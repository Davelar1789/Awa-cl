import { useMemo } from 'react'
import { MapContainer, TileLayer, Marker, Circle, Popup, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import s from './MapWorkspace.module.css'

const ACCRA_CENTER = [5.6037, -0.187]

const DRIVER_COLORS = ['#FDB913', '#2563EB', '#16A34A', '#DC2626', '#7C3AED', '#0891B2', '#DB2777', '#65A30D']

function colorForDriver(driverId) {
  if (!driverId) return '#6B7280'
  let hash = 0
  for (let i = 0; i < driverId.length; i++) hash = (hash * 31 + driverId.charCodeAt(i)) >>> 0
  return DRIVER_COLORS[hash % DRIVER_COLORS.length]
}

function pinIcon(color) {
  return L.divIcon({
    className: '',
    html: `<div style="background:${color}" class="${s.pin}"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 15],
  })
}

function ClickCapture({ onMapClick }) {
  useMapEvents({
    click(e) {
      onMapClick?.(e.latlng.lat, e.latlng.lng)
    },
  })
  return null
}

export default function MapWorkspace({ students = [], driverFilter = 'all', onStudentClick, onMapClick, mini = false }) {
  const visible = useMemo(
    () => students.filter((s) => s.homeLatitude != null && s.homeLongitude != null),
    [students]
  )

  const center = visible.length
    ? [visible[0].homeLatitude, visible[0].homeLongitude]
    : ACCRA_CENTER

  return (
    <div className={s.wrap}>
      <MapContainer
        center={center}
        zoom={visible.length ? 14 : 12}
        scrollWheelZoom
        className={`${s.map} ${mini ? s.mapMini : ''}`}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {onMapClick && <ClickCapture onMapClick={onMapClick} />}

        {visible.map((student) => {
          const driverId = student.driverUserId?._id ?? student.driverUserId
          const color = driverFilter !== 'all' && driverFilter !== driverId ? '#C7CDD4' : colorForDriver(driverId)
          return (
            <div key={student._id}>
              <Circle
                center={[student.homeLatitude, student.homeLongitude]}
                radius={student.geofenceRadius ?? 500}
                pathOptions={{ color, fillColor: color, fillOpacity: 0.08, weight: 1.5 }}
              />
              <Marker
                position={[student.homeLatitude, student.homeLongitude]}
                icon={pinIcon(color)}
                eventHandlers={{ click: () => onStudentClick?.(student) }}
              >
                <Popup>
                  <div className={s.popup}>
                    <div className={s.popupTitle}>{student.name}</div>
                    <div className={s.popupMeta}>Radius: {student.geofenceRadius ?? 500}m</div>
                  </div>
                </Popup>
              </Marker>
            </div>
          )
        })}
      </MapContainer>
      {onMapClick && <div className={s.hint}>Click anywhere on the map to drop the student's home pin.</div>}
    </div>
  )
}
