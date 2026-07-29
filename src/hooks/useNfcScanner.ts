import { useState, useEffect, useCallback, useRef } from 'react';

export interface UseNfcScannerOptions {
  onScan: (id: string) => void;
  active: boolean;
}

export interface UseNfcScannerResult {
  supported: boolean;
  scanning: boolean;
  error: string | null;
  initialize: () => Promise<void>;
}

export function useNfcScanner({ onScan, active }: UseNfcScannerOptions): UseNfcScannerResult {
  const [supported] = useState(() => typeof window !== 'undefined' && 'NDEFReader' in window && (window as any).NDEFReader !== undefined);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const initializedRef = useRef(false);

  const initialize = useCallback(async () => {
    if (!supported || !active) return;
    setError(null);
    try {
      const NDEF = (window as any).NDEFReader;
      const reader = new NDEF();
      await reader.scan();
      setScanning(true);
      reader.onreading = (event: any) => {
        let cardId = '';
        const decoder = new TextDecoder();
        
        if (event.message?.records) {
          for (const record of event.message.records) {
            if (record.recordType === 'text') {
              cardId = decoder.decode(record.data);
              break;
            }
          }
        }

        if (!cardId && event.serialNumber) {
          cardId = event.serialNumber.replace(/:/g, '').toLowerCase();
        }

        if (cardId) {
          onScan(cardId);
        }
      };
    } catch (err: any) {
      setScanning(false);
      setError(err.message || 'NFC Scan Failed');
    }
  }, [supported, active, onScan]);

  useEffect(() => {
    if (!supported || !active || initializedRef.current) return;
    
    const onGesture = () => {
      if (!initializedRef.current) {
        initializedRef.current = true;
        initialize();
        window.removeEventListener('pointerdown', onGesture);
        window.removeEventListener('keydown', onGesture);
      }
    };

    window.addEventListener('pointerdown', onGesture);
    window.addEventListener('keydown', onGesture);
    
    return () => {
      window.removeEventListener('pointerdown', onGesture);
      window.removeEventListener('keydown', onGesture);
    };
  }, [supported, active, initialize]);

  return { supported, scanning, error, initialize };
}
