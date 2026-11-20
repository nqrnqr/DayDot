export type FieldType = 'number' | 'select' | 'text';

export interface SelectOption {
  id: string;
  label: string;
  color: string;
}

export interface NumberFieldDef {
  id: string;
  name: string;
  type: 'number';
  unit: string;
  required?: boolean;
  defaultValue?: number;
  quickSteps?: number[];
}

export interface SelectFieldDef {
  id: string;
  name: string;
  type: 'select';
  required?: boolean;
  multiple?: boolean;
  options: SelectOption[];
  defaultOptionIds?: string[];
}

export interface TextFieldDef {
  id: string;
  name: string;
  type: 'text';
  required?: boolean;
  placeholder?: string;
  defaultValue?: string;
}

export type CustomFieldDef = NumberFieldDef | SelectFieldDef | TextFieldDef;

export interface Group {
  id: string;
  name: string;
  order: number;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number | null;
}

export interface EventItem {
  id: string;
  name: string;
  icon: string;
  color: string;
  groupId: string | null;
  /** true: ⚡ 一键按默认值速记; false: + 弹出带默认值的确认抽屉 */
  quickMode: boolean;
  fields: CustomFieldDef[];
  order: number;
  pinned?: boolean;
  archived?: boolean;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number | null;
}

export type FieldValue = number | string | string[];

export interface EventRecord {
  id: string;
  eventId: string;
  timestamp: number;
  values: Record<string, FieldValue>;
  note?: string;
  /** 预留第二阶段照片功能 */
  photos?: string[];
  createdAt: number;
  updatedAt: number;
  deletedAt?: number | null;
}

export interface BackupPayload {
  app: 'DayDot';
  version: 1;
  exportedAt: number;
  groups: Group[];
  events: EventItem[];
  records: EventRecord[];
}
