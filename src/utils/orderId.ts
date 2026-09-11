/**
 * Identifier for one order attempt, so the server can recognise a replay.
 *
 * Deliberately not `crypto.randomUUID()`: that is only exposed in a secure
 * context, and the kiosks run over plain http on the LAN (http://<ip>:3400),
 * where it is undefined. `crypto.getRandomValues` has no such restriction, and
 * a time prefix keeps ids roughly ordered and readable in the orders table.
 */
export const newClientOrderId = (): string => {
  const stamp = Date.now().toString(36);
  return `ord-${stamp}-${randomSuffix()}`;
};

const randomSuffix = (): string => {
  const cryptoObj = typeof globalThis !== 'undefined' ? (globalThis as any).crypto : undefined;
  if (cryptoObj?.getRandomValues) {
    const bytes = new Uint8Array(12);
    cryptoObj.getRandomValues(bytes);
    return Array.from(bytes, (b: number) => b.toString(16).padStart(2, '0')).join('');
  }
  // Only reachable on a browser too old to have Web Crypto at all.
  return `${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
};
