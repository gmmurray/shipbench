/**
 * Calculate estimated reading time in minutes based on 200 words per minute.
 */
export function getReadingTime(content: string): string {
  if (!content) return '1 min read';
  // Strip code blocks and markdown tags for cleaner word count
  const cleanText = content
    .replace(/```[\s\S]*?```/g, '')
    .replace(/<[^>]*>/g, '')
    .trim();
  const words = cleanText.split(/\s+/).filter(Boolean).length;
  const minutes = Math.max(1, Math.ceil(words / 200));
  return `${minutes} min read`;
}

/**
 * Format a Date or date string to MM-DD-YYYY format (e.g. 07-23-2026).
 */
export function formatDate(date?: Date | string): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return String(date);

  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  const year = d.getUTCFullYear();

  return `${month}-${day}-${year}`;
}
