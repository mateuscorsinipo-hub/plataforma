import {
  BookOpenIcon,
  CalendarDaysIcon,
  ChartColumnIcon,
  CircleHelpIcon,
  FolderIcon,
  HouseIcon,
  LayersIcon,
  ListChecksIcon,
  MessageCircleIcon,
  NotebookPenIcon,
  SparklesIcon,
  TimerIcon,
  TrophyIcon,
  type LucideIcon,
} from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon; exact?: boolean };

export const primaryNav: NavItem[] = [
  { href: "/app", label: "Início", icon: HouseIcon, exact: true },
  { href: "/app/tutor", label: "Tutor de IA", icon: MessageCircleIcon },
  { href: "/app/estudio", label: "Estúdio", icon: SparklesIcon },
  { href: "/app/pastas", label: "Pastas", icon: FolderIcon },
];

export const practiceNav: NavItem[] = [
  { href: "/app/flashcards", label: "Flashcards", icon: LayersIcon },
  { href: "/app/quizzes", label: "Quizzes", icon: CircleHelpIcon },
  { href: "/app/simulados", label: "Simulados", icon: TimerIcon },
];

export const planningNav: NavItem[] = [
  { href: "/app/plano", label: "Plano de estudos", icon: ListChecksIcon },
  { href: "/app/calendario", label: "Calendário", icon: CalendarDaysIcon },
  { href: "/app/desempenho", label: "Desempenho", icon: ChartColumnIcon },
  { href: "/app/conquistas", label: "Conquistas", icon: TrophyIcon },
];

export const communityNav: NavItem[] = [
  { href: "/app/biblioteca", label: "Biblioteca", icon: BookOpenIcon },
  { href: "/app/materiais", label: "Meus materiais", icon: NotebookPenIcon },
];

export const navSections = [
  { title: null, items: primaryNav },
  { title: "Praticar", items: practiceNav },
  { title: "Organizar", items: planningNav },
  { title: "Comunidade", items: communityNav },
] as const;

/** Atalhos da barra inferior no celular. */
export const mobileTabs: NavItem[] = [
  { href: "/app", label: "Início", icon: HouseIcon, exact: true },
  { href: "/app/tutor", label: "Tutor", icon: MessageCircleIcon },
  { href: "/app/flashcards", label: "Revisar", icon: LayersIcon },
  { href: "/app/plano", label: "Plano", icon: ListChecksIcon },
];

export function isActivePath(pathname: string, item: Pick<NavItem, "href" | "exact">): boolean {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}
