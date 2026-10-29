import { useState } from 'react'
import { Link } from 'react-router-dom'
import { DownloadCloud, Pencil, Truck } from 'lucide-react'
import { useVehicles } from '@/hooks/useFleet'
import { onelap } from '@/lib/onelap'
import { supabase } from '@/lib/supabase'
import type { Vehicle } from '@/lib/types'
import { Button, Card, Empty, ErrorNote, Field, Input, Modal, PageHeader, Spinner, Table } from '@/components/ui'

export default function Vehicles() {
  const { vehicles, loading, error, reload } = useVehicles()
  const [syncing, setSyncing] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const [syncError, setSyncError] = useState<string | null>(null)
  const [editing, setEditing] = useState<Vehicle | null>(null)

  async function sync() {
    setSyncing(true)
    setSyncError(null)
    setNote(null)
    try {
      const r = await onelap.sync()
      setNote(r.added ? `Imported ${r.added} new vehicle(s) from OneLap.` : `All ${r.total} OneLap devices are already here.`)
      await reload()
    } catch (e) {
      setSyncError(e instanceof Error ? e.message : String(e))
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Vehicles"
        subtitle="Vehicles come from your OneLap account"
        actions={
          <Button onClick={sync} loading={syncing}>
            <DownloadCloud className="size-4" /> Import from OneLap
          </Button>
        }
      />
      <div className="mb-4 space-y-2">
        <ErrorNote error={error ?? syncError} />
        {note && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700 ring-1 ring-emerald-200">{note}</p>}
      </div>
      <Card>
        {loading ? (
          <Spinner />
        ) : !vehicles.length ? (
          <Empty icon={<Truck />} title="No vehicles yet" text="Press “Import from OneLap” to add all your tracked vehicles." />
        ) : (
          <Table head={['Registration', 'Name', 'OneLap device', '']}>
            {vehicles.map((v) => (
              <tr key={v.id}>
                <td className="px-4 py-3 font-bold tracking-wide">
                  <Link to={`/vehicles/${v.id}`} className="hover:text-brand-600">{v.reg_no}</Link>
                </td>
                <td className="px-4 py-3 text-slate-600">{v.name ?? '—'}</td>
                <td className="px-4 py-3 text-slate-600">{v.onelap_device_id}</td>
                <td className="px-4 py-3 text-right">
                  <Button variant="ghost" onClick={() => setEditing(v)} aria-label="Edit">
                    <Pencil className="size-4" />
                  </Button>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
      {editing && <EditVehicle vehicle={editing} onClose={() => setEditing(null)} onSaved={reload} />}
    </div>
  )
}

function EditVehicle({ vehicle, onClose, onSaved }: { vehicle: Vehicle; onClose: () => void; onSaved: () => void }) {
  const [regNo, setRegNo] = useState(vehicle.reg_no)
  const [name, setName] = useState(vehicle.name ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    setBusy(true)
    const { error } = await supabase
      .from('vehicles')
      .update({ reg_no: regNo.trim().toUpperCase(), name: name.trim() || null })
      .eq('id', vehicle.id)
    setBusy(false)
    if (error) return setError(error.message)
    onSaved()
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Edit vehicle"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={save} loading={busy}>Save</Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Registration number">
          <Input value={regNo} onChange={(e) => setRegNo(e.target.value)} placeholder="TN 28 AB 1234" />
        </Field>
        <Field label="Name (optional)">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Tata 1612" />
        </Field>
        <ErrorNote error={error} />
      </div>
    </Modal>
  )
}
