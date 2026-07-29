// In production (Vercel), set VITE_API_BASE=https://spotter-jipp.onrender.com
// In local dev, leave unset — Vite's proxy handles /api requests.
export const API_BASE = import.meta.env.VITE_API_BASE ?? ''

export function apiUrl(path) {
  return `${API_BASE}${path}`
}
