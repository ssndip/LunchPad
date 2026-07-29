import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { KioskView } from './KioskView';

const mockProps = {
  menu: [],
  groupedMenu: {},
  sideItems: [],
  selectedItems: [],
  selectedItemIds: new Set<number>(),
  totalPrice: 0,
  rfid: '',
  setRfid: vi.fn(),
  isScanning: false,
  showSuccess: false,
  successMessage: null,
  error: null,
  connectionError: null,
  orderButtonEnabled: true,
  testModeEnabled: false,
  computedKioskOpen: true,
  kioskAutoTiming: false,
  kioskCloseTime: '16:00',
  onToggleItem: vi.fn(),
  onAddWithSide: vi.fn(),
  onUpdateQuantity: vi.fn(),
  onOrder: vi.fn(),
  onClearCart: vi.fn(),
  onGoToManager: vi.fn(),
};

describe('KioskView', () => {
  it('adds kiosk-mode class to document.body when rendered and removes it on unmount', () => {
    expect(document.body.classList.contains('kiosk-mode')).toBe(false);
    
    const { unmount } = render(<KioskView {...mockProps} />);
    
    expect(document.body.classList.contains('kiosk-mode')).toBe(true);
    
    unmount();
    
    expect(document.body.classList.contains('kiosk-mode')).toBe(false);
  });
});
