import {
  AtomIcon,
  BookOpenIcon,
  BrainIcon,
  FlaskConicalIcon,
  GlobeIcon,
  GraduationCapIcon,
  LandmarkIcon,
  LanguagesIcon,
  LaptopIcon,
  LeafIcon,
  MessageCircleIcon,
  PenLineIcon,
  ShapesIcon,
  SigmaIcon,
  TargetIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react";

import { subjectColorClass } from "@/lib/config/subjects";
import { cn } from "@/lib/utils";

const icons: Record<string, LucideIcon> = {
  sigma: SigmaIcon,
  languages: LanguagesIcon,
  "pen-line": PenLineIcon,
  "book-open": BookOpenIcon,
  leaf: LeafIcon,
  "flask-conical": FlaskConicalIcon,
  atom: AtomIcon,
  landmark: LandmarkIcon,
  globe: GlobeIcon,
  brain: BrainIcon,
  users: UsersIcon,
  "message-circle": MessageCircleIcon,
  laptop: LaptopIcon,
  "graduation-cap": GraduationCapIcon,
  target: TargetIcon,
  shapes: ShapesIcon,
};

export type SubjectLike = { name: string; color: string; icon?: string | null };

function SubjectIcon({ icon, className }: { icon?: string | null; className?: string }) {
  const Icon = icons[icon ?? ""] ?? BookOpenIcon;
  return <Icon aria-hidden="true" className={className} />;
}

function SubjectChip({
  subject,
  className,
  withIcon = false,
  size = "md",
}: {
  subject: SubjectLike;
  className?: string;
  withIcon?: boolean;
  size?: "sm" | "md";
}) {
  return (
    <span
      className={cn(
        "inline-flex w-fit shrink-0 items-center gap-1.5 rounded-full font-semibold whitespace-nowrap",
        size === "sm" ? "px-2.5 py-0.5 text-xs" : "px-3 py-1 text-[0.8125rem]",
        subjectColorClass(subject.color),
        className,
      )}
    >
      {withIcon ? <SubjectIcon icon={subject.icon} className="size-3.5" /> : null}
      {subject.name}
    </span>
  );
}

/** Nomes de ícone aceitos para matérias (usados também no painel administrativo). */
const subjectIconNames = Object.keys(icons);

export { SubjectChip, SubjectIcon, subjectIconNames };
