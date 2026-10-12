import { describe, expect, it } from 'vitest';
import { wireFields } from './wireFields.js';

describe('wireFields', () => {
  it('keeps a cleared field in the JSON body as null', () => {
    const body = JSON.stringify(
      wireFields({ assignee: undefined, flag: undefined, title: 'Kept' }),
    );

    expect(JSON.parse(body)).toEqual({
      assignee: null,
      flag: null,
      title: 'Kept',
    });
  });
});
