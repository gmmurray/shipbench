import { describe, expect, it } from 'vitest';
import { frontmatterBlock } from './UnreadableTaskCard.js';

describe('frontmatterBlock', () => {
  const file = ['---', 'title: A', 'title: B', '---', '', 'Body.'];

  it('returns the frontmatter through its closing fence', () => {
    expect(frontmatterBlock(file.join('\n'))).toBe(
      '---\ntitle: A\ntitle: B\n---',
    );
  });

  it('handles CRLF files', () => {
    expect(frontmatterBlock(file.join('\r\n'))).toBe(
      '---\ntitle: A\ntitle: B\n---',
    );
  });

  it('handles a leading byte order mark', () => {
    expect(
      frontmatterBlock(String.fromCharCode(0xfeff) + file.join('\n')),
    ).toContain('title: B\n---');
  });

  it('returns the whole file when the fence never closes', () => {
    const unclosed = '---\ntitle: [unclosed\n\nBody.';
    expect(frontmatterBlock(unclosed)).toBe(unclosed);
  });
});
