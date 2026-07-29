import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { KioskView } from './KioskView';
import { useStore } from '../../store/useStore';

const mockProps = {
  menu: [],
  groupedMenu: {},
  sideItems: [],
  selectedItems: [{ id: 1, name: 'Item 1', basePrice: 5, price: 5, available: true, category: 'Main', tags: [], extraFees: [], quantity: 1 }],
  selectedItemIds: new Set<number>([1]),
  totalPrice: 5,
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
  beforeEach(() => {
    localStorage.clear();
    useStore.setState({ error: null });
    vi.clearAllMocks();
  });

  it('adds kiosk-mode class to document.body when rendered and removes it on unmount', () => {
    expect(document.body.classList.contains('kiosk-mode')).toBe(false);
    
    const { unmount } = render(<KioskView {...mockProps} />);
    
    expect(document.body.classList.contains('kiosk-mode')).toBe(true);
    
    unmount();
    
    expect(document.body.classList.contains('kiosk-mode')).toBe(false);
  });

  it('blocks unregistered card scans when offline', () => {
    localStorage.setItem('lunchpad_valid_rfids', JSON.stringify(['validcard123']));
    
    render(<KioskView {...mockProps} connectionError="Network Error" />);

    const now = Date.now();
    const keys = 'unknown999'.split('');
    keys.forEach((key, index) => {
      fireEvent.keyDown(document, { key, timeStamp: now + index * 10 });
    });
    fireEvent.keyDown(document, { key: 'Enter', timeStamp: now + keys.length * 10 });

    expect(useStore.getState().error).toBe('Card not registered (offline)');
    expect(mockProps.onOrder).not.toHaveBeenCalled();
  });
});
