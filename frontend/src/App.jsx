import { useEffect, useState } from 'react'
import './App.css'

function App() {
  const [status, setStatus] = useState('loading…')
  const [error, setError] = useState(null)

  useEffect(() => {
    fetch('/api/health/')
      .then((res) => {
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`)
        }
        return res.json()
      })
      .then((data) => setStatus(data.status))
      .catch((err) => {
        setError(err.message)
        setStatus('unavailable')
      })
  }, [])

  return (
    <main className="app">
      <h1>Snapper</h1>
      <p>
        Backend health:{' '}
        <span className={error ? 'status error' : 'status ok'}>{status}</span>
      </p>
      {error && <p className="hint">Could not reach API ({error}). Is the Django server running?</p>}
    </main>
  )
}

export default App
