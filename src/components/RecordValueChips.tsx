import type { EventItem, EventRecord } from '../types/models';
import { getColorToken } from '../constants/theme';
import { formatCleanNumber } from '../utils/stats';

interface RecordValueChipsProps {
  event: EventItem;
  record: EventRecord;
  isDark?: boolean;
  compact?: boolean;
}

export function RecordValueChips({
  event,
  record,
  isDark = false,
  compact,
}: RecordValueChipsProps) {
  const color = getColorToken(event.color, isDark);
  const chips: { key: string; label: string; bg: string; fg: string }[] = [];

  for (const field of event.fields) {
    const val = record.values[field.id];
    if (val === undefined || val === '' || (Array.isArray(val) && val.length === 0)) {
      continue;
    }

    if (field.type === 'number' && typeof val === 'number') {
      chips.push({
        key: field.id,
        label: `${formatCleanNumber(val)}${field.unit ? ` ${field.unit}` : ''}`,
        bg: color.soft,
        fg: color.ink,
      });
    } else if (field.type === 'select') {
      const ids = Array.isArray(val) ? val : [String(val)];
      for (const id of ids) {
        const opt = field.options.find((o) => o.id === id);
        if (opt) {
          chips.push({
            key: `${field.id}_${id}`,
            label: opt.label,
            bg: 'var(--bg-subtle)',
            fg: 'var(--fg-secondary)',
          });
        }
      }
    } else if (field.type === 'text' && typeof val === 'string') {
      chips.push({
        key: field.id,
        label: val,
        bg: 'var(--bg-subtle)',
        fg: 'var(--fg-secondary)',
      });
    }
  }

  const hasContent = chips.length > 0 || Boolean(record.note);

  if (!hasContent) {
    return (
      <span className="text-sm text-[var(--fg-secondary)]">
        {compact ? '已完成' : '记录一次'}
      </span>
    );
  }

  return (
    <div className="space-y-1.5">
      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {chips.map((c) => (
            <span
              key={c.key}
              className="inline-flex items-center rounded-lg px-2 py-0.5 text-xs font-semibold"
              style={{ backgroundColor: c.bg, color: c.fg }}
            >
              {c.label}
            </span>
          ))}
        </div>
      )}
      {record.note && (
        <p className="text-[13px] leading-relaxed text-[var(--fg-secondary)]">
          {record.note}
        </p>
      )}
    </div>
  );
}
