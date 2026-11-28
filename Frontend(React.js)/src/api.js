export const API = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api'

const getCache = new Map()
const inFlightGets = new Map()
const GET_CACHE_MS = 5000

export async function request(path, { token, body, method = 'GET' } = {}) {
  const verb = method.toUpperCase()
  const cacheKey = `${token || 'public'}:${path}`
  if (verb === 'GET') {
    const cached = getCache.get(cacheKey)
    if (cached && cached.expiresAt > Date.now()) return cached.data
    if (cached) getCache.delete(cacheKey)
    if (inFlightGets.has(cacheKey)) return inFlightGets.get(cacheKey)
  }

  const headers = { Accept: 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  if (body && !(body instanceof FormData)) headers['Content-Type'] = 'application/json'
  const promise = (async () => {
    const response = await fetch(`${API}${path}`, {
      method: verb,
      headers,
      body: body ? (body instanceof FormData ? body : JSON.stringify(body)) : undefined,
    })
    const data = await response.json().catch(() => ({}))
    if (response.status === 401 && token) window.dispatchEvent(new CustomEvent('auth:expired'))
    if (!response.ok) throw new Error(data.message || Object.values(data.errors || {}).flat()[0] || 'Có lỗi xảy ra, vui lòng thử lại.')
    if (verb === 'GET') getCache.set(cacheKey, { data, expiresAt: Date.now() + GET_CACHE_MS })
    else getCache.clear()
    return data
  })()

  if (verb !== 'GET') return promise
  inFlightGets.set(cacheKey, promise)
  try { return await promise } finally { inFlightGets.delete(cacheKey) }
}
