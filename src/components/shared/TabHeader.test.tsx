import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import { TabHeader } from './TabHeader';
import { useStore } from '../../store/useStore';

const responsive = vi.hoisted(() => ({ value: { isPhone: true } }));

vi.mock('../../hooks/useResponsive', () => ({
  useResponsive: () => ({
    width: responsive.value.isPhone ? 390 : 1280,
    height: 840, isPortrait: true, isLandscape: false,
    isPhone: responsive.value.isPhone, isTablet: false,
    isDesktop: !responsive.value.isPhone, useMobileLayout: responsive.value.isPhone,
    sm: true, md: !responsive.value.isPhone, lg: !responsive.value.isPhone, xl: false, xxl: false,
  }),
}));

const secondary = [
  { key: 'paste', label: 'Paste Menu', onClick: vi.fn() },
  { key: 'backup', label: 'Restore Backup', onClick: vi.fn() },
];

describe('TabHeader', () => {
  beforeEach(() => {
    responsive.value.isPhone = true;
    vi.clearAllMocks();
    // Pin the language: the store default is 'bg', and the overflow
    // button/sheet derive their accessible name from t('navigation.actions').
    useStore.setState({ lang: 'en' });
  });

  it('renders the title and subtitle', () => {
    render(<TabHeader title="Menu Management" subtitle="Edit today's menu" />);
    expect(screen.getByText('Menu Management')).toBeInTheDocument();
    expect(screen.getByText("Edit today's menu")).toBeInTheDocument();
  });

  it('always shows the primary action', () => {
    const onClick = vi.fn();
    render(<TabHeader title="T" primaryAction={{ key: 'add', label: 'Add Item', onClick }} />);
    fireEvent.click(screen.getByText('Add Item'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('hides secondary actions behind an overflow button on a phone', () => {
    render(<TabHeader title="T" secondaryActions={secondary} />);
    expect(screen.queryByText('Paste Menu')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('tabheader-overflow'));
    expect(within(screen.getByRole('dialog')).getByText('Paste Menu')).toBeInTheDocument();
  });

  it('runs a secondary action and closes the sheet', async () => {
    render(<TabHeader title="T" secondaryActions={secondary} />);
    fireEvent.click(screen.getByTestId('tabheader-overflow'));
    fireEvent.click(within(screen.getByRole('dialog')).getByText('Paste Menu'));
    expect(secondary[0].onClick).toHaveBeenCalledTimes(1);
    // Sheet's exit is animated (AnimatePresence), so the panel leaves the DOM
    // asynchronously after `isOpen` flips to false — matching the precedent
    // in ManagerDashboard.test.tsx for the same Sheet component.
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('renders secondary actions inline above md', () => {
    responsive.value.isPhone = false;
    render(<TabHeader title="T" secondaryActions={secondary} />);
    expect(screen.getByText('Paste Menu')).toBeInTheDocument();
    expect(screen.queryByTestId('tabheader-overflow')).not.toBeInTheDocument();
  });

  it('omits hidden actions entirely', () => {
    render(<TabHeader title="T" secondaryActions={[{ key: 'x', label: 'Delete All', onClick: vi.fn(), hidden: true }]} />);
    expect(screen.queryByTestId('tabheader-overflow')).not.toBeInTheDocument();
  });

  it('puts controls in the sheet on a phone and inline above md', () => {
    render(<TabHeader title="T" controls={<input aria-label="Fee" />} secondaryActions={secondary} />);
    expect(screen.queryByLabelText('Fee')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('tabheader-overflow'));
    expect(within(screen.getByRole('dialog')).getByLabelText('Fee')).toBeInTheDocument();
  });

  it('does not duplicate controls inline above md', () => {
    responsive.value.isPhone = false;
    render(<TabHeader title="T" controls={<input aria-label="Fee" />} />);
    expect(screen.getAllByLabelText('Fee')).toHaveLength(1);
  });

  it('gives the overflow sheet an accessible name', () => {
    render(<TabHeader title="T" secondaryActions={secondary} />);
    fireEvent.click(screen.getByTestId('tabheader-overflow'));
    expect(screen.getByRole('dialog', { name: 'Actions' })).toBeInTheDocument();
  });
});
