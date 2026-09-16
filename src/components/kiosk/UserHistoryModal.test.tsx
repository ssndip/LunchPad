import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UserHistoryModal } from './UserHistoryModal';

describe('UserHistoryModal', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('focuses the RFID input synchronously on open, with no timer involved', () => {
    // Fake timers with zero pending timers proves focus does not depend on a
    // setTimeout race against Sheet's own synchronous initial-focus effect.
    vi.useFakeTimers();
    render(<UserHistoryModal isOpen={true} onClose={() => {}} t={(k) => k} />);

    const input = screen.getByPlaceholderText('kiosk.user_history_scan_prompt');
    expect(input).toHaveFocus();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('focuses the RFID input when the surrounding label is clicked (not just the input itself)', async () => {
    const user = userEvent.setup();
    render(<UserHistoryModal isOpen={true} onClose={() => {}} t={(k) => k} />);
    const input = screen.getByPlaceholderText('kiosk.user_history_scan_prompt');

    // Sheet's initial-focus already put focus on the input on open; move it
    // away first so the click-to-focus behaviour under test is isolated.
    (input as HTMLInputElement).blur();
    expect(input).not.toHaveFocus();

    const label = input.closest('label');
    expect(label).toBeTruthy();

    await user.click(label as HTMLLabelElement);

    expect(input).toHaveFocus();
  });
});
