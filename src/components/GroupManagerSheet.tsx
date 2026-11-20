import { useMemo, useState } from 'react';
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Check, GripVertical, Pencil, Plus, Trash2, X } from 'lucide-react';
import type { EventItem, Group } from '../types/models';
import { createId, db } from '../db/db';
import { BottomSheetDialog } from './BottomSheetDialog';

interface GroupManagerSheetProps {
  open: boolean;
  groups: Group[];
  events: EventItem[];
  onClose: () => void;
  onNotify: (msg: string) => void;
}

interface SortableGroupRowProps {
  group: Group;
  eventCount: number;
  isEditing: boolean;
  editingText: string;
  confirmDelete: boolean;
  onStartEdit: () => void;
  onChangeEditText: (text: string) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onDeleteClick: () => void;
}

function SortableGroupRow({
  group,
  eventCount,
  isEditing,
  editingText,
  confirmDelete,
  onStartEdit,
  onChangeEditText,
  onSaveEdit,
  onCancelEdit,
  onDeleteClick,
}: SortableGroupRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: group.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 20 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2.5 rounded-[18px] bg-[var(--bg-surface)] px-3 py-3 transition-shadow ${
        isDragging
          ? 'scale-[1.02] shadow-lg ring-1 ring-[var(--border-color)]'
          : 'shadow-[0_1px_2px_rgba(15,23,42,0.05)]'
      }`}
    >
      {/* Drag Handle */}
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`拖动排序 ${group.name}`}
        className="flex h-8 w-7 shrink-0 cursor-grab touch-none items-center justify-center rounded-lg text-[var(--fg-muted)] active:cursor-grabbing"
      >
        <GripVertical className="h-4 w-4" />
      </button>

      {/* Group Name / Inline Rename */}
      {isEditing ? (
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          <input
            type="text"
            autoFocus
            value={editingText}
            onChange={(e) => onChangeEditText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                onSaveEdit();
              } else if (e.key === 'Escape') {
                e.stopPropagation();
                onCancelEdit();
              }
            }}
            className="min-w-0 flex-1 rounded-xl border border-[var(--border-color)] bg-[var(--bg-input)] px-2.5 py-1.5 text-sm font-semibold text-[var(--fg-primary)] focus:border-[var(--fg-muted)] focus:bg-[var(--bg-surface)] focus:outline-none"
          />
          <button
            type="button"
            onClick={onSaveEdit}
            aria-label="保存名称"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--pill-active-bg)] text-[var(--pill-active-fg)]"
          >
            <Check className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onCancelEdit}
            aria-label="取消重命名"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--bg-subtle)] text-[var(--fg-secondary)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-[var(--fg-primary)]">
              {group.name}
            </div>
            <div className="text-[11px] font-medium text-[var(--fg-muted)]">
              {eventCount} 个事件
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={onStartEdit}
              aria-label={`重命名 ${group.name}`}
              className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--fg-muted)] transition hover:bg-[var(--bg-subtle)] hover:text-[var(--fg-primary)]"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>

            <button
              type="button"
              onClick={onDeleteClick}
              aria-label={`删除分组 ${group.name}`}
              className={`flex h-8 items-center justify-center rounded-full transition ${
                confirmDelete
                  ? 'bg-red-600 px-2.5 text-[11px] font-semibold text-white'
                  : 'w-8 text-[var(--fg-muted)] hover:bg-red-500/12 hover:text-red-500'
              }`}
            >
              {confirmDelete ? '确认删' : <Trash2 className="h-3.5 w-3.5" />}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export function GroupManagerSheet({
  open,
  groups,
  events,
  onClose,
  onNotify,
}: GroupManagerSheetProps) {
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const countByGroup = useMemo(() => {
    const map = new Map<string, number>();
    for (const ev of events) {
      if (ev.archived || !ev.groupId) continue;
      map.set(ev.groupId, (map.get(ev.groupId) ?? 0) + 1);
    }
    return map;
  }, [events]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newName.trim();
    if (!trimmed) return;
    const now = Date.now();
    await db.groups.add({
      id: createId('grp'),
      name: trimmed,
      order: groups.length,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });
    setNewName('');
    onNotify(`已新建分组「${trimmed}」`);
  };

  const handleSaveRename = async () => {
    if (!editingId) return;
    const trimmed = editingText.trim();
    if (!trimmed) {
      setEditingId(null);
      return;
    }
    await db.groups.update(editingId, {
      name: trimmed,
      updatedAt: Date.now(),
    });
    setEditingId(null);
    onNotify(`已重命名为「${trimmed}」`);
  };

  const handleDelete = async (group: Group) => {
    if (confirmDeleteId !== group.id) {
      setConfirmDeleteId(group.id);
      return;
    }
    await db.transaction('rw', db.groups, db.events, async () => {
      await db.events.where('groupId').equals(group.id).modify({ groupId: null });
      await db.groups.delete(group.id);
    });
    setConfirmDeleteId(null);
    onNotify(`已删除分组「${group.name}」`);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = groups.findIndex((g) => g.id === active.id);
    const newIdx = groups.findIndex((g) => g.id === over.id);
    if (oldIdx < 0 || newIdx < 0) return;

    const reordered = arrayMove(groups, oldIdx, newIdx);
    const now = Date.now();
    await db.transaction('rw', db.groups, async () => {
      for (let i = 0; i < reordered.length; i++) {
        await db.groups.update(reordered[i].id, { order: i, updatedAt: now });
      }
    });
  };

  return (
    <BottomSheetDialog
      open={open}
      onClose={() => {
        setEditingId(null);
        setConfirmDeleteId(null);
        onClose();
      }}
      title="分组管理"
      bodyStyle={{ backgroundColor: 'var(--bg-canvas)' }}
    >
      <div className="space-y-3">
        {/* Create New Group Card */}
        <form
          onSubmit={handleAdd}
          className="flex items-center gap-2 rounded-[20px] bg-[var(--bg-surface)] p-2.5 shadow-[0_1px_2px_rgba(15,23,42,0.05)]"
        >
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="新建分组名称..."
            className="min-w-0 flex-1 bg-transparent px-2.5 py-1.5 text-sm text-[var(--fg-primary)] placeholder:text-[var(--fg-muted)] focus:outline-none"
          />
          <button
            type="submit"
            disabled={!newName.trim()}
            className="inline-flex shrink-0 items-center gap-1 rounded-2xl bg-[var(--pill-active-bg)] px-3.5 py-2 text-xs font-semibold text-[var(--pill-active-fg)] transition active:scale-95 disabled:opacity-40"
          >
            <Plus className="h-3.5 w-3.5 stroke-[2.4]" />
            新建
          </button>
        </form>

        {/* Sortable Group List */}
        {groups.length === 0 ? (
          <div className="rounded-[20px] bg-[var(--bg-surface)] py-8 text-center text-xs text-[var(--fg-muted)] shadow-[0_1px_2px_rgba(15,23,42,0.05)]">
            还没有自定义分组
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={groups.map((g) => g.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2">
                {groups.map((group) => (
                  <SortableGroupRow
                    key={group.id}
                    group={group}
                    eventCount={countByGroup.get(group.id) ?? 0}
                    isEditing={editingId === group.id}
                    editingText={editingText}
                    confirmDelete={confirmDeleteId === group.id}
                    onStartEdit={() => {
                      setConfirmDeleteId(null);
                      setEditingId(group.id);
                      setEditingText(group.name);
                    }}
                    onChangeEditText={setEditingText}
                    onSaveEdit={handleSaveRename}
                    onCancelEdit={() => setEditingId(null)}
                    onDeleteClick={() => handleDelete(group)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>
    </BottomSheetDialog>
  );
}
