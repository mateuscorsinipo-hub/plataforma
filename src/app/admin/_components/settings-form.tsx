"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { Input, NativeSelect } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { saveSettings } from "../actions";

export type SettingsValues = {
  moderation_mode: "pre" | "post";
  report_auto_hide_threshold: number;
  community_min_age_without_guardian: number;
  child_age_limit: number;
};

export function SettingsForm({ initial }: { initial: SettingsValues }) {
  const [form, setForm] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="flex max-w-2xl flex-col gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        startTransition(async () => {
          const result = await saveSettings(form);
          if (!result.ok) setError(result.error);
          else toast.success(result.message ?? "Salvo.");
        });
      }}
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="cfg-moderacao">Moderação da biblioteca</Label>
        <NativeSelect
          id="cfg-moderacao"
          value={form.moderation_mode}
          onChange={(e) => setForm({ ...form, moderation_mode: e.target.value as SettingsValues["moderation_mode"] })}
        >
          <option value="pre">Prévia: todo material passa pela moderação antes de aparecer</option>
          <option value="post">Posterior: publica na hora e revisa por denúncia</option>
        </NativeSelect>
        <p className="text-xs text-muted-foreground">Com público menor de idade, a moderação prévia é a opção mais segura.</p>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="cfg-denuncias">Denúncias para tirar um material do ar até a revisão</Label>
        <Input
          id="cfg-denuncias"
          type="number"
          min={1}
          max={50}
          value={form.report_auto_hide_threshold}
          onChange={(e) => setForm({ ...form, report_auto_hide_threshold: Number(e.target.value) })}
        />
        <p className="text-xs text-muted-foreground">Conta pessoas diferentes com denúncias abertas.</p>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cfg-idade">Idade mínima para publicar sem responsável</Label>
          <Input
            id="cfg-idade"
            type="number"
            min={13}
            max={18}
            value={form.community_min_age_without_guardian}
            onChange={(e) => setForm({ ...form, community_min_age_without_guardian: Number(e.target.value) })}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cfg-crianca">Idade abaixo da qual a conta exige responsável</Label>
          <Input
            id="cfg-crianca"
            type="number"
            min={12}
            max={16}
            value={form.child_age_limit}
            onChange={(e) => setForm({ ...form, child_age_limit: Number(e.target.value) })}
          />
          <p className="text-xs text-muted-foreground">A LGPD (art. 14) trata como criança quem tem menos de 12 anos.</p>
        </div>
      </div>
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <Button type="submit" className="self-start" disabled={pending}>
        Salvar configurações
      </Button>
    </form>
  );
}
