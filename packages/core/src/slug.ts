export function slugify(title: string): string {
  return title
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function resolveSlugCollision(
  slug: string,
  existingSlugs: Set<string>,
): string {
  if (!existingSlugs.has(slug)) return slug;

  let counter = 2;
  while (existingSlugs.has(`${slug}-${counter}`)) {
    counter++;
  }

  return `${slug}-${counter}`;
}

/**
 * Rejects a slug that is not a single path segment, so a slug can only ever
 * name a file directly inside the tasks directory.
 *
 * This deliberately does not require the shape `slugify` produces: `listTasks`
 * returns every `*.md` filename as a slug, and a hand-created `My_Task.md` has
 * to stay readable and movable through core.
 */
export function assertTaskSlug(slug: string): void {
  if (slug === '' || slug === '.' || slug === '..' || /[/\\\0]/.test(slug)) {
    throw new Error(
      `Invalid task slug ${JSON.stringify(slug)}: a slug names one file in the tasks directory, so it cannot be empty, "." or "..", or contain "/", "\\", or a NUL character.`,
    );
  }
}
