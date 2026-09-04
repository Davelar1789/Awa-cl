import { useState, useEffect, useCallback } from 'react'
import toast from 'react-hot-toast'
import { Plus } from 'lucide-react'
import api, { apiErrorMessage } from '../../services/api'
import PageHeader from '../../components/layout/PageHeader'
import {
  Button, Table, Th, Td, Tr, Modal,
  Input, Select, SearchInput, Empty, Spinner, StatusDot, ActionMenu,
} from '../../components/ui'
import styles from './admin.module.css'

const EMPTY_FORM = { registrationNumber: '', nickname: '', capacity: '', status: 'Idle', assignedDriverUserId: '' }

export default function Buses() {
  const [buses, setBuses] = useState([])
  const [drivers, setDrivers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [busRes, driverRes] = await Promise.all([
        api.get('/buses', { params: { limit: 500 } }),
        api.get('/users', { params: { role: 'driver', status: 'active', limit: 500 } }),
      ])
      setBuses(busRes.data.buses)
      setDrivers(driverRes.data.users)
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Could not load buses.'))
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

  function openEdit(b) {
    setEditTarget(b)
    setForm({
      registrationNumber: b.registrationNumber,
      nickname: b.nickname ?? '',
      capacity: b.capacity ?? '',
      status: b.status,
      assignedDriverUserId: b.assignedDriverUserId?._id ?? b.assignedDriverUserId ?? '',
    })
    setModalOpen(true)
  }

  async function handleSave() {
    if (!form.registrationNumber.trim()) {
      toast.error('Registration number is required.')
      return
    }
    setSaving(true)
    try {
      const payload = {
        registrationNumber: form.registrationNumber,
        nickname: form.nickname || null,
        capacity: form.capacity ? Number(form.capacity) : null,
        status: form.status === 'Active Trip' ? undefined : form.status,
      }
      let busId = editTarget?._id
      if (editTarget) {
        await api.put(`/buses/${editTarget._id}`, payload)
        toast.success('Bus updated.')
      } else {
        const { data } = await api.post('/buses', payload)
        busId = data.bus._id
        toast.success('Bus created.')
      }
      const currentDriverId = editTarget?.assignedDriverUserId?._id ?? editTarget?.assignedDriverUserId ?? ''
      if (busId && form.assignedDriverUserId !== currentDriverId) {
        await api.patch(`/buses/${busId}/assign-driver`, { driverUserId: form.assignedDriverUserId || null })
      }
      setModalOpen(false)
      load()
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Save failed.'))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(b) {
    if (!window.confirm(`Delete bus ${b.registrationNumber}?`)) return
    try {
      await api.delete(`/buses/${b._id}`)
      toast.success('Bus deleted.')
      load()
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Cannot delete — bus may have an assigned driver or trip history.'))
    }
  }

  const filtered = buses.filter((b) =>
    b.registrationNumber.toLowerCase().includes(search.toLowerCase()) ||
    (b.nickname ?? '').toLowerCase().includes(search.toLowerCase())
  )

  const driverName = (b) => b.assignedDriverUserId?.name ?? '—'

  return (
    <div className={styles.page}>
      <PageHeader
        title="Buses"
        subtitle={`${buses.length} buses registered`}
        action={<Button onClick={openCreate}><Plus size={14} />Add bus</Button>}
      />

      <div className={styles.body}>
        <div className={styles.toolbar}>
          <SearchInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by plate or nickname…" />
        </div>

        {loading ? <Spinner /> : (
          <Table>
            <thead>
              <tr>
                <Th>Registration</Th>
                <Th>Nickname</Th>
                <Th>Capacity</Th>
                <Th>Assigned driver</Th>
                <Th>Status</Th>
                <Th width="48px"></Th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={6}><Empty message="No buses match your search." /></td></tr>
              ) : filtered.map((b) => (
                <Tr key={b._id}>
                  <Td><strong>{b.registrationNumber}</strong></Td>
                  <Td muted>{b.nickname || '—'}</Td>
                  <Td muted>{b.capacity ? `${b.capacity} seats` : '—'}</Td>
                  <Td>{driverName(b)}</Td>
                  <Td>
                    <span className={styles.statusCell}>
                      <StatusDot status={b.status} />
                      {b.status}
                    </span>
                  </Td>
                  <Td>
                    <ActionMenu
                      items={[
                        { label: 'Edit', onClick: () => openEdit(b) },
                        { label: 'Delete', danger: true, onClick: () => handleDelete(b) },
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
        title={editTarget ? 'Edit bus' : 'Add bus'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : editTarget ? 'Save changes' : 'Create bus'}
            </Button>
          </>
        }
      >
        <div className={styles.formGrid}>
          <div className={styles.formGridFull}>
            <Input label="Registration number" id="reg" placeholder="e.g. GR-1234-22"
              value={form.registrationNumber} onChange={(e) => setForm((f) => ({ ...f, registrationNumber: e.target.value }))} />
          </div>
          <Input label="Nickname (optional)" id="nickname" placeholder="e.g. Yellow Bus"
            value={form.nickname} onChange={(e) => setForm((f) => ({ ...f, nickname: e.target.value }))} />
          <Input label="Capacity" id="capacity" type="number" placeholder="e.g. 30"
            value={form.capacity} onChange={(e) => setForm((f) => ({ ...f, capacity: e.target.value }))} />
          <div className={styles.formGridFull}>
            <Select label="Assign driver" id="driver" value={form.assignedDriverUserId}
              onChange={(e) => setForm((f) => ({ ...f, assignedDriverUserId: e.target.value }))}>
              <option value="">— No driver assigned —</option>
              {drivers.map((d) => <option key={d._id} value={d._id}>{d.name} · {d.phone}</option>)}
            </Select>
          </div>
          {editTarget?.status !== 'Active Trip' && (
            <div className={styles.formGridFull}>
              <Select label="Status" id="status" value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
                <option value="Idle">Idle</option>
                <option value="Maintenance">Maintenance</option>
              </Select>
            </div>
          )}
        </div>
      </Modal>
    </div>
  )
}
