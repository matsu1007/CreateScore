const OLLAMA_BASE = "http://localhost:11434";

export type OllamaMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

type OllamaChatOptions = {
  temperature?: number;
  num_predict?: number;
  num_thread?: number;
};

type OllamaStreamChunk = {
  message: { content: string };
  done: boolean;
};

export const checkOllamaHealth = async (): Promise<boolean> => {
  try {
    const ac = new AbortController();
    const timerId = setTimeout(() => ac.abort(), 2000);
    const res = await fetch(`${OLLAMA_BASE}/`, { signal: ac.signal });
    clearTimeout(timerId);
    return res.ok;
  } catch {
    return false;
  }
};

export const ollamaChat = async (
  model: string,
  messages: OllamaMessage[],
  options?: OllamaChatOptions,
  signal?: AbortSignal,
  onToken?: (count: number) => void
): Promise<string> => {
  const CHAT_TIMEOUT_MS = 600_000; // 10 minutes — for large local models like Gemma4 12B
  const ac = new AbortController();
  const timerId = setTimeout(() => ac.abort(new DOMException("timeout", "AbortError")), CHAT_TIMEOUT_MS);
  if (signal) {
    signal.addEventListener("abort", () => ac.abort(signal.reason), { once: true });
  }

  try {
    const res = await fetch(`${OLLAMA_BASE}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages,
        stream: true,
        options: {
          temperature: options?.temperature ?? 0.1,
          num_predict: options?.num_predict ?? 2000,
          ...(options?.num_thread !== undefined && { num_thread: options.num_thread })
        }
      }),
      signal: ac.signal
    });

    if (!res.ok) {
      throw new Error(`Ollama がエラーを返しました (HTTP ${res.status})`);
    }

    if (!res.body) {
      throw new Error("Ollama のレスポンス body が空です");
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let content = "";
    let tokenCount = 0;
    let buffer = "";
    let streamDone = false;

    while (!streamDone) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        let chunk: OllamaStreamChunk;
        try {
          chunk = JSON.parse(trimmed) as OllamaStreamChunk;
        } catch {
          continue;
        }
        if (chunk.message?.content) {
          content += chunk.message.content;
          tokenCount++;
          onToken?.(tokenCount);
        }
        if (chunk.done) {
          streamDone = true;
          break;
        }
      }
    }

    return content;
  } finally {
    clearTimeout(timerId);
  }
};
