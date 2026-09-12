import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import { ManagerDashboard } from './ManagerDashboard';
import { useStore } from '../../store/useStore';

// The store defaults to lang 'bg' (settingsSlice.ts:82), and Sheet reads
// useResponsive, so both are pinned here: the labels asserted below are the
// English ones.
vi.mock('../../hooks/useResponsive', () => ({
  useResponsive: () => ({
    width: 390, height: 840, isPortrait: true, isLandscape: false,
    isPhone: true, isTablet: false, isDesktop: false, useMobileLayout: true,
    sm: false, md: false, lg: false, xl: false, xxl: false,
  }),
}));

const props = {
  activeTab: 'menu' as const,
  onTabChange: vi.fn(),
  onLogout: vi.fn(),
  kioskOpen: true,
  onToggleKiosk: vi.fn(),
  children: <div>content</div>,
};

const PRIMARY = ['Menu', 'Orders', 'History', 'Cards'];

describe('ManagerDashboard phone navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    useStore.setState({ lang: 'en' });
  });

  it('shows exactly four primary tabs plus More', () => {
    render(<ManagerDashboard {...props} />);
    const nav = screen.getByTestId('phone-bottom-nav');
    PRIMARY.forEach((label) => expect(within(nav).getByText(label)).toBeInTheDocument());
    expect(within(nav).getByText('More')).toBeInTheDocument();
    expect(within(nav).getAllByRole('button')).toHaveLength(5);
  });

  it('keeps every primary label short enough not to truncate', () => {
    render(<ManagerDashboard {...props} />);
    const nav = screen.getByTestId('phone-bottom-nav');
    [...PRIMARY, 'More'].forEach((label) =>
      expect(within(nav).getByText(label).textContent!.length).toBeLessThanOrEqual(8),
    );
  });

  it('routes a primary tab tap to onTabChange', () => {
    render(<ManagerDashboard {...props} />);
    fireEvent.click(within(screen.getByTestId('phone-bottom-nav')).getByText('Orders'));
    expect(props.onTabChange).toHaveBeenCalledWith('orders');
  });

  it('opens a sheet with the secondary destinations', () => {
    render(<ManagerDashboard {...props} />);
    fireEvent.click(within(screen.getByTestId('phone-bottom-nav')).getByText('More'));
    const sheet = screen.getByRole('dialog');
    expect(within(sheet).getByText('Analytics')).toBeInTheDocument();
    expect(within(sheet).getByText('Parser Rules')).toBeInTheDocument();
    expect(within(sheet).getByText('System Settings')).toBeInTheDocument();
  });

  it('routes a secondary destination and closes the sheet', async () => {
    render(<ManagerDashboard {...props} />);
    fireEvent.click(within(screen.getByTestId('phone-bottom-nav')).getByText('More'));
    fireEvent.click(within(screen.getByRole('dialog')).getByText('Analytics'));
    expect(props.onTabChange).toHaveBeenCalledWith('analytics');
    // Sheet (Task 9) exits via a real spring animation; give it a tick to
    // finish before asserting it left the DOM rather than racing it.
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('offers logout from the More sheet', () => {
    render(<ManagerDashboard {...props} />);
    fireEvent.click(within(screen.getByTestId('phone-bottom-nav')).getByText('More'));
    fireEvent.click(within(screen.getByRole('dialog')).getByText('Logout'));
    expect(props.onLogout).toHaveBeenCalledTimes(1);
  });

  it('reaches every destination from the phone nav', () => {
    render(<ManagerDashboard {...props} />);
    const nav = screen.getByTestId('phone-bottom-nav');
    ['Menu', 'Orders', 'History', 'Cards'].forEach((l) => fireEvent.click(within(nav).getByText(l)));
    fireEvent.click(within(nav).getByText('More'));
    ['Analytics', 'Parser Rules', 'System Settings'].forEach((l) =>
      fireEvent.click(within(screen.getByRole('dialog')).getByText(l)),
    );
    const reached = props.onTabChange.mock.calls.map(([tab]) => tab);
    expect(new Set(reached)).toEqual(
      new Set(['menu', 'orders', 'history', 'cards', 'analytics', 'parser_rules', 'settings']),
    );
  });
});
