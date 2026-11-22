export interface PaletteToken {
  id: string;
  name: string;
  /** Soft Morandi accent color for buttons, filled calendar circles, active tabs */
  solid: string;
  /** Readable ink shade for small text on soft background */
  ink: string;
  /** Airy pastel tile background */
  soft: string;
  /** Heatmap 4 intensity levels (from soft to deep) */
  levels: [string, string, string, string];
  /** Dark-mode calibrated tokens */
  darkInk: string;
  darkSoft: string;
  darkLevels: [string, string, string, string];
}

export interface ResolvedPalette {
  id: string;
  name: string;
  solid: string;
  ink: string;
  soft: string;
  levels: [string, string, string, string];
}

export const COLOR_PALETTE: PaletteToken[] = [
  {
    id: 'emerald',
    name: '薄荷绿',
    solid: '#38B28B',
    ink: '#1F7A5C',
    soft: '#EAF6F1',
    levels: ['#CDECE0', '#92D8BF', '#52BC98', '#2E9674'],
    darkInk: '#78DEC0',
    darkSoft: '#162F28',
    darkLevels: ['#18372E', '#1E5645', '#278065', '#42BD97'],
  },
  {
    id: 'indigo',
    name: '雾霾蓝',
    solid: '#6E85D8',
    ink: '#445AA8',
    soft: '#EEF1FA',
    levels: ['#DAE1F6', '#B2C1EC', '#849AE0', '#5871C9'],
    darkInk: '#A3B8F8',
    darkSoft: '#1C243D',
    darkLevels: ['#1E2847', '#2B3E73', '#445FB3', '#768EE0'],
  },
  {
    id: 'coral',
    name: '豆沙粉',
    solid: '#DF7A86',
    ink: '#A84854',
    soft: '#FAEEF0',
    levels: ['#F5D7DB', '#EBACB4', '#E0828E', '#C45B68'],
    darkInk: '#F4A6B0',
    darkSoft: '#361D23',
    darkLevels: ['#3D1F26', '#662C37', '#A44858', '#E07D89'],
  },
  {
    id: 'amber',
    name: '奶杏橙',
    solid: '#E0A458',
    ink: '#9E6822',
    soft: '#FBF3E7',
    levels: ['#F7E4C8', '#EFC790', '#E3A95E', '#C78634'],
    darkInk: '#F2C686',
    darkSoft: '#342716',
    darkLevels: ['#3D2C16', '#66461D', '#A36D28', '#E0A55A'],
  },
  {
    id: 'violet',
    name: '丁香紫',
    solid: '#937EDB',
    ink: '#624DA8',
    soft: '#F2EFFB',
    levels: ['#E2DBF7', '#C4B5EE', '#9F8BE0', '#7B64C7'],
    darkInk: '#C4B6F5',
    darkSoft: '#261F3E',
    darkLevels: ['#2B2247', '#443478', '#6851B5', '#9985DF'],
  },
  {
    id: 'sky',
    name: '晴空青',
    solid: '#4DA6C8',
    ink: '#287290',
    soft: '#EAF5FA',
    levels: ['#CEE7F2', '#98CFE3', '#60AFD0', '#388CAE'],
    darkInk: '#87D1EC',
    darkSoft: '#152C38',
    darkLevels: ['#173240', '#205069', '#2E7EA1', '#54AED1'],
  },
  {
    id: 'rose',
    name: '莓果粉',
    solid: '#CF749C',
    ink: '#943F65',
    soft: '#F9EEF3',
    levels: ['#F2D4E2', '#E3A8C3', '#D37CA4', '#B45681'],
    darkInk: '#EAA6C4',
    darkSoft: '#351C2A',
    darkLevels: ['#3D1E30', '#662D4C', '#9E4874', '#D178A1'],
  },
  {
    id: 'slate',
    name: '烟灰蓝',
    solid: '#6E7F96',
    ink: '#475569',
    soft: '#EFF2F6',
    levels: ['#D9E0E8', '#B4C1D1', '#8899B0', '#5E7088'],
    darkInk: '#BDC9D8',
    darkSoft: '#232934',
    darkLevels: ['#28303D', '#3B4657', '#5C6C82', '#8294AC'],
  },
];

export function getColorToken(colorId: string, isDark = false): ResolvedPalette {
  const token = COLOR_PALETTE.find((c) => c.id === colorId) ?? COLOR_PALETTE[0];
  if (isDark) {
    return {
      id: token.id,
      name: token.name,
      solid: token.solid,
      ink: token.darkInk,
      soft: token.darkSoft,
      levels: token.darkLevels,
    };
  }
  return {
    id: token.id,
    name: token.name,
    solid: token.solid,
    ink: token.ink,
    soft: token.soft,
    levels: token.levels,
  };
}

export const OPTION_COLORS = [
  '#38B28B',
  '#6E85D8',
  '#DF7A86',
  '#E0A458',
  '#937EDB',
  '#4DA6C8',
  '#CF749C',
  '#6E7F96',
];

export const ICON_CATALOG: { id: string; label: string; category: string }[] = [
  { id: 'dumbbell', label: '力量训练', category: '运动' },
  { id: 'activity', label: '运动心率', category: '运动' },
  { id: 'bike', label: '骑行', category: '运动' },
  { id: 'footprints', label: '跑步步行', category: '运动' },
  { id: 'flame', label: '燃脂挑战', category: '运动' },
  { id: 'music', label: '练琴音乐', category: '艺术' },
  { id: 'headphones', label: '听歌播客', category: '艺术' },
  { id: 'pen-tool', label: '绘画创作', category: '艺术' },
  { id: 'camera', label: '摄影', category: '艺术' },
  { id: 'book-open', label: '阅读', category: '学习' },
  { id: 'code', label: '编程', category: '学习' },
  { id: 'graduation-cap', label: '学习课程', category: '学习' },
  { id: 'languages', label: '外语', category: '学习' },
  { id: 'cup-soda', label: '奶茶饮品', category: '生活' },
  { id: 'coffee', label: '咖啡', category: '生活' },
  { id: 'pill', label: '维生素吃药', category: '健康' },
  { id: 'droplets', label: '喝水补水', category: '健康' },
  { id: 'moon', label: '睡眠休息', category: '健康' },
  { id: 'heart', label: '身心健康', category: '健康' },
  { id: 'utensils', label: '饮食下厨', category: '生活' },
  { id: 'sparkles', label: '护肤清洁', category: '生活' },
  { id: 'shopping-bag', label: '消费购物', category: '生活' },
  { id: 'gamepad-2', label: '游戏娱乐', category: '娱乐' },
  { id: 'film', label: '电影追剧', category: '娱乐' },
  { id: 'check-circle-2', label: '通用完成', category: '通用' },
  { id: 'star', label: '高光时刻', category: '通用' },
];
