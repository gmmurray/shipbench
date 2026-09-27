import type { TaskSearchMatch } from '@shipbench/core';
import { localDateTime } from '../utils/time.js';

/**
 * Where a search term was found when the card itself does not show it: one
 * excerpt from the description or a Task Update, plus a count of any other
 * matching Updates. An Update excerpt shows its timestamp rather than a label
 * like "current", because the task's column is its present state and the
 * Update is a record of what was said then.
 */
export function SearchMatchContext({ match }: { match: TaskSearchMatch }) {
  const updates = match.update_matches ?? [];
  const [firstUpdate, ...laterUpdates] = updates;

  let excerpt: { source: React.ReactNode; text: string };
  let moreUpdates: number;
  if (match.snippet !== undefined) {
    excerpt = { source: 'description', text: match.snippet };
    moreUpdates = updates.length;
  } else if (firstUpdate !== undefined) {
    excerpt = {
      source:
        'unreadable' in firstUpdate ? (
          'unreadable Task Updates'
        ) : (
          <>
            Update ·{' '}
            <time dateTime={firstUpdate.timestamp}>
              {localDateTime(firstUpdate.timestamp)}
            </time>
          </>
        ),
      text: firstUpdate.snippet,
    };
    moreUpdates = laterUpdates.length;
  } else {
    return null;
  }

  return (
    <div className="mt-3 border-t border-sb-iron pt-2.5">
      <p className="font-mono text-[11px] text-sb-silver">
        Found in {excerpt.source}
      </p>
      <p className="mt-1 line-clamp-3 wrap-break-word text-[12px] leading-5 text-sb-frosted">
        {excerpt.text}
      </p>
      {moreUpdates > 0 ? (
        <p className="mt-1 font-mono text-[11px] text-sb-silver">
          {`Also in ${moreUpdates} ${match.snippet !== undefined ? '' : 'more '}${
            moreUpdates === 1 ? 'Task Update' : 'Task Updates'
          }`}
        </p>
      ) : null}
    </div>
  );
}
