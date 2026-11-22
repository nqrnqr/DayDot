import { useEffect, useId, useState } from 'react';
import { CalendarClock, Check, Trash2 } from 'lucide-react';
import type { EventItem, EventRecord, FieldValue } from '../types/models';
import { getColorToken } from '../constants/theme';
import {
  buildDefaultValues,
  createId,
  db,
  notifyLocalMutation,
  softDeleteRecord,
} from '../db/db';
import { toDatetimeLocalValue } from '../utils/date';
import { BottomSheetDialog } from './BottomSheetDialog';

interface QuickRecordSheetProps {
  open: boolean;
  event: EventItem | null;
  editingRecord?: EventRecord | null;
  initialTimestamp?: number;
  isDark?: boolean;
  onClose: () => void;
  onSaved?: (message: string) => void;
}

export function QuickRecordSheet({
  open,
  event,
  editingRecord,
  initialTimestamp,
  isDark = false,
  onClose,
  onSaved,
}: QuickRecordSheetProps) {
  const formId = useId();
  const [values, setValues] = useState<Record<string, FieldValue>>({});
  const [note, setNote] = useState('');
  const [dateTimeStr, setDateTimeStr] = useState('');
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [missingFieldIds, setMissingFieldIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !event) return;
    setConfirmDelete(false);
    setMissingFieldIds([]);
    if (editingRecord) {
      setValues({ ...editingRecord.values });
      setNote(editingRecord.note ?? '');
      setDateTimeStr(toDatetimeLocalValue(editingRecord.timestamp));
      setShowTimePicker(true);
    } else {
      setValues(buildDefaultValues(event));
      setNote('');
      const ts = initialTimestamp ?? Date.now();
      setDateTimeStr(toDatetimeLocalValue(ts));
      setShowTimePicker(Boolean(initialTimestamp));
    }
  }, [open, event, editingRecord, initialTimestamp]);

  if (!event) return null;
  const color = getColorToken(event.color, isDark);

  const clearMissing = (fieldId: string) => {
    setMissingFieldIds((prev) =>
      prev.includes(fieldId) ? prev.filter((id) => id !== fieldId) : prev,
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;

    const missing: string[] = [];
    for (const field of event.fields) {
      if (!field.required) continue;
      const val = values[field.id];
      const isEmpty =
        val === undefined ||
        val === '' ||
        (typeof val === 'number' && Number.isNaN(val)) ||
        (Array.isArray(val) && val.length === 0) ||
        (typeof val === 'string' && val.trim() === '');
      if (isEmpty) missing.push(field.id);
    }
    if (missing.length > 0) {
      setMissingFieldIds(missing);
      return;
    }

    setSaving(true);
    try {
      const parsedTime = dateTimeStr ? new Date(dateTimeStr).getTime() : Date.now();
      const timestamp = Number.isNaN(parsedTime) ? Date.now() : parsedTime;
      const now = Date.now();

      if (editingRecord) {
        await db.records.update(editingRecord.id, {
          timestamp,
          values,
          note: note.trim() || undefined,
          updatedAt: now,
        });
        notifyLocalMutation();
        onSaved?.('已更新记录');
      } else {
        await db.records.add({
          id: createId('rec'),
          eventId: event.id,
          timestamp,
          values,
          note: note.trim() || undefined,
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
        });
        notifyLocalMutation();
        onSaved?.(`已记录「${event.name}」`);
      }
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editingRecord) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    await softDeleteRecord(editingRecord.id);
    onSaved?.('已删除记录');
    onClose();
  };

  return (
    <BottomSheetDialog
      open={open}
      onClose={onClose}
      title={editingRecord ? `编辑 · ${event.name}` : event.name}
      accentColor={color.solid}
      bodyStyle={{ backgroundColor: 'var(--bg-canvas)' }}
      headerRight={
        editingRecord ? (
          <button
            type="button"
            onClick={handleDelete}
            className={`flex h-8 items-center gap-1 rounded-full px-2.5 text-xs font-medium transition-colors ${
              confirmDelete
                ? 'bg-red-600 text-white'
                : 'bg-red-500/12 text-red-500 hover:bg-red-500/20'
            }`}
          >
            <Trash2 className="h-3.5 w-3.5" />
            {confirmDelete ? '确认删除' : '删除'}
          </button>
        ) : undefined
      }
      footer={
        <button
          type="submit"
          form={formId}
          disabled={saving}
          className="flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-[15px] font-medium text-white transition active:scale-[0.98] disabled:opacity-60"
          style={{ backgroundColor: color.solid }}
        >
          <Check className="h-4.5 w-4.5 stroke-[2.2]" />
          {editingRecord ? '保存修改' : '确认记录'}
        </button>
      }
    >
      <form id={formId} onSubmit={handleSave} className="space-y-3">
        {event.fields.map((field) => {
          const isMissing = missingFieldIds.includes(field.id);

          if (field.type === 'number') {
            const raw = values[field.id];
            const numVal =
              typeof raw === 'number'
                ? raw
                : raw !== undefined && raw !== ''
                  ? Number(raw)
                  : 0;

            const setNum = (next: number) => {
              const clamped = Math.max(0, Number(next.toFixed(2)));
              setValues((prev) => ({ ...prev, [field.id]: clamped }));
              clearMissing(field.id);
            };

            return (
              <div
                key={field.id}
                className={`rounded-[20px] bg-[var(--bg-surface)] p-4 ${
                  isMissing ? 'ring-1.5 ring-rose-500' : ''
                }`}
              >
                <div className="mb-2.5 flex items-center justify-between">
                  <label
                    htmlFor={`field-${field.id}`}
                    className="text-xs font-medium tracking-wide text-[var(--fg-muted)]"
                  >
                    {field.name}
                    {field.required && (
                      <span className="ml-0.5 text-rose-500" aria-hidden="true">
                        *
                      </span>
                    )}
                  </label>
                  {isMissing && (
                    <span className="text-[11px] font-medium text-rose-500">
                      请填写{field.name}
                    </span>
                  )}
                </div>

                <label
                  htmlFor={`field-${field.id}`}
                  className="flex cursor-text items-baseline justify-between rounded-2xl border border-transparent bg-[var(--bg-input)] px-4 py-3 transition focus-within:border-[var(--border-color)] focus-within:bg-[var(--bg-surface)]"
                >
                  <input
                    id={`field-${field.id}`}
                    type="number"
                    step="any"
                    inputMode="decimal"
                    value={raw === undefined ? '' : String(raw)}
                    onFocus={(e) => e.currentTarget.select()}
                    onChange={(e) => {
                      const txt = e.target.value;
                      setValues((prev) => ({
                        ...prev,
                        [field.id]: txt === '' ? '' : Number(txt),
                      }));
                      if (txt !== '') clearMissing(field.id);
                    }}
                    placeholder="0"
                    className="no-number-spinner w-full bg-transparent text-[28px] leading-none font-semibold tracking-tight text-[var(--fg-primary)] tabular-nums placeholder:text-[var(--fg-muted)] focus:outline-none"
                  />
                  {field.unit && (
                    <span className="ml-2 shrink-0 text-sm font-medium text-[var(--fg-muted)]">
                      {field.unit}
                    </span>
                  )}
                </label>

                {field.quickSteps && field.quickSteps.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {field.quickSteps.map((preset) => {
                      const active = raw !== '' && raw !== undefined && numVal === preset;
                      return (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setNum(preset)}
                          className="rounded-full px-3.5 py-1.5 text-xs font-semibold transition active:scale-95"
                          style={
                            active
                              ? { backgroundColor: color.solid, color: '#FFFFFF' }
                              : {
                                  backgroundColor: 'var(--bg-subtle)',
                                  color: 'var(--fg-secondary)',
                                }
                          }
                        >
                          {preset} {field.unit}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }

          if (field.type === 'select') {
            const current = values[field.id];
            const selectedIds = Array.isArray(current)
              ? current
              : typeof current === 'string' && current
                ? [current]
                : [];

            const toggleOption = (optId: string) => {
              setValues((prev) => {
                if (field.multiple) {
                  const next = selectedIds.includes(optId)
                    ? selectedIds.filter((id) => id !== optId)
                    : [...selectedIds, optId];
                  return { ...prev, [field.id]: next };
                }
                return {
                  ...prev,
                  [field.id]: selectedIds.includes(optId) ? '' : optId,
                };
              });
              clearMissing(field.id);
            };

            return (
              <div
                key={field.id}
                className={`rounded-[20px] bg-[var(--bg-surface)] p-4 ${
                  isMissing ? 'ring-1.5 ring-rose-500' : ''
                }`}
              >
                <div className="mb-2.5 flex items-center justify-between">
                  <span className="text-xs font-medium tracking-wide text-[var(--fg-muted)]">
                    {field.name}
                    {field.required && (
                      <span className="ml-0.5 text-rose-500" aria-hidden="true">
                        *
                      </span>
                    )}
                  </span>
                  {isMissing && (
                    <span className="text-[11px] font-medium text-rose-500">
                      请选择{field.name}
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  {field.options.map((opt) => {
                    const active = selectedIds.includes(opt.id);
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => toggleOption(opt.id)}
                        className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] font-medium transition active:scale-95"
                        style={
                          active
                            ? {
                                backgroundColor: color.soft,
                                color: color.ink,
                                boxShadow: `inset 0 0 0 1.5px ${color.solid}`,
                              }
                            : {
                                backgroundColor: 'var(--bg-subtle)',
                                color: 'var(--fg-secondary)',
                              }
                        }
                      >
                        {active && <Check className="h-3.5 w-3.5 stroke-[2.5]" />}
                        <span>{opt.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          }

          return (
            <div
              key={field.id}
              className={`rounded-[20px] bg-[var(--bg-surface)] p-4 shadow-[0_1px_2px_rgba(15,23,42,0.05)] ${
                isMissing ? 'ring-1.5 ring-rose-500' : ''
              }`}
            >
              <div className="mb-2 flex items-center justify-between">
                <label
                  htmlFor={`field-${field.id}`}
                  className="text-xs font-semibold tracking-wide text-[var(--fg-muted)]"
                >
                  {field.name}
                  {field.required && (
                    <span className="ml-0.5 text-rose-500" aria-hidden="true">
                      *
                    </span>
                  )}
                </label>
                {isMissing && (
                  <span className="text-[11px] font-medium text-rose-500">
                    请填写{field.name}
                  </span>
                )}
              </div>
              <input
                id={`field-${field.id}`}
                type="text"
                value={typeof values[field.id] === 'string' ? (values[field.id] as string) : ''}
                placeholder={field.placeholder || `输入${field.name}...`}
                onChange={(e) => {
                  setValues((prev) => ({ ...prev, [field.id]: e.target.value }));
                  if (e.target.value.trim()) clearMissing(field.id);
                }}
                className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-input)] px-3.5 py-2.5 text-sm text-[var(--fg-primary)] placeholder:text-[var(--fg-muted)] focus:border-[var(--fg-muted)] focus:bg-[var(--bg-surface)] focus:outline-none"
              />
            </div>
          );
        })}

        {/* Note Card */}
        <div className="rounded-[20px] bg-[var(--bg-surface)] p-4">
          <label
            htmlFor={`note-${formId}`}
            className="mb-2 block text-xs font-medium tracking-wide text-[var(--fg-muted)]"
          >
            备注
          </label>
          <textarea
            id={`note-${formId}`}
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="写点状态或细节..."
            className="w-full resize-none rounded-xl border border-transparent bg-[var(--bg-input)] px-3.5 py-2.5 text-sm text-[var(--fg-primary)] placeholder:text-[var(--fg-muted)] focus:border-[var(--border-color)] focus:bg-[var(--bg-surface)] focus:outline-none"
          />
        </div>

        {/* Time Card */}
        <div className="rounded-[20px] bg-[var(--bg-surface)] px-4 py-3.5">
          <button
            type="button"
            onClick={() => setShowTimePicker((v) => !v)}
            className="flex w-full items-center justify-between text-xs font-medium text-[var(--fg-muted)]"
          >
            <span className="inline-flex items-center gap-1.5">
              <CalendarClock className="h-4 w-4" />
              记录时间
            </span>
            <span className="font-normal text-[var(--fg-primary)] tabular-nums">
              {dateTimeStr.replace('T', ' ')}
            </span>
          </button>
          {showTimePicker && (
            <input
              type="datetime-local"
              value={dateTimeStr}
              onChange={(e) => setDateTimeStr(e.target.value)}
              className="mt-2.5 w-full rounded-xl border border-transparent bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--fg-primary)] focus:border-[var(--border-color)] focus:bg-[var(--bg-surface)] focus:outline-none"
            />
          )}
        </div>
      </form>
    </BottomSheetDialog>
  );
}
