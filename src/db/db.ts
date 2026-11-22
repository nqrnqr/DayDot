import Dexie, { type Table } from 'dexie';
import type { BackupPayload, EventItem, EventRecord, Group } from '../types/models';

export class DayDotDB extends Dexie {
  groups!: Table<Group, string>;
  events!: Table<EventItem, string>;
  records!: Table<EventRecord, string>;

  constructor() {
    super('DayDotDB');
    this.version(1).stores({
      groups: 'id, order, updatedAt, deletedAt',
      events: 'id, groupId, order, archived, updatedAt, deletedAt',
      records: 'id, eventId, timestamp, updatedAt, deletedAt',
    });
  }
}

export const db = new DayDotDB();

export function createId(prefix: string): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}_${crypto.randomUUID().slice(0, 12)}`;
  }
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

const SEED_FLAG_KEY = 'daydot_seeded_v1';
const USER_MODIFIED_KEY = 'daydot_user_modified_v1';

export function isUserModified(): boolean {
  try {
    return localStorage.getItem(USER_MODIFIED_KEY) === '1';
  } catch {
    return true;
  }
}

/** Mark that local data contains real user changes and notify auto-sync listeners */
export function notifyLocalMutation(): void {
  try {
    localStorage.setItem(USER_MODIFIED_KEY, '1');
  } catch {
    // Ignore storage access errors
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('daydot-local-change'));
  }
}

/** Soft-delete a record so deletion syncs cleanly across devices */
export async function softDeleteRecord(recordId: string): Promise<void> {
  const now = Date.now();
  await db.records.update(recordId, { deletedAt: now, updatedAt: now });
  notifyLocalMutation();
}

/** Soft-delete an event and all of its records */
export async function softDeleteEvent(eventId: string): Promise<void> {
  const now = Date.now();
  await db.transaction('rw', db.events, db.records, async () => {
    await db.records
      .where('eventId')
      .equals(eventId)
      .modify({ deletedAt: now, updatedAt: now });
    await db.events.update(eventId, { deletedAt: now, updatedAt: now });
  });
  notifyLocalMutation();
}

/** Soft-delete a group and detach its events */
export async function softDeleteGroup(groupId: string): Promise<void> {
  const now = Date.now();
  await db.transaction('rw', db.groups, db.events, async () => {
    await db.events
      .where('groupId')
      .equals(groupId)
      .modify({ groupId: null, updatedAt: now });
    await db.groups.update(groupId, { deletedAt: now, updatedAt: now });
  });
  notifyLocalMutation();
}

/** Seed realistic starter events (Pull-ups 20 reps, Piano 30 min, Bubble Tea, Vitamin) on first launch */
export async function ensureSeeded(): Promise<void> {
  if (localStorage.getItem(SEED_FLAG_KEY) === '1') return;
  const existingCount = await db.events.count();
  if (existingCount > 0) {
    localStorage.setItem(SEED_FLAG_KEY, '1');
    return;
  }
  await seedDemoData(false);
  localStorage.setItem(SEED_FLAG_KEY, '1');
}

export async function seedDemoData(markModified = true): Promise<void> {
  const now = Date.now();
  const dayMs = 86_400_000;

  const groups: Group[] = [
    { id: 'grp_sport', name: '运动', order: 0, createdAt: now, updatedAt: now, deletedAt: null },
    { id: 'grp_music', name: '乐器', order: 1, createdAt: now, updatedAt: now, deletedAt: null },
    { id: 'grp_life', name: '生活', order: 2, createdAt: now, updatedAt: now, deletedAt: null },
  ];

  const events: EventItem[] = [
    {
      id: 'evt_pullup',
      name: '引体向上',
      icon: 'dumbbell',
      color: 'emerald',
      groupId: 'grp_sport',
      quickMode: false,
      order: 0,
      fields: [
        {
          id: 'fld_pullup_reps',
          name: '数量',
          type: 'number',
          unit: '个',
          required: true,
          defaultValue: 20,
          quickSteps: [15, 20, 25, 30],
        },
        {
          id: 'fld_pullup_grip',
          name: '握距',
          type: 'select',
          multiple: false,
          options: [
            { id: 'opt_wide', label: '宽握正手', color: '#38B28B' },
            { id: 'opt_std', label: '标准正手', color: '#6E85D8' },
            { id: 'opt_chin', label: '反手引体', color: '#E0A458' },
          ],
          defaultOptionIds: ['opt_std'],
        },
      ],
      createdAt: now - 30 * dayMs,
      updatedAt: now,
      deletedAt: null,
    },
    {
      id: 'evt_piano',
      name: '练琴',
      icon: 'music',
      color: 'indigo',
      groupId: 'grp_music',
      quickMode: false,
      order: 1,
      fields: [
        {
          id: 'fld_piano_min',
          name: '时长',
          type: 'number',
          unit: '分钟',
          required: true,
          defaultValue: 30,
          quickSteps: [15, 30, 45, 60],
        },
        {
          id: 'fld_piano_focus',
          name: '练习内容',
          type: 'select',
          multiple: true,
          options: [
            { id: 'opt_scale', label: '音阶哈农', color: '#6E85D8' },
            { id: 'opt_new', label: '新曲视奏', color: '#937EDB' },
            { id: 'opt_review', label: '曲目打磨', color: '#4DA6C8' },
          ],
          defaultOptionIds: ['opt_review'],
        },
      ],
      createdAt: now - 30 * dayMs,
      updatedAt: now,
      deletedAt: null,
    },
    {
      id: 'evt_vitamin',
      name: '维生素',
      icon: 'pill',
      color: 'coral',
      groupId: 'grp_life',
      quickMode: true,
      order: 2,
      fields: [],
      createdAt: now - 30 * dayMs,
      updatedAt: now,
      deletedAt: null,
    },
    {
      id: 'evt_tea',
      name: '奶茶',
      icon: 'cup-soda',
      color: 'amber',
      groupId: 'grp_life',
      quickMode: false,
      order: 3,
      fields: [
        {
          id: 'fld_tea_price',
          name: '花费',
          type: 'number',
          unit: '元',
          defaultValue: 18,
          quickSteps: [12, 16, 18, 22],
        },
        {
          id: 'fld_tea_brand',
          name: '品牌',
          type: 'select',
          multiple: false,
          options: [
            { id: 'opt_heytea', label: '喜茶', color: '#E0A458' },
            { id: 'opt_chagee', label: '霸王茶姬', color: '#DF7A86' },
            { id: 'opt_yidiandian', label: '一点点', color: '#38B28B' },
          ],
          defaultOptionIds: ['opt_chagee'],
        },
      ],
      createdAt: now - 30 * dayMs,
      updatedAt: now,
      deletedAt: null,
    },
  ];

  const makeTs = (daysAgo: number, hour: number, minute: number) => {
    const d = new Date(now - daysAgo * dayMs);
    d.setHours(hour, minute, 0, 0);
    return d.getTime();
  };

  const records: EventRecord[] = [
    {
      id: 'rec_p1',
      eventId: 'evt_pullup',
      timestamp: makeTs(0, 10, 20),
      values: { fld_pullup_reps: 20, fld_pullup_grip: 'opt_std' },
      note: '分 4 组完成，状态不错',
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    },
    {
      id: 'rec_p2',
      eventId: 'evt_pullup',
      timestamp: makeTs(2, 18, 15),
      values: { fld_pullup_reps: 25, fld_pullup_grip: 'opt_wide' },
      note: '宽握最后一组力竭',
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    },
    {
      id: 'rec_p3',
      eventId: 'evt_pullup',
      timestamp: makeTs(5, 19, 5),
      values: { fld_pullup_reps: 20, fld_pullup_grip: 'opt_std' },
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    },
    {
      id: 'rec_p4',
      eventId: 'evt_pullup',
      timestamp: makeTs(8, 17, 40),
      values: { fld_pullup_reps: 18, fld_pullup_grip: 'opt_chin' },
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    },
    {
      id: 'rec_p5',
      eventId: 'evt_pullup',
      timestamp: makeTs(12, 18, 30),
      values: { fld_pullup_reps: 20, fld_pullup_grip: 'opt_std' },
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    },
    {
      id: 'rec_p6',
      eventId: 'evt_pullup',
      timestamp: makeTs(16, 11, 10),
      values: { fld_pullup_reps: 22, fld_pullup_grip: 'opt_wide' },
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    },
    {
      id: 'rec_m1',
      eventId: 'evt_piano',
      timestamp: makeTs(0, 12, 30),
      values: { fld_piano_min: 30, fld_piano_focus: ['opt_scale', 'opt_review'] },
      note: '右手分解和弦流畅多了',
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    },
    {
      id: 'rec_m2',
      eventId: 'evt_piano',
      timestamp: makeTs(1, 21, 10),
      values: { fld_piano_min: 45, fld_piano_focus: ['opt_new'] },
      note: '新曲前两页识谱',
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    },
    {
      id: 'rec_m3',
      eventId: 'evt_piano',
      timestamp: makeTs(3, 20, 40),
      values: { fld_piano_min: 30, fld_piano_focus: ['opt_review'] },
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    },
    {
      id: 'rec_m4',
      eventId: 'evt_piano',
      timestamp: makeTs(6, 15, 20),
      values: { fld_piano_min: 60, fld_piano_focus: ['opt_scale', 'opt_new'] },
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    },
    {
      id: 'rec_m5',
      eventId: 'evt_piano',
      timestamp: makeTs(10, 21, 0),
      values: { fld_piano_min: 30, fld_piano_focus: ['opt_review'] },
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    },
    {
      id: 'rec_v1',
      eventId: 'evt_vitamin',
      timestamp: makeTs(0, 8, 45),
      values: {},
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    },
    {
      id: 'rec_v2',
      eventId: 'evt_vitamin',
      timestamp: makeTs(1, 9, 10),
      values: {},
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    },
    {
      id: 'rec_v3',
      eventId: 'evt_vitamin',
      timestamp: makeTs(3, 8, 55),
      values: {},
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    },
    {
      id: 'rec_t1',
      eventId: 'evt_tea',
      timestamp: makeTs(4, 15, 30),
      values: { fld_tea_price: 18, fld_tea_brand: 'opt_chagee' },
      note: '伯牙绝弦少冰不额外加糖',
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    },
    {
      id: 'rec_t2',
      eventId: 'evt_tea',
      timestamp: makeTs(11, 16, 15),
      values: { fld_tea_price: 19, fld_tea_brand: 'opt_heytea' },
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    },
  ];

  await db.transaction('rw', db.groups, db.events, db.records, async () => {
    await db.groups.bulkPut(groups);
    await db.events.bulkPut(events);
    await db.records.bulkPut(records);
  });

  if (markModified) notifyLocalMutation();
}

export async function exportBackupJson(): Promise<BackupPayload> {
  const [groups, events, records] = await Promise.all([
    db.groups.toArray(),
    db.events.toArray(),
    db.records.toArray(),
  ]);
  return {
    app: 'DayDot',
    version: 1,
    exportedAt: Date.now(),
    groups: groups.filter((g) => !g.deletedAt),
    events: events.filter((e) => !e.deletedAt),
    records: records.filter((r) => !r.deletedAt),
  };
}

export async function importBackupJson(
  payload: BackupPayload,
  mode: 'merge' | 'replace',
): Promise<{ groups: number; events: number; records: number }> {
  if (!payload || payload.app !== 'DayDot' || !Array.isArray(payload.events)) {
    throw new Error('备份文件格式不正确，请选择 DayDot 导出的 JSON 文件。');
  }

  await db.transaction('rw', db.groups, db.events, db.records, async () => {
    if (mode === 'replace') {
      await db.groups.clear();
      await db.events.clear();
      await db.records.clear();
    }
    if (payload.groups?.length) await db.groups.bulkPut(payload.groups);
    if (payload.events?.length) await db.events.bulkPut(payload.events);
    if (payload.records?.length) await db.records.bulkPut(payload.records);
  });

  localStorage.setItem(SEED_FLAG_KEY, '1');
  notifyLocalMutation();
  return {
    groups: payload.groups?.length ?? 0,
    events: payload.events?.length ?? 0,
    records: payload.records?.length ?? 0,
  };
}

export async function clearAllData(): Promise<void> {
  await db.transaction('rw', db.groups, db.events, db.records, async () => {
    await db.groups.clear();
    await db.events.clear();
    await db.records.clear();
  });
  localStorage.setItem(SEED_FLAG_KEY, '1');
  notifyLocalMutation();
}

export function buildDefaultValues(event: EventItem): Record<string, number | string | string[]> {
  const values: Record<string, number | string | string[]> = {};
  for (const field of event.fields) {
    if (field.type === 'number' && field.defaultValue !== undefined) {
      values[field.id] = field.defaultValue;
    } else if (field.type === 'select' && field.defaultOptionIds?.length) {
      values[field.id] = field.multiple
        ? [...field.defaultOptionIds]
        : field.defaultOptionIds[0];
    } else if (field.type === 'text' && field.defaultValue) {
      values[field.id] = field.defaultValue;
    }
  }
  return values;
}
