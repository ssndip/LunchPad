import { useState, useCallback } from 'react';

export function useNfcWriter() {
  const [writeStatus, setWriteStatus] = useState<'idle' | 'waiting' | 'writing' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const writeId = useCallback(async (id: string) => {
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
      await ndef.write({
        records: [{ recordType: 'text', data: id }]
      });
      setWriteStatus('success');
    } catch (err: any) {
      setWriteStatus('error');
      setErrorMessage(err.message || 'Failed to write NFC tag');
    }
  }, []);

  const reset = useCallback(() => {
    setWriteStatus('idle');
    setErrorMessage(null);
  }, []);

  return { writeId, writeStatus, errorMessage, reset };
}
