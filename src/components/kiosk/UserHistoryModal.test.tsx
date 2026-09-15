import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UserHistoryModal } from './UserHistoryModal';

describe('UserHistoryModal', () => {
  it('focuses the RFID input when the surrounding label is clicked (not just the input itself)', async () => {
    const user = userEvent.setup();
    render(<UserHistoryModal isOpen={true} onClose={() => {}} t={(k) => k} />);
    const input = screen.getByPlaceholderText('kiosk.user_history_scan_prompt');
    expect(input).not.toHaveFocus();

    const label = input.closest('label');
    expect(label).toBeTruthy();

    await user.click(label as HTMLLabelElement);

    expect(input).toHaveFocus();
  });
});
