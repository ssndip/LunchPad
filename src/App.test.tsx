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
    render(<App />);

    // Depending on kioskOpen state or language it will render either 'Daily Menu', 'Дневно меню' or 'Поръчките са преустановени' / 'Ordering Closed'
    const hasAnyTitle = screen.queryByText(/Daily Menu/i) || screen.queryByText(/Дневно меню/i) || screen.queryByText(/Поръчките са преустановени/i) || screen.queryByText(/Ordering Closed/i);
    expect(hasAnyTitle).toBeInTheDocument();
  });
});
