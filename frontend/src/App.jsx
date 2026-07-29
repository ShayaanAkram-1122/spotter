import { useState } from 'react'
import TripForm from './TripForm'
import TripResult from './TripResult'
import './App.css'

export default function App() {
  const [result, setResult] = useState(null)

  return (
    <div className="app">
      <header className="app-header">
        <h1>Snapper</h1>
        <p>Enter trip details to generate a compliant HOS duty schedule.</p>
      </header>

      <div className="card">
        <p className="card-title">
          <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path d="M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
            <path d="M3 4a1 1 0 00-1 1v10a1 1 0 001 1h1.05a2.5 2.5 0 014.9 0H10a1 1 0 001-1v-1h3.05a2.5 2.5 0 014.9 0H19a1 1 0 001-1v-3a1 1 0 00-.293-.707l-3-3A1 1 0 0016 6h-1V5a1 1 0 00-1-1H3z" />
          </svg>
          Trip details
        </p>
        <TripForm onResult={setResult} />
      </div>

      {result && <TripResult result={result} />}
    </div>
  )
}
