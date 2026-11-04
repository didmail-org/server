import { describe, test, expect, beforeEach } from '@jest/globals';

import { rateLimit, __clearRateLimits } from '../rate-limit';

describe('rate-limit', () => {
  beforeEach(() => __clearRateLimits());

  test('allows up to limit then blocks within window', () => {
    expect(rateLimit('k1', 3, 60_000)).toBe(true);
    expect(rateLimit('k1', 3, 60_000)).toBe(true);
    expect(rateLimit('k1', 3, 60_000)).toBe(true);
    expect(rateLimit('k1', 3, 60_000)).toBe(false);
    expect(rateLimit('k2', 3, 60_000)).toBe(true);
  });
});
