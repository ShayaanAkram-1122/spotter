import { useState } from 'react'

const INITIAL_FIELDS = {
  current_location: '',
  pickup_location: '',
  dropoff_location: '',
  current_cycle_used: '',
}

function validate(fields) {
  const errors = {}
  if (!fields.current_location.trim())  errors.current_location  = 'Required'
  if (!fields.pickup_location.trim())   errors.pickup_location   = 'Required'
  if (!fields.dropoff_location.trim())  errors.dropoff_location  = 'Required'

  const cycle = parseFloat(fields.current_cycle_used)
  if (fields.current_cycle_used === '') {
    errors.current_cycle_used = 'Required'
  } else if (isNaN(cycle) || cycle < 0 || cycle > 70) {
    errors.current_cycle_used = 'Must be a number between 0 and 70'
  }
  return errors
}

async function reverseGeocode(lat, lng) {
  const url =
    `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}` +
    `&format=json&accept-language=en`
  const res = await fetch(url, {
    headers: { 'User-Agent': 'snapper-planner/1.0 (local development)' },
  })
  if (!res.ok) throw new Error('Reverse geocode failed')
  const data = await res.json()
  // Use display_name but strip the very long country-code suffix
  return data.display_name ?? `${lat.toFixed(5)}, ${lng.toFixed(5)}`
}

function LocationIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
    </svg>
  )
}

export default function TripForm({ onResult }) {
  const [fields, setFields]       = useState(INITIAL_FIELDS)
  const [touched, setTouched]     = useState({})
  const [loading, setLoading]     = useState(false)
  const [apiError, setApiError]   = useState(null)
  const [geoLoading, setGeoLoading] = useState(false)
  const [geoError, setGeoError]   = useState(null)

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
          // Fall back to raw coordinates if reverse-geocode fails
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
          setGeoError('Location permission denied. Please allow access and try again.')
        } else {
          setGeoError('Unable to determine your location.')
        }
      },
      { timeout: 10000 },
    )
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setTouched({
      current_location: true,
      pickup_location: true,
      dropoff_location: true,
      current_cycle_used: true,
    })

    if (Object.keys(errors).length > 0) return

    setLoading(true)
    setApiError(null)
    onResult(null)

    try {
      const res = await fetch('/api/trips/', {
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
        return
      }

      onResult(data)
    } catch {
      setApiError('Could not reach the server. Is the Django backend running?')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className="form-grid">

        {/* Current location — has live-location button */}
        <div className="form-group">
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
                : <LocationIcon />}
            </button>
          </div>
          {showErrors.current_location && (
            <p className="field-error">{showErrors.current_location}</p>
          )}
          {geoError && <p className="field-error">{geoError}</p>}
        </div>

        {/* Pickup and dropoff — plain text inputs */}
        {[
          { name: 'pickup_location',  label: 'Pickup location',  placeholder: 'e.g. Gulberg, Lahore' },
          { name: 'dropoff_location', label: 'Dropoff location', placeholder: 'e.g. Saddar, Karachi' },
        ].map(({ name, label, placeholder }) => (
          <div className="form-group" key={name}>
            <label htmlFor={name}>{label}</label>
            <input
              id={name}
              name={name}
              type="text"
              placeholder={placeholder}
              value={fields[name]}
              onChange={handleChange}
              onBlur={handleBlur}
              className={showErrors[name] ? 'invalid' : ''}
              autoComplete="off"
            />
            {showErrors[name] && <p className="field-error">{showErrors[name]}</p>}
          </div>
        ))}

        <div className="form-group">
          <label htmlFor="current_cycle_used">Current cycle used (hrs)</label>
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
          {showErrors.current_cycle_used && (
            <p className="field-error">{showErrors.current_cycle_used}</p>
          )}
        </div>
      </div>

      <button type="submit" className="btn-submit" disabled={loading}>
        {loading ? (
          <>
            <span className="spinner" aria-hidden="true" />
            Planning trip…
          </>
        ) : (
          'Plan trip'
        )}
      </button>

      {apiError && (
        <div className="api-error" role="alert">
          <svg className="api-error-icon" width="18" height="18" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <p>{apiError}</p>
        </div>
      )}
    </form>
  )
}
