import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import { TabHeader } from './TabHeader';
import { useStore } from '../../store/useStore';

const responsive = vi.hoisted(() => ({ value: { isPhone: true, xl: false } }));

vi.mock('../../hooks/useResponsive', () => ({
  useResponsive: () => ({
    width: responsive.value.isPhone ? 390 : responsive.value.xl ? 1440 : 1024,
    height: 840, isPortrait: true, isLandscape: false,
    isPhone: responsive.value.isPhone, isTablet: false,
    isDesktop: !responsive.value.isPhone, useMobileLayout: responsive.value.isPhone,
    sm: true, md: !responsive.value.isPhone, lg: !responsive.value.isPhone,
    xl: responsive.value.xl, xxl: false,
  }),
}));

const secondary = [
  { key: 'paste', label: 'Paste Menu', onClick: vi.fn() },
  { key: 'backup', label: 'Restore Backup', onClick: vi.fn() },
];

describe('TabHeader', () => {
  beforeEach(() => {
    responsive.value.isPhone = true;
    responsive.value.xl = false;
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

  it('does not duplicate controls inline at xl', () => {
    responsive.value.isPhone = false;
    responsive.value.xl = true;
    render(<TabHeader title="T" controls={<input aria-label="Fee" />} />);
    expect(screen.getAllByLabelText('Fee')).toHaveLength(1);
  });

  /**
   * Controls are the bulky part of a header — MenuTab passes two fee widgets
   * around 350px wide each — and between 1024px and 1279px is where the
   * dashboard content area is at its narrowest, because DesktopNav's 320px
   * aside appears at lg and `lg:p-10` doubles the padding at the same time:
   * 689px of content at a 1024px viewport, against 991px at 1023px. Measured
   * against MenuTab in Chrome with the controls still inline there, the header
   * stood 358px tall — most of a screen before the first menu row. Secondary
   * actions are compact buttons and stay inline from md up.
   */
  it('keeps controls in the overflow sheet below xl, where the content area is narrowest', () => {
    responsive.value.isPhone = false;
    render(<TabHeader title="T" controls={<input aria-label="Fee" />} />);
    expect(screen.queryByLabelText('Fee')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('tabheader-overflow'));
    expect(within(screen.getByRole('dialog')).getByLabelText('Fee')).toBeInTheDocument();
  });

  it('keeps secondary actions inline below xl', () => {
    responsive.value.isPhone = false;
    render(<TabHeader title="T" secondaryActions={secondary} />);
    expect(screen.getByText('Paste Menu')).toBeInTheDocument();
    expect(screen.queryByTestId('tabheader-overflow')).not.toBeInTheDocument();
  });

  /**
   * The next two assert on class names because happy-dom does not lay out:
   * every getBoundingClientRect is 0x0, so "is the title clipped?" cannot be
   * measured here (same reason scripts/audit-mobile.js exists). Measured in
   * Chrome against MenuTab before this pair: at a 1024px viewport the title
   * column collapsed to 129px and clipped 75px of "Управление на менюто",
   * painting the word underneath the fee controls. The cause was `min-w-0` on
   * the title column — the hand-written headers TabHeader replaced used a bare
   * <div>, whose `min-width: auto` floor kept the column at its longest word
   * and made the action row wrap instead.
   */
  it('keeps a minimum width under the title so the action row cannot crush it', () => {
    responsive.value.isPhone = false;
    const { container } = render(
      <TabHeader title="Управление на менюто" secondaryActions={secondary} />,
    );
    const titleColumn = container.querySelector('h1')!.parentElement!;
    expect(titleColumn.className).not.toMatch(/(^|\s)min-w-0(\s|$)/);
    expect(titleColumn.className).toMatch(/(^|\s)min-w-\[/);
  });

  it('lets a title too long for its column wrap instead of overflowing it', () => {
    responsive.value.isPhone = false;
    const { container } = render(<TabHeader title="Управление на менюто" />);
    expect(container.querySelector('h1')!.className).toMatch(/(^|\s)break-words(\s|$)/);
  });

  it('gives the overflow sheet an accessible name', () => {
    render(<TabHeader title="T" secondaryActions={secondary} />);
    fireEvent.click(screen.getByTestId('tabheader-overflow'));
    expect(screen.getByRole('dialog', { name: 'Actions' })).toBeInTheDocument();
  });
});
