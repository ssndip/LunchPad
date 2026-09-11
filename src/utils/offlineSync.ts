/**
 * offlineSync.ts — Replay of orders taken while the kiosk was offline.
 *
 * Split out of useSyncState so the decision "retry, accept, or give up" is a
 * pure function that can be tested without a store or a live WebSocket.
 *
 * The rule is that an order is never discarded silently. Every queued order
 * ends up in exactly one of three places: accepted by the server, still pending
 * for a later attempt, or recorded as failed with a reason someone can act on.
 */
import type { OfflineOrder } from '../store/slices/orderSlice';

/**
 * How long a queued order stays meaningful. Past this it is not replayed at
 * all: a canteen order from yesterday must not quietly charge someone today,
 * and the menu it was priced against is long gone.
 */
export const MAX_QUEUE_AGE_MS = 24 * 60 * 60 * 1000;

export interface FailedOrder extends OfflineOrder {
  /** Why the server refused it, in words that can be shown to a person. */
  reason: string;
  failedAt: number;
}

export interface SyncOutcome {
  /** Still worth another attempt, in their original order. */
  pending: OfflineOrder[];
  /** Refused for good. These need a human, not another retry. */
  failed: FailedOrder[];
  syncedCount: number;
}

/**
 * Statuses that mean "not now" rather than "never".
 *
 * 429 covers the server's duplicate-tap guard, which fires when two orders from
 * the same card replay within three seconds of each other — the second order is
 * genuine and must survive. Anything >= 500 is the server struggling.
 */
const isRetryableStatus = (status: number) => status === 429 || status >= 500;

/** Pull a human-readable reason out of an error body without trusting it. */
const reasonFrom = async (res: Response): Promise<string> => {
  try {
    const body = await res.json();
    const reason = body?.error || body?.message;
    if (reason) return String(reason);
  } catch {
    // Not JSON — a proxy error page, or an empty body.
  }
  return `Rejected by server (HTTP ${res.status})`;
};

/**
 * Replay `queue` in order, stopping at the first sign the server is not ready
 * so later orders keep their place rather than burning their one attempt.
 */
export async function syncOfflineOrders(
  queue: OfflineOrder[],
  submit: (order: OfflineOrder) => Promise<Response>,
): Promise<SyncOutcome> {
  const pending: OfflineOrder[] = [];
  const failed: FailedOrder[] = [];
  let syncedCount = 0;
  let stopped = false;

  for (const order of queue) {
    // Once the server has shown it cannot take orders, everything behind this
    // point stays queued untouched.
    if (stopped) {
      pending.push(order);
      continue;
    }

    // Its PIN was stripped before the queue was written to disk and the page
    // has since reloaded, so there is no credential to send. Replaying it
    // without one would just be rejected; say so instead.
    if (order.pinRedacted && !order.pin) {
      failed.push({
        ...order,
        reason: 'PIN order could not be recovered after the page reloaded',
        failedAt: Date.now(),
      });
      continue;
    }

    if (Date.now() - order.timestamp > MAX_QUEUE_AGE_MS) {
      failed.push({ ...order, reason: 'Expired before it could be synced', failedAt: Date.now() });
      continue;
    }

    let res: Response;
    try {
      res = await submit(order);
    } catch {
      // Still offline. Keep this one and stop trying.
      pending.push(order);
      stopped = true;
      continue;
    }

    if (res.ok) {
      syncedCount += 1;
      continue;
    }

    if (isRetryableStatus(res.status)) {
      pending.push(order);
      stopped = true;
      continue;
    }

    // A permanent refusal. Record it and carry on — the orders behind it are
    // unrelated and may well be fine.
    failed.push({ ...order, reason: await reasonFrom(res), failedAt: Date.now() });
  }

  return { pending, failed, syncedCount };
}
