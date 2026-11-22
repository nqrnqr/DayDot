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
  const rows: { key: string; label: string; value: string; isPrimary?: boolean }[] = [];

  for (const field of event.fields) {
    const val = record.values[field.id];
    if (val === undefined || val === '' || (Array.isArray(val) && val.length === 0)) {
      continue;
    }

    if (field.type === 'number' && typeof val === 'number') {
      rows.push({
        key: field.id,
        label: field.name,
        value: `${formatCleanNumber(val)}${field.unit ? ` ${field.unit}` : ''}`,
        isPrimary: true,
      });
    } else if (field.type === 'select') {
      const ids = Array.isArray(val) ? val : [String(val)];
      const labels = ids
        .map((id) => field.options.find((o) => o.id === id)?.label)
        .filter((s): s is string => Boolean(s));
      if (labels.length > 0) {
        rows.push({
          key: field.id,
          label: field.name,
          value: labels.join('、'),
        });
      }
    } else if (field.type === 'text' && typeof val === 'string') {
      rows.push({
        key: field.id,
        label: field.name,
        value: val,
      });
    }
  }

  const hasContent = rows.length > 0 || Boolean(record.note);

  if (!hasContent) {
    return (
      <span className="text-[13.5px] font-normal text-[var(--fg-secondary)]">
        {compact ? '已完成' : '记录一次'}
      </span>
    );
  }

  if (compact) {
    return (
      <div className="space-y-1">
        {rows.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[13px]">
            {rows.map((r) => (
              <span key={r.key} className="inline-flex items-baseline gap-1">
                <span
                  className={r.isPrimary ? 'font-medium' : 'font-normal text-[var(--fg-secondary)]'}
                  style={r.isPrimary ? { color: color.ink } : undefined}
                >
                  {r.value}
                </span>
              </span>
            ))}
          </div>
        )}
        {record.note && (
          <p className="text-xs leading-relaxed text-[var(--fg-muted)]">{record.note}</p>
        )}
      </div>
    );
  }

  // Calm MarkTimes-style key-value lines inside the timeline record card
  return (
    <div className="space-y-1.5">
      {rows.length > 0 && (
        <div className="space-y-1">
          {rows.map((r) => (
            <div
              key={r.key}
              className="flex items-baseline gap-3 text-[13.5px] leading-snug"
            >
              <span className="shrink-0 text-[var(--fg-muted)]">{r.label}</span>
              <span className="text-[var(--fg-primary)]">{r.value}</span>
            </div>
          ))}
        </div>
      )}
      {record.note && (
        <p className="text-[13px] leading-relaxed text-[var(--fg-muted)]">
          {record.note}
        </p>
      )}
    </div>
  );
}
