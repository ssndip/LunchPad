import '@testing-library/jest-dom';

if (typeof window === 'undefined') {
  global.window = {} as any;
}

process.env.JWT_SECRET = "test-secret-for-tests";
