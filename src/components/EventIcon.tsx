import {
  Activity,
  Bike,
  BookOpen,
  Camera,
  CheckCircle2,
  Code,
  Coffee,
  CupSoda,
  Droplets,
  Dumbbell,
  Film,
  Flame,
  Footprints,
  Gamepad2,
  GraduationCap,
  Headphones,
  Heart,
  Languages,
  Moon,
  Music,
  PenTool,
  Pill,
  ShoppingBag,
  Sparkles,
  Star,
  Utensils,
  type LucideProps,
} from 'lucide-react';

const ICON_MAP: Record<string, React.ComponentType<LucideProps>> = {
  dumbbell: Dumbbell,
  activity: Activity,
  bike: Bike,
  footprints: Footprints,
  flame: Flame,
  music: Music,
  headphones: Headphones,
  'pen-tool': PenTool,
  camera: Camera,
  'book-open': BookOpen,
  code: Code,
  'graduation-cap': GraduationCap,
  languages: Languages,
  'cup-soda': CupSoda,
  coffee: Coffee,
  pill: Pill,
  droplets: Droplets,
  moon: Moon,
  heart: Heart,
  utensils: Utensils,
  sparkles: Sparkles,
  'shopping-bag': ShoppingBag,
  'gamepad-2': Gamepad2,
  film: Film,
  'check-circle-2': CheckCircle2,
  star: Star,
};

interface EventIconProps extends LucideProps {
  name: string;
}

export function EventIcon({ name, ...props }: EventIconProps) {
  const IconComp = ICON_MAP[name] ?? CheckCircle2;
  return <IconComp {...props} />;
}
