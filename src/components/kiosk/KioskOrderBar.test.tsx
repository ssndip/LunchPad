import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitForElementToBeRemoved } from '@testing-library/react';
import { KioskOrderBar } from './KioskOrderBar';
import { CartItem } from '../../types';

const t = (k: string) => k;

const item = (id: number, name: string): CartItem => ({
  id,
  name,
  price: 5,
  basePrice: 5,
  available: true,
  category: 'Main',
  tags: [],
  extraFees: [],
  quantity: 1,
});

const base = {
  selectedItems: [item(1, 'Soup'), item(2, 'Salad')],
  totalPrice: 10,
  rfid: 'abc',
  setRfid: vi.fn(),
  rfidInputRef: React.createRef<HTMLInputElement>(),
  isScanning: false,
  computedKioskOpen: true,
  testModeEnabled: false,
  orderButtonEnabled: true,
  onOrder: vi.fn(),
  onClearCart: vi.fn(),
  onChangeSide: vi.fn(),
  t,
};

describe('KioskOrderBar', () => {
  it('renders nothing with an empty cart', () => {
    render(<KioskOrderBar {...base} selectedItems={[]} />);
    expect(screen.queryByText('kiosk.place_order')).not.toBeInTheDocument();
  });

  it('shows the total and the order button while collapsed', () => {
    render(<KioskOrderBar {...base} />);
    expect(screen.getByText('€10.00')).toBeInTheDocument();
    expect(screen.getByText('kiosk.place_order')).toBeInTheDocument();
  });

  it('hides the item list until expanded', () => {
    render(<KioskOrderBar {...base} />);
    expect(screen.queryByText('Soup')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('order-bar-toggle'));
    expect(screen.getByText('Soup')).toBeInTheDocument();
    expect(screen.getByText('Salad')).toBeInTheDocument();
  });

  it('collapses again on a second tap', async () => {
    render(<KioskOrderBar {...base} />);
    fireEvent.click(screen.getByTestId('order-bar-toggle'));
    fireEvent.click(screen.getByTestId('order-bar-toggle'));
    // The list exits via a height/opacity animation (motion/react), so its
    // node leaves the DOM asynchronously once the exit transition resolves,
    // not synchronously on the click that triggers it.
    await waitForElementToBeRemoved(() => screen.queryByText('Soup'));
    expect(screen.queryByText('Soup')).not.toBeInTheDocument();
  });

  it('keeps the order button reachable without expanding', () => {
    render(<KioskOrderBar {...base} />);
    fireEvent.click(screen.getByText('kiosk.place_order'));
    expect(base.onOrder).toHaveBeenCalled();
  });

  it('exposes the toggle state to assistive tech', () => {
    render(<KioskOrderBar {...base} />);
    const toggle = screen.getByTestId('order-bar-toggle');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
  });
});
