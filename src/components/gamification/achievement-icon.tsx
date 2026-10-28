import {
  AwardIcon,
  BookOpenIcon,
  CalendarCheckIcon,
  CircleHelpIcon,
  ClockIcon,
  FlameIcon,
  FootprintsIcon,
  LayersIcon,
  StarIcon,
  TimerIcon,
  type LucideIcon,
} from "lucide-react";

const icons: Record<string, LucideIcon> = {
  award: AwardIcon,
  "book-open": BookOpenIcon,
  "calendar-check": CalendarCheckIcon,
  "circle-help": CircleHelpIcon,
  clock: ClockIcon,
  flame: FlameIcon,
  footprints: FootprintsIcon,
  layers: LayersIcon,
  star: StarIcon,
  timer: TimerIcon,
};

/** Ícone de uma conquista pelo nome guardado no banco (desconhecidos viram medalha). */
export function AchievementIcon({ name, className }: { name: string; className?: string }) {
  const Icon = icons[name] ?? AwardIcon;
  return <Icon aria-hidden="true" className={className} />;
}
