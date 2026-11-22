import { useEffect, useId, useState } from 'react';
import { Check, ChevronDown, Plus, Trash2, X, Zap } from 'lucide-react';
import type {
  CustomFieldDef,
  EventItem,
  Group,
  NumberFieldDef,
  SelectFieldDef,
  TextFieldDef,
} from '../types/models';
import { COLOR_PALETTE, ICON_CATALOG, OPTION_COLORS, getColorToken } from '../constants/theme';
import { createId, db } from '../db/db';
import { BottomSheetDialog } from './BottomSheetDialog';
import { EventIcon } from './EventIcon';

interface EventEditorSheetProps {
  open: boolean;
  editingEvent?: EventItem | null;
  groups: Group[];
  isDark?: boolean;
  onClose: () => void;
  onSaved?: (message: string) => void;
  onDeleteEvent?: (event: EventItem) => void;
}

export function EventEditorSheet({
  open,
  editingEvent,
  groups,
  isDark = false,
  onClose,
  onSaved,
  onDeleteEvent,
}: EventEditorSheetProps) {
  const formId = useId();
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('dumbbell');
  const [colorId, setColorId] = useState('emerald');
  const [groupId, setGroupId] = useState<string | null>(null);
  const [quickMode, setQuickMode] = useState(false);
  const [fields, setFields] = useState<CustomFieldDef[]>([]);
  const [iconPickerOpen, setIconPickerOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [addingGroup, setAddingGroup] = useState(false);
  const [newOptionText, setNewOptionText] = useState<Record<string, string>>({});
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setConfirmDelete(false);
    if (editingEvent) {
      setName(editingEvent.name);
      setIcon(editingEvent.icon);
      setColorId(editingEvent.color);
      setGroupId(editingEvent.groupId);
      setQuickMode(editingEvent.quickMode);
      setFields(structuredClone(editingEvent.fields));
      setIconPickerOpen(false);
    } else {
      setName('');
      setIcon('dumbbell');
      setColorId('emerald');
      setGroupId(groups[0]?.id ?? null);
      setQuickMode(false);
      setFields([]);
      setIconPickerOpen(false);
    }
    setAddingGroup(false);
    setNewGroupName('');
    setNewOptionText({});
  }, [open, editingEvent, groups]);

  const color = getColorToken(colorId, isDark);

  const handleAddGroup = async () => {
    const trimmed = newGroupName.trim();
    if (!trimmed) return;
    const now = Date.now();
    const id = createId('grp');
    await db.groups.add({
      id,
      name: trimmed,
      order: groups.length,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });
    setGroupId(id);
    setNewGroupName('');
    setAddingGroup(false);
  };

  const addNumberField = () => {
    const fld: NumberFieldDef = {
      id: createId('fld'),
      name: '数量',
      type: 'number',
      unit: '次',
      required: false,
      defaultValue: 1,
      quickSteps: [1, 5, 10],
    };
    setFields((prev) => [...prev, fld]);
  };

  const addSelectField = () => {
    const opt1 = createId('opt');
    const opt2 = createId('opt');
    const fld: SelectFieldDef = {
      id: createId('fld'),
      name: '标签',
      type: 'select',
      required: false,
      multiple: false,
      options: [
        { id: opt1, label: '选项一', color: OPTION_COLORS[0] },
        { id: opt2, label: '选项二', color: OPTION_COLORS[1] },
      ],
      defaultOptionIds: [],
    };
    setFields((prev) => [...prev, fld]);
  };

  const addTextField = () => {
    const fld: TextFieldDef = {
      id: createId('fld'),
      name: '简记',
      type: 'text',
      required: false,
      placeholder: '补充信息...',
    };
    setFields((prev) => [...prev, fld]);
  };

  const updateField = (id: string, updater: (f: CustomFieldDef) => CustomFieldDef) => {
    setFields((prev) => prev.map((f) => (f.id === id ? updater(f) : f)));
  };

  const removeField = (id: string) => {
    setFields((prev) => prev.filter((f) => f.id !== id));
  };

  const appendSelectOption = (fieldId: string) => {
    const label = (newOptionText[fieldId] ?? '').trim();
    if (!label) return;
    updateField(fieldId, (f) => {
      const sf = f as SelectFieldDef;
      return {
        ...sf,
        options: [
          ...sf.options,
          {
            id: createId('opt'),
            label,
            color: OPTION_COLORS[sf.options.length % OPTION_COLORS.length],
          },
        ],
      };
    });
    setNewOptionText((prev) => ({ ...prev, [fieldId]: '' }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    try {
      const now = Date.now();
      if (editingEvent) {
        await db.events.update(editingEvent.id, {
          name: trimmed,
          icon,
          color: colorId,
          groupId,
          quickMode,
          fields,
          updatedAt: now,
        });
        onSaved?.('已保存事件');
      } else {
        const count = await db.events.count();
        await db.events.add({
          id: createId('evt'),
          name: trimmed,
          icon,
          color: colorId,
          groupId,
          quickMode,
          fields,
          order: count,
          pinned: false,
          archived: false,
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
        });
        onSaved?.(`已创建「${trimmed}」`);
      }
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteClick = () => {
    if (!editingEvent || !onDeleteEvent) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    onDeleteEvent(editingEvent);
    onClose();
  };

  return (
    <BottomSheetDialog
      open={open}
      onClose={onClose}
      title={editingEvent ? '编辑事件' : '新建事件'}
      accentColor={color.solid}
      bodyStyle={{ backgroundColor: 'var(--bg-canvas)' }}
      footer={
        <button
          type="submit"
          form={formId}
          disabled={saving || !name.trim()}
          className="flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-[15px] font-semibold text-white shadow-sm transition active:scale-[0.98] disabled:opacity-50"
          style={{ backgroundColor: color.solid }}
        >
          <Check className="h-4.5 w-4.5 stroke-[2.4]" />
          {editingEvent ? '保存事件' : '创建事件'}
        </button>
      }
    >
      <form id={formId} onSubmit={handleSubmit} className="space-y-3">
        {/* Card 1: Name, Collapsible Icon Picker & Accent Color */}
        <section className="rounded-[20px] bg-[var(--bg-surface)] p-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIconPickerOpen((v) => !v)}
              aria-label="更换图标"
              title="更换图标"
              aria-expanded={iconPickerOpen}
              className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl transition active:scale-95"
              style={{ backgroundColor: color.soft, color: color.ink }}
            >
              <EventIcon name={icon} className="h-6 w-6" />
              <span className="absolute -right-1 -bottom-1 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-[var(--bg-surface)] text-[var(--fg-muted)] ring-1 ring-[var(--border-color)]">
                <ChevronDown
                  className={`h-3 w-3 transition-transform ${iconPickerOpen ? 'rotate-180' : ''}`}
                />
              </span>
            </button>

            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="事件名称（如：引体向上、练琴）"
              className="flex-1 rounded-xl border border-transparent bg-[var(--bg-input)] px-3.5 py-2.5 text-[15px] font-medium text-[var(--fg-primary)] placeholder:font-normal placeholder:text-[var(--fg-muted)] focus:border-[var(--border-color)] focus:bg-[var(--bg-surface)] focus:outline-none"
            />
          </div>

          {iconPickerOpen && (
            <div className="mt-4">
              <div className="grid grid-cols-7 gap-2">
                {ICON_CATALOG.map((item) => {
                  const selected = item.id === icon;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setIcon(item.id);
                        setIconPickerOpen(false);
                      }}
                      aria-label={item.label}
                      title={item.label}
                      className="flex h-10 items-center justify-center rounded-xl transition active:scale-90"
                      style={
                        selected
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
                      <EventIcon name={item.id} className="h-4.5 w-4.5" />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="mt-4 flex items-center justify-between gap-2 pt-1">
            {COLOR_PALETTE.map((token) => {
              const selected = token.id === colorId;
              return (
                <button
                  key={token.id}
                  type="button"
                  onClick={() => setColorId(token.id)}
                  aria-label={token.name}
                  title={token.name}
                  className="flex h-7 w-7 items-center justify-center rounded-full transition active:scale-90"
                  style={{
                    backgroundColor: token.solid,
                    boxShadow: selected
                      ? `0 0 0 2px var(--bg-surface), 0 0 0 4px ${token.solid}`
                      : 'none',
                  }}
                >
                  {selected && <Check className="h-3.5 w-3.5 stroke-[2.6] text-white" />}
                </button>
              );
            })}
          </div>
        </section>

        {/* Card 2: Group & Recording Mode */}
        <section className="space-y-4 rounded-[20px] bg-[var(--bg-surface)] p-4">
          <div>
            <div className="mb-2.5 flex items-center justify-between">
              <span className="text-xs font-semibold tracking-wide text-[var(--fg-muted)]">
                分组
              </span>
              <button
                type="button"
                onClick={() => setAddingGroup((v) => !v)}
                className="text-xs font-semibold"
                style={{ color: color.ink }}
              >
                {addingGroup ? '取消' : '+ 新建'}
              </button>
            </div>

            {addingGroup && (
              <div className="mb-2.5 flex gap-2">
                <input
                  type="text"
                  autoFocus
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddGroup();
                    }
                  }}
                  placeholder="新分组名称"
                  className="flex-1 rounded-xl border border-[var(--border-color)] bg-[var(--bg-input)] px-3 py-1.5 text-xs text-[var(--fg-primary)] focus:border-[var(--fg-muted)] focus:bg-[var(--bg-surface)] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleAddGroup}
                  className="rounded-xl bg-[var(--pill-active-bg)] px-3 py-1.5 text-xs font-semibold text-[var(--pill-active-fg)]"
                >
                  确定
                </button>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setGroupId(null)}
                className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition active:scale-95 ${
                  groupId === null
                    ? 'bg-[var(--pill-active-bg)] text-[var(--pill-active-fg)]'
                    : 'bg-[var(--bg-subtle)] text-[var(--fg-secondary)]'
                }`}
              >
                未分组
              </button>
              {groups.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setGroupId(g.id)}
                  className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition active:scale-95 ${
                    groupId === g.id
                      ? 'bg-[var(--pill-active-bg)] text-[var(--pill-active-fg)]'
                      : 'bg-[var(--bg-subtle)] text-[var(--fg-secondary)]'
                  }`}
                >
                  {g.name}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-1">
            <span className="mb-2.5 block text-xs font-medium tracking-wide text-[var(--fg-muted)]">
              录入方式
            </span>
            <div className="grid grid-cols-2 gap-1.5 rounded-xl bg-[var(--bg-subtle)] p-1">
              <button
                type="button"
                onClick={() => setQuickMode(false)}
                className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition ${
                  !quickMode
                    ? 'bg-[var(--bg-surface)] text-[var(--fg-primary)] shadow-xs'
                    : 'text-[var(--fg-muted)]'
                }`}
              >
                <Plus className="h-3.5 w-3.5" />
                弹窗确认
              </button>
              <button
                type="button"
                onClick={() => setQuickMode(true)}
                className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition ${
                  quickMode
                    ? 'bg-[var(--bg-surface)] text-[var(--fg-primary)] shadow-xs'
                    : 'text-[var(--fg-muted)]'
                }`}
              >
                <Zap className="h-3.5 w-3.5" />
                一键速记
              </button>
            </div>
          </div>
        </section>

        {/* Section Header: Custom Fields */}
        <div className="flex items-center justify-between px-1 pt-1">
          <span className="text-xs font-semibold tracking-wide text-[var(--fg-muted)]">
            自定义字段
          </span>
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={addNumberField}
              className="rounded-full bg-[var(--bg-surface)] px-3 py-1 text-xs font-semibold text-[var(--fg-secondary)] shadow-[0_1px_2px_rgba(15,23,42,0.05)] transition active:scale-95"
            >
              + 数值
            </button>
            <button
              type="button"
              onClick={addSelectField}
              className="rounded-full bg-[var(--bg-surface)] px-3 py-1 text-xs font-semibold text-[var(--fg-secondary)] shadow-[0_1px_2px_rgba(15,23,42,0.05)] transition active:scale-95"
            >
              + 标签
            </button>
            <button
              type="button"
              onClick={addTextField}
              className="rounded-full bg-[var(--bg-surface)] px-3 py-1 text-xs font-semibold text-[var(--fg-secondary)] shadow-[0_1px_2px_rgba(15,23,42,0.05)] transition active:scale-95"
            >
              + 文本
            </button>
          </div>
        </div>

        {fields.length === 0 && (
          <div className="rounded-[20px] bg-[var(--bg-surface)] px-4 py-6 text-center text-xs text-[var(--fg-muted)] shadow-[0_1px_2px_rgba(15,23,42,0.05)]">
            暂无字段，点击右上角按需添加
          </div>
        )}

        {fields.map((field) => (
          <section
            key={field.id}
            className="space-y-3 rounded-[20px] bg-[var(--bg-surface)] p-4"
          >
            <div className="flex items-center gap-2">
              <span
                className="shrink-0 rounded-lg px-2 py-1 text-[11px] font-semibold"
                style={{ backgroundColor: color.soft, color: color.ink }}
              >
                {field.type === 'number'
                  ? '数值'
                  : field.type === 'select'
                    ? '标签'
                    : '文本'}
              </span>

              <input
                type="text"
                value={field.name}
                onChange={(e) =>
                  updateField(field.id, (f) => ({ ...f, name: e.target.value }))
                }
                placeholder="字段名称"
                className="min-w-0 flex-1 rounded-xl border border-transparent bg-[var(--bg-input)] px-2.5 py-1.5 text-sm font-semibold text-[var(--fg-primary)] focus:border-[var(--border-color)] focus:bg-[var(--bg-surface)] focus:outline-none"
              />

              {field.type === 'select' && (
                <button
                  type="button"
                  onClick={() =>
                    updateField(field.id, (f) => ({
                      ...(f as SelectFieldDef),
                      multiple: !(f as SelectFieldDef).multiple,
                    }))
                  }
                  className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
                    field.multiple
                      ? 'bg-[var(--pill-active-bg)] text-[var(--pill-active-fg)]'
                      : 'bg-[var(--bg-subtle)] text-[var(--fg-muted)]'
                  }`}
                >
                  多选
                </button>
              )}

              <button
                type="button"
                onClick={() =>
                  updateField(field.id, (f) => ({ ...f, required: !f.required }))
                }
                className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
                  field.required
                    ? 'bg-rose-500/12 text-rose-500 ring-1 ring-rose-500/30 ring-inset'
                    : 'bg-[var(--bg-subtle)] text-[var(--fg-muted)]'
                }`}
              >
                {field.required ? '* 必填' : '必填'}
              </button>

              <button
                type="button"
                onClick={() => removeField(field.id)}
                aria-label="删除字段"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[var(--fg-muted)] transition hover:bg-red-500/12 hover:text-red-500"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>

            {field.type === 'number' && (
              <div className="space-y-2.5 pt-1">
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="mb-1 block text-[11px] font-medium text-[var(--fg-muted)]">
                      单位
                    </label>
                    <input
                      type="text"
                      value={field.unit}
                      onChange={(e) =>
                        updateField(field.id, (f) => ({
                          ...(f as NumberFieldDef),
                          unit: e.target.value,
                        }))
                      }
                      placeholder="个 / 分钟"
                      className="w-full rounded-xl border border-transparent bg-[var(--bg-input)] px-3 py-2 text-xs font-medium text-[var(--fg-primary)] focus:border-[var(--border-color)] focus:bg-[var(--bg-surface)] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-medium text-[var(--fg-muted)]">
                      默认值
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={field.defaultValue ?? ''}
                      onChange={(e) =>
                        updateField(field.id, (f) => ({
                          ...(f as NumberFieldDef),
                          defaultValue:
                            e.target.value === '' ? undefined : Number(e.target.value),
                        }))
                      }
                      placeholder="20"
                      className="no-number-spinner w-full rounded-xl border border-transparent bg-[var(--bg-input)] px-3 py-2 text-xs font-medium text-[var(--fg-primary)] tabular-nums focus:border-[var(--border-color)] focus:bg-[var(--bg-surface)] focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-[11px] font-medium text-[var(--fg-muted)]">
                    快捷档位
                  </label>
                  <input
                    type="text"
                    defaultValue={field.quickSteps?.join(', ') ?? ''}
                    onBlur={(e) => {
                      const nums = e.target.value
                        .split(/[,，\s]+/)
                        .map((s) => Number(s.trim()))
                        .filter((n) => !Number.isNaN(n) && n > 0);
                      updateField(field.id, (f) => ({
                        ...(f as NumberFieldDef),
                        quickSteps: nums,
                      }));
                    }}
                    placeholder="15, 20, 25, 30"
                    className="w-full rounded-xl border border-transparent bg-[var(--bg-input)] px-3 py-2 text-xs font-medium text-[var(--fg-primary)] tabular-nums focus:border-[var(--border-color)] focus:bg-[var(--bg-surface)] focus:outline-none"
                  />
                </div>
              </div>
            )}

            {field.type === 'select' && (
              <div className="space-y-2.5 pt-1">
                <div className="flex flex-wrap gap-1.5">
                  {field.options.map((opt) => {
                    const isDef = field.defaultOptionIds?.includes(opt.id);
                    return (
                      <span
                        key={opt.id}
                        className="inline-flex items-center gap-1 rounded-full py-1 pr-1.5 pl-2.5 text-xs font-medium transition"
                        style={
                          isDef
                            ? {
                                backgroundColor: color.soft,
                                color: color.ink,
                                boxShadow: `inset 0 0 0 1px ${color.solid}`,
                              }
                            : {
                                backgroundColor: 'var(--bg-subtle)',
                                color: 'var(--fg-secondary)',
                              }
                        }
                      >
                        <button
                          type="button"
                          onClick={() => {
                            updateField(field.id, (f) => {
                              const sf = f as SelectFieldDef;
                              const cur = sf.defaultOptionIds ?? [];
                              const next = cur.includes(opt.id)
                                ? cur.filter((x) => x !== opt.id)
                                : sf.multiple
                                  ? [...cur, opt.id]
                                  : [opt.id];
                              return { ...sf, defaultOptionIds: next };
                            });
                          }}
                          title="点击设为默认选中"
                          className="inline-flex items-center gap-1"
                        >
                          {isDef && <Check className="h-3 w-3 stroke-[2.5]" />}
                          <span>{opt.label}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            updateField(field.id, (f) => {
                              const sf = f as SelectFieldDef;
                              return {
                                ...sf,
                                options: sf.options.filter((o) => o.id !== opt.id),
                                defaultOptionIds: sf.defaultOptionIds?.filter(
                                  (id) => id !== opt.id,
                                ),
                              };
                            })
                          }
                          aria-label={`删除选项 ${opt.label}`}
                          className="ml-0.5 flex h-4 w-4 items-center justify-center rounded-full opacity-60 hover:bg-black/15 hover:opacity-100"
                        >
                          <X className="h-2.5 w-2.5" />
                        </button>
                      </span>
                    );
                  })}
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newOptionText[field.id] ?? ''}
                    onChange={(e) =>
                      setNewOptionText((prev) => ({
                        ...prev,
                        [field.id]: e.target.value,
                      }))
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        appendSelectOption(field.id);
                      }
                    }}
                    placeholder="添加新选项（点标签可设默认）"
                    className="flex-1 rounded-xl border border-[var(--border-color)] bg-[var(--bg-input)] px-3 py-2 text-xs text-[var(--fg-primary)] placeholder:text-[var(--fg-muted)] focus:border-[var(--fg-muted)] focus:bg-[var(--bg-surface)] focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => appendSelectOption(field.id)}
                    className="rounded-xl bg-[var(--pill-active-bg)] px-3.5 py-2 text-xs font-semibold text-[var(--pill-active-fg)] transition active:scale-95"
                  >
                    添加
                  </button>
                </div>
              </div>
            )}

            {field.type === 'text' && (
              <div className="border-t border-[var(--border-soft)] pt-3">
                <label className="mb-1 block text-[11px] font-medium text-[var(--fg-muted)]">
                  默认值
                </label>
                <input
                  type="text"
                  value={field.defaultValue ?? ''}
                  onChange={(e) =>
                    updateField(field.id, (f) => ({
                      ...(f as TextFieldDef),
                      defaultValue: e.target.value,
                    }))
                  }
                  placeholder="留空则不预填"
                  className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-input)] px-3 py-2 text-xs text-[var(--fg-primary)] focus:border-[var(--fg-muted)] focus:bg-[var(--bg-surface)] focus:outline-none"
                />
              </div>
            )}
          </section>
        ))}

        {/* Safe Delete Event Section (moved here from detail header to prevent accidental taps) */}
        {editingEvent && onDeleteEvent && (
          <section className="pt-1">
            <button
              type="button"
              onClick={handleDeleteClick}
              className={`flex w-full items-center justify-center gap-1.5 rounded-[18px] py-3 text-xs font-semibold transition active:scale-[0.99] ${
                confirmDelete
                  ? 'bg-red-600 text-white'
                  : 'bg-[var(--bg-surface)] text-red-500 shadow-[0_1px_2px_rgba(15,23,42,0.05)] hover:bg-red-500/10'
              }`}
            >
              <Trash2 className="h-3.5 w-3.5" />
              {confirmDelete ? '再次点击确认删除该事件及全部记录' : '删除此事件'}
            </button>
          </section>
        )}
      </form>
    </BottomSheetDialog>
  );
}
