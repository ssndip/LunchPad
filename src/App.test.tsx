import { render, screen } from '@testing-library/react';
import App from './App';
import { describe, it, expect, vi } from 'vitest';

// Mock matchMedia
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

// Mock fetch
global.fetch = vi.fn().mockResolvedValue({
  json: () => Promise.resolve([])
}) as any;

describe('App Component', () => {
  it('renders the initial kiosk view correctly', () => {
    render(<App />);

    // Check for Daily Menu title
    expect(screen.getByText(/Daily Menu/i)).toBeInTheDocument();
  });
});
