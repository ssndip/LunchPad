import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NfcStatusButton } from './NfcStatusButton';

describe('NfcStatusButton', () => {
  it('should call initialize on click', () => {
    const initSpy = vi.fn();
    render(<NfcStatusButton supported={true} scanning={true} error={null} onInit={initSpy} />);
    const btn = screen.getByRole('button');
    fireEvent.click(btn);
    expect(initSpy).toHaveBeenCalled();
  });
});
