import TripMap from './TripMap'

const STATUS_META = {
  driving:            { label: 'Driving',             cls: 'badge-driving'       },
  on_duty_not_driving:{ label: 'On duty (not driving)',cls: 'badge-on_duty'       },
  off_duty:           { label: 'Off duty',             cls: 'badge-off_duty'      },
  sleeper_berth:      { label: 'Sleeper berth',        cls: 'badge-sleeper_berth' },
}

function fmtHour(h) {
  const hh   = Math.floor(h) % 24
  const mm   = Math.round((h % 1) * 60)
  const ampm = hh < 12 ? 'AM' : 'PM'
  const hr   = hh % 12 === 0 ? 12 : hh % 12
  return `${hr}:${String(mm).padStart(2, '0')} ${ampm}`
}

function fmtDuration(h) {
  const hours = Math.floor(h)
  const mins  = Math.round((h - hours) * 60)
  if (hours === 0)   return `${mins}m`
  if (mins  === 0)   return `${hours}h`
  return `${hours}h ${mins}m`
}

function StatusBadge({ status }) {
  const meta = STATUS_META[status] ?? { label: status, cls: 'badge-off_duty' }
  return <span className={`badge ${meta.cls}`}>{meta.label}</span>
}

function DayBlock({ day }) {
  const nonZeroTotals = Object.entries(day.totals).filter(([, v]) => v > 0)

  return (
    <div className="day-block">
      <p className="day-label">Day {day.day_index + 1}</p>

      <table className="segments-table">
        <thead>
          <tr>
            <th>Start</th>
            <th>End</th>
            <th>Duration</th>
            <th>Status</th>
            <th>Note</th>
          </tr>
        </thead>
        <tbody>
          {day.segments.map((seg, i) => (
            <tr key={i}>
              <td>{fmtHour(seg.start_hour)}</td>
              <td>{fmtHour(seg.end_hour)}</td>
              <td>{fmtDuration(seg.end_hour - seg.start_hour)}</td>
              <td><StatusBadge status={seg.status} /></td>
              <td style={{ color: '#9ca3af' }}>{seg.label ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="day-totals">
        {nonZeroTotals.map(([status, hours]) => (
          <span key={status} className="total-chip">
            {STATUS_META[status]?.label ?? status}: {fmtDuration(hours)}
          </span>
        ))}
      </div>
    </div>
  )
}

export default function TripResult({ result }) {
  const totalOnDuty = result.duty_schedule.reduce(
    (acc, day) => acc + day.totals.driving + day.totals.on_duty_not_driving,
    0,
  )

  return (
    <>
      <div className="card">
        <p className="card-title">
          <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
          </svg>
          Route summary
        </p>

        <div className="result-meta">
          <div className="stat-box">
            <p className="stat-label">Distance</p>
            <p className="stat-value">
              {result.total_distance_miles.toLocaleString(undefined, { maximumFractionDigits: 1 })}
              <span className="stat-unit">mi</span>
            </p>
          </div>
          <div className="stat-box">
            <p className="stat-label">Drive time</p>
            <p className="stat-value">
              {fmtDuration(result.total_driving_hours)}
            </p>
          </div>
          <div className="stat-box">
            <p className="stat-label">Total on-duty</p>
            <p className="stat-value">
              {fmtDuration(totalOnDuty)}
            </p>
          </div>
          <div className="stat-box">
            <p className="stat-label">Days required</p>
            <p className="stat-value">
              {result.duty_schedule.length}
            </p>
          </div>
        </div>

        <div className="coords-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
          {['current_location', 'pickup_location', 'dropoff_location'].map((key) => {
            const coord = result.coordinates[key]
            const labels = { current_location: 'Current', pickup_location: 'Pickup', dropoff_location: 'Dropoff' }
            return (
              <div key={key} className="stat-box" style={{ padding: '0.625rem 0.75rem' }}>
                <p className="stat-label">{labels[key]}</p>
                <p style={{ margin: 0, fontSize: '0.78rem', color: '#374151', fontVariantNumeric: 'tabular-nums' }}>
                  {coord.lat.toFixed(4)}, {coord.lng.toFixed(4)}
                </p>
              </div>
            )
          })}
        </div>
      </div>

      <div className="card map-card">
        <p className="card-title">
          <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path fillRule="evenodd" d="M12 1.586l-4 4V14h8V5.586l-4-4zM2 6a2 2 0 012-2h1V3a1 1 0 112 0v1h6V3a1 1 0 112 0v1h1a2 2 0 012 2v9a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" />
          </svg>
          Route map
        </p>
        <TripMap result={result} />
      </div>

      <div className="card">
        <p className="card-title">
          <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
          </svg>
          Duty schedule
        </p>

        {result.duty_schedule.map((day) => (
          <DayBlock key={day.day_index} day={day} />
        ))}
      </div>
    </>
  )
}
