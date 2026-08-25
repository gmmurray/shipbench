import { describe, expect, it } from 'vitest';
import { shouldUseColor } from './terminal.js';

describe('shouldUseColor', () => {
  it('allows ANSI only for an interactive stdout', () => {
    expect(shouldUseColor({}, true)).toBe(true);
    expect(shouldUseColor({}, false)).toBe(false);
  });

  it('honors NO_COLOR even when its value is empty', () => {
    expect(shouldUseColor({ NO_COLOR: '' }, true)).toBe(false);
    expect(shouldUseColor({ NO_COLOR: '1' }, true)).toBe(false);
  });

  it('never lets FORCE_COLOR override a redirected stdout', () => {
    expect(shouldUseColor({ FORCE_COLOR: '1' }, false)).toBe(false);
  });

  it('lets NO_COLOR override FORCE_COLOR', () => {
    expect(shouldUseColor({ FORCE_COLOR: '1', NO_COLOR: '1' }, true)).toBe(
      false,
    );
  });
});
