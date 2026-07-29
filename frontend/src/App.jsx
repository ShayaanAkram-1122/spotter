import { useState } from 'react'
import TripForm from './TripForm'
import TripResult from './TripResult'
import './App.css'

function Logo() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function TruckIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="1" y="3" width="15" height="13" rx="1"/>
      <path d="M16 8h4l3 5v3h-7V8z"/>
      <circle cx="5.5" cy="18.5" r="2.5"/>
      <circle cx="18.5" cy="18.5" r="2.5"/>
    </svg>
  )
}

export default function App() {
  const [result, setResult]   = useState(null)
  const [loading, setLoading] = useState(false)

  function handleResult(data) {
    setLoading(false)
    setResult(data)
  }

  function handleLoading(isLoading) {
    setLoading(isLoading)
    if (isLoading) setResult(null)
  }

  return (
    <div className="app">
      {/* ── Sticky top nav ── */}
      <nav className="top-nav" aria-label="Site navigation">
        <div className="top-nav-inner">
          <a href="/" className="nav-logo" aria-label="RouteLog home">
            <div className="nav-logo-icon" aria-hidden="true">
              <TruckIcon />
            </div>
            <div className="nav-logo-text">
              <strong>RouteLog</strong>
              <span>HOS Trip Planner</span>
            </div>
          </a>
          <span className="nav-badge">FMCSA 70/8</span>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="page-hero" aria-label="Page hero">
        <h1>Plan your trip.<br />Stay compliant.</h1>
        <p>Enter your trip details and get a complete FMCSA Hours-of-Service duty schedule with route map and daily log sheets in seconds.</p>
        <div className="hero-pills" aria-label="Key features">
          <span className="hero-pill">70-hr / 8-day cycle</span>
          <span className="hero-pill">11-hr driving limit</span>
          <span className="hero-pill">Fuel stops every 1,000 mi</span>
          <span className="hero-pill">34-hr restart</span>
        </div>
      </section>

      {/* ── Page body ── */}
      <main className="page-body">
        {/* Form card */}
        <div className="card">
          <div className="card-head">
            <p className="card-title">
              <span className="card-title-icon">
                <Logo />
              </span>
              Trip details
            </p>
          </div>
          <div className="card-body" style={{ paddingTop: 0 }}>
            <TripForm onResult={handleResult} onLoading={handleLoading} />
          </div>
        </div>

        {/* Loading state */}
        {loading && !result && (
          <div className="card">
            <div className="loading-card">
              <div className="spinner" style={{ width: '2rem', height: '2rem', borderWidth: '3px', borderColor: 'var(--border-2)', borderTopColor: 'var(--brand-mid)' }} />
              <p>Geocoding locations and computing route…</p>
            </div>
          </div>
        )}

        {/* Results */}
        {result && <TripResult result={result} />}
      </main>
    </div>
  )
}
