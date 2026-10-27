import { acceptedMimeTypes, type AcceptedMimeType, type UploadKind } from "@/lib/config/uploads";
import type { Database } from "@/lib/supabase/database.types";

type FileRow = Database["public"]["Tables"]["uploaded_files"]["Row"];

/** Dados de arquivo seguros para enviar ao navegador (sem caminho interno do Storage). */
export type FileSummary = {
  id: string;
  name: string;
  mimeType: string;
  kind: UploadKind;
  sizeBytes: number;
  status: FileRow["status"];
  purpose: string;
  pageCount: number | null;
  charCount: number | null;
  chunkCount: number | null;
  errorMessage: string | null;
  folderId: string | null;
  createdAt: string;
};

export function toFileSummary(row: FileRow): FileSummary {
  return {
    id: row.id,
    name: row.original_name,
    mimeType: row.mime_type,
    kind: acceptedMimeTypes[row.mime_type as AcceptedMimeType]?.kind ?? "text",
    sizeBytes: row.size_bytes,
    status: row.status,
    purpose: row.purpose,
    pageCount: row.page_count,
    charCount: row.char_count,
    chunkCount: row.chunk_count,
    errorMessage: row.error_message,
    folderId: row.folder_id,
    createdAt: row.created_at,
  };
}
