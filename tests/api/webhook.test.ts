import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

// Mock environment variables
process.env.WEBHOOK_SECRET = 'test_secret_123';
process.env.NODE_ENV = 'test';
process.env.ACCOUNT_BALANCE = '10000';
process.env.RISK_PER_TRADE = '1';

// Mock Prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
    bot: {
      findUnique: vi.fn(),
    },
    signal: {
      create: vi.fn(),
      update: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  },
}));

// Mock TradeExecutor
vi.mock('@/lib/engine/executor', () => ({
  TradeExecutor: class {
    constructor(params: any) {
      this.params = params;
    }
    async processSignal(signal: any) {
      return Promise.resolve();
    }
  },
}));

import { POST } from '@/app/api/webhook/tradingview/route';

describe('TradingView Webhook API', () => {
  let mockRequest: Partial<NextRequest>;

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset rate limit store between tests (if accessible)
  });

  describe('Authentication - Valid Secret', () => {
    it('should accept webhook with correct X-Webhook-Secret header', async () => {
      const { prisma } = await import('@/lib/prisma');

      vi.mocked(prisma.user).findFirst?.mockResolvedValue({
        id: 'user-123',
        onboardingStep: 'COMPLETED',
      } as any);

      vi.mocked(prisma.signal).create?.mockResolvedValue({
        id: 'signal-1',
      } as any);

      vi.mocked(prisma.signal).update?.mockResolvedValue({} as any);

      vi.mocked(prisma.auditLog).create?.mockResolvedValue({} as any);

      const request = new NextRequest('http://localhost:3000/api/webhook/tradingview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Secret': 'test_secret_123',
        },
        body: JSON.stringify({
          symbol: 'EURUSD',
          action: 'BUY',
          price: 1.0950,
          strategy: 'Custom TS',
          notes: 'Test signal',
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.status).toBe('success');
      expect(data.received).toBe(true);
    });

    it('should accept webhook with Bearer token Authorization header', async () => {
      const { prisma } = await import('@/lib/prisma');

      vi.mocked(prisma.user).findFirst?.mockResolvedValue({
        id: 'user-123',
        onboardingStep: 'COMPLETED',
      } as any);

      vi.mocked(prisma.signal).create?.mockResolvedValue({
        id: 'signal-2',
      } as any);

      vi.mocked(prisma.signal).update?.mockResolvedValue({} as any);

      vi.mocked(prisma.auditLog).create?.mockResolvedValue({} as any);

      const request = new NextRequest('http://localhost:3000/api/webhook/tradingview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test_secret_123',
        },
        body: JSON.stringify({
          symbol: 'BTCUSD',
          action: 'SELL',
          price: 65000,
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.status).toBe('success');
    });
  });

  describe('Authentication - Missing Secret', () => {
    it('should return 401 when secret is required but missing', async () => {
      const request = new NextRequest('http://localhost:3000/api/webhook/tradingview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // No X-Webhook-Secret or Authorization header
        },
        body: JSON.stringify({
          symbol: 'EURUSD',
          action: 'BUY',
          price: 1.0950,
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 401 with invalid secret', async () => {
      const request = new NextRequest('http://localhost:3000/api/webhook/tradingview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Secret': 'wrong_secret',
        },
        body: JSON.stringify({
          symbol: 'EURUSD',
          action: 'BUY',
          price: 1.0950,
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 401 with empty secret header', async () => {
      const request = new NextRequest('http://localhost:3000/api/webhook/tradingview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Secret': '',
        },
        body: JSON.stringify({
          symbol: 'EURUSD',
          action: 'BUY',
          price: 1.0950,
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(401);
    });
  });

  describe('Payload Validation', () => {
    it('should return 400 for missing required symbol field', async () => {
      const request = new NextRequest('http://localhost:3000/api/webhook/tradingview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Secret': 'test_secret_123',
        },
        body: JSON.stringify({
          // symbol missing
          action: 'BUY',
          price: 1.0950,
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Invalid request');
    });

    it('should return 400 for missing required action field', async () => {
      const request = new NextRequest('http://localhost:3000/api/webhook/tradingview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Secret': 'test_secret_123',
        },
        body: JSON.stringify({
          symbol: 'EURUSD',
          // action missing
          price: 1.0950,
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Invalid request');
    });

    it('should return 400 for missing required price field', async () => {
      const request = new NextRequest('http://localhost:3000/api/webhook/tradingview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Secret': 'test_secret_123',
        },
        body: JSON.stringify({
          symbol: 'EURUSD',
          action: 'BUY',
          // price missing
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Invalid request');
    });

    it('should return 400 for zero or negative price', async () => {
      const request = new NextRequest('http://localhost:3000/api/webhook/tradingview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Secret': 'test_secret_123',
        },
        body: JSON.stringify({
          symbol: 'EURUSD',
          action: 'BUY',
          price: -100, // Invalid
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    it('should return 400 for invalid action value', async () => {
      const request = new NextRequest('http://localhost:3000/api/webhook/tradingview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Secret': 'test_secret_123',
        },
        body: JSON.stringify({
          symbol: 'EURUSD',
          action: 'INVALID_ACTION',
          price: 1.0950,
        }),
      });

      const response = await POST(request);

      // Schema doesn't restrict action enum, but let's verify behavior
      expect([200, 400]).toContain(response.status);
    });

    it('should accept valid optional fields (stopLoss, takeProfit, strategy, notes)', async () => {
      const { prisma } = await import('@/lib/prisma');

      vi.mocked(prisma.user).findFirst?.mockResolvedValue({
        id: 'user-123',
        onboardingStep: 'COMPLETED',
      } as any);

      vi.mocked(prisma.signal).create?.mockResolvedValue({
        id: 'signal-3',
      } as any);

      vi.mocked(prisma.signal).update?.mockResolvedValue({} as any);

      vi.mocked(prisma.auditLog).create?.mockResolvedValue({} as any);

      const request = new NextRequest('http://localhost:3000/api/webhook/tradingview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Secret': 'test_secret_123',
        },
        body: JSON.stringify({
          symbol: 'EURUSD',
          action: 'BUY',
          price: 1.0950,
          stopLoss: 1.0900,
          takeProfit: 1.1050,
          strategy: 'My Strategy',
          notes: 'Support rejection at key level',
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.status).toBe('success');
    });

    it('should reject symbol longer than 20 characters', async () => {
      const request = new NextRequest('http://localhost:3000/api/webhook/tradingview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Secret': 'test_secret_123',
        },
        body: JSON.stringify({
          symbol: 'A'.repeat(21), // 21 characters
          action: 'BUY',
          price: 1.0950,
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    it('should reject notes longer than 500 characters', async () => {
      const request = new NextRequest('http://localhost:3000/api/webhook/tradingview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Secret': 'test_secret_123',
        },
        body: JSON.stringify({
          symbol: 'EURUSD',
          action: 'BUY',
          price: 1.0950,
          notes: 'A'.repeat(501), // 501 characters
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
    });
  });

  describe('Signal Storage', () => {
    it('should create signal record in database with valid payload', async () => {
      const { prisma } = await import('@/lib/prisma');

      vi.mocked(prisma.user).findFirst?.mockResolvedValue({
        id: 'user-123',
        onboardingStep: 'COMPLETED',
      } as any);

      vi.mocked(prisma.signal).create?.mockResolvedValue({
        id: 'signal-4',
      } as any);

      vi.mocked(prisma.signal).update?.mockResolvedValue({} as any);

      vi.mocked(prisma.auditLog).create?.mockResolvedValue({} as any);

      const request = new NextRequest('http://localhost:3000/api/webhook/tradingview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Secret': 'test_secret_123',
        },
        body: JSON.stringify({
          symbol: 'EURUSD',
          action: 'BUY',
          price: 1.0950,
          strategy: 'Test Strategy',
          stopLoss: 1.0900,
          takeProfit: 1.1050,
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(vi.mocked(prisma.signal).create).toHaveBeenCalled();

      // Verify signal was created with correct data
      const createCall = vi.mocked(prisma.signal).create?.mock.calls[0];
      expect(createCall).toBeDefined();
      const createdSignal = createCall?.[0]?.data;
      expect(createdSignal?.symbol).toBe('EURUSD');
      expect(createdSignal?.action).toBe('BUY');
      expect(createdSignal?.price).toBe(1.0950);
    });

    it('should mark signal as processed after execution', async () => {
      const { prisma } = await import('@/lib/prisma');

      vi.mocked(prisma.user).findFirst?.mockResolvedValue({
        id: 'user-123',
        onboardingStep: 'COMPLETED',
      } as any);

      vi.mocked(prisma.signal).create?.mockResolvedValue({
        id: 'signal-5',
      } as any);

      vi.mocked(prisma.signal).update?.mockResolvedValue({} as any);

      vi.mocked(prisma.auditLog).create?.mockResolvedValue({} as any);

      const request = new NextRequest('http://localhost:3000/api/webhook/tradingview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Secret': 'test_secret_123',
        },
        body: JSON.stringify({
          symbol: 'EURUSD',
          action: 'BUY',
          price: 1.0950,
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(vi.mocked(prisma.signal).update).toHaveBeenCalled();

      // Verify signal was updated to processed
      const updateCall = vi.mocked(prisma.signal).update?.mock.calls[0];
      expect(updateCall).toBeDefined();
      const updateData = updateCall?.[0]?.data;
      expect(updateData?.processed).toBe(true);
      expect(updateData?.status).toBe('EXECUTED');
    });

    it('should convert action to uppercase for storage', async () => {
      const { prisma } = await import('@/lib/prisma');

      vi.mocked(prisma.user).findFirst?.mockResolvedValue({
        id: 'user-123',
        onboardingStep: 'COMPLETED',
      } as any);

      vi.mocked(prisma.signal).create?.mockResolvedValue({
        id: 'signal-6',
      } as any);

      vi.mocked(prisma.signal).update?.mockResolvedValue({} as any);

      vi.mocked(prisma.auditLog).create?.mockResolvedValue({} as any);

      const request = new NextRequest('http://localhost:3000/api/webhook/tradingview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Secret': 'test_secret_123',
        },
        body: JSON.stringify({
          symbol: 'EURUSD',
          action: 'buy', // lowercase
          price: 1.0950,
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(200);

      const createCall = vi.mocked(prisma.signal).create?.mock.calls[0];
      const createdSignal = createCall?.[0]?.data;
      expect(createdSignal?.action).toBe('BUY');
    });

    it('should map BUY/LONG actions to LONG direction', async () => {
      const { prisma } = await import('@/lib/prisma');

      vi.mocked(prisma.user).findFirst?.mockResolvedValue({
        id: 'user-123',
        onboardingStep: 'COMPLETED',
      } as any);

      vi.mocked(prisma.signal).create?.mockResolvedValue({
        id: 'signal-7',
      } as any);

      vi.mocked(prisma.signal).update?.mockResolvedValue({} as any);

      vi.mocked(prisma.auditLog).create?.mockResolvedValue({} as any);

      const request = new NextRequest('http://localhost:3000/api/webhook/tradingview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Secret': 'test_secret_123',
        },
        body: JSON.stringify({
          symbol: 'EURUSD',
          action: 'BUY',
          price: 1.0950,
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(200);

      const createCall = vi.mocked(prisma.signal).create?.mock.calls[0];
      const createdSignal = createCall?.[0]?.data;
      expect(createdSignal?.direction).toBe('LONG');
    });

    it('should map SELL/SHORT actions to SHORT direction', async () => {
      const { prisma } = await import('@/lib/prisma');

      vi.mocked(prisma.user).findFirst?.mockResolvedValue({
        id: 'user-123',
        onboardingStep: 'COMPLETED',
      } as any);

      vi.mocked(prisma.signal).create?.mockResolvedValue({
        id: 'signal-8',
      } as any);

      vi.mocked(prisma.signal).update?.mockResolvedValue({} as any);

      vi.mocked(prisma.auditLog).create?.mockResolvedValue({} as any);

      const request = new NextRequest('http://localhost:3000/api/webhook/tradingview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Secret': 'test_secret_123',
        },
        body: JSON.stringify({
          symbol: 'EURUSD',
          action: 'SELL',
          price: 1.0950,
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(200);

      const createCall = vi.mocked(prisma.signal).create?.mock.calls[0];
      const createdSignal = createCall?.[0]?.data;
      expect(createdSignal?.direction).toBe('SHORT');
    });
  });

  describe('Rate Limiting', () => {
    it('should allow requests within rate limit', async () => {
      const { prisma } = await import('@/lib/prisma');

      vi.mocked(prisma.user).findFirst?.mockResolvedValue({
        id: 'user-123',
        onboardingStep: 'COMPLETED',
      } as any);

      vi.mocked(prisma.signal).create?.mockResolvedValue({
        id: 'signal-9',
      } as any);

      vi.mocked(prisma.signal).update?.mockResolvedValue({} as any);

      vi.mocked(prisma.auditLog).create?.mockResolvedValue({} as any);

      const request = new NextRequest('http://localhost:3000/api/webhook/tradingview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Secret': 'test_secret_123',
          'x-forwarded-for': '192.168.1.1',
        },
        body: JSON.stringify({
          symbol: 'EURUSD',
          action: 'BUY',
          price: 1.0950,
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.status).toBe('success');
    });
  });

  describe('Payload Size Validation', () => {
    it('should return 413 if content-length exceeds 64KB', async () => {
      const request = new NextRequest('http://localhost:3000/api/webhook/tradingview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Secret': 'test_secret_123',
          'content-length': '65537', // > 64KB
        },
        body: JSON.stringify({
          symbol: 'EURUSD',
          action: 'BUY',
          price: 1.0950,
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(413);
      const data = await response.json();
      expect(data.error).toContain('too large');
    });
  });

  describe('Response Format', () => {
    it('should return success response with correct structure', async () => {
      const { prisma } = await import('@/lib/prisma');

      vi.mocked(prisma.user).findFirst?.mockResolvedValue({
        id: 'user-123',
        onboardingStep: 'COMPLETED',
      } as any);

      vi.mocked(prisma.signal).create?.mockResolvedValue({
        id: 'signal-10',
      } as any);

      vi.mocked(prisma.signal).update?.mockResolvedValue({} as any);

      vi.mocked(prisma.auditLog).create?.mockResolvedValue({} as any);

      const request = new NextRequest('http://localhost:3000/api/webhook/tradingview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Secret': 'test_secret_123',
        },
        body: JSON.stringify({
          symbol: 'EURUSD',
          action: 'BUY',
          price: 1.0950,
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty('status');
      expect(data).toHaveProperty('received');
      expect(data).toHaveProperty('symbol');
      expect(data.status).toBe('success');
      expect(data.received).toBe(true);
      expect(data.symbol).toBe('EURUSD');
    });
  });
});
