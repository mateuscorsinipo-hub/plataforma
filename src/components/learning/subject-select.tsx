import { NativeSelect } from "@/components/ui/input";
import type { Subject } from "@/lib/data/subjects";

/** Lista de matérias para formulários (carregada no servidor e passada como prop). */
export function SubjectSelect({
  subjects,
  emptyLabel = "Sem matéria",
  ...props
}: React.ComponentProps<typeof NativeSelect> & { subjects: Pick<Subject, "id" | "name">[]; emptyLabel?: string }) {
  return (
    <NativeSelect {...props}>
      <option value="">{emptyLabel}</option>
      {subjects.map((subject) => (
        <option key={subject.id} value={subject.id}>
          {subject.name}
        </option>
      ))}
    </NativeSelect>
  );
}
