import * as RadixSelect from '@radix-ui/react-select';

import type { ReactNode } from 'react';
import { RxCheck } from 'react-icons/rx';
import { Chevron } from './Chevron.js';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps {
  value: string;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  ariaLabel?: string;
  /** Optional first entry that maps to `""` (e.g. "None"). */
  emptyOption?: { label: string };
  /** Render the column-marker square before the value — the shared "status"
   * visual language across board columns, select triggers, and card headers. */
  statusMarker?: boolean;
}

export function Select({
  value,
  onValueChange,
  options,
  placeholder,
  ariaLabel,
  emptyOption,
  statusMarker = false,
}: SelectProps) {
  // Radix Select uses `__none__` for the empty entry because it disallows
  // `value=""` on items.
  const NONE_SENTINEL = '__none__';
  const internalValue = value === '' ? NONE_SENTINEL : value;

  return (
    <RadixSelect.Root
      value={internalValue}
      onValueChange={next => onValueChange(next === NONE_SENTINEL ? '' : next)}
    >
      <RadixSelect.Trigger
        aria-label={ariaLabel}
        className="flex h-9 w-full items-center justify-between gap-2 rounded border border-sb-iron bg-sb-surface2 px-3 text-left text-[13px] text-sb-frosted outline-none transition-colors hover:border-sb-silver focus:border-sb-silver data-placeholder:text-sb-silver"
      >
        <span className="flex min-w-0 items-center gap-2 truncate">
          {statusMarker && internalValue !== NONE_SENTINEL ? (
            <span
              className="h-2.5 w-2.5 shrink-0 bg-sb-frosted"
              aria-hidden="true"
            />
          ) : null}
          <RadixSelect.Value placeholder={placeholder} />
        </span>
        <RadixSelect.Icon className="shrink-0 text-sb-silver">
          <Chevron className="h-2.5 w-2.5 rotate-90" />
        </RadixSelect.Icon>
      </RadixSelect.Trigger>

      <RadixSelect.Portal>
        <RadixSelect.Content
          className="z-50 overflow-hidden rounded border border-sb-iron bg-sb-surface text-[13px] text-sb-frosted"
          position="popper"
          sideOffset={4}
        >
          <RadixSelect.Viewport className="p-1">
            {emptyOption ? (
              <Item value={NONE_SENTINEL}>{emptyOption.label}</Item>
            ) : null}
            {options.map(option => (
              <Item key={option.value} value={option.value}>
                {option.label}
              </Item>
            ))}
          </RadixSelect.Viewport>
        </RadixSelect.Content>
      </RadixSelect.Portal>
    </RadixSelect.Root>
  );
}

function Item({ value, children }: { value: string; children: ReactNode }) {
  return (
    <RadixSelect.Item
      className="relative flex h-8 cursor-default select-none items-center rounded px-2 pr-8 text-sb-silver outline-none transition-colors data-highlighted:bg-sb-surface2 data-highlighted:text-sb-frosted data-[state=checked]:text-sb-frosted"
      value={value}
    >
      <RadixSelect.ItemText>{children}</RadixSelect.ItemText>
      <RadixSelect.ItemIndicator className="absolute right-2 inline-flex items-center">
        <RxCheck aria-hidden="true" className="h-3.5 w-3.5" />
      </RadixSelect.ItemIndicator>
    </RadixSelect.Item>
  );
}
