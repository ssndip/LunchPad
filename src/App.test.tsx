import { render, screen } from '@testing-library/react';
import App from './App';
import { describe, it, expect, vi } from 'vitest';

// Mock matchMedia
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(), // deprecated
      removeListener: vi.fn(), // deprecated
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

// Mock fetch
global.fetch = vi.fn().mockResolvedValue({
  json: () => Promise.resolve([])
}) as any;

describe('App Component', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Set time to something that wouldn't show "ordering closed" depending on logic
    // Actually the logic uses a clock, lets set time to 12:00:00
    vi.setSystemTime(new Date(2024, 1, 1, 12, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the initial kiosk view correctly', () => {
    render(<App />);

    // Check for Daily Menu title or closed message
    const hasDailyMenu = screen.queryByText(/Daily Menu/i);
    const hasClosedMsg = screen.queryByText(/Поръчките са преустановени/i);

    expect(hasDailyMenu || hasClosedMsg).toBeInTheDocument();
  });
});
