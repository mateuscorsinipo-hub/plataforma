/** Lê uma resposta em NDJSON (um evento JSON por linha) conforme os dados chegam. */
export async function* readNdjson<T>(response: Response): AsyncGenerator<T> {
  if (!response.body) return;
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let newline = buffer.indexOf("\n");
      while (newline >= 0) {
        const line = buffer.slice(0, newline).trim();
        buffer = buffer.slice(newline + 1);
        if (line) yield JSON.parse(line) as T;
        newline = buffer.indexOf("\n");
      }
    }
    const rest = buffer.trim();
    if (rest) yield JSON.parse(rest) as T;
  } finally {
    reader.releaseLock();
  }
}

/** Mensagem de erro de uma resposta JSON da API ({ error }). */
export async function errorMessageOf(response: Response, fallback = "Algo deu errado. Tente novamente."): Promise<string> {
  try {
    const data = (await response.json()) as { error?: unknown };
    return typeof data.error === "string" ? data.error : fallback;
  } catch {
    return fallback;
  }
}
