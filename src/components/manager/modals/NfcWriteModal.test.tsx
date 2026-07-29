import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { NfcWriteModal } from './NfcWriteModal';
import { Card } from '../../../types';

const testCard: Card = {
  rfid: '12345678',
  ownerName: 'Alice',
  balance: 0,
  isAdmin: false
};

describe('NfcWriteModal', () => {
  const originalNDEF = (window as any).NDEFReader;

  afterEach(() => {
    if (originalNDEF !== undefined) {
      (window as any).NDEFReader = originalNDEF;
    } else {
      delete (window as any).NDEFReader;
    }
  });

  it('renders nothing when card is null', () => {
    const { container } = render(<NfcWriteModal card={null} onClose={() => {}} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders modal with card info when card is provided', () => {
    delete (window as any).NDEFReader;
    render(<NfcWriteModal card={testCard} onClose={() => {}} />);

    expect(screen.getByText(/Alice/)).toBeInTheDocument();
    expect(screen.getAllByText(/12345678/).length).toBeGreaterThan(0);
  });

  it('calls onClose when Cancel/Close button is clicked', () => {
    delete (window as any).NDEFReader;
    const onCloseMock = vi.fn();
    render(<NfcWriteModal card={testCard} onClose={onCloseMock} />);

    const cancelBtn = screen.getByText(/Cancel|Отказ/i);
    fireEvent.click(cancelBtn);

    expect(onCloseMock).toHaveBeenCalled();
  });

  it('displays success state when NDEFReader write resolves', async () => {
    const mockWrite = vi.fn().mockResolvedValue(undefined);
    (window as any).NDEFReader = class {
      write = mockWrite;
    };

    render(<NfcWriteModal card={testCard} onClose={() => {}} />);

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(screen.getByText(/Tag Written Successfully|Стикерът е записан успешно/i)).toBeInTheDocument();
  });
});
