import {
  BookAIcon,
  CircleHelpIcon,
  FileTextIcon,
  KeyRoundIcon,
  LayersIcon,
  LightbulbIcon,
  MapIcon,
  PenLineIcon,
  TimerIcon,
  ZapIcon,
  type LucideIcon,
} from "lucide-react";

import type { GenerationKind } from "@/lib/ai/studio/kinds";

export const kindIcons: Record<GenerationKind, LucideIcon> = {
  summary_quick: ZapIcon,
  summary_detailed: FileTextIcon,
  study_guide: MapIcon,
  key_concepts: KeyRoundIcon,
  glossary: BookAIcon,
  flashcards: LayersIcon,
  quiz: CircleHelpIcon,
  mock_exam: TimerIcon,
  essay_questions: PenLineIcon,
  explanation: LightbulbIcon,
};
