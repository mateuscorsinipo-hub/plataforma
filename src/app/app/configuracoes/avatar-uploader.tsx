"use client";

import { CameraIcon, Trash2Icon } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { initialsOf } from "@/lib/avatar";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/primitives";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

import { removeAvatar, saveAvatar } from "./actions";

const MAX_INPUT_BYTES = 8 * 1024 * 1024;

/**
 * Redimensiona para 256×256 (recorte central) e reexporta em WebP no navegador.
 * Isso também descarta metadados da foto original (como localização GPS).
 */
async function toAvatarBlob(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, 256, 256);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("blob"))), "image/webp", 0.9),
  );
}

export function AvatarUploader({ userId, displayName, avatarUrl }: { userId: string; displayName: string; avatarUrl: string | null }) {
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState(avatarUrl);
  const [pending, startTransition] = useTransition();

  function handleFile(file: File | undefined) {
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      toast.error("Use uma imagem PNG, JPG ou WebP.");
      return;
    }
    if (file.size > MAX_INPUT_BYTES) {
      toast.error("A imagem é muito grande (máximo 8 MB).");
      return;
    }
    startTransition(async () => {
      try {
        const blob = await toAvatarBlob(file);
        const supabase = createSupabaseBrowserClient();
        const { error } = await supabase.storage
          .from("avatars")
          .upload(`${userId}/avatar`, blob, { upsert: true, contentType: "image/webp", cacheControl: "3600" });
        if (error) throw error;
        const result = await saveAvatar();
        if (result.error) throw new Error(result.error);
        setPreview(URL.createObjectURL(blob));
        toast.success("Foto atualizada.");
      } catch {
        toast.error("Não foi possível enviar a foto. Tente outra imagem.");
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-4">
      <Avatar className="size-20">
        {preview ? <AvatarImage src={preview} alt="Sua foto de perfil" /> : null}
        <AvatarFallback className="text-xl">{initialsOf(displayName)}</AvatarFallback>
      </Avatar>
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" disabled={pending} onClick={() => input.current?.click()}>
            <CameraIcon />
            {pending ? "Enviando…" : "Trocar foto"}
          </Button>
          {preview ? (
            <Button
              variant="ghost"
              size="sm"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  await removeAvatar();
                  setPreview(null);
                  toast.success("Foto removida.");
                })
              }
            >
              <Trash2Icon />
              Remover
            </Button>
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground">A foto só aparece para outras pessoas se o seu perfil for público.</p>
      </div>
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="sr-only"
        aria-label="Escolher foto de perfil"
        onChange={(event) => {
          handleFile(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
    </div>
  );
}
