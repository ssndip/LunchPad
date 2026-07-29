import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useNfcWriter } from './useNfcWriter';

describe('useNfcWriter', () => {
  const originalNDEFReader = (window as any).NDEFReader;

  afterEach(() => {
    if (originalNDEFReader !== undefined) {
      (window as any).NDEFReader = originalNDEFReader;
    } else {
      delete (window as any).NDEFReader;
    }
  });

  it('should report idle initially', () => {
    const { result } = renderHook(() => useNfcWriter());
    expect(result.current.writeStatus).toBe('idle');
    expect(result.current.errorMessage).toBeNull();
  });

  it('should set error status if NDEFReader is not supported', async () => {
    delete (window as any).NDEFReader;
    const { result } = renderHook(() => useNfcWriter());

    await act(async () => {
      await result.current.writeId('TEST-CARD-123');
    });

    expect(result.current.writeStatus).toBe('error');
    expect(result.current.errorMessage).toBe('NFC Writing not supported on this browser/device.');
  });

  it('should successfully write when NDEFReader write resolves', async () => {
    const mockWrite = vi.fn().mockResolvedValue(undefined);
    (window as any).NDEFReader = class {
      write = mockWrite;
    };

    const { result } = renderHook(() => useNfcWriter());

    await act(async () => {
      await result.current.writeId('CARD-999');
    });

    expect(mockWrite).toHaveBeenCalledWith(
      { records: [{ recordType: 'text', data: 'CARD-999' }] },
      { signal: expect.any(AbortSignal) }
    );
    expect(result.current.writeStatus).toBe('success');
    expect(result.current.errorMessage).toBeNull();
  });

  it('should set error status if NDEFReader write throws non-abort error', async () => {
    const mockWrite = vi.fn().mockRejectedValue(new Error('Tag disconnected'));
    (window as any).NDEFReader = class {
      write = mockWrite;
    };

    const { result } = renderHook(() => useNfcWriter());

    await act(async () => {
      await result.current.writeId('CARD-999');
    });

    expect(result.current.writeStatus).toBe('error');
    expect(result.current.errorMessage).toBe('Tag disconnected');
  });

  it('should ignore AbortError gracefully without setting error status', async () => {
    const abortError = new Error('The operation was aborted');
    abortError.name = 'AbortError';
    const mockWrite = vi.fn().mockRejectedValue(abortError);
    (window as any).NDEFReader = class {
      write = mockWrite;
    };

    const { result } = renderHook(() => useNfcWriter());

    await act(async () => {
      await result.current.writeId('CARD-999');
    });

    // Should stay waiting (or not change to error)
    expect(result.current.writeStatus).not.toBe('error');
    expect(result.current.errorMessage).toBeNull();
  });

  it('should reset write status and abort pending write', async () => {
    let capturedSignal: AbortSignal | undefined;
    const mockWrite = vi.fn().mockImplementation((_opts, options) => {
      capturedSignal = options?.signal;
      return new Promise(() => {}); // never resolves to simulate pending
    });
    (window as any).NDEFReader = class {
      write = mockWrite;
    };

    const { result } = renderHook(() => useNfcWriter());

    act(() => {
      result.current.writeId('CARD-123');
    });

    expect(result.current.writeStatus).toBe('waiting');
    expect(capturedSignal?.aborted).toBe(false);

    act(() => {
      result.current.reset();
    });

    expect(result.current.writeStatus).toBe('idle');
    expect(result.current.errorMessage).toBeNull();
    expect(capturedSignal?.aborted).toBe(true);
  });

  it('should abort pending write on unmount', async () => {
    let capturedSignal: AbortSignal | undefined;
    const mockWrite = vi.fn().mockImplementation((_opts, options) => {
      capturedSignal = options?.signal;
      return new Promise(() => {});
    });
    (window as any).NDEFReader = class {
      write = mockWrite;
    };

    const { result, unmount } = renderHook(() => useNfcWriter());

    act(() => {
      result.current.writeId('CARD-123');
    });

    expect(capturedSignal?.aborted).toBe(false);

    unmount();

    expect(capturedSignal?.aborted).toBe(true);
  });
});
