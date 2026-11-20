import type { Task, TaskFrontmatter } from '@shipbench/core';
import { describe, expect, it } from 'vitest';
import {
  diffTaskEdit,
  relatedRemovalsNotRecordedHere,
  requestsMetadataChange,
} from './editFields.js';

function task(frontmatter: Record<string, unknown> = {}): Task {
  return {
    slug: 'subject',
    frontmatter: {
      title: 'Subject',
      status: 'todo',
      created: '2026-01-01T00:00:00.000Z',
      updated: '2026-01-01T00:00:00.000Z',
      ...frontmatter,
    } as TaskFrontmatter,
    body: '',
    comments: [],
  };
}

describe('requestsMetadataChange', () => {
  it('is false for an empty request and for clear flags left off', () => {
    expect(requestsMetadataChange({})).toBe(false);
    expect(
      requestsMetadataChange({
        clearAssignee: false,
        clearTags: false,
        clearDependsOn: false,
        clearRelated: false,
      }),
    ).toBe(false);
  });

  it('is true for any one flag, including an empty list', () => {
    expect(requestsMetadataChange({ title: 'New' })).toBe(true);
    expect(requestsMetadataChange({ clearTags: true })).toBe(true);
    expect(requestsMetadataChange({ removeRelated: [] })).toBe(true);
  });
});

describe('diffTaskEdit', () => {
  it('leaves out every value that already matches', () => {
    const diff = diffTaskEdit(
      task({ priority: 'high', assignee: 'claude', tags: ['a'] }),
      {
        title: 'Subject',
        priority: 'high',
        assignee: 'claude',
        tags: ['a'],
        addDependsOn: [],
        clearRelated: true,
      },
    );
    expect(diff).toEqual({ fields: {}, changes: [] });
  });

  it('reports scalar changes in field order', () => {
    const diff = diffTaskEdit(task({ priority: 'low' }), {
      assignee: 'claude',
      priority: 'high',
      title: 'Renamed',
    });
    expect(diff.fields).toEqual({
      title: 'Renamed',
      priority: 'high',
      assignee: 'claude',
    });
    expect(diff.changes).toEqual([
      'title "Subject" → "Renamed"',
      'priority low → high',
      'assignee (unset) → claude',
    ]);
  });

  it('clears an assignee with an explicit undefined, and only when one is set', () => {
    const cleared = diffTaskEdit(task({ assignee: 'claude' }), {
      clearAssignee: true,
    });
    expect('assignee' in cleared.fields).toBe(true);
    expect(cleared.fields.assignee).toBeUndefined();
    expect(cleared.changes).toEqual(['assignee claude → (unset)']);

    expect(diffTaskEdit(task(), { clearAssignee: true }).changes).toEqual([]);
  });

  it('adds and removes tags case-insensitively, keeping the first spelling', () => {
    const diff = diffTaskEdit(task({ tags: ['Docs', 'site'] }), {
      addTag: ['docs', 'CLI', 'cli'],
      removeTag: ['SITE'],
    });
    expect(diff.fields.tags).toEqual(['Docs', 'CLI']);
    expect(diff.changes).toEqual(['tags [Docs, site] → [Docs, CLI]']);
  });

  it('writes no tags field when the result is empty', () => {
    const diff = diffTaskEdit(task({ tags: ['a'] }), { removeTag: ['a'] });
    expect('tags' in diff.fields).toBe(true);
    expect(diff.fields.tags).toBeUndefined();
    expect(diff.changes).toEqual(['tags [a] → (none)']);
  });

  it('treats a null tags field as an empty list', () => {
    expect(diffTaskEdit(task({ tags: null }), { clearTags: true })).toEqual({
      fields: {},
      changes: [],
    });
  });

  it('clears dependencies with an explicit empty array', () => {
    const diff = diffTaskEdit(task({ depends_on: ['a', 'b'] }), {
      clearDependsOn: true,
    });
    expect(diff.fields).toEqual({ depends_on: [] });
    expect(diff.changes).toEqual(['depends_on [a, b] → (none)']);
  });

  it('removes dependencies by exact slug and dedupes additions', () => {
    const diff = diffTaskEdit(task({ depends_on: ['a', 'b'] }), {
      addDependsOn: ['c', 'C', 'a'],
      removeDependsOn: ['B', 'b'],
    });
    expect(diff.fields.depends_on).toEqual(['a', 'c']);
  });

  describe('a list field a hand edit left malformed', () => {
    it('repairs a bare string even when the request names nothing new', () => {
      const diff = diffTaskEdit(task({ tags: 'docs' }), { clearTags: true });
      expect(diff.fields.tags).toBeUndefined();
      expect('tags' in diff.fields).toBe(true);
      expect(diff.changes).toEqual(['tags (invalid: "docs") → (none)']);
    });

    it('treats a null depends_on as invalid, unlike tags', () => {
      const diff = diffTaskEdit(task({ depends_on: null }), {
        clearDependsOn: true,
      });
      expect(diff.fields).toEqual({ depends_on: [] });
      expect(diff.changes).toEqual(['depends_on (invalid: null) → (none)']);
    });

    it('keeps the text entries and drops the rest', () => {
      const diff = diffTaskEdit(task({ tags: ['a', 1, null] }), {
        addTag: ['b'],
      });
      expect(diff.fields.tags).toEqual(['a', 'b']);
      expect(diff.changes).toEqual(['tags (invalid: ["a",1,null]) → [a, b]']);
    });

    it('writes a replacement that matches the text entries', () => {
      const diff = diffTaskEdit(task({ related: ['a', 2] }), {
        related: ['a'],
      });
      expect(diff.fields).toEqual({ related: ['a'] });
      expect(diff.changes).toEqual(['related (invalid: ["a",2]) → [a]']);
    });
  });

  it('starts related edits from the slugs core reads', () => {
    const diff = diffTaskEdit(task({ related: [' a ', 'a', 'b'] }), {
      addRelated: ['c'],
      removeRelated: ['b'],
    });
    expect(diff.fields).toEqual({ related: ['a', 'c'] });
    expect(diff.changes).toEqual(['related [a, b] → [a, c]']);
  });
});

describe('relatedRemovalsNotRecordedHere', () => {
  const subject = task({ related: ['own'] });

  it('names removals this file does not record', () => {
    expect(
      relatedRemovalsNotRecordedHere(subject, {
        removeRelated: ['own', 'elsewhere'],
      }),
    ).toEqual(['elsewhere']);
  });

  it('is empty when the request replaces or clears the list', () => {
    expect(
      relatedRemovalsNotRecordedHere(subject, {
        related: [],
        removeRelated: ['elsewhere'],
      }),
    ).toEqual([]);
    expect(
      relatedRemovalsNotRecordedHere(subject, {
        clearRelated: true,
        removeRelated: ['elsewhere'],
      }),
    ).toEqual([]);
  });

  it('treats a malformed related field as recording nothing', () => {
    expect(
      relatedRemovalsNotRecordedHere(task({ related: 'own' }), {
        removeRelated: ['own'],
      }),
    ).toEqual(['own']);
  });
});
