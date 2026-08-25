// Doctrine: Iconography › the pointing/gauge primitive. A horizontal `>` shape
// used for breadcrumb separators, priority indicators, select-trigger arrows,
// and prev/next navigation. Semantic actions use Radix Icons (react-icons/rx)
// instead — never both for the same purpose.
//
// Fold/unfold is NOT one of its jobs; that belongs to the doctrine's `#disc`
// marker. The Board has no disclosure toggles, so it declares no `#disc`.

// Distinct from Harbor's `#chev` so the embedded Board never depends on (or
// collides with) symbols the host page may or may not define.
const SYMBOL_ID = 'sb-chev';

/** Inline SVG <symbol> for the chevron primitive. Mounted once in the Board
 * root; every `<Chevron />` references it via `<use>`. Color propagates
 * through `currentColor` — set with any text utility. */
export function ChevronDefs() {
  return (
    <svg width="0" height="0" className="absolute" aria-hidden="true">
      <defs>
        <symbol id={SYMBOL_ID} viewBox="0 0 24 24">
          <path
            fill="currentColor"
            d="M3 2.5 L15 12 L3 21.5 L8.6 21.5 L20.6 12 L8.6 2.5 Z"
          />
        </symbol>
      </defs>
    </svg>
  );
}

export function Chevron({ className = 'h-2.5 w-2.5' }: { className?: string }) {
  return (
    <svg className={className} aria-hidden="true">
      <use href={`#${SYMBOL_ID}`} />
    </svg>
  );
}
