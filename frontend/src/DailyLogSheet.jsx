// ── Layout constants ──────────────────────────────────────────────────────────
const ROW_LABELS = [
  { status: 'off_duty',            label: '1. Off Duty'           },
  { status: 'sleeper_berth',       label: '2. Sleeper Berth'      },
  { status: 'driving',             label: '3. Driving'            },
  { status: 'on_duty_not_driving', label: '4. On Duty\nNot Driving' },
]

const STATUS_ROW_INDEX = Object.fromEntries(ROW_LABELS.map(({ status }, i) => [status, i]))

const STATUS_COLOR = {
  off_duty:            '#16a34a',
  sleeper_berth:       '#7c3aed',
  driving:             '#2563eb',
  on_duty_not_driving: '#d97706',
}

// SVG viewport
const SVG_W         = 900
const SVG_H         = 280

// Left gutter: row labels
const LEFT_W        = 120
// Right gutter: totals column
const RIGHT_W       = 70
// Top/bottom margins inside the grid area
const TOP_M         = 36   // space for hour labels
const BOT_M         = 8

const GRID_W        = SVG_W - LEFT_W - RIGHT_W
const GRID_H        = SVG_H - TOP_M - BOT_M
const ROW_H         = GRID_H / ROW_LABELS.length

// ── Coordinate helpers ────────────────────────────────────────────────────────
// hour  (0–24) → x pixel inside the grid area
function hourToX(hour) {
  return LEFT_W + (hour / 24) * GRID_W
}

// status key → y pixel at the centre of that row
function statusToY(status) {
  const idx = STATUS_ROW_INDEX[status] ?? 0
  return TOP_M + idx * ROW_H + ROW_H / 2
}

// status key → y pixel at the top edge of that row (for shading)
function statusToRowTop(status) {
  const idx = STATUS_ROW_INDEX[status] ?? 0
  return TOP_M + idx * ROW_H
}

// ── Stepped polyline path from segments ──────────────────────────────────────
// Each transition: move horizontally along current row → drop vertically to
// next row at the transition hour. This is exactly how real paper logs look.
function buildPath(segments) {
  if (!segments.length) return ''

  const pts = []

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]
    const x1  = hourToX(seg.start_hour)
    const x2  = hourToX(seg.end_hour)
    const y   = statusToY(seg.status)

    if (i === 0) pts.push(`M ${x1} ${y}`)

    // Horizontal line for this segment
    pts.push(`L ${x2} ${y}`)

    // Vertical drop to next segment's row (if there is a next segment)
    if (i + 1 < segments.length) {
      const nextY = statusToY(segments[i + 1].status)
      if (nextY !== y) pts.push(`L ${x2} ${nextY}`)
    }
  }

  return pts.join(' ')
}

// ── Transition label positions ────────────────────────────────────────────────
// Returns label text + x/y for segments that carry a label, placed just above
// the row centre at the segment's start so they don't collide with the line.
function buildLabelPoints(segments) {
  return segments
    .filter((seg) => seg.label && seg.label !== 'Driving')
    .map((seg) => ({
      x:     hourToX(seg.start_hour),
      y:     statusToRowTop(seg.status) + 4,
      label: seg.label,
      color: STATUS_COLOR[seg.status] ?? '#374151',
    }))
}

// ── Hour axis labels ──────────────────────────────────────────────────────────
const HOUR_LABELS = Array.from({ length: 25 }, (_, h) => {
  if (h === 0 || h === 24) return { h, text: 'M' }
  if (h === 12)            return { h, text: 'N' }
  return { h, text: String(h) }
})

// ── Duration formatter (same as TripResult) ───────────────────────────────────
function fmtDur(h) {
  if (h <= 0) return '—'
  const hrs  = Math.floor(h)
  const mins = Math.round((h - hrs) * 60)
  if (hrs === 0)  return `${mins}m`
  if (mins === 0) return `${hrs}h`
  return `${hrs}h ${mins}m`
}

// ── Sub-components ────────────────────────────────────────────────────────────

function GridBackground() {
  const rows = ROW_LABELS.map((_, i) => {
    const y    = TOP_M + i * ROW_H
    const fill = i % 2 === 0 ? '#f9fafb' : '#ffffff'
    return <rect key={i} x={LEFT_W} y={y} width={GRID_W} height={ROW_H} fill={fill} />
  })

  const vLines = HOUR_LABELS.map(({ h }) => {
    const x      = hourToX(h)
    const isMajor = h % 6 === 0
    return (
      <line
        key={h}
        x1={x} y1={TOP_M}
        x2={x} y2={TOP_M + GRID_H}
        stroke={isMajor ? '#9ca3af' : '#e5e7eb'}
        strokeWidth={isMajor ? 1 : 0.5}
      />
    )
  })

  // Half-hour minor ticks
  const halfLines = Array.from({ length: 24 }, (_, h) => {
    const x = hourToX(h + 0.5)
    return (
      <line
        key={`h${h}`}
        x1={x} y1={TOP_M}
        x2={x} y2={TOP_M + GRID_H}
        stroke="#f3f4f6"
        strokeWidth={0.5}
      />
    )
  })

  const hLines = ROW_LABELS.map((_, i) => {
    const y = TOP_M + i * ROW_H
    return (
      <line
        key={i}
        x1={LEFT_W} y1={y}
        x2={LEFT_W + GRID_W} y2={y}
        stroke="#d1d5db"
        strokeWidth={0.75}
      />
    )
  })
  // bottom border
  const bottomLine = (
    <line
      x1={LEFT_W} y1={TOP_M + GRID_H}
      x2={LEFT_W + GRID_W} y2={TOP_M + GRID_H}
      stroke="#d1d5db" strokeWidth={0.75}
    />
  )

  return <>{rows}{halfLines}{vLines}{hLines}{bottomLine}</>
}

function HourAxis() {
  return (
    <>
      {HOUR_LABELS.map(({ h, text }) => (
        <text
          key={h}
          x={hourToX(h)}
          y={TOP_M - 6}
          textAnchor="middle"
          fontSize={9}
          fill="#6b7280"
          fontFamily="system-ui, sans-serif"
        >
          {text}
        </text>
      ))}
    </>
  )
}

function RowLabels({ totals }) {
  return (
    <>
      {ROW_LABELS.map(({ status, label }, i) => {
        const y        = TOP_M + i * ROW_H
        const lines    = label.split('\n')
        const centerY  = y + ROW_H / 2
        const color    = STATUS_COLOR[status]

        return (
          <g key={status}>
            {/* Colour stripe on the far left */}
            <rect x={0} y={y} width={6} height={ROW_H} fill={color} />
            {/* Row label text */}
            {lines.map((line, li) => (
              <text
                key={li}
                x={12}
                y={centerY + (li - (lines.length - 1) / 2) * 12}
                dominantBaseline="middle"
                fontSize={9.5}
                fontWeight="500"
                fill="#374151"
                fontFamily="system-ui, sans-serif"
              >
                {line}
              </text>
            ))}
            {/* Totals on the right */}
            <text
              x={SVG_W - RIGHT_W / 2}
              y={centerY}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={9.5}
              fontWeight="600"
              fill={totals[status] > 0 ? color : '#9ca3af'}
              fontFamily="system-ui, sans-serif"
            >
              {fmtDur(totals[status] ?? 0)}
            </text>
          </g>
        )
      })}
      {/* Totals column header */}
      <text
        x={SVG_W - RIGHT_W / 2}
        y={TOP_M - 6}
        textAnchor="middle"
        fontSize={8}
        fill="#9ca3af"
        fontFamily="system-ui, sans-serif"
      >
        TOTAL
      </text>
    </>
  )
}

function StatusLine({ segments }) {
  const d = buildPath(segments)
  if (!d) return null

  // Determine overall status colour — use the driving colour if any driving,
  // else the first segment's colour, for the stroke.
  const hasDriving = segments.some((s) => s.status === 'driving')
  const lineColor  = hasDriving ? STATUS_COLOR.driving : (STATUS_COLOR[segments[0]?.status] ?? '#2563eb')

  return (
    <path
      d={d}
      fill="none"
      stroke={lineColor}
      strokeWidth={2.5}
      strokeLinejoin="round"
      strokeLinecap="round"
    />
  )
}

function TransitionDots({ segments }) {
  const dots = []
  for (let i = 1; i < segments.length; i++) {
    const prev = segments[i - 1]
    const cur  = segments[i]
    if (prev.status !== cur.status) {
      dots.push(
        <circle
          key={i}
          cx={hourToX(cur.start_hour)}
          cy={statusToY(cur.status)}
          r={3}
          fill={STATUS_COLOR[cur.status] ?? '#374151'}
          stroke="#fff"
          strokeWidth={1}
        />
      )
    }
  }
  return <>{dots}</>
}

function SegmentLabels({ segments }) {
  const points = buildLabelPoints(segments)
  return (
    <>
      {points.map((pt, i) => (
        <g key={i}>
          <line
            x1={pt.x} y1={pt.y + 2}
            x2={pt.x} y2={pt.y + 10}
            stroke={pt.color}
            strokeWidth={1}
            strokeDasharray="2 1"
          />
          <text
            x={pt.x + 3}
            y={pt.y + 2}
            fontSize={8}
            fill={pt.color}
            fontFamily="system-ui, sans-serif"
            fontWeight="600"
          >
            {pt.label}
          </text>
        </g>
      ))}
    </>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function DailyLogSheet({ day }) {
  return (
    <div className="log-sheet-wrap">
      <div className="log-sheet-header">
        <span className="log-day-badge">Day {day.day_index + 1}</span>
      </div>
      <div className="log-sheet-svg-scroll">
        <svg
          viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          width="100%"
          style={{ display: 'block', minWidth: 520 }}
          aria-label={`Daily log sheet for day ${day.day_index + 1}`}
        >
          <GridBackground />
          <HourAxis />
          <RowLabels totals={day.totals} />
          <StatusLine segments={day.segments} />
          <TransitionDots segments={day.segments} />
          <SegmentLabels segments={day.segments} />

          {/* Outer border */}
          <rect
            x={LEFT_W} y={TOP_M}
            width={GRID_W} height={GRID_H}
            fill="none"
            stroke="#9ca3af"
            strokeWidth={1}
          />
        </svg>
      </div>
    </div>
  )
}
