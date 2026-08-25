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
