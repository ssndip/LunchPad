import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Sheet } from './Sheet';

const responsive = vi.hoisted(() => ({ value: { isPhone: true } }));

vi.mock('../../hooks/useResponsive', () => ({
  useResponsive: () => ({
    width: responsive.value.isPhone ? 390 : 1280,
    height: 840,
    isPortrait: true,
    isLandscape: false,
    isPhone: responsive.value.isPhone,
    isTablet: false,
    isDesktop: !responsive.value.isPhone,
    useMobileLayout: responsive.value.isPhone,
    sm: true, md: !responsive.value.isPhone, lg: !responsive.value.isPhone, xl: false, xxl: false,
  }),
}));

describe('Sheet', () => {
  beforeEach(() => {
    responsive.value.isPhone = true;
    document.body.style.overflow = '';
  });

  it('renders nothing when closed', () => {
    render(<Sheet isOpen={false} onClose={vi.fn()} title="Settings">body</Sheet>);
    expect(screen.queryByText('body')).not.toBeInTheDocument();
  });

  it('renders its title and children when open', () => {
    render(<Sheet isOpen onClose={vi.fn()} title="Settings">body</Sheet>);
    expect(screen.getByText('Settings')).toBeInTheDocument();
    expect(screen.getByText('body')).toBeInTheDocument();
  });

  it('is a dialog with an accessible name', () => {
    render(<Sheet isOpen onClose={vi.fn()} title="Settings">body</Sheet>);
    expect(screen.getByRole('dialog', { name: 'Settings' })).toBeInTheDocument();
  });

  it('anchors to the bottom on a phone', () => {
    render(<Sheet isOpen onClose={vi.fn()} title="Settings">body</Sheet>);
    expect(screen.getByTestId('sheet-panel').className).toContain('rounded-t-[28px]');
  });

  it('centres as a dialog above md', () => {
    responsive.value.isPhone = false;
    render(<Sheet isOpen onClose={vi.fn()} title="Settings">body</Sheet>);
    expect(screen.getByTestId('sheet-panel').className).toContain('rounded-[28px]');
    expect(screen.getByTestId('sheet-panel').className).not.toContain('rounded-t-[28px]');
  });

  it('closes on backdrop click', () => {
    const onClose = vi.fn();
    render(<Sheet isOpen onClose={onClose} title="Settings">body</Sheet>);
    fireEvent.click(screen.getByTestId('sheet-backdrop'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes on Escape', () => {
    const onClose = vi.fn();
    render(<Sheet isOpen onClose={onClose} title="Settings">body</Sheet>);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('locks body scroll while open and restores it on close', () => {
    const { rerender } = render(<Sheet isOpen onClose={vi.fn()} title="S">body</Sheet>);
    expect(document.body.style.overflow).toBe('hidden');
    rerender(<Sheet isOpen={false} onClose={vi.fn()} title="S">body</Sheet>);
    expect(document.body.style.overflow).toBe('');
  });

  it('has an accessible name from ariaLabel when there is no title', () => {
    render(<Sheet isOpen onClose={vi.fn()} ariaLabel="Quick settings">body</Sheet>);
    expect(screen.getByRole('dialog', { name: 'Quick settings' })).toBeInTheDocument();
  });

  it('moves focus to the first focusable element in the panel on open', () => {
    render(
      <Sheet isOpen onClose={vi.fn()} ariaLabel="Body only">
        <button>First</button>
        <button>Second</button>
      </Sheet>
    );
    expect(screen.getByText('First')).toHaveFocus();
  });

  it('wraps focus with Tab from the last focusable element to the first', () => {
    render(
      <Sheet isOpen onClose={vi.fn()} ariaLabel="Body only">
        <button>First</button>
        <button>Second</button>
      </Sheet>
    );
    screen.getByText('Second').focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(screen.getByText('First')).toHaveFocus();
  });

  it('wraps focus with Shift+Tab from the first focusable element to the last', () => {
    render(
      <Sheet isOpen onClose={vi.fn()} ariaLabel="Body only">
        <button>First</button>
        <button>Second</button>
      </Sheet>
    );
    screen.getByText('First').focus();
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(screen.getByText('Second')).toHaveFocus();
  });

  it('restores focus to the previously focused element on close', () => {
    const trigger = document.createElement('button');
    trigger.textContent = 'Open sheet';
    document.body.appendChild(trigger);
    trigger.focus();
    expect(trigger).toHaveFocus();

    const { rerender } = render(<Sheet isOpen onClose={vi.fn()} ariaLabel="Body only">body</Sheet>);
    rerender(<Sheet isOpen={false} onClose={vi.fn()} ariaLabel="Body only">body</Sheet>);

    expect(trigger).toHaveFocus();
    document.body.removeChild(trigger);
  });
});
