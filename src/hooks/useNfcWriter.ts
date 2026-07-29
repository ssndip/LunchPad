import { useState, useCallback, useRef, useEffect } from 'react';

export function useNfcWriter() {
  const [writeStatus, setWriteStatus] = useState<'idle' | 'waiting' | 'writing' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setWriteStatus('idle');
    setErrorMessage(null);
  }, []);

  const writeId = useCallback(async (id: string) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setErrorMessage(null);
    if (typeof window === 'undefined' || !('NDEFReader' in window)) {
      setWriteStatus('error');
      setErrorMessage('NFC Writing not supported on this browser/device.');
      return;
    }
    try {
      setWriteStatus('waiting');
      const NDEF = (window as any).NDEFReader;
      const ndef = new NDEF();
      await ndef.write(
        { records: [{ recordType: 'text', data: id }] },
        { signal: controller.signal }
      );
      if (!controller.signal.aborted) {
        setWriteStatus('success');
      }
    } catch (err: any) {
      if (err.name === 'AbortError' || controller.signal.aborted) {
        return;
      }
      setWriteStatus('error');
      setErrorMessage(err.message || 'Failed to write NFC tag');
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
    }
  }, []);

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, []);

  return { writeId, writeStatus, errorMessage, reset };
}
