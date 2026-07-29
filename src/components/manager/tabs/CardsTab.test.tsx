import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { CardsTab } from './CardsTab';
import * as useNfcScannerModule from '../../../hooks/useNfcScanner';

const defaultProps = {
  cards: [
    { rfid: 'card1', ownerName: 'Alice', balance: 10, isAdmin: false }
  ],
  onUpdateSingleCard: vi.fn().mockResolvedValue(true),
  onRemoveCard: vi.fn(),
  onResetCardBalance: vi.fn(),
  onResetAllBalances: vi.fn(),
  onAddManualCard: vi.fn(),
  onBatchAddCards: vi.fn(),
  newCardRfid: '',
  setNewCardRfid: vi.fn(),
  newCardOwner: '',
  setNewCardOwner: vi.fn(),
  newCardIsAdmin: false,
  setNewCardIsAdmin: vi.fn(),
  newCardPin: '',
  setNewCardPin: vi.fn(),
  lastScanned: null,
  isScanning: false,
  setIsScanning: vi.fn(),
  pasteCardsText: '',
  setPasteCardsText: vi.fn(),
  isPasteCardsModalOpen: false,
  setIsPasteCardsModalOpen: vi.fn(),
};

describe('CardsTab - NFC Scanning in Card Forms', () => {
  let onScanCallback: ((id: string) => void) | null = null;
  const mockInitialize = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    onScanCallback = null;
    vi.spyOn(useNfcScannerModule, 'useNfcScanner').mockImplementation((options) => {
      onScanCallback = options.onScan;
      return {
        supported: true,
        scanning: true,
        error: null,
        initialize: mockInitialize,
      };
    });
  });

  it('calls setNewCardRfid when NFC tag is scanned', () => {
    const setNewCardRfid = vi.fn();
    render(<CardsTab {...defaultProps} setNewCardRfid={setNewCardRfid} />);

    expect(useNfcScannerModule.useNfcScanner).toHaveBeenCalled();
    expect(onScanCallback).not.toBeNull();

    act(() => {
      onScanCallback!('NFC-TAG-9999');
    });

    expect(setNewCardRfid).toHaveBeenCalledWith('NFC-TAG-9999');
  });

  it('renders NFC scan button inside the RFID input field and initializes on click', () => {
    render(<CardsTab {...defaultProps} />);

    const nfcBtn = screen.getByLabelText(/Scan NFC tag to auto-fill RFID/i);
    expect(nfcBtn).toBeInTheDocument();

    fireEvent.click(nfcBtn);
    expect(mockInitialize).toHaveBeenCalled();
  });
});
