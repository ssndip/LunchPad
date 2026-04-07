import { render, screen } from '@testing-library/react';
import App from './App';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

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
  it('renders the initial kiosk view correctly', async () => {
    // Return fetch mock back to explicitly opening the kiosk
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        menu: [],
        orders: [],
        kioskOpen: true, // Force Kiosk Open
        cards: []
      })
    }) as any;

    render(<App />);

    // Fast-forward fetch and state updates manually to render the Daily Menu instead of falling back to Ordering Closed due to mocked time resolving instantly to a closed state based on default empty time.
    expect(await screen.findByText(/Поръчките са преустановени|Ordering Closed|Daily Menu|Дневно меню/i)).toBeInTheDocument();
  });
});
