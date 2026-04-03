import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock environment variables
process.env.DATABASE_URL = 'postgresql://mock';
process.env.AUTH_SECRET = 'mock-secret';
process.env.AUTH_URL = 'http://localhost:3000';

// Mock Next.js server utilities
vi.mock('next/server', () => ({
  NextRequest: class MockNextRequest {
    url: string;
    nextUrl: URL;
    constructor(url: string, init?: RequestInit) {
      this.url = url;
      this.nextUrl = new URL(url);
    }
    async json() {
      return {};
    }
  },
  NextResponse: {
    json: (data: unknown, init?: ResponseInit) => ({
      ok: init?.status ? init.status < 400 : true,
      status: init?.status || 200,
      json: async () => data,
    }),
  },
}));
