"use client";

import { PencilIcon, PlusIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { SubjectChip, subjectIconNames } from "@/components/brand/subject-chip";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert } from "@/components/ui/feedback";
import { Input, NativeSelect } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/primitives";
import { subjectColorClasses } from "@/lib/config/subjects";

import { saveSubject } from "../actions";

export type SubjectRow = {
  id: string;
  slug: string;
  name: string;
  kind: string;
  color: string;
  icon: string;
  sort_order: number;
  is_active: boolean;
};

const kinds = { discipline: "Disciplina", exam_prep: "Preparação para prova", other: "Outra" } as const;

function SubjectDialog({ subject, onClose }: { subject: SubjectRow | null; onClose: () => void }) {
  const [form, setForm] = useState(
    subject ?? { id: "", slug: "", name: "", kind: "discipline", color: "blue", icon: "book-open", sort_order: 200, is_active: true },
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{subject ? `Editar ${subject.name}` : "Nova matéria"}</DialogTitle>
          <DialogDescription>Matérias inativas somem dos filtros e formulários, mas o conteúdo já associado é preservado.</DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            setError(null);
            startTransition(async () => {
              const result = await saveSubject(subject?.id ?? null, {
                name: form.name,
                slug: form.slug,
                kind: form.kind as keyof typeof kinds,
                color: form.color,
                icon: form.icon,
                sortOrder: Number(form.sort_order),
                isActive: form.is_active,
              });
              if (!result.ok) {
                setError(result.error);
                return;
              }
              toast.success(result.message ?? "Salvo.");
              onClose();
            });
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="mat-nome">Nome</Label>
              <Input id="mat-nome" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={60} required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="mat-slug">Endereço</Label>
              <Input
                id="mat-slug"
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase() })}
                disabled={Boolean(subject)}
                maxLength={40}
                required
                placeholder="ex.: artes"
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="mat-tipo">Tipo</Label>
              <NativeSelect id="mat-tipo" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
                {Object.entries(kinds).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="mat-cor">Cor</Label>
              <NativeSelect id="mat-cor" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })}>
                {Object.keys(subjectColorClasses).map((color) => (
                  <option key={color} value={color}>
                    {color}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="mat-icone">Ícone</Label>
              <NativeSelect id="mat-icone" value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })}>
                {subjectIconNames.map((icon) => (
                  <option key={icon} value={icon}>
                    {icon}
                  </option>
                ))}
              </NativeSelect>
            </div>
          </div>
          <div className="grid items-end gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="mat-ordem">Ordem</Label>
              <Input
                id="mat-ordem"
                type="number"
                min={0}
                max={10000}
                value={form.sort_order}
                onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })}
              />
            </div>
            <label className="flex items-center gap-3 pb-2.5 text-sm font-semibold">
              <Switch checked={form.is_active} onCheckedChange={(is_active) => setForm({ ...form, is_active })} /> Ativa
            </label>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            Prévia: <SubjectChip subject={{ name: form.name || "Matéria", color: form.color, icon: form.icon }} withIcon />
          </div>
          {error ? <Alert tone="danger">{error}</Alert> : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function SubjectList({ subjects }: { subjects: SubjectRow[] }) {
  const [editing, setEditing] = useState<SubjectRow | null | "new">(null);
  return (
    <div className="flex flex-col gap-4">
      <Button className="self-start" onClick={() => setEditing("new")}>
        <PlusIcon className="size-4" /> Nova matéria
      </Button>
      <ul className="flex flex-col divide-y divide-border rounded-2xl border border-border bg-card">
        {subjects.map((s) => (
          <li key={s.id} className="flex items-center gap-3 px-4 py-2.5">
            <SubjectChip subject={s} withIcon size="sm" />
            <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
              /{s.slug} · {kinds[s.kind as keyof typeof kinds] ?? s.kind} · ordem {s.sort_order}
            </span>
            {!s.is_active ? <span className="text-xs font-semibold text-warning-text">inativa</span> : null}
            <Button variant="ghost" size="icon-sm" aria-label={`Editar ${s.name}`} onClick={() => setEditing(s)}>
              <PencilIcon className="size-4" />
            </Button>
          </li>
        ))}
      </ul>
      {editing ? <SubjectDialog subject={editing === "new" ? null : editing} onClose={() => setEditing(null)} /> : null}
    </div>
  );
}
