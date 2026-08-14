import { describe, expect, it } from 'vitest';
import { getByPath } from './jsonPath';

describe('getByPath', () => {
  it('resolves a nested dot-notation path', () => {
    expect(getByPath({ bill_summary: { case_verdict: 0 } }, 'bill_summary.case_verdict')).toBe(0);
  });

  it('resolves a top-level key', () => {
    expect(getByPath({ stage: 'categorisation', score: 0.938 }, 'stage')).toBe('categorisation');
  });

  it('returns undefined when a key is missing', () => {
    expect(getByPath({}, 'missing.key')).toBeUndefined();
  });

  it('resolves array index notation', () => {
    expect(getByPath({ charges: [{ amount: 10 }] }, 'charges[0].amount')).toBe(10);
  });

  it('returns undefined when the path string is empty', () => {
    expect(getByPath({ a: 1 }, '')).toBeUndefined();
  });

  it('returns undefined when an intermediate value is null', () => {
    expect(getByPath({ a: null }, 'a.b')).toBeUndefined();
  });

  it('returns undefined when an intermediate value is undefined', () => {
    expect(getByPath({ a: undefined }, 'a.b')).toBeUndefined();
  });

  it('returns undefined when an intermediate value is a primitive that cannot be indexed', () => {
    expect(getByPath({ a: 5 }, 'a.b')).toBeUndefined();
  });

  it('returns undefined when the object itself is null', () => {
    expect(getByPath(null, 'a.b')).toBeUndefined();
  });

  it('returns undefined when an array index is out of bounds', () => {
    expect(getByPath({ charges: [{ amount: 10 }] }, 'charges[5].amount')).toBeUndefined();
  });

  it('resolves a value of 0 without treating it as falsy/missing', () => {
    expect(getByPath({ score: 0 }, 'score')).toBe(0);
  });
});
