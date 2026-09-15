import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ConfirmModal } from './ConfirmModal';

describe('ConfirmModal', () => {
  it('focuses its text input on open in prompt mode', () => {
    render(
      <ConfirmModal
        config={{
          title: 'Rename',
          message: 'Enter a new name',
          onConfirm: () => {},
          isPrompt: true,
          initialValue: 'Soup',
          placeholder: 'New name',
        }}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByPlaceholderText('New name')).toHaveFocus();
  });

  it('renders nothing when config is null', () => {
    const { container } = render(<ConfirmModal config={null} onClose={vi.fn()} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(container).toBeTruthy();
  });
});
