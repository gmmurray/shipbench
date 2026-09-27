import type { UnreadableTaskFile } from '@shipbench/core';
import { RxExclamationTriangle } from 'react-icons/rx';

/**
 * The frontmatter block of a file, verbatim: from the opening `---` through the
 * closing one. Falls back to the whole file when there is no closing fence,
 * since then the whole file is what the parser tried to read.
 */
export function frontmatterBlock(content: string): string {
  // trim() also drops a leading BOM, so the fence check needs no special case.
  const lines = content.split(/\r?\n/);
  if (lines[0]?.trim() !== '---') return content;
  const close = lines.findIndex(
    (line, index) =>
      index > 0 && (line.trim() === '---' || line.trim() === '...'),
  );
  return close < 0 ? content : lines.slice(0, close + 1).join('\n');
}

/**
 * A task file whose frontmatter did not parse. It has no title, status, or
 * fields to render, so the card shows what someone needs to repair it: which
 * file, why, and the frontmatter exactly as written. Deliberately read-only and
 * not Markdown — rendering would hide the very markup that broke the parse.
 */
export function UnreadableTaskCard({ file }: { file: UnreadableTaskFile }) {
  return (
    <article
      aria-label={`Unreadable task file ${file.path}`}
      className="rounded-md border border-sb-iron bg-sb-surface p-3"
    >
      <div className="flex items-start gap-2">
        <RxExclamationTriangle
          aria-hidden="true"
          className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sb-warning"
        />
        <div className="min-w-0">
          <h3 className="truncate font-mono text-[13px] text-sb-frosted">
            {file.slug}
          </h3>
          <p className="mt-0.5 truncate font-mono text-[11px] text-sb-silver">
            {file.path}
          </p>
        </div>
      </div>
      <p className="mt-3 font-mono text-[11px] leading-5 text-sb-warning">
        Frontmatter does not parse: {file.reason}
      </p>
      <pre className="mt-2 max-h-64 overflow-auto rounded border border-sb-iron bg-sb-surface2 px-3 py-2 font-mono text-[12px] leading-relaxed text-sb-silver">
        {frontmatterBlock(file.content)}
      </pre>
      <p className="mt-2 text-[12px] text-sb-silver">
        Fix it in the file to restore the task.
      </p>
    </article>
  );
}
