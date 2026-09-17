import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { KioskCategorySidebar } from './KioskCategorySidebar';

/**
 * These assert on class names rather than geometry on purpose. happy-dom does
 * not lay out — every getBoundingClientRect is 0x0 and no media query ever
 * matches — so "is this a row or a column?" cannot be measured here (see the
 * header comment in scripts/audit-mobile.js). What CAN be pinned down is that
 * the direction is decided by the `orientation` prop and not re-derived from a
 * `md:` variant, which is the actual bug: KioskView picks the layout from
 * useResponsive (useMobileLayout, true below 1024px in portrait) while this
 * component was picking its own from `md:flex-col`, active from 768px up. On a
 * portrait tablet the two disagreed and a horizontal strip rendered a full
 * width vertical stack inside itself.
 */

const baseProps = {
  categories: ['Soups', 'Main Dishes', 'Side Dishes'],
  activeCategory: 'Soups',
  onSelect: vi.fn(),
  menu: [],
  t: (key: string) => key,
};

/** The scrolling container is the element the category buttons sit in. */
const scroller = () => screen.getAllByRole('button')[0].parentElement as HTMLElement;

describe('KioskCategorySidebar', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('stacks the categories into a column when vertical', () => {
    render(<KioskCategorySidebar {...baseProps} orientation="vertical" />);
    expect(scroller().className).toMatch(/(^|\s)flex-col(\s|$)/);
  });

  it('lays the categories out in a row when horizontal', () => {
    render(<KioskCategorySidebar {...baseProps} orientation="horizontal" />);
    // Neither the plain utility nor a `md:` variant of it: at 800px wide —
    // horizontal, because the tablet is in portrait — `md:flex-col` is active
    // and would turn the strip back into a stack.
    expect(scroller().className).not.toMatch(/flex-col/);
  });

  it('stretches each category button to full width only when vertical', () => {
    const { unmount } = render(<KioskCategorySidebar {...baseProps} orientation="vertical" />);
    expect(screen.getAllByRole('button')[0].className).toMatch(/(^|\s)w-full(\s|$)/);
    unmount();

    render(<KioskCategorySidebar {...baseProps} orientation="horizontal" />);
    expect(screen.getAllByRole('button')[0].className).not.toMatch(/w-full/);
  });

  it('renders the edge fades only in the horizontal layout', () => {
    const { container, unmount } = render(
      <KioskCategorySidebar {...baseProps} orientation="horizontal" />,
    );
    expect(container.querySelectorAll('[data-testid="category-fade"]')).toHaveLength(2);
    unmount();

    const vertical = render(<KioskCategorySidebar {...baseProps} orientation="vertical" />);
    expect(vertical.container.querySelectorAll('[data-testid="category-fade"]')).toHaveLength(0);
  });

  it('renders every category as a button in both orientations', () => {
    const { unmount } = render(<KioskCategorySidebar {...baseProps} orientation="horizontal" />);
    expect(screen.getAllByRole('button')).toHaveLength(3);
    unmount();

    render(<KioskCategorySidebar {...baseProps} orientation="vertical" />);
    expect(screen.getAllByRole('button')).toHaveLength(3);
  });
});
