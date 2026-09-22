import { describe, it, expect } from 'vitest';
import * as C from './constants';

describe('constants', () => {
  it('spec eşiklerini taşır', () => {
    expect(C.MIN_PLAYTIME_MINUTES).toBe(60);
    expect(C.MIN_REVIEWS).toBe(50);
    expect(C.MIN_POSITIVE_RATIO).toBeCloseTo(0.70);
    expect(C.RELEASE_WINDOW_DAYS).toBe(90);
    expect(C.MMR_LAMBDA).toBeCloseTo(0.7);
  });
});
