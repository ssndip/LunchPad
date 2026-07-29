import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useNfcScanner } from './useNfcScanner';

describe('useNfcScanner', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    delete (window as any).NDEFReader;
  });

  it('should report unsupported when NDEFReader is not in window', () => {
    const { result } = renderHook(() => useNfcScanner({ onScan: () => {}, active: true }));
    expect(result.current.supported).toBe(false);
  });

  it('should report supported when NDEFReader is present', () => {
    class MockNDEFReader {
      scan = vi.fn().mockResolvedValue(undefined);
      onreading: ((event: any) => void) | null = null;
    }
    vi.stubGlobal('NDEFReader', MockNDEFReader);

    const { result } = renderHook(() => useNfcScanner({ onScan: () => {}, active: true }));
    expect(result.current.supported).toBe(true);
  });

  it('should initialize scanner on gesture and process text record', async () => {
    let mockInstance: any;
    class MockNDEFReader {
      scan = vi.fn().mockResolvedValue(undefined);
      onreading: ((event: any) => void) | null = null;
      constructor() {
        mockInstance = this;
      }
    }
    vi.stubGlobal('NDEFReader', MockNDEFReader);

    const onScan = vi.fn();
    const { result } = renderHook(() => useNfcScanner({ onScan, active: true }));

    await act(async () => {
      window.dispatchEvent(new Event('pointerdown'));
    });

    expect(mockInstance.scan).toHaveBeenCalled();
    expect(result.current.scanning).toBe(true);

    // Simulate reading event with text record (using toText helper)
    act(() => {
      mockInstance.onreading({
        message: {
          records: [
            {
              recordType: 'text',
              data: new TextEncoder().encode('CARD12345'),
              toText: () => 'CARD12345',
            },
          ],
        },
      });
    });

    expect(onScan).toHaveBeenCalledWith('CARD12345');
  });

  it('should fallback to TextDecoder if record.toText is not available', async () => {
    let mockInstance: any;
    class MockNDEFReader {
      scan = vi.fn().mockResolvedValue(undefined);
      onreading: ((event: any) => void) | null = null;
      constructor() {
        mockInstance = this;
      }
    }
    vi.stubGlobal('NDEFReader', MockNDEFReader);

    const onScan = vi.fn();
    renderHook(() => useNfcScanner({ onScan, active: true }));

    await act(async () => {
      window.dispatchEvent(new Event('pointerdown'));
    });

    const encoder = new TextEncoder();
    act(() => {
      mockInstance.onreading({
        message: {
          records: [
            {
              recordType: 'text',
              data: encoder.encode('CARD67890'),
              // no toText method
            },
          ],
        },
      });
    });

    expect(onScan).toHaveBeenCalledWith('CARD67890');
  });

  it('should fallback to serialNumber if text record is absent', async () => {
    let mockInstance: any;
    class MockNDEFReader {
      scan = vi.fn().mockResolvedValue(undefined);
      onreading: ((event: any) => void) | null = null;
      constructor() {
        mockInstance = this;
      }
    }
    vi.stubGlobal('NDEFReader', MockNDEFReader);

    const onScan = vi.fn();
    renderHook(() => useNfcScanner({ onScan, active: true }));

    await act(async () => {
      window.dispatchEvent(new Event('keydown'));
    });

    act(() => {
      mockInstance.onreading({
        serialNumber: '04:A1:B2:C3:D4:E5:F6',
      });
    });

    expect(onScan).toHaveBeenCalledWith('04a1b2c3d4e5f6');
  });

  it('should invoke latest onScan callback even when onScan prop changes (stale closure test)', async () => {
    let mockInstance: any;
    class MockNDEFReader {
      scan = vi.fn().mockResolvedValue(undefined);
      onreading: ((event: any) => void) | null = null;
      constructor() {
        mockInstance = this;
      }
    }
    vi.stubGlobal('NDEFReader', MockNDEFReader);

    const initialOnScan = vi.fn();
    const updatedOnScan = vi.fn();

    const { rerender } = renderHook(
      ({ onScan }) => useNfcScanner({ onScan, active: true }),
      { initialProps: { onScan: initialOnScan } }
    );

    await act(async () => {
      window.dispatchEvent(new Event('pointerdown'));
    });

    rerender({ onScan: updatedOnScan });

    act(() => {
      mockInstance.onreading({
        message: {
          records: [{ recordType: 'text', data: new TextEncoder().encode('CARD999'), toText: () => 'CARD999' }],
        },
      });
    });

    expect(initialOnScan).not.toHaveBeenCalled();
    expect(updatedOnScan).toHaveBeenCalledWith('CARD999');
  });

  it('should set error state when scan fails', async () => {
    class MockNDEFReader {
      scan = vi.fn().mockRejectedValue(new Error('Permission denied'));
    }
    vi.stubGlobal('NDEFReader', MockNDEFReader);

    const { result } = renderHook(() => useNfcScanner({ onScan: () => {}, active: true }));

    await act(async () => {
      await result.current.initialize();
    });

    expect(result.current.scanning).toBe(false);
    expect(result.current.error).toBe('Permission denied');
  });
});
