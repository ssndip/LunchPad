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
  it('renders the initial kiosk view correctly', () => {
    vi.useFakeTimers();
    // Set time to something when kiosk is open (e.g. 12:00 PM)
    vi.setSystemTime(new Date(new Date().setHours(12, 0, 0, 0)));

    render(<App />);

    // Check for Daily Menu title or Ordering Closed title depending on initial state mock
    const titleElement = screen.queryByText(/Daily Menu/i) || screen.queryByText(/Ordering Closed/i) || screen.queryByText(/Поръчките са преустановени/i);
    expect(titleElement).toBeInTheDocument();

    vi.useRealTimers();
  });
});
