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

// Mock current time to be within kiosk opening hours (09:00 AM)
vi.useFakeTimers();
vi.setSystemTime(new Date('2026-04-07T09:00:00Z'));

import { useStore } from './store/useStore';

describe('App Component', () => {
  it('renders the initial kiosk view correctly', () => {
    // Force the kiosk to be open for the test environment
    useStore.setState({ kioskOpen: true, kioskAutoTiming: false });
    
    render(<App />);

    // Check for Daily Menu title (Bulgarian default)
    expect(screen.getByText(/Дневно меню|Daily Menu/i)).toBeInTheDocument();
  });
});
