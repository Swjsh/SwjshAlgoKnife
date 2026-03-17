import { describe, expect, it } from 'vitest';
import { hashStringToSeed, mulberry32 } from '../src/lib/utils/prng';

describe('prng', () => {
  it('hashStringToSeed is stable', () => {
    expect(hashStringToSeed('abc')).toBe(hashStringToSeed('abc'));
    expect(hashStringToSeed('abc')).not.toBe(hashStringToSeed('abcd'));
  });

  it('mulberry32 produces deterministic sequence for same seed', () => {
    const seed = 123456;
    const a = mulberry32(seed);
    const b = mulberry32(seed);

    const seqA = Array.from({ length: 5 }, () => a());
    const seqB = Array.from({ length: 5 }, () => b());

    expect(seqA).toEqual(seqB);
  });
});
