import { vi, describe, it, expect, beforeEach } from 'vitest';

const mockFindUnique = vi.fn();

vi.mock('@/lib/db', () => ({
  prisma: {
    systemConfig: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
    },
  },
}));

import { getRequiredNumericConfig, invalidateConfigCache } from '@/lib/system-config';

beforeEach(() => {
  vi.clearAllMocks();
  // Clear the in-memory cache so each test starts fresh
  invalidateConfigCache();
  // Clear process.env test keys
  delete process.env['TEST_CONFIG_KEY'];
});

describe('getRequiredNumericConfig', () => {
  it('returns parsed number when DB has a valid positive value', async () => {
    mockFindUnique.mockResolvedValue({ key: 'TEST_CONFIG_KEY', value: '2000' });
    const result = await getRequiredNumericConfig('TEST_CONFIG_KEY');
    expect(result).toBe(2000);
  });

  it('falls back to process.env when DB returns null', async () => {
    mockFindUnique.mockResolvedValue(null);
    process.env['TEST_CONFIG_KEY'] = '500';
    const result = await getRequiredNumericConfig('TEST_CONFIG_KEY');
    expect(result).toBe(500);
  });

  it('throws when DB is undefined and env is also undefined', async () => {
    mockFindUnique.mockResolvedValue(null);
    await expect(getRequiredNumericConfig('TEST_CONFIG_KEY')).rejects.toThrow(
      'Missing required config: TEST_CONFIG_KEY. Set it via admin UI or .env.',
    );
  });

  it('throws when DB returns a non-numeric string', async () => {
    mockFindUnique.mockResolvedValue({ key: 'TEST_CONFIG_KEY', value: 'abc' });
    await expect(getRequiredNumericConfig('TEST_CONFIG_KEY')).rejects.toThrow(
      'Missing required config: TEST_CONFIG_KEY. Set it via admin UI or .env.',
    );
  });

  it('throws when DB returns "0" (not positive)', async () => {
    mockFindUnique.mockResolvedValue({ key: 'TEST_CONFIG_KEY', value: '0' });
    await expect(getRequiredNumericConfig('TEST_CONFIG_KEY')).rejects.toThrow(
      'Missing required config: TEST_CONFIG_KEY. Set it via admin UI or .env.',
    );
  });

  it('throws when DB returns a negative value', async () => {
    mockFindUnique.mockResolvedValue({ key: 'TEST_CONFIG_KEY', value: '-5' });
    await expect(getRequiredNumericConfig('TEST_CONFIG_KEY')).rejects.toThrow(
      'Missing required config: TEST_CONFIG_KEY. Set it via admin UI or .env.',
    );
  });

  it('throws when DB returns empty string', async () => {
    mockFindUnique.mockResolvedValue({ key: 'TEST_CONFIG_KEY', value: '' });
    await expect(getRequiredNumericConfig('TEST_CONFIG_KEY')).rejects.toThrow(
      'Missing required config: TEST_CONFIG_KEY. Set it via admin UI or .env.',
    );
  });
});
