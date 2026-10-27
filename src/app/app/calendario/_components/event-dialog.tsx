"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { SubjectSelect } from "@/components/learning/subject-select";
import { Button } from "@/components/ui/button";
import { ChoiceChip } from "@/components/ui/choice-chip";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert } from "@/components/ui/feedback";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/primitives";
import type { EventEditData } from "@/lib/data/calendar";
import { weekdayLabel } from "@/lib/domain/dates";
import { eventTypeLabels, eventTypes, recurrenceLabels, reminderOptions } from "@/lib/validation/calendar";

import { saveEvent } from "../actions";

export type EventDraft = Omit<EventEditData, "id" | "fromPlan"> & { id: string | null };

export function emptyDraft(date: string): EventDraft {
  return {
    id: null,
    title: "",
    description: "",
    eventType: "study",
    subjectId: "",
    date,
    allDay: false,
    startTime: "19:00",
    endTime: "20:00",
    recurrence: "none",
    weekdays: [],
    until: "",
    reminderMinutes: "",
    location: "",
  };
}

export function EventDialog({
  draft,
  onClose,
  subjects,
  emailReminders,
}: {
  draft: EventDraft | null;
  onClose: () => void;
  subjects: { id: string; name: string }[];
  emailReminders: boolean;
}) {
  const [form, setForm] = useState<EventDraft | null>(draft);
  const [conflicts, setConflicts] = useState<string[] | null>(null);
  const [pending, startTransition] = useTransition();
  if (!form) return null;
  const set = (patch: Partial<EventDraft>) => {
    setConflicts(null);
    setForm((prev) => (prev ? { ...prev, ...patch } : prev));
  };

  function submit(confirmConflicts: boolean) {
    if (!form) return;
    startTransition(async () => {
      const result = await saveEvent(
        form.id,
        {
          title: form.title,
          description: form.description,
          eventType: form.eventType as (typeof eventTypes)[number],
          subjectId: form.subjectId,
          date: form.date,
          allDay: form.allDay,
          startTime: form.startTime,
          endTime: form.endTime,
          recurrence: form.recurrence as keyof typeof recurrenceLabels,
          weekdays: form.weekdays,
          until: form.until,
          reminderMinutes: form.reminderMinutes as "",
          location: form.location,
        },
        { confirmConflicts },
      );
      if (result.ok) {
        toast.success(form.id ? "Evento atualizado." : "Evento criado.");
        onClose();
      } else if (result.conflicts) {
        setConflicts(result.conflicts);
      } else {
        toast.error(result.error);
      }
    });
  }

  const repeatsWeekly = form.recurrence === "weekly" || form.recurrence === "biweekly";

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{form.id ? "Editar evento" : "Novo evento"}</DialogTitle>
          <DialogDescription>{form.id && form.recurrence !== "none" ? "As alterações valem para todas as repetições." : "Aulas, provas, sessões de estudo e lembretes."}</DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            submit(false);
          }}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ev-titulo">Título</Label>
            <Input id="ev-titulo" value={form.title} onChange={(e) => set({ title: e.target.value })} maxLength={120} required autoFocus />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ev-tipo">Tipo</Label>
              <NativeSelect id="ev-tipo" value={form.eventType} onChange={(e) => set({ eventType: e.target.value })}>
                {eventTypes.map((t) => (
                  <option key={t} value={t}>
                    {eventTypeLabels[t]}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ev-materia">Matéria</Label>
              <SubjectSelect id="ev-materia" subjects={subjects} value={form.subjectId} onChange={(e) => set({ subjectId: e.target.value })} />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ev-data">Data</Label>
              <Input id="ev-data" type="date" value={form.date} onChange={(e) => set({ date: e.target.value })} required />
            </div>
            <label className="flex items-center gap-3 self-end pb-2.5 text-sm font-semibold">
              <Switch checked={form.allDay} onCheckedChange={(allDay) => set({ allDay })} /> Dia inteiro
            </label>
          </div>
          {!form.allDay ? (
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ev-inicio">Início</Label>
                <Input id="ev-inicio" type="time" value={form.startTime} onChange={(e) => set({ startTime: e.target.value })} required />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ev-fim">Fim</Label>
                <Input id="ev-fim" type="time" value={form.endTime} onChange={(e) => set({ endTime: e.target.value })} required />
              </div>
            </div>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ev-repete">Repetição</Label>
              <NativeSelect id="ev-repete" value={form.recurrence} onChange={(e) => set({ recurrence: e.target.value })}>
                {Object.entries(recurrenceLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </NativeSelect>
            </div>
            {form.recurrence !== "none" ? (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ev-ate">Repetir até</Label>
                <Input id="ev-ate" type="date" min={form.date} value={form.until} onChange={(e) => set({ until: e.target.value })} />
              </div>
            ) : null}
          </div>
          {repeatsWeekly ? (
            <fieldset>
              <legend className="mb-2 text-sm font-semibold">Dias da semana</legend>
              <div className="flex flex-wrap gap-2">
                {[0, 1, 2, 3, 4, 5, 6].map((day) => (
                  <ChoiceChip
                    key={day}
                    label={weekdayLabel(day).replace(/^./, (c) => c.toUpperCase())}
                    chipClassName="min-h-9 px-3 text-sm"
                    checked={form.weekdays.includes(day)}
                    onChange={() => set({ weekdays: form.weekdays.includes(day) ? form.weekdays.filter((d) => d !== day) : [...form.weekdays, day] })}
                  />
                ))}
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">Sem dias marcados, repete no mesmo dia da semana da data.</p>
            </fieldset>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ev-lembrete">Lembrete</Label>
              <NativeSelect id="ev-lembrete" value={form.reminderMinutes} onChange={(e) => set({ reminderMinutes: e.target.value })}>
                {reminderOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </NativeSelect>
              <p className="text-xs text-muted-foreground">
                {emailReminders ? "Aviso no app e por e-mail." : "Aviso no app. E-mail, se ativado nas configurações e disponível."}
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ev-local">Local</Label>
              <Input id="ev-local" value={form.location} onChange={(e) => set({ location: e.target.value })} maxLength={200} />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ev-descricao">Descrição</Label>
            <Textarea id="ev-descricao" value={form.description} onChange={(e) => set({ description: e.target.value })} rows={2} maxLength={1000} />
          </div>
          {conflicts ? (
            <Alert tone="warning" title="Choque de horário">
              Este horário coincide com: {conflicts.join(", ")}.
            </Alert>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            {conflicts ? (
              <Button type="button" disabled={pending} onClick={() => submit(true)}>
                Salvar mesmo assim
              </Button>
            ) : (
              <Button type="submit" disabled={pending || !form.title.trim()}>
                Salvar
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
