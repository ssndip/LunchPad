import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { triggerHaptic } from './haptics';

describe('triggerHaptic', () => {
  let originalNavigator: any;
  let originalWindow: any;

  beforeEach(() => {
    originalNavigator = global.navigator;
    originalWindow = global.window;

    Object.defineProperty(global, 'navigator', {
      value: {
        vibrate: vi.fn(),
      },
      writable: true,
      configurable: true,
    });

    Object.defineProperty(global, 'window', {
      value: {},
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(global, 'navigator', {
      value: originalNavigator,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(global, 'window', {
      value: originalWindow,
      writable: true,
      configurable: true,
    });
    vi.clearAllMocks();
  });

  it('defaults to light type if no arguments provided', () => {
    triggerHaptic();
    expect(navigator.vibrate).toHaveBeenCalledWith(10);
  });

  it('calls vibrate with 10 for light', () => {
    triggerHaptic('light');
    expect(navigator.vibrate).toHaveBeenCalledWith(10);
  });

  it('calls vibrate with 20 for medium', () => {
    triggerHaptic('medium');
    expect(navigator.vibrate).toHaveBeenCalledWith(20);
  });

  it('calls vibrate with 50 for heavy', () => {
    triggerHaptic('heavy');
    expect(navigator.vibrate).toHaveBeenCalledWith(50);
  });

  it('calls vibrate with [10, 50, 30] for success', () => {
    triggerHaptic('success');
    expect(navigator.vibrate).toHaveBeenCalledWith([10, 50, 30]);
  });

  it('calls vibrate with [30, 40, 30, 40, 50] for error', () => {
    triggerHaptic('error');
    expect(navigator.vibrate).toHaveBeenCalledWith([30, 40, 30, 40, 50]);
  });

  it('does nothing if navigator is undefined', () => {
    Object.defineProperty(global, 'navigator', {
      value: undefined,
      writable: true,
      configurable: true,
    });
    expect(() => triggerHaptic('light')).not.toThrow();
  });

  it('does nothing if navigator.vibrate is undefined', () => {
    Object.defineProperty(global, 'navigator', {
      value: {},
      writable: true,
      configurable: true,
    });
    expect(() => triggerHaptic('light')).not.toThrow();
  });

  it('does nothing if window is undefined', () => {
    Object.defineProperty(global, 'window', {
      value: undefined,
      writable: true,
      configurable: true,
    });

    expect(() => triggerHaptic('light')).not.toThrow();
    expect(global.navigator.vibrate).not.toHaveBeenCalled();
  });

  it('catches and ignores errors thrown by navigator.vibrate', () => {
    global.navigator.vibrate = vi.fn().mockImplementation(() => {
      throw new Error('Vibrate error');
    });

    expect(() => triggerHaptic('light')).not.toThrow();
    expect(global.navigator.vibrate).toHaveBeenCalled();
  });
});
