# NFC Sticker Identification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate client-side Web NFC reading and writing capabilities to allow tablets to identify users and program NFC stickers natively in the browser alongside standard RFID cards.

**Architecture:** Use React hooks to wrap browser-native `NDEFReader` APIs. In the Kiosk, NFC scanning auto-starts on first user interaction with a manual status/retry button in the header. In the Admin Panel, managers can write card IDs to tags and scan tags to auto-fill the RFID field during registration.

**Tech Stack:** React, TypeScript, Web NFC API (`NDEFReader`), Vitest, React Testing Library.

## Global Constraints
* All web UI updates must run correctly in HTTPS secure context.
* Support graceful degradation when `NDEFReader` is not available in the current browser/device.
* No direct backend modifications required; reuse the existing card ID validation endpoints.

---

### Task 1: NFC Scanner Hook (`useNfcScanner`)

**Files:**
- Create: `src/hooks/useNfcScanner.ts`
- Test: `src/hooks/useNfcScanner.test.ts`

**Interfaces:**
- Consumes: None
- Produces: `useNfcScanner(options: UseNfcScannerOptions) => UseNfcScannerResult`

```typescript
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
```

- [ ] **Step 1: Write the failing test**
  Create `src/hooks/useNfcScanner.test.ts`:
  ```typescript
  import { describe, it, expect, vi, beforeEach } from 'vitest';
  import { renderHook, act } from '@testing-library/react';
  import { useNfcScanner } from './useNfcScanner';

  describe('useNfcScanner', () => {
    beforeEach(() => {
      vi.stubGlobal('NDEFReader', undefined);
    });

    it('should report unsupported when NDEFReader is not in window', () => {
      const { result } = renderHook(() => useNfcScanner({ onScan: () => {}, active: true }));
      expect(result.current.supported).toBe(false);
    });
  });
  ```

- [ ] **Step 2: Run test to verify it fails**
  Run: `npx vitest run src/hooks/useNfcScanner.test.ts`
  Expected: FAIL with compilation/import error for `useNfcScanner`

- [ ] **Step 3: Write minimal implementation**
  Create `src/hooks/useNfcScanner.ts`:
  ```typescript
  import { useState, useEffect, useCallback, useRef } from 'react';
  import { UseNfcScannerOptions, UseNfcScannerResult } from './useNfcScanner.types';

  export function useNfcScanner({ onScan, active }: UseNfcScannerOptions): UseNfcScannerResult {
    const [supported] = useState(() => typeof window !== 'undefined' && 'NDEFReader' in window);
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
  ```

- [ ] **Step 4: Run test to verify it passes**
  Run: `npx vitest run src/hooks/useNfcScanner.test.ts`
  Expected: PASS

- [ ] **Step 5: Commit**
  ```bash
  git add src/hooks/useNfcScanner.ts src/hooks/useNfcScanner.test.ts
  git commit -m "feat: add useNfcScanner hook for client-side Web NFC reading"
  ```

---

### Task 2: Kiosk UI NFC Reader Integration

**Files:**
- Create: `src/components/kiosk/NfcStatusButton.tsx`
- Modify: `src/components/kiosk/KioskView.tsx`
- Test: `src/components/kiosk/NfcStatusButton.test.tsx`

**Interfaces:**
- Consumes: `useNfcScanner`
- Produces: Visual NFC signal status indicator in Kiosk header

- [ ] **Step 1: Write the failing test**
  Create `src/components/kiosk/NfcStatusButton.test.tsx`:
  ```typescript
  import React from 'react';
  import { describe, it, expect, vi } from 'vitest';
  import { render, screen, fireEvent } from '@testing-library/react';
  import { NfcStatusButton } from './NfcStatusButton';

  describe('NfcStatusButton', () => {
    it('should call initialize on click', () => {
      const initSpy = vi.fn();
      render(<NfcStatusButton supported={true} scanning={true} error={null} onInit={initSpy} />);
      const btn = screen.getByRole('button');
      fireEvent.click(btn);
      expect(initSpy).toHaveBeenCalled();
    });
  });
  ```

- [ ] **Step 2: Run test to verify it fails**
  Run: `npx vitest run src/components/kiosk/NfcStatusButton.test.tsx`
  Expected: FAIL with compilation/import error for `NfcStatusButton`

- [ ] **Step 3: Write minimal implementation**
  Create `src/components/kiosk/NfcStatusButton.tsx`:
  ```typescript
  import React from 'react';
  import { Wifi, AlertCircle } from 'lucide-react';

  interface NfcStatusButtonProps {
    supported: boolean;
    scanning: boolean;
    error: string | null;
    onInit: () => void;
  }

  export function NfcStatusButton({ supported, scanning, error, onInit }: NfcStatusButtonProps) {
    if (!supported) return null;

    let color = 'text-neutral-400';
    let icon = <Wifi className="w-5 h-5" />;
    
    if (scanning) {
      color = 'text-green-500 animate-pulse';
    } else if (error) {
      color = 'text-red-500';
      icon = <AlertCircle className="w-5 h-5" />;
    }

    return (
      <button
        onClick={onInit}
        className={`p-2 rounded-xl hover:bg-neutral-100 transition-all ${color}`}
        title={error || (scanning ? 'NFC Scanning Active' : 'NFC Inactive (Tap to scan)')}
      >
        {icon}
      </button>
    );
  }
  ```
  Integrate `useNfcScanner` and `NfcStatusButton` inside `KioskView.tsx`.

- [ ] **Step 4: Run test to verify it passes**
  Run: `npx vitest run src/components/kiosk/NfcStatusButton.test.tsx`
  Expected: PASS

- [ ] **Step 5: Commit**
  ```bash
  git add src/components/kiosk/NfcStatusButton.tsx src/components/kiosk/NfcStatusButton.test.tsx src/components/kiosk/KioskView.tsx
  git commit -m "feat: add nfc status button and integrate useNfcScanner in KioskView"
  ```

---

### Task 3: NFC Writer Hook & Admin Write Modal

**Files:**
- Create: `src/hooks/useNfcWriter.ts`
- Create: `src/components/manager/modals/NfcWriteModal.tsx`
- Modify: `src/components/manager/tabs/CardsTab.tsx`

**Interfaces:**
- Consumes: None
- Produces: `useNfcWriter() => UseNfcWriterResult` and programming trigger in Cards table

- [ ] **Step 1: Write the failing test**
  Create `src/hooks/useNfcWriter.test.ts` (skeleton or minimal mockup testing):
  ```typescript
  import { describe, it, expect } from 'vitest';
  import { renderHook } from '@testing-library/react';
  import { useNfcWriter } from './useNfcWriter';

  describe('useNfcWriter', () => {
    it('should report idle initially', () => {
      const { result } = renderHook(() => useNfcWriter());
      expect(result.current.writeStatus).toBe('idle');
    });
  });
  ```

- [ ] **Step 2: Run test to verify it fails**
  Run: `npx vitest run src/hooks/useNfcWriter.test.ts`
  Expected: FAIL

- [ ] **Step 3: Write minimal implementation**
  Create `src/hooks/useNfcWriter.ts`:
  ```typescript
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
  ```
  Create `src/components/manager/modals/NfcWriteModal.tsx` and integrate the trigger button inside `CardsTab.tsx`.

- [ ] **Step 4: Run test to verify it passes**
  Run: `npx vitest run src/hooks/useNfcWriter.test.ts`
  Expected: PASS

- [ ] **Step 5: Commit**
  ```bash
  git add src/hooks/useNfcWriter.ts src/components/manager/modals/NfcWriteModal.tsx src/components/manager/tabs/CardsTab.tsx
  git commit -m "feat: add nfc writing capability and programming modal to Cards tab"
  ```

---

### Task 4: Card Form NFC Scanning (RFID Auto-populate)

**Files:**
- Modify: `src/components/manager/tabs/CardsTab.tsx`

**Interfaces:**
- Consumes: `useNfcScanner`
- Produces: Scanning helper triggers in Add/Edit card forms

- [ ] **Step 1: Write the failing test**
  Add test behavior verifying that tag scanned triggers filling inputs inside `CardsTab.tsx` or its subcomponents.

- [ ] **Step 2: Run test to verify it fails**
  Run: `npx vitest run src/components/manager/tabs/CardsTab.test.tsx`
  Expected: FAIL (or verify original suite remains sound before change)

- [ ] **Step 3: Write minimal implementation**
  Add scanner triggers and status indicators inside the Add/Edit Card Modal forms in `CardsTab.tsx` to read tags and auto-fill the RFID field with target IDs.

- [ ] **Step 4: Run test to verify it passes**
  Run: `npx vitest run src/components/manager/tabs/CardsTab.test.tsx`
  Expected: PASS

- [ ] **Step 5: Commit**
  ```bash
  git add src/components/manager/tabs/CardsTab.tsx
  git commit -m "feat: add nfc auto-populate support inside Add/Edit card forms"
  ```
