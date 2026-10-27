/**
 * Log estruturado e sem dados sensíveis. Nunca registre e-mails, conteúdo de
 * estudo, tokens ou chaves: passe apenas identificadores e códigos de erro.
 */
type LogFields = Record<string, string | number | boolean | null | undefined>;

const REDACT = /(password|senha|token|secret|key|authorization|cookie|email|content|prompt)/i;

function sanitize(fields: LogFields = {}): LogFields {
  const out: LogFields = {};
  for (const [key, value] of Object.entries(fields)) {
    out[key] = REDACT.test(key) ? "[redacted]" : value;
  }
  return out;
}

function write(level: "info" | "warn" | "error", event: string, fields?: LogFields) {
  const line = JSON.stringify({ level, event, time: new Date().toISOString(), ...sanitize(fields) });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}

export const logger = {
  info: (event: string, fields?: LogFields) => write("info", event, fields),
  warn: (event: string, fields?: LogFields) => write("warn", event, fields),
  error: (event: string, fields?: LogFields) => write("error", event, fields),
};
