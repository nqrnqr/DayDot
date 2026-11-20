export interface PaletteToken {
  id: string;
  name: string;
  /** Solid accessible accent color for buttons, filled calendar circles, active tabs */
  solid: string;
  /** Stronger ink shade for small text on soft background (WCAG >= 4.5:1) */
  ink: string;
  /** Soft pastel tile background (like MarkTimes icon badge) */
  soft: string;
  /** Heatmap 4 intensity levels (from light to deep) */
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
    solid: '#1F9D75',
    ink: '#136D51',
    soft: '#E3F6EE',
    levels: ['#C6EFE0', '#7FD8B9', '#38B88C', '#168562'],
    darkInk: '#6EE7B7',
    darkSoft: '#15322A',
    darkLevels: ['#15382C', '#1A5A44', '#1F8563', '#34D399'],
  },
  {
    id: 'indigo',
    name: '雾霾蓝',
    solid: '#4F6EF7',
    ink: '#3149C9',
    soft: '#E9EDFE',
    levels: ['#D2DCFD', '#9FB3FA', '#6581F7', '#3B56DC'],
    darkInk: '#93B4FF',
    darkSoft: '#1A2444',
    darkLevels: ['#1B264A', '#263D7D', '#3B5BD4', '#6E8CFF'],
  },
  {
    id: 'coral',
    name: '珊瑚粉',
    solid: '#E05A6D',
    ink: '#B23346',
    soft: '#FCE9EC',
    levels: ['#FAD0D7', '#F29CA9', '#E5697C', '#C93D53'],
    darkInk: '#FDA4AF',
    darkSoft: '#3B1B22',
    darkLevels: ['#401B23', '#6D2634', '#B53B4E', '#F47183'],
  },
  {
    id: 'amber',
    name: '暖阳橙',
    solid: '#D97706',
    ink: '#9A4F04',
    soft: '#FEF2DC',
    levels: ['#FDE2B3', '#F9C168', '#EE961E', '#C46804'],
    darkInk: '#FCD34D',
    darkSoft: '#3A2811',
    darkLevels: ['#422B10', '#704513', '#B4690E', '#F59E0B'],
  },
  {
    id: 'violet',
    name: '丁香紫',
    solid: '#7C5CE6',
    ink: '#5838BC',
    soft: '#EFEAFC',
    levels: ['#DDD2FA', '#B9A3F4', '#8E70EB', '#6343CE'],
    darkInk: '#C4B5FD',
    darkSoft: '#271E44',
    darkLevels: ['#2B204D', '#443082', '#6847C7', '#9A7BF5'],
  },
  {
    id: 'sky',
    name: '晴空青',
    solid: '#0E8BB8',
    ink: '#086387',
    soft: '#E3F4FB',
    levels: ['#C2E7F7', '#7ECBE9', '#2CA8D6', '#0B769E'],
    darkInk: '#7DD3FC',
    darkSoft: '#122E3D',
    darkLevels: ['#133242', '#195470', '#1680AB', '#38BDF8'],
  },
  {
    id: 'rose',
    name: '莓果红',
    solid: '#C84B84',
    ink: '#9B2C5F',
    soft: '#FAE8F1',
    levels: ['#F5CBE0', '#E89AC1', '#D6649B', '#B23872'],
    darkInk: '#F9A8D4',
    darkSoft: '#3A1A2B',
    darkLevels: ['#421A30', '#6F264C', '#AD3B74', '#E86DA7'],
  },
  {
    id: 'slate',
    name: '石墨灰',
    solid: '#475569',
    ink: '#334155',
    soft: '#EBEEF3',
    levels: ['#CBD5E1', '#94A3B8', '#64748B', '#334155'],
    darkInk: '#CBD5E1',
    darkSoft: '#252B36',
    darkLevels: ['#28303D', '#3D4859', '#64748B', '#94A3B8'],
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
  '#1F9D75',
  '#4F6EF7',
  '#E05A6D',
  '#D97706',
  '#7C5CE6',
  '#0E8BB8',
  '#C84B84',
  '#475569',
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
