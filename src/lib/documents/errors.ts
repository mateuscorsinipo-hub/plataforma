export type DocumentErrorCode =
  | "unsupported_type"
  | "mismatched_type"
  | "too_large"
  | "password_protected"
  | "corrupted"
  | "empty"
  | "too_many_pages"
  | "too_much_text"
  | "zip_bomb"
  | "ocr_unavailable"
  | "ocr_failed"
  | "scanned_too_large"
  | "storage_error";

export const documentErrorMessages: Record<DocumentErrorCode, string> = {
  unsupported_type: "Tipo de arquivo não suportado. Envie PDF, Word (.docx), PowerPoint (.pptx), imagem ou texto.",
  mismatched_type: "O conteúdo do arquivo não corresponde à extensão informada.",
  too_large: "O arquivo é maior que o limite do seu plano.",
  password_protected: "O PDF está protegido por senha. Remova a proteção e envie de novo.",
  corrupted: "Não conseguimos ler este arquivo. Ele pode estar corrompido.",
  empty: "Não encontramos texto neste arquivo.",
  too_many_pages: "O arquivo tem páginas demais. Divida em partes menores.",
  too_much_text: "O arquivo tem texto demais para processar de uma vez. Divida em partes menores.",
  zip_bomb: "O arquivo tem uma estrutura interna inválida.",
  ocr_unavailable: "A leitura de imagens e de PDFs digitalizados não está disponível nesta instalação.",
  ocr_failed: "Não conseguimos ler o texto da imagem. Tente uma foto mais nítida e bem iluminada.",
  scanned_too_large: "Este PDF parece digitalizado (páginas em imagem) e é grande demais para leitura automática. Envie até 20 páginas por vez.",
  storage_error: "Não conseguimos acessar o arquivo enviado. Tente enviar novamente.",
};

export class DocumentError extends Error {
  constructor(public readonly code: DocumentErrorCode) {
    super(documentErrorMessages[code]);
    this.name = "DocumentError";
  }
}
