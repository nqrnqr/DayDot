export function startOfDay(date: Date | number): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function endOfDay(date: Date | number): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

export function toDateKey(date: Date | number): string {
  const d = new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function fromDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function isSameDay(a: Date | number, b: Date | number): boolean {
  return toDateKey(a) === toDateKey(b);
}

export function formatTime(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function formatFullDate(ts: number | Date): string {
  const d = new Date(ts);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

export function formatWeekday(ts: number | Date): string {
  const names = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  return names[new Date(ts).getDay()];
}

export function formatMonthTitle(year: number, monthIndex: number): string {
  return `${year}年${monthIndex + 1}月`;
}

export function toDatetimeLocalValue(ts: number): string {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${day}T${hh}:${mm}`;
}

/** Get Monday-first week range containing `anchor` */
export function getWeekRange(anchor: Date): { start: Date; end: Date; days: Date[] } {
  const d = startOfDay(anchor);
  const dayOfWeek = d.getDay(); // 0=Sun..6=Sat
  const diffToMon = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const start = new Date(d);
  start.setDate(d.getDate() + diffToMon);
  const days: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const cur = new Date(start);
    cur.setDate(start.getDate() + i);
    days.push(cur);
  }
  const end = endOfDay(days[6]);
  return { start, end, days };
}

export interface CalendarCell {
  date: Date;
  dateKey: string;
  dayNum: number;
  inCurrentMonth: boolean;
  isToday: boolean;
}

/** Build 6-row (or 5-row) Monday-first calendar grid for given year & 0-based month */
export function buildMonthGrid(year: number, monthIndex: number): CalendarCell[] {
  const firstDay = new Date(year, monthIndex, 1);
  const lastDay = new Date(year, monthIndex + 1, 0);
  const firstWeekdayMon = (firstDay.getDay() + 6) % 7; // Mon=0 .. Sun=6
  const totalDays = lastDay.getDate();
  const totalCells = Math.ceil((firstWeekdayMon + totalDays) / 7) * 7;
  const todayKey = toDateKey(new Date());

  const cells: CalendarCell[] = [];
  for (let i = 0; i < totalCells; i++) {
    const dayOffset = i - firstWeekdayMon;
    const d = new Date(year, monthIndex, 1 + dayOffset);
    const key = toDateKey(d);
    cells.push({
      date: d,
      dateKey: key,
      dayNum: d.getDate(),
      inCurrentMonth: d.getMonth() === monthIndex,
      isToday: key === todayKey,
    });
  }
  return cells;
}

export interface HeatmapWeekColumn {
  monthLabel?: string;
  days: {
    dateKey: string;
    date: Date;
    dayOfMonth: number;
    isFuture: boolean;
  }[];
}

/** Build rolling 53-week GitHub-style heatmap grid ending this week (Monday to Sunday rows) */
export function buildAnnualHeatmapColumns(endYear?: number): HeatmapWeekColumn[] {
  const now = startOfDay(new Date());
  const targetEnd =
    endYear && endYear !== now.getFullYear()
      ? new Date(endYear, 11, 31)
      : new Date(now.getFullYear(), 11, 31);
  const targetStart = new Date(targetEnd.getFullYear(), 0, 1);

  // Align start back to Monday
  const startMonOffset = (targetStart.getDay() + 6) % 7;
  const gridStart = new Date(targetStart);
  gridStart.setDate(targetStart.getDate() - startMonOffset);

  // Align end forward to Sunday
  const endSunOffset = (7 - ((targetEnd.getDay() + 6) % 7) - 1 + 7) % 7;
  const gridEnd = new Date(targetEnd);
  gridEnd.setDate(targetEnd.getDate() + endSunOffset);

  const monthNames = [
    '一月',
    '二月',
    '三月',
    '四月',
    '五月',
    '六月',
    '七月',
    '八月',
    '九月',
    '十月',
    '十一月',
    '十二月',
  ];

  const columns: HeatmapWeekColumn[] = [];
  const cursor = new Date(gridStart);
  let lastLabeledMonth = -1;

  while (cursor <= gridEnd) {
    const days: HeatmapWeekColumn['days'] = [];
    let monthLabel: string | undefined;

    for (let r = 0; r < 7; r++) {
      const d = new Date(cursor);
      const isFirstOfMonth = d.getDate() === 1 && d.getFullYear() === targetEnd.getFullYear();
      if (isFirstOfMonth && d.getMonth() !== lastLabeledMonth) {
        monthLabel = monthNames[d.getMonth()];
        lastLabeledMonth = d.getMonth();
      }
      days.push({
        dateKey: toDateKey(d),
        date: d,
        dayOfMonth: d.getDate(),
        isFuture: d.getTime() > now.getTime(),
      });
      cursor.setDate(cursor.getDate() + 1);
    }

    // Label first column if January starts mid-week
    if (columns.length === 0 && !monthLabel) {
      monthLabel = monthNames[0];
      lastLabeledMonth = 0;
    }

    columns.push({ monthLabel, days });
  }

  return columns;
}

export function formatRelativeSince(lastTimestamp: number | undefined): string {
  if (!lastTimestamp) return '暂无记录';
  const now = new Date();
  const diffMs = now.getTime() - lastTimestamp;
  if (diffMs < 0) return '计划中';

  const todayStart = startOfDay(now).getTime();
  const recordDayStart = startOfDay(lastTimestamp).getTime();
  const diffDays = Math.round((todayStart - recordDayStart) / 86_400_000);

  if (diffDays === 0) {
    const mins = Math.floor(diffMs / 60_000);
    if (mins < 1) return '刚刚';
    if (mins < 60) return `${mins}分钟前`;
    return `今天 ${formatTime(lastTimestamp)}`;
  }
  if (diffDays === 1) return '昨天';
  if (diffDays < 30) return `距上次 ${diffDays} 天`;
  const months = Math.floor(diffDays / 30);
  return `距上次 ${months} 个月`;
}
