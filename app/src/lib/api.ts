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
