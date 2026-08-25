import { Chevron } from './Chevron.js';

/** Doctrine: Component primitives › Priority meter. One chevron per configured
 * priority tier — filled at or below the current value, dim above. Priorities
 * come from `config.priority.values`, never a hardcoded low/medium/high, so the
 * meter renders only when the value maps to a sane configured scale and falls
 * back to a plain mono chip otherwise. */
export function PriorityMeter({
  value,
  values,
}: {
  value: string;
  values: string[];
}) {
  const level = values.indexOf(value) + 1;
  const meterFits = level > 0 && values.length >= 2 && values.length <= 5;

  if (!meterFits) {
    return (
      <span className="max-w-full truncate rounded border border-sb-iron px-1.5 py-0.5 font-mono text-[11px] text-sb-silver">
        {value}
      </span>
    );
  }

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded border border-sb-iron px-1.5 py-0.5"
      title={`Priority: ${value}`}
    >
      <span className="flex items-center gap-[1px]" aria-hidden="true">
        {values.map((tier, index) => (
          <Chevron
            key={tier}
            className={`h-2.5 w-2.5 ${
              index < level ? 'text-sb-frosted' : 'text-sb-iron'
            }`}
          />
        ))}
      </span>
      <span className="font-mono text-[11px] text-sb-silver">{value}</span>
    </span>
  );
}
