import { relatedSlugs, type Task, type TaskFrontmatter } from '@shipbench/core';
import { dedupePreservingCase } from './options.js';

/** The metadata flags `task edit` takes, as commander parses them. */
export interface TaskEditRequest {
  title?: string;
  priority?: string;
  assignee?: string;
  clearAssignee?: boolean;
  tags?: string[];
  addTag?: string[];
  removeTag?: string[];
  clearTags?: boolean;
  dependsOn?: string[];
  addDependsOn?: string[];
  removeDependsOn?: string[];
  clearDependsOn?: boolean;
  related?: string[];
  addRelated?: string[];
  removeRelated?: string[];
  clearRelated?: boolean;
}

export interface TaskEditDiff {
  /** The fields to hand `updateTask`; only those that change are present. */
  fields: Partial<TaskFrontmatter>;
  /** One human-readable entry per changed field, in the order they are reported. */
  changes: string[];
}

/**
 * A list field as stored, for an edit that rewrites it. A hand edit can leave
 * a bare string, a null where a null is not allowed, or non-text entries; the
 * edit then starts from the text entries it can keep and always writes, so
 * the command `shipbench validate` suggests repairs the field instead of
 * comparing against a list that is not there.
 */
interface StoredList {
  values: string[];
  valid: boolean;
  raw: unknown;
}

function storedList(raw: unknown, nullIsValid: boolean): StoredList {
  if (raw === undefined || (raw === null && nullIsValid)) {
    return { values: [], valid: true, raw };
  }
  if (!Array.isArray(raw)) return { values: [], valid: false, raw };
  const values = raw.filter(
    (entry): entry is string => typeof entry === 'string',
  );
  return { values, valid: values.length === raw.length, raw };
}

function listChanged(current: StoredList, next: readonly string[]): boolean {
  return (
    !current.valid ||
    next.length !== current.values.length ||
    next.some((value, index) => value !== current.values[index])
  );
}

function storedRelated(task: Task): StoredList {
  const current = storedList(task.frontmatter.related, true);
  if (current.valid) current.values = relatedSlugs(task);
  return current;
}

/** Whether the request names any metadata change at all. */
export function requestsMetadataChange(request: TaskEditRequest): boolean {
  return (
    request.title !== undefined ||
    request.priority !== undefined ||
    request.assignee !== undefined ||
    Boolean(request.clearAssignee) ||
    request.tags !== undefined ||
    request.addTag !== undefined ||
    request.removeTag !== undefined ||
    Boolean(request.clearTags) ||
    request.dependsOn !== undefined ||
    request.addDependsOn !== undefined ||
    request.removeDependsOn !== undefined ||
    Boolean(request.clearDependsOn) ||
    request.related !== undefined ||
    request.addRelated !== undefined ||
    request.removeRelated !== undefined ||
    Boolean(request.clearRelated)
  );
}

/**
 * The `--remove-related` targets this task's own file does not record. An
 * association can be recorded on the other task's file instead, and an edit
 * only writes this one, so removing such a link would succeed without
 * changing anything a reader sees. The caller says where the link lives.
 */
export function relatedRemovalsNotRecordedHere(
  task: Task,
  request: TaskEditRequest,
): string[] {
  if (request.related !== undefined || request.clearRelated) return [];
  if (request.addRelated === undefined && request.removeRelated === undefined) {
    return [];
  }
  const current = storedRelated(task);
  return (request.removeRelated ?? []).filter(
    target => !current.values.includes(target),
  );
}

/**
 * Works out what an edit writes and how to report it. Every requested value
 * that already matches is left out, so an edit that changes nothing has no
 * fields and no changes.
 */
export function diffTaskEdit(
  task: Task,
  request: TaskEditRequest,
): TaskEditDiff {
  const before = task.frontmatter;
  const fields: Partial<TaskFrontmatter> = {};
  const changes: string[] = [];
  const list = (values: readonly string[]): string =>
    values.length > 0 ? `[${values.join(', ')}]` : '(none)';
  const storedAs = (stored: StoredList): string =>
    stored.valid
      ? list(stored.values)
      : `(invalid: ${JSON.stringify(stored.raw)})`;

  if (request.title !== undefined && request.title !== before.title) {
    fields.title = request.title;
    changes.push(`title "${before.title}" → "${request.title}"`);
  }

  if (request.priority !== undefined && request.priority !== before.priority) {
    fields.priority = request.priority;
    changes.push(
      `priority ${before.priority ?? '(unset)'} → ${request.priority}`,
    );
  }

  if (request.assignee !== undefined) {
    if (request.assignee !== (before.assignee ?? undefined)) {
      fields.assignee = request.assignee;
      changes.push(
        `assignee ${before.assignee ?? '(unset)'} → ${request.assignee}`,
      );
    }
  } else if (request.clearAssignee && before.assignee !== undefined) {
    fields.assignee = undefined;
    changes.push(`assignee ${before.assignee} → (unset)`);
  }

  const currentTags = storedList(before.tags, true);
  let nextTags: string[] | undefined;
  if (request.tags !== undefined) {
    nextTags = dedupePreservingCase(request.tags);
  } else if (request.clearTags) {
    nextTags = [];
  } else if (request.addTag !== undefined || request.removeTag !== undefined) {
    const removed = new Set(
      (request.removeTag ?? []).map(tag => tag.toLowerCase()),
    );
    nextTags = dedupePreservingCase([
      ...currentTags.values.filter(tag => !removed.has(tag.toLowerCase())),
      ...(request.addTag ?? []),
    ]);
  }
  if (nextTags !== undefined && listChanged(currentTags, nextTags)) {
    fields.tags = nextTags.length > 0 ? nextTags : undefined;
    changes.push(`tags ${storedAs(currentTags)} → ${list(nextTags)}`);
  }

  // An empty `depends_on:` is not a list to availability, so null is invalid.
  const currentDeps = storedList(before.depends_on, false);
  let nextDeps: string[] | undefined;
  if (request.dependsOn !== undefined) {
    nextDeps = dedupePreservingCase(request.dependsOn);
  } else if (request.clearDependsOn) {
    nextDeps = [];
  } else if (
    request.addDependsOn !== undefined ||
    request.removeDependsOn !== undefined
  ) {
    const removed = new Set(request.removeDependsOn ?? []);
    nextDeps = dedupePreservingCase([
      ...currentDeps.values.filter(dep => !removed.has(dep)),
      ...(request.addDependsOn ?? []),
    ]);
  }
  if (nextDeps !== undefined && listChanged(currentDeps, nextDeps)) {
    // Core keys dependency handling off `'depends_on' in fields`, so an empty
    // array is the explicit "clear" signal it normalizes away on write.
    fields.depends_on = nextDeps;
    changes.push(`depends_on ${storedAs(currentDeps)} → ${list(nextDeps)}`);
  }

  const currentRelated = storedRelated(task);
  let nextRelated: string[] | undefined;
  if (request.related !== undefined) {
    nextRelated = dedupePreservingCase(request.related);
  } else if (request.clearRelated) {
    nextRelated = [];
  } else if (
    request.addRelated !== undefined ||
    request.removeRelated !== undefined
  ) {
    const removed = new Set(request.removeRelated ?? []);
    nextRelated = dedupePreservingCase([
      ...currentRelated.values.filter(target => !removed.has(target)),
      ...(request.addRelated ?? []),
    ]);
  }
  if (nextRelated !== undefined && listChanged(currentRelated, nextRelated)) {
    fields.related = nextRelated;
    changes.push(`related ${storedAs(currentRelated)} → ${list(nextRelated)}`);
  }

  return { fields, changes };
}
