/**
 * useRfidScanner.ts — Feature 2 & 3: Global RFID keyboard capture hook.
 *
 * RFID scanners emulate a keyboard: they rapidly type a string then send Enter.
 * This hook listens globally on `document` for that pattern. It is safe to use
 * alongside regular inputs — it will not steal characters from focused <input>
 * or <textarea> elements; it only fires `onScan` when Enter arrives.
 */
import { useEffect, useRef, useCallback } from 'react';

const MIN_RFID_LENGTH = 4;

interface UseRfidScannerOptions {
  /** Scan callback — receives the cleaned RFID string */
  onScan: (rfid: string) => void;
  /** When false the listener is detached entirely */
  active: boolean;
  /** Minimum characters to be considered a valid RFID (default 4) */
  minLength?: number;
}

export function useRfidScanner({
  onScan,
  active,
  minLength = MIN_RFID_LENGTH,
}: UseRfidScannerOptions) {
  // Buffer accumulates rapid keystrokes
  const bufferRef = useRef('');
  const firstKeyTimeRef = useRef<number>(0);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Don't intercept when a real input/textarea is focused
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        // Still detect Enter from the target if it's our own hidden input (no value typed by user)
        // We skip it here — KioskOrderBar has its own explicit onKeyDown handler.
        return;
      }

      if (e.key === 'Enter') {
        const raw = bufferRef.current
          .trim()
          .replace(/[^\x20-\x7E]/g, '')
          .toLowerCase();
        const bufferLength = bufferRef.current.length;
        const totalDuration = Date.now() - firstKeyTimeRef.current;
        bufferRef.current = '';
        if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
        
        // Differentiate hardware scanner (rapid successive keystrokes) from manual human typing
        const averageDelay = bufferLength > 0 ? totalDuration / bufferLength : 0;
        if (raw.length >= minLength && averageDelay < 100) {
          onScan(raw);
        }
        return;
      }

      // Accumulate printable characters
      if (e.key.length === 1) {
        if (bufferRef.current === '') {
          firstKeyTimeRef.current = Date.now();
        }
        bufferRef.current += e.key;
        // Auto-clear buffer after 2 s of inactivity (no Enter received)
        if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
        resetTimerRef.current = setTimeout(() => {
          bufferRef.current = '';
        }, 2000);
      }
    },
    [onScan, minLength],
  );

  useEffect(() => {
    if (!active) {
      bufferRef.current = '';
      return;
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      bufferRef.current = '';
    };
  }, [active, handleKeyDown]);
}
