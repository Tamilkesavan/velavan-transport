import { useCallback, useEffect, useState } from 'react'
import { KeyRound, Pencil, Plus, Trash2, Users } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useVehicles } from '@/hooks/useFleet'
import { driversApi } from '@/lib/onelap'
import { supabase } from '@/lib/supabase'
import type { Profile, Vehicle } from '@/lib/types'
import { Badge, Button, Card, Empty, ErrorNote, Field, Input, Modal, PageHeader, Select, Spinner, Table } from '@/components/ui'

export default function Drivers() {
  const { profile } = useAuth()
  const { vehicles } = useVehicles()
  const [drivers, setDrivers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<Profile | 'new' | null>(null)

  const reload = useCallback(async () => {
    const { data, error } = await supabase.from('profiles').select('*').eq('role', 'driver').eq('owner_id', profile?.id ?? '').order('name')
    if (error) setError(error.message)
    setDrivers((data ?? []) as Profile[])
    setLoading(false)
  }, [profile?.id])

  useEffect(() => {
    reload()
  }, [reload])

  const vehicleName = (id: string | null) => vehicles.find((v) => v.id === id)?.reg_no

  async function remove(d: Profile) {
    if (!confirm(`Delete ${d.name}'s login? They will no longer be able to sign in.`)) return
    try {
      await driversApi({ action: 'delete', id: d.id })
      reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <div>
      <PageHeader
        title="Drivers"
        subtitle="Each driver signs in with their mobile number and sees only the vehicle you assign"
        actions={
          <Button onClick={() => setEditing('new')}>
            <Plus className="size-4" /> Add driver
          </Button>
        }
      />
      <div className="mb-4">
        <ErrorNote error={error} />
      </div>
      <Card>
        {loading ? (
          <Spinner />
        ) : !drivers.length ? (
          <Empty icon={<Users />} title="No drivers yet" text="Add a driver, set their password and assign a vehicle." />
        ) : (
          <Table head={['Driver', 'Mobile (login)', 'Assigned vehicle', 'Status', '']}>
            {drivers.map((d) => (
              <tr key={d.id}>
                <td className="px-4 py-3 font-semibold text-white">{d.name}</td>
                <td className="px-4 py-3 text-slate-400">{d.phone}</td>
                <td className="px-4 py-3">{vehicleName(d.vehicle_id) ? <span className="font-semibold tracking-wide text-white">{vehicleName(d.vehicle_id)}</span> : <span className="text-slate-500">Not assigned</span>}</td>
                <td className="px-4 py-3">{d.active ? <Badge tone="green" dot="#34d399">Active</Badge> : <Badge>Disabled</Badge>}</td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  <Button variant="ghost" onClick={() => setEditing(d)} aria-label="Edit">
                    <Pencil className="size-4" />
                  </Button>
                  <Button variant="ghost" onClick={() => remove(d)} aria-label="Delete">
                    <Trash2 className="size-4 text-red-400" />
                  </Button>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
      {editing && <DriverForm driver={editing === 'new' ? null : editing} vehicles={vehicles} onClose={() => setEditing(null)} onSaved={reload} />}
    </div>
  )
}

function DriverForm({ driver, vehicles, onClose, onSaved }: { driver: Profile | null; vehicles: Vehicle[]; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(driver?.name ?? '')
  const [phone, setPhone] = useState(driver?.phone ?? '')
  const [password, setPassword] = useState('')
  const [vehicleId, setVehicleId] = useState(driver?.vehicle_id ?? vehicles[0]?.id ?? '')
  const [active, setActive] = useState(driver?.active ?? true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    setBusy(true)
    setError(null)
    try {
      if (driver) {
        await driversApi({ action: 'update', id: driver.id, name, vehicle_id: vehicleId || null, active, ...(password ? { password } : {}) })
      } else {
        await driversApi({ action: 'create', name, phone, password, vehicle_id: vehicleId || null })
      }
      onSaved()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={driver ? `Edit ${driver.name}` : 'Add driver'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={save} loading={busy}>{driver ? 'Save changes' : 'Create login'}</Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Driver name">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Murugan" />
        </Field>
        <Field label="Mobile number (used to sign in)">
          <Input type="tel" inputMode="numeric" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="98765 43210" disabled={Boolean(driver)} />
        </Field>
        <Field label={driver ? 'New password (leave empty to keep)' : 'Password'} hint="At least 6 characters. Share it with the driver.">
          <div className="relative">
            <KeyRound className="absolute top-2.5 left-3 size-4 text-slate-400" />
            <Input className="pl-9" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={driver ? '••••••' : 'Set a password'} />
          </div>
        </Field>
        <Field label="Assigned vehicle" hint="The driver will see only this vehicle.">
          <Select value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}>
            <option value="">Not assigned</option>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>{v.reg_no}</option>
            ))}
          </Select>
        </Field>
        {driver && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="size-4 accent-brand-500" />
            Login active
          </label>
        )}
        <ErrorNote error={error} />
      </div>
    </Modal>
  )
}
