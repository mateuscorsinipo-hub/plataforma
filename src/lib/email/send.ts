import "server-only";

import { isEmailConfigured, serverEnv } from "@/lib/env/server";
import { logger } from "@/lib/logger";

export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

export type SendResult = { sent: true } | { sent: false; reason: "not_configured" | "provider_error" };

/** Envia e-mail transacional pelo Resend. Sem credenciais, retorna not_configured (nada é simulado). */
export async function sendEmail(message: EmailMessage): Promise<SendResult> {
  if (!isEmailConfigured()) {
    return { sent: false, reason: "not_configured" };
  }
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serverEnv.email.resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: serverEnv.email.from,
        to: [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) {
      logger.error("email.provider_error", { status: response.status });
      return { sent: false, reason: "provider_error" };
    }
    return { sent: true };
  } catch (error) {
    logger.error("email.request_failed", { name: error instanceof Error ? error.name : "unknown" });
    return { sent: false, reason: "provider_error" };
  }
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
}

export function emailLayout(title: string, bodyHtml: string): string {
  return `<!doctype html><html lang="pt-BR"><body style="margin:0;padding:24px;background:#F6F7FB;font-family:Arial,Helvetica,sans-serif;color:#0E1B33">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#FFFFFF;border:1px solid #E3E7F0;border-radius:16px">
<tr><td style="padding:32px"><p style="margin:0 0 8px;font-size:22px;font-weight:bold">grifo</p>
<h1 style="margin:0 0 16px;font-size:20px">${escapeHtml(title)}</h1>${bodyHtml}</td></tr></table></body></html>`;
}
