import { useEffect, useRef } from 'react'
import { MapContainer, TileLayer, GeoJSON, Marker, Tooltip, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// ── SVG icon factory ─────────────────────────────────────────────────────────
// Avoids the broken default-icon PNG resolution that plagues Leaflet + Vite.
function makeSvgIcon({ bg, border, symbol, size = 30 }) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 30 30">
      <circle cx="15" cy="15" r="13" fill="${bg}" stroke="${border}" stroke-width="2"/>
      <text x="15" y="19" text-anchor="middle" font-size="13" font-family="system-ui,sans-serif">${symbol}</text>
    </svg>`
  return L.divIcon({
    html: svg,
    className: '',
    iconSize:   [size, size],
    iconAnchor: [size / 2, size / 2],
    tooltipAnchor: [size / 2, 0],
  })
}

const ICONS = {
  current:  makeSvgIcon({ bg: '#2563eb', border: '#1d4ed8', symbol: '📍' }),
  pickup:   makeSvgIcon({ bg: '#16a34a', border: '#15803d', symbol: '⬆️' }),
  dropoff:  makeSvgIcon({ bg: '#dc2626', border: '#b91c1c', symbol: '⬇️' }),
  fuel:     makeSvgIcon({ bg: '#f59e0b', border: '#d97706', symbol: '⛽', size: 26 }),
  break:    makeSvgIcon({ bg: '#8b5cf6', border: '#7c3aed', symbol: '☕', size: 26 }),
  stop:     makeSvgIcon({ bg: '#6b7280', border: '#4b5563', symbol: '🛑', size: 26 }),
}

// ── Auto-fit bounds to route ──────────────────────────────────────────────────
function FitBounds({ coordinates }) {
  const map = useMap()
  const fitted = useRef(false)

  useEffect(() => {
    if (fitted.current || !coordinates?.length) return
    // GeoJSON coords are [lng, lat]; Leaflet wants [lat, lng]
    const latLngs = coordinates.map(([lng, lat]) => [lat, lng])
    map.fitBounds(L.latLngBounds(latLngs), { padding: [40, 40] })
    fitted.current = true
  }, [map, coordinates])

  return null
}

// ── Derive stop markers from the duty schedule ────────────────────────────────
//
// The HOS engine doesn't embed lat/lng in segments — it operates purely on
// time. We know the route geometry and the fraction of total distance driven
// at any given point, so we can project each stop onto the polyline by the
// fraction of driving time that has elapsed before it.
//
function buildStopMarkers(dutySchedule, routeCoords, totalDrivingHours) {
  if (!routeCoords?.length || totalDrivingHours <= 0) return []

  // Build cumulative distance array for the route polyline.
  const cumDist = [0]
  for (let i = 1; i < routeCoords.length; i++) {
    const [lng1, lat1] = routeCoords[i - 1]
    const [lng2, lat2] = routeCoords[i]
    const d = Math.hypot(lat2 - lat1, lng2 - lng1)
    cumDist.push(cumDist[i - 1] + d)
  }
  const totalDist = cumDist[cumDist.length - 1]

  function interpolateAtFraction(frac) {
    const target = frac * totalDist
    for (let i = 1; i < cumDist.length; i++) {
      if (cumDist[i] >= target) {
        const segFrac = (target - cumDist[i - 1]) / (cumDist[i] - cumDist[i - 1]) || 0
        const [lng1, lat1] = routeCoords[i - 1]
        const [lng2, lat2] = routeCoords[i]
        return [lat1 + segFrac * (lat2 - lat1), lng1 + segFrac * (lng2 - lng1)]
      }
    }
    const last = routeCoords[routeCoords.length - 1]
    return [last[1], last[0]]
  }

  const stops = []
  let drivingAccum = 0

  for (const day of dutySchedule) {
    for (const seg of day.segments) {
      if (seg.status === 'on_duty_not_driving' && seg.label) {
        const frac = Math.min(drivingAccum / totalDrivingHours, 1)
        const latLng = interpolateAtFraction(frac)

        let icon = ICONS.stop
        const lower = seg.label.toLowerCase()
        if (lower.includes('fuel'))    icon = ICONS.fuel
        else if (lower.includes('break')) icon = ICONS.break
        // Pickup / Dropoff are shown as primary markers; skip them here.
        else if (lower === 'pickup' || lower === 'dropoff') continue

        stops.push({ latLng, label: seg.label, icon })
      } else if (seg.status === 'driving') {
        drivingAccum += seg.end_hour - seg.start_hour
      }
    }
  }

  return stops
}

// ── GeoJSON polyline style ────────────────────────────────────────────────────
const routeStyle = { color: '#2563eb', weight: 4, opacity: 0.85 }

// ── Main component ────────────────────────────────────────────────────────────
export default function TripMap({ result }) {
  const { coordinates, route_geometry, duty_schedule, total_driving_hours } = result
  const routeCoords = route_geometry?.coordinates ?? []

  const primaryMarkers = [
    { key: 'current',  coord: coordinates.current_location,  label: 'Current location', icon: ICONS.current },
    { key: 'pickup',   coord: coordinates.pickup_location,    label: 'Pickup',           icon: ICONS.pickup  },
    { key: 'dropoff',  coord: coordinates.dropoff_location,   label: 'Dropoff',          icon: ICONS.dropoff },
  ]

  const stopMarkers = buildStopMarkers(duty_schedule, routeCoords, total_driving_hours)

  // Use the first coord as an initial center; FitBounds will override it.
  const firstCoord = routeCoords[0] ?? [0, 0]
  const center = [firstCoord[1], firstCoord[0]]

  return (
    <MapContainer
      center={center}
      zoom={5}
      style={{ height: '420px', width: '100%', borderRadius: '10px' }}
      // suppress the default attribution so we can keep the tile attribution
      attributionControl={true}
    >
      {/* Carto Voyager — English labels worldwide, free, no API key */}
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        subdomains="abcd"
        maxZoom={20}
      />

      {routeCoords.length > 0 && (
        <>
          <GeoJSON data={route_geometry} style={routeStyle} />
          <FitBounds coordinates={routeCoords} />
        </>
      )}

      {primaryMarkers.map(({ key, coord, label, icon }) => (
        <Marker key={key} position={[coord.lat, coord.lng]} icon={icon}>
          <Tooltip permanent={false} direction="top" offset={[0, -8]}>
            <strong>{label}</strong>
            <br />
            {coord.lat.toFixed(4)}, {coord.lng.toFixed(4)}
          </Tooltip>
        </Marker>
      ))}

      {stopMarkers.map((stop, i) => (
        <Marker key={`stop-${i}`} position={stop.latLng} icon={stop.icon}>
          <Tooltip direction="top" offset={[0, -8]}>
            <strong>{stop.label}</strong>
          </Tooltip>
        </Marker>
      ))}
    </MapContainer>
  )
}
