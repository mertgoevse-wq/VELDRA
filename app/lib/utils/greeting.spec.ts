import { describe, expect, it } from 'vitest';
import { BUILD_PROMPTS, composeGreeting, getTimeOfDayGreeting } from './greeting';

function atHour(hour: number): Date {
  const date = new Date(2026, 0, 1, hour, 0, 0);
  return date;
}

describe('getTimeOfDayGreeting', () => {
  it('returns a late-night greeting before 5am', () => {
    expect(getTimeOfDayGreeting(atHour(0))).toBe('Still up');
    expect(getTimeOfDayGreeting(atHour(4))).toBe('Still up');
  });

  it('returns a morning greeting from 5am up to (not including) noon', () => {
    expect(getTimeOfDayGreeting(atHour(5))).toBe('Good morning');
    expect(getTimeOfDayGreeting(atHour(11))).toBe('Good morning');
  });

  it('returns an afternoon greeting from noon up to (not including) 6pm', () => {
    expect(getTimeOfDayGreeting(atHour(12))).toBe('Good afternoon');
    expect(getTimeOfDayGreeting(atHour(17))).toBe('Good afternoon');
  });

  it('returns an evening greeting from 6pm onward', () => {
    expect(getTimeOfDayGreeting(atHour(18))).toBe('Good evening');
    expect(getTimeOfDayGreeting(atHour(23))).toBe('Good evening');
  });
});

describe('composeGreeting', () => {
  it('omits the name when none is given', () => {
    expect(composeGreeting(atHour(9))).toBe('Good morning.');
  });

  it('omits the name when it is empty or whitespace-only', () => {
    expect(composeGreeting(atHour(9), '')).toBe('Good morning.');
    expect(composeGreeting(atHour(9), '   ')).toBe('Good morning.');
  });

  it('includes a trimmed name when provided', () => {
    expect(composeGreeting(atHour(9), '  Mert  ')).toBe('Good morning, Mert.');
  });

  it('uses the correct greeting at each boundary with a name', () => {
    expect(composeGreeting(atHour(14), 'Mert')).toBe('Good afternoon, Mert.');
    expect(composeGreeting(atHour(20), 'Mert')).toBe('Good evening, Mert.');
  });
});

describe('BUILD_PROMPTS', () => {
  it('is a non-empty list of distinct, original lines', () => {
    expect(BUILD_PROMPTS.length).toBeGreaterThan(1);
    expect(new Set(BUILD_PROMPTS).size).toBe(BUILD_PROMPTS.length);

    for (const line of BUILD_PROMPTS) {
      expect(line.length).toBeGreaterThan(0);
    }
  });
});
