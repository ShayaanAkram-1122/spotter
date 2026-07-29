import TripMap from './TripMap'
import DailyLogSheet from './DailyLogSheet'

const STATUS_META = {
  driving:             { label: 'Driving',              cls: 'badge-driving'      },
  on_duty_not_driving: { label: 'On duty (not driving)', cls: 'badge-on_duty'      },
  off_duty:            { label: 'Off duty',              cls: 'badge-off_duty'     },
  sleeper_berth:       { label: 'Sleeper berth',         cls: 'badge-sleeper_berth'},
}

function fmtHour(h) {
  const hh   = Math.floor(h) % 24
  const mm   = Math.round((h % 1) * 60)
  const ampm = hh < 12 ? 'AM' : 'PM'
  const hr   = hh % 12 === 0 ? 12 : hh % 12
  return `${hr}:${String(mm).padStart(2, '0')} ${ampm}`
}

function fmtDuration(h) {
  if (h <= 0) return '—'
  const hours = Math.floor(h)
  const mins  = Math.round((h - hours) * 60)
  if (hours === 0) return `${mins}m`
  if (mins  === 0) return `${hours}h`
  return `${hours}h ${mins}m`
}

function StatusBadge({ status }) {
  const meta = STATUS_META[status] ?? { label: status, cls: 'badge-off_duty' }
  return <span className={`badge ${meta.cls}`}>{meta.label}</span>
}

function SectionIcon({ children }) {
  return <span className="card-title-icon">{children}</span>
}

function DayBlock({ day }) {
  const nonZeroTotals = Object.entries(day.totals).filter(([, v]) => v > 0)

  return (
    <div className="day-block">
      <p className="day-label">Segment detail</p>
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
              <td style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--text-3)' }}>{fmtHour(seg.start_hour)}</td>
              <td style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--text-3)' }}>{fmtHour(seg.end_hour)}</td>
              <td style={{ fontWeight: 600 }}>{fmtDuration(seg.end_hour - seg.start_hour)}</td>
              <td><StatusBadge status={seg.status} /></td>
              <td style={{ color: 'var(--text-4)', fontSize: '0.825rem' }}>{seg.label ?? '—'}</td>
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
      {/* ── Route summary ── */}
      <div className="card">
        <div className="card-head">
          <p className="card-title">
            <SectionIcon>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
              </svg>
            </SectionIcon>
            Route summary
          </p>
        </div>
        <div className="card-body" style={{ paddingTop: 0 }}>
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
              <p className="stat-value">{fmtDuration(result.total_driving_hours)}</p>
            </div>
            <div className="stat-box">
              <p className="stat-label">Total on-duty</p>
              <p className="stat-value">{fmtDuration(totalOnDuty)}</p>
            </div>
            <div className="stat-box">
              <p className="stat-label">Days required</p>
              <p className="stat-value">{result.duty_schedule.length}</p>
            </div>
          </div>

          <div className="coords-grid">
            {[
              { key: 'current_location', label: 'Current' },
              { key: 'pickup_location',  label: 'Pickup'  },
              { key: 'dropoff_location', label: 'Dropoff' },
            ].map(({ key, label }) => {
              const coord = result.coordinates[key]
              return (
                <div key={key} className="stat-box">
                  <p className="stat-label">{label}</p>
                  <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-2)', fontVariantNumeric: 'tabular-nums' }}>
                    {coord.lat.toFixed(4)}, {coord.lng.toFixed(4)}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── Route map ── */}
      <div className="card map-card">
        <div className="map-card-head">
          <SectionIcon>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"/>
            </svg>
          </SectionIcon>
          Route map
        </div>
        <TripMap result={result} />
      </div>

      {/* ── Duty schedule ── */}
      <div className="card">
        <div className="card-head">
          <p className="card-title">
            <SectionIcon>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
            </SectionIcon>
            Duty schedule — {result.duty_schedule.length} day{result.duty_schedule.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="card-body" style={{ paddingTop: 0 }}>
          {result.duty_schedule.map((day) => (
            <div key={day.day_index} className="day-log-block">
              <DailyLogSheet day={day} />
              <DayBlock day={day} />
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
