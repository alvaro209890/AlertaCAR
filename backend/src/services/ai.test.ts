import { describe, expect, it } from 'vitest'
import { parseDeepSeekSseEvent } from './ai.js'

describe('parseDeepSeekSseEvent', () => {
  it('extrai delta de um evento SSE OpenAI-compatível', () => {
    expect(parseDeepSeekSseEvent('event: message\ndata: {"choices":[{"delta":{"content":"Olá"}}]}')).toEqual({ type: 'delta', content: 'Olá' })
  })

  it('reconhece o marcador de fim', () => {
    expect(parseDeepSeekSseEvent('data: [DONE]')).toEqual({ type: 'done' })
  })

  it('ignora eventos sem conteúdo ou JSON inválido', () => {
    expect(parseDeepSeekSseEvent('data: {invalido}')).toEqual({ type: 'done' })
    expect(parseDeepSeekSseEvent('data: {"choices":[{"delta":{}}]}')).toEqual({ type: 'done' })
  })
})
