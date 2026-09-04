import { useState, useEffect, useCallback } from 'react'
import toast from 'react-hot-toast'
import { Plus, Map, List } from 'lucide-react'
import api, { apiErrorMessage } from '../../services/api'
import PageHeader from '../../components/layout/PageHeader'
import {
  Button, Table, Th, Td, Tr, Modal,
  Input, Select, SearchInput, Empty, Spinner, ActionMenu,
} from '../../components/ui'
import MapWorkspace from '../../components/map/MapWorkspace'
import styles from './admin.module.css'

const EMPTY_FORM = {
  name: '', parentUserId: '', driverUserId: '',
  homeLatitude: '', homeLongitude: '', geofenceRadius: 500,
}

export default function Students() {
  const [students, setStudents] = useState([])
  const [parents, setParents] = useState([])
  const [drivers, setDrivers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [view, setView] = useState('list')
  const [driverFilter, setDriverFilter] = useState('all')
  const [modalOpen, setModalOpen] = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [stuRes, parRes, drvRes] = await Promise.all([
        api.get('/students', { params: { limit: 1000, active: true } }),
        api.get('/users', { params: { role: 'parent', limit: 1000 } }),
        api.get('/users', { params: { role: 'driver', limit: 500 } }),
      ])
      setStudents(stuRes.data.students)
      setParents(parRes.data.users)
      setDrivers(drvRes.data.users)
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Could not load students.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  function openCreate() {
    setEditTarget(null)
    setForm(EMPTY_FORM)
    setModalOpen(true)
  }

  function openEdit(s) {
    setEditTarget(s)
    setForm({
      name: s.name,
      parentUserId: s.parentUserId?._id ?? s.parentUserId ?? '',
      driverUserId: s.driverUserId?._id ?? s.driverUserId ?? '',
      homeLatitude: s.homeLatitude ?? '',
      homeLongitude: s.homeLongitude ?? '',
      geofenceRadius: s.geofenceRadius ?? 500,
    })
    setModalOpen(true)
  }

  async function handleSave() {
    if (!form.name.trim() || !form.parentUserId || !form.driverUserId || form.homeLatitude === '' || form.homeLongitude === '') {
      toast.error('Name, parent, driver, and home coordinates are required.')
      return
    }
    setSaving(true)
    try {
      const payload = {
        ...form,
        homeLatitude: parseFloat(form.homeLatitude),
        homeLongitude: parseFloat(form.homeLongitude),
        geofenceRadius: parseInt(form.geofenceRadius, 10),
      }
      if (editTarget) {
        await api.put(`/students/${editTarget._id}`, payload)
        toast.success('Student updated.')
      } else {
        await api.post('/students', payload)
        toast.success('Student created.')
      }
      setModalOpen(false)
      load()
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Save failed.'))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(s) {
    if (!window.confirm(`Remove ${s.name} from the system?`)) return
    try {
      await api.delete(`/students/${s._id}`)
      toast.success('Student removed.')
      load()
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Could not remove student.'))
    }
  }

  function handleMapPin(lat, lng) {
    setForm((f) => ({ ...f, homeLatitude: lat.toFixed(6), homeLongitude: lng.toFixed(6) }))
  }

  const filtered = students.filter((s) => {
    const matchSearch = s.name.toLowerCase().includes(search.toLowerCase())
    const matchDriver = driverFilter === 'all' || (s.driverUserId?._id ?? s.driverUserId) === driverFilter
    return matchSearch && matchDriver
  })

  const previewStudent = {
    _id: 'preview',
    name: form.name || 'New student',
    homeLatitude: form.homeLatitude !== '' ? parseFloat(form.homeLatitude) : undefined,
    homeLongitude: form.homeLongitude !== '' ? parseFloat(form.homeLongitude) : undefined,
    geofenceRadius: parseInt(form.geofenceRadius, 10) || 500,
    driverUserId: form.driverUserId,
  }

  return (
    <div className={styles.page}>
      <PageHeader
        title="Students"
        subtitle={`${students.length} students enrolled`}
        action={<Button onClick={openCreate}><Plus size={14} />Add student</Button>}
      />

      <div className={styles.body}>
        <div className={styles.toolbar}>
          <SearchInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name…" />

          <Select id="driverFilter" value={driverFilter} onChange={(e) => setDriverFilter(e.target.value)}
            style={{ width: 'auto', height: '36px', fontSize: '13px' }}>
            <option value="all">All drivers</option>
            {drivers.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
          </Select>

          <div className={styles.viewToggle}>
            <button className={`${styles.viewBtn} ${view === 'list' ? styles.viewBtnActive : ''}`} onClick={() => setView('list')} aria-label="List view">
              <List size={14} />
            </button>
            <button className={`${styles.viewBtn} ${view === 'map' ? styles.viewBtnActive : ''}`} onClick={() => setView('map')} aria-label="Map view">
              <Map size={14} />
            </button>
          </div>
        </div>

        {loading ? <Spinner /> : view === 'map' ? (
          <MapWorkspace students={filtered} driverFilter={driverFilter} onStudentClick={openEdit} />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Student</Th>
                <Th>Parent</Th>
                <Th>Driver</Th>
                <Th>Coordinates</Th>
                <Th>Radius</Th>
                <Th width="48px"></Th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={6}><Empty message="No students match your search." /></td></tr>
              ) : filtered.map((s) => (
                <Tr key={s._id}>
                  <Td>
                    <div className={styles.nameCell}>
                      <div className={styles.initials}>{s.name?.[0]?.toUpperCase()}</div>
                      <span>{s.name}</span>
                    </div>
                  </Td>
                  <Td muted>{s.parentUserId?.name ?? '—'}</Td>
                  <Td muted>{s.driverUserId?.name ?? '—'}</Td>
                  <Td muted>{s.homeLatitude?.toFixed(4)}, {s.homeLongitude?.toFixed(4)}</Td>
                  <Td muted>{s.geofenceRadius}m</Td>
                  <Td>
                    <ActionMenu
                      items={[
                        { label: 'Edit', onClick: () => openEdit(s) },
                        { label: 'Remove', danger: true, onClick: () => handleDelete(s) },
                      ]}
                    />
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editTarget ? 'Edit student' : 'Add student'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : editTarget ? 'Save changes' : 'Create student'}
            </Button>
          </>
        }
      >
        <Input label="Student name" id="sname" placeholder="e.g. Kofi Mensah" value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
        <Select label="Parent" id="parent" value={form.parentUserId}
          onChange={(e) => setForm((f) => ({ ...f, parentUserId: e.target.value }))}>
          <option value="">— Select parent —</option>
          {parents.map((p) => <option key={p._id} value={p._id}>{p.name} · {p.phone}</option>)}
        </Select>
        <Select label="Driver (route)" id="driver" value={form.driverUserId}
          onChange={(e) => setForm((f) => ({ ...f, driverUserId: e.target.value }))}>
          <option value="">— Select driver —</option>
          {drivers.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
        </Select>

        <div className={styles.coordNote}>Click the map to drop a pin, or enter coordinates manually.</div>

        <MapWorkspace
          mini
          students={previewStudent.homeLatitude !== undefined ? [previewStudent] : []}
          onMapClick={handleMapPin}
        />

        <div className={styles.formGrid} style={{ marginTop: 14 }}>
          <Input label="Latitude" id="lat" type="number" step="any" placeholder="e.g. 5.6037"
            value={form.homeLatitude} onChange={(e) => setForm((f) => ({ ...f, homeLatitude: e.target.value }))} />
          <Input label="Longitude" id="lng" type="number" step="any" placeholder="e.g. -0.1870"
            value={form.homeLongitude} onChange={(e) => setForm((f) => ({ ...f, homeLongitude: e.target.value }))} />
          <div className={styles.formGridFull}>
            <Input label={`Geofence radius: ${form.geofenceRadius}m`} id="radius" type="range" min="100" max="2000" step="50"
              value={form.geofenceRadius} onChange={(e) => setForm((f) => ({ ...f, geofenceRadius: e.target.value }))} />
          </div>
        </div>
      </Modal>
    </div>
  )
}
