const API = import.meta.env.VITE_API_URL || 'http://localhost:4000/api'

const getToken = () => localStorage.getItem('token')

const request = async (method, path, body, params) => {
  const url = new URL(`${API}${path}`)
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v)
    })
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 15_000)

  const headers = { Authorization: `Bearer ${getToken()}` }
  if (body) headers['Content-Type'] = 'application/json'

  try {
    const res = await fetch(url.toString(), {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    })

    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error || `Server error (${res.status})`)
    return data
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('Request timed out. Please try again.')
    throw err
  } finally {
    clearTimeout(timer)
  }
}

const api = {
  get: (path, params) => request('GET', path, null, params),
  post: (path, body) => request('POST', path, body),
  put: (path, body) => request('PUT', path, body),
  delete: (path) => request('DELETE', path),
}

export default api
