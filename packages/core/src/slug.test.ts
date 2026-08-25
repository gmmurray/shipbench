import { describe, expect, it } from 'vitest';
import { resolveSlugCollision, slugify } from './slug.js';

describe('slugify', () => {
  describe('basic transformations', () => {
    it('lowercases and hyphenates words', () => {
      expect(slugify('Setup GitHub OAuth')).toBe('setup-github-oauth');
    });

    it('collapses runs of whitespace into a single hyphen', () => {
      expect(slugify('a   b\t\tc')).toBe('a-b-c');
    });

    it('converts underscores to hyphens', () => {
      expect(slugify('my_task_name')).toBe('my-task-name');
    });

    it('collapses consecutive hyphens', () => {
      expect(slugify('foo---bar')).toBe('foo-bar');
    });

    it('preserves digits', () => {
      expect(slugify('release 42')).toBe('release-42');
    });
  });

  describe('special characters', () => {
    it('hyphenates punctuation', () => {
      expect(slugify('Fix bug #123!')).toBe('fix-bug-123');
    });

    it('hyphenates dots in version numbers', () => {
      expect(slugify('upgrade to 2.0')).toBe('upgrade-to-2-0');
    });

    it('hyphenates slashes and colons', () => {
      expect(slugify('Scaffold apps/cli with chosen stack')).toBe(
        'scaffold-apps-cli-with-chosen-stack',
      );
      expect(slugify('Draft the /projects/:id/connect endpoint contract')).toBe(
        'draft-the-projects-id-connect-endpoint-contract',
      );
    });

    it('hyphenates common token separators', () => {
      expect(slugify('R&D + C# @ Home')).toBe('r-d-c-home');
    });

    it('collapses back-to-back special characters', () => {
      expect(slugify('alpha/&:+#@/beta')).toBe('alpha-beta');
    });
  });

  describe('trimming', () => {
    it('trims leading and trailing whitespace', () => {
      expect(slugify('  hello world  ')).toBe('hello-world');
    });

    it('strips leading and trailing hyphens', () => {
      expect(slugify('---hello---')).toBe('hello');
    });

    it('strips hyphens left behind by trimmed special chars', () => {
      expect(slugify('!hello!')).toBe('hello');
    });
  });

  describe('edge cases', () => {
    it('returns empty string for empty input', () => {
      expect(slugify('')).toBe('');
    });

    it('returns empty string when only special characters are present', () => {
      expect(slugify('!!!')).toBe('');
    });

    it('returns empty string when only whitespace is present', () => {
      expect(slugify('   ')).toBe('');
    });

    it('handles accented latin letters', () => {
      // Spec says "no special characters" — accents should be normalized,
      // not silently dropped along with the base letter.
      expect(slugify('café')).toBe('cafe');
    });
  });
});

describe('resolveSlugCollision', () => {
  it('returns the original slug when it is not taken', () => {
    expect(resolveSlugCollision('my-task', new Set())).toBe('my-task');
  });

  it('appends -2 on first collision', () => {
    expect(resolveSlugCollision('my-task', new Set(['my-task']))).toBe(
      'my-task-2',
    );
  });

  it('walks the counter until it finds a free slug', () => {
    expect(
      resolveSlugCollision(
        'my-task',
        new Set(['my-task', 'my-task-2', 'my-task-3']),
      ),
    ).toBe('my-task-4');
  });

  it('returns the original slug even if a numbered variant is taken', () => {
    // The base slug being free is what matters.
    expect(resolveSlugCollision('my-task', new Set(['my-task-2']))).toBe(
      'my-task',
    );
  });
});
