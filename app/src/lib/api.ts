export const API = import.meta.env.VITE_API_URL || '/api'

export async function apiFetch(endpoint: string, options: RequestInit = {}) {
  const token = localStorage.getItem('alertacar_token')
  const res = await fetch(`${API}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })
  return res.json()
}

/** Baixa um arquivo binário (PDF/ZIP/GPKG/…) autenticado e dispara o download no navegador. */
export async function apiDownload(endpoint: string, suggestedFilename?: string): Promise<{ error?: string }> {
  const token = localStorage.getItem('alertacar_token')
  const res = await fetch(`${API}${endpoint}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!res.ok) {
    const contentType = res.headers.get('content-type') || ''
    if (contentType.includes('application/json')) return await res.json()
    return { error: `Erro ao baixar (HTTP ${res.status})` }
  }
  const blob = await res.blob()
  const disposition = res.headers.get('content-disposition') || ''
  const match = disposition.match(/filename="?([^"]+)"?/)
  const filename = match?.[1] || suggestedFilename || 'download'
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
  return {}
}

export async function apiStream(
  endpoint: string,
  options: RequestInit,
  onEvent: (event: Record<string, unknown>) => void,
): Promise<Record<string, unknown>> {
  const token = localStorage.getItem('alertacar_token')
  const res = await fetch(`${API}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })
  if (!res.ok || !res.body) return await res.json()

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let done: Record<string, unknown> = {}
  while (true) {
    const { value, done: readerDone } = await reader.read()
    if (readerDone) break
    buffer += decoder.decode(value, { stream: true })
    const blocks = buffer.split(/\r?\n\r?\n/)
    buffer = blocks.pop() || ''
    for (const block of blocks) {
      const data = block.split(/\r?\n/).find((line) => line.startsWith('data:'))?.slice(5).trim()
      if (!data) continue
      try {
        const event = JSON.parse(data) as Record<string, unknown>
        onEvent(event)
        if (event.type === 'done' || event.type === 'error') done = event
      } catch { /* Ignore malformed transient SSE fragments. */ }
    }
  }
  return done
}
