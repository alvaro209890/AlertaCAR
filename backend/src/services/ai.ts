import config from '../lib/config.js'

export type AiMessage = { role: 'system' | 'user' | 'assistant'; content: string }

export type AiCompletion = {
  content: string
  tokensIn: number | null
  tokensOut: number | null
}

export class AiUnavailableError extends Error {}

const RETRYABLE_STATUS = new Set([408, 409, 429, 500, 502, 503, 504])

export function isAiConfigured(): boolean {
  return Boolean(config.ai.apiKey)
}

/** OpenAI-compatible DeepSeek client. It deliberately does not log prompts or credentials. */
export async function completeAi(messages: AiMessage[], maxTokens = 700): Promise<AiCompletion> {
  if (!isAiConfigured()) {
    throw new AiUnavailableError('IA não configurada. Defina DEEPSEEK_API_KEY no ambiente do backend.')
  }

  let lastError: Error | undefined
  for (let attempt = 0; attempt <= config.ai.maxRetries; attempt++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), config.ai.timeoutMs)
    try {
      const response = await fetch(`${config.ai.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.ai.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: config.ai.model,
          messages,
          temperature: 0.2,
          max_tokens: maxTokens,
        }),
        signal: controller.signal,
      })

      if (!response.ok) {
        const detail = (await response.text()).slice(0, 500)
        const error = new AiUnavailableError(`DeepSeek respondeu ${response.status}: ${detail || 'erro sem detalhe'}`)
        if (!RETRYABLE_STATUS.has(response.status) || attempt === config.ai.maxRetries) throw error
        lastError = error
      } else {
        const data = await response.json() as any
        const content = data?.choices?.[0]?.message?.content
        if (typeof content !== 'string' || !content.trim()) {
          throw new AiUnavailableError('DeepSeek retornou uma resposta vazia ou inválida.')
        }
        return {
          content: content.trim(),
          tokensIn: Number.isFinite(data?.usage?.prompt_tokens) ? data.usage.prompt_tokens : null,
          tokensOut: Number.isFinite(data?.usage?.completion_tokens) ? data.usage.completion_tokens : null,
        }
      }
    } catch (error: any) {
      if (error instanceof AiUnavailableError && attempt === config.ai.maxRetries) throw error
      if (error?.name === 'AbortError') lastError = new AiUnavailableError('DeepSeek excedeu o tempo limite.')
      else if (!(error instanceof AiUnavailableError)) lastError = new AiUnavailableError('Não foi possível conectar ao DeepSeek.')
      if (attempt === config.ai.maxRetries) throw lastError
    } finally {
      clearTimeout(timer)
    }
    await new Promise((resolve) => setTimeout(resolve, 300 * (attempt + 1)))
  }
  throw lastError || new AiUnavailableError('Falha ao chamar a IA.')
}
