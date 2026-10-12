import type { TaskFrontmatter } from '@shipbench/core';

/**
 * Prepares task fields for a JSON request body.
 *
 * The Board clears a field by passing it as `undefined`, and `JSON.stringify`
 * drops such a key entirely, so the server would see no change at all. Sending
 * `null` keeps the key; the CLI's board server turns it back into `undefined`.
 */
export function wireFields(
  fields: Partial<TaskFrontmatter>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [
      key,
      value === undefined ? null : value,
    ]),
  );
}
