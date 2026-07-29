import { useState } from 'react'
import { apiUrl } from './api'

const INITIAL_FIELDS = {
  current_location:  '',
  pickup_location:   '',
  dropoff_location:  '',
  current_cycle_used:'',
}

function validate(fields) {
  const errors = {}
  if (!fields.current_location.trim())   errors.current_location   = 'Required'
  if (!fields.pickup_location.trim())    errors.pickup_location    = 'Required'
  if (!fields.dropoff_location.trim())   errors.dropoff_location   = 'Required'

  const cycle = parseFloat(fields.current_cycle_used)
  if (fields.current_cycle_used === '') {
    errors.current_cycle_used = 'Required'
  } else if (isNaN(cycle) || cycle < 0 || cycle > 70) {
    errors.current_cycle_used = 'Must be 0–70'
  }
  return errors
}

async function reverseGeocode(lat, lng) {
  const url =
    `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}` +
    `&format=json&accept-language=en`
  const res = await fetch(url, {
    headers: { 'User-Agent': 'routelog-planner/1.0 (local development)' },
  })
  if (!res.ok) throw new Error('Reverse geocode failed')
  const data = await res.json()
  return data.display_name ?? `${lat.toFixed(5)}, ${lng.toFixed(5)}`
}

function GeoIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3"/>
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>
    </svg>
  )
}

function ErrorMsg({ msg }) {
  if (!msg) return null
  return (
    <p className="field-error">
      <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" style={{ flexShrink: 0 }}>
        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
      </svg>
      {msg}
    </p>
  )
}

export default function TripForm({ onResult, onLoading }) {
  const [fields, setFields]         = useState(INITIAL_FIELDS)
  const [touched, setTouched]       = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [apiError, setApiError]     = useState(null)
  const [geoLoading, setGeoLoading] = useState(false)
  const [geoError, setGeoError]     = useState(null)

  const errors     = validate(fields)
  const showErrors = Object.fromEntries(
    Object.keys(errors).map((k) => [k, touched[k] && errors[k]])
  )

  function handleChange(e) {
    setFields((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  function handleBlur(e) {
    setTouched((prev) => ({ ...prev, [e.target.name]: true }))
  }

  function handleUseLiveLocation() {
    if (!navigator.geolocation) {
      setGeoError('Geolocation is not supported by your browser.')
      return
    }
    setGeoLoading(true)
    setGeoError(null)

    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const address = await reverseGeocode(coords.latitude, coords.longitude)
          setFields((prev) => ({ ...prev, current_location: address }))
          setTouched((prev) => ({ ...prev, current_location: true }))
        } catch {
          setFields((prev) => ({
            ...prev,
            current_location: `${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`,
          }))
        } finally {
          setGeoLoading(false)
        }
      },
      (err) => {
        setGeoLoading(false)
        if (err.code === err.PERMISSION_DENIED) {
          setGeoError('Location permission denied.')
        } else {
          setGeoError('Unable to determine your location.')
        }
      },
      { timeout: 10000 },
    )
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const allTouched = Object.fromEntries(Object.keys(INITIAL_FIELDS).map((k) => [k, true]))
    setTouched(allTouched)
    if (Object.keys(errors).length > 0) return

    setSubmitting(true)
    setApiError(null)
    onLoading?.(true)

    try {
      const res = await fetch(apiUrl('/api/trips/'), {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...fields,
          current_cycle_used: parseFloat(fields.current_cycle_used),
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setApiError(data.error ?? `Request failed (HTTP ${res.status})`)
        onLoading?.(false)
        return
      }

      onResult(data)
    } catch {
      setApiError('Could not reach the server. Is the Django backend running?')
      onLoading?.(false)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className="form-grid">
        {/* Current location — with live-location button */}
        <div className="form-group full-width">
          <label htmlFor="current_location">Current location</label>
          <div className="input-with-action">
            <input
              id="current_location"
              name="current_location"
              type="text"
              placeholder="e.g. DHA Phase 5, Lahore"
              value={fields.current_location}
              onChange={handleChange}
              onBlur={handleBlur}
              className={showErrors.current_location ? 'invalid' : ''}
              autoComplete="off"
            />
            <button
              type="button"
              className="btn-geo"
              onClick={handleUseLiveLocation}
              disabled={geoLoading}
              title="Use my current location"
              aria-label="Use my current location"
            >
              {geoLoading
                ? <span className="spinner spinner-sm" aria-hidden="true" />
                : <GeoIcon />}
            </button>
          </div>
          <ErrorMsg msg={showErrors.current_location || geoError} />
        </div>

        <div className="form-group">
          <label htmlFor="pickup_location">Pickup location</label>
          <input
            id="pickup_location"
            name="pickup_location"
            type="text"
            placeholder="e.g. Gulberg III, Lahore"
            value={fields.pickup_location}
            onChange={handleChange}
            onBlur={handleBlur}
            className={showErrors.pickup_location ? 'invalid' : ''}
            autoComplete="off"
          />
          <ErrorMsg msg={showErrors.pickup_location} />
        </div>

        <div className="form-group">
          <label htmlFor="dropoff_location">Dropoff location</label>
          <input
            id="dropoff_location"
            name="dropoff_location"
            type="text"
            placeholder="e.g. Saddar, Karachi"
            value={fields.dropoff_location}
            onChange={handleChange}
            onBlur={handleBlur}
            className={showErrors.dropoff_location ? 'invalid' : ''}
            autoComplete="off"
          />
          <ErrorMsg msg={showErrors.dropoff_location} />
        </div>

        <div className="form-group">
          <label htmlFor="current_cycle_used">
            Current cycle used
            <span style={{ fontWeight: 400, color: 'var(--text-3)', marginLeft: '0.25rem' }}>(hrs, 0–70)</span>
          </label>
          <input
            id="current_cycle_used"
            name="current_cycle_used"
            type="number"
            min="0"
            max="70"
            step="0.1"
            placeholder="e.g. 12.5"
            value={fields.current_cycle_used}
            onChange={handleChange}
            onBlur={handleBlur}
            className={showErrors.current_cycle_used ? 'invalid' : ''}
          />
          <ErrorMsg msg={showErrors.current_cycle_used} />
        </div>
      </div>

      <div className="form-actions">
        <button type="submit" className="btn-submit" disabled={submitting}>
          {submitting ? (
            <>
              <span className="spinner" aria-hidden="true" />
              Planning trip…
            </>
          ) : (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"/>
              </svg>
              Plan trip
            </>
          )}
        </button>
      </div>

      {apiError && (
        <div className="api-error" role="alert">
          <svg className="api-error-icon" width="18" height="18" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
          </svg>
          <p>{apiError}</p>
        </div>
      )}
    </form>
  )
}
