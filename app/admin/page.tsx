'use client'

import { useCallback, useState } from 'react'
import type { BatchSummary, GroupTally, ParticipantAssignment } from '@/lib/types'

// ── Types for API payloads ────────────────────────────────────────────────
interface BatchesResponse {
  batches: BatchSummary[]
}
interface ParticipantsResponse {
  participants: ParticipantAssignment[]
}

const STATUS_STYLE: Record<string, string> = {
  assigned: 'bg-blue-50 text-blue-700 border-blue-200',
  completed: 'bg-green-50 text-green-700 border-green-200',
  invalid: 'bg-red-50 text-red-700 border-red-200',
}

const GROUP_COLOR: Record<string, string> = {
  G1: '#1d4ed8',
  G2: '#0369a1',
  G3: '#7c3aed',
  G4: '#b45309',
}

function GroupBar({ tally }: { tally: GroupTally }) {
  const pctAssigned = Math.min(100, (tally.assigned / tally.capacity) * 100)
  const pctCompleted = Math.min(100, (tally.completed / tally.capacity) * 100)
  return (
    <div className="flex items-center gap-3">
      <span
        className="w-8 text-[13px] font-bold"
        style={{ color: GROUP_COLOR[tally.group] }}
      >
        {tally.group}
      </span>
      <div className="relative flex-1 h-3 rounded-full bg-gray-100 overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 bg-gray-300"
          style={{ width: `${pctAssigned}%` }}
        />
        <div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{ width: `${pctCompleted}%`, background: GROUP_COLOR[tally.group] }}
        />
      </div>
      <span className="w-28 text-right text-[12px] text-gray-600 tabular-nums">
        {tally.completed}✓ / {tally.assigned} / {tally.capacity}
        {tally.invalid > 0 && <span className="text-red-500"> ({tally.invalid}✗)</span>}
      </span>
    </div>
  )
}

export default function AdminPage() {
  const [password, setPassword] = useState('')
  const [authed, setAuthed] = useState(false)
  const [pwError, setPwError] = useState('')
  const [loading, setLoading] = useState(false)
  const [batches, setBatches] = useState<BatchSummary[]>([])
  const [error, setError] = useState('')

  // New-batch form
  const [newName, setNewName] = useState('')
  const [newSize, setNewSize] = useState(25)

  // Roster view
  const [openBatchId, setOpenBatchId] = useState<string | null>(null)
  const [roster, setRoster] = useState<ParticipantAssignment[]>([])
  const [rosterLoading, setRosterLoading] = useState(false)

  const authHeaders = useCallback(
    (): HeadersInit => ({ 'x-stats-password': password, 'Content-Type': 'application/json' }),
    [password],
  )

  const loadBatches = useCallback(
    async (pw?: string) => {
      const submitted = pw ?? password
      if (!submitted) {
        setPwError('Enter the access password.')
        return
      }
      setLoading(true)
      setError('')
      setPwError('')
      try {
        const res = await fetch('/api/admin/batches', {
          headers: { 'x-stats-password': submitted },
        })
        if (res.status === 401) {
          setAuthed(false)
          setPwError('Incorrect password.')
          return
        }
        if (!res.ok) {
          setError(`API responded with ${res.status}`)
          return
        }
        const data: BatchesResponse = await res.json()
        setAuthed(true)
        setBatches(data.batches)
      } catch (err) {
        setError(String(err))
      } finally {
        setLoading(false)
      }
    },
    [password],
  )

  async function createBatch(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/batches', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ name: newName.trim(), groupSize: newSize }),
      })
      if (!res.ok) {
        setError(`Create failed (${res.status})`)
        return
      }
      setNewName('')
      setNewSize(25)
      await loadBatches()
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }

  async function setBatchStatus(id: string, status: 'active' | 'closed') {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/batches/${id}`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({ status }),
      })
      if (!res.ok) {
        setError(`Update failed (${res.status})`)
        return
      }
      await loadBatches()
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }

  async function toggleRoster(id: string) {
    if (openBatchId === id) {
      setOpenBatchId(null)
      setRoster([])
      return
    }
    setOpenBatchId(id)
    setRosterLoading(true)
    setRoster([])
    try {
      const res = await fetch(`/api/admin/batches/${id}/participants`, {
        headers: { 'x-stats-password': password },
      })
      if (res.ok) {
        const data: ParticipantsResponse = await res.json()
        setRoster(data.participants)
      }
    } finally {
      setRosterLoading(false)
    }
  }

  function copyCompletedPids() {
    const pids = roster
      .filter((p) => p.status === 'completed')
      .map((p) => p.prolificPid)
      .join('\n')
    void navigator.clipboard.writeText(pids)
  }

  function downloadRosterCsv(batch: BatchSummary) {
    const header = 'prolific_pid,group,status,prolific_session_id,assigned_at,completed_at'
    const lines = roster.map((p) =>
      [
        p.prolificPid,
        p.groupCondition,
        p.status,
        p.prolificSessionId ?? '',
        p.assignedAt,
        p.completedAt ?? '',
      ].join(','),
    )
    const blob = new Blob([[header, ...lines].join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `batch_${batch.name.replace(/\s+/g, '_')}_roster.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // ── Password gate ─────────────────────────────────────────────────────────
  if (!authed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <h1 className="text-xl font-bold mb-1">Test Management</h1>
          <p className="text-sm text-gray-500 mb-6">Enter the admin access password.</p>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              void loadBatches(password)
            }}
            className="space-y-3"
          >
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Access password"
              className="w-full h-11 px-4 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-black/70"
            />
            {pwError && <p className="text-sm text-red-600">{pwError}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 rounded-xl bg-black text-white font-bold disabled:opacity-50"
            >
              {loading ? 'Checking…' : 'Enter'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  // ── Dashboard ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Test Management</h1>
          <button
            onClick={() => loadBatches()}
            disabled={loading}
            className="text-sm px-4 h-9 rounded-lg border border-gray-200 bg-white font-semibold disabled:opacity-50"
          >
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* New batch */}
        <form
          onSubmit={createBatch}
          className="mb-8 bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-wrap items-end gap-4"
        >
          <div className="flex-1 min-w-[180px]">
            <label className="block text-xs font-bold text-gray-500 mb-1">Batch name</label>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Pilot — July 2026"
              className="w-full h-10 px-3 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-black/70"
            />
          </div>
          <div className="w-28">
            <label className="block text-xs font-bold text-gray-500 mb-1">Per group</label>
            <input
              type="number"
              min={1}
              value={newSize}
              onChange={(e) => setNewSize(Number(e.target.value))}
              className="w-full h-10 px-3 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-black/70"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !newName.trim()}
            className="h-10 px-5 rounded-lg bg-black text-white font-bold disabled:opacity-50"
          >
            Start batch
          </button>
          <p className="w-full text-xs text-gray-400">
            Starting a batch closes any other active batch. New participants fill 4 groups of{' '}
            {newSize} ({newSize * 4} total).
          </p>
        </form>

        {/* Batch list */}
        {batches.length === 0 && (
          <p className="text-sm text-gray-500">No batches yet. Start one above.</p>
        )}

        <div className="space-y-5">
          {batches.map((batch) => {
            const isActive = batch.status === 'active'
            return (
              <div
                key={batch.id}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5"
              >
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-bold">{batch.name}</h2>
                      <span
                        className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${
                          isActive
                            ? 'bg-green-50 text-green-700 border-green-200'
                            : 'bg-gray-100 text-gray-500 border-gray-200'
                        }`}
                      >
                        {isActive ? 'ACTIVE' : 'CLOSED'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {batch.totalCompleted} completed · {batch.totalAssigned} assigned /{' '}
                      {batch.capacity} · {new Date(batch.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleRoster(batch.id)}
                      className="text-sm px-3 h-9 rounded-lg border border-gray-200 bg-white font-semibold"
                    >
                      {openBatchId === batch.id ? 'Hide' : 'Participants'}
                    </button>
                    <button
                      onClick={() => setBatchStatus(batch.id, isActive ? 'closed' : 'active')}
                      disabled={loading}
                      className={`text-sm px-3 h-9 rounded-lg font-semibold disabled:opacity-50 ${
                        isActive
                          ? 'border border-gray-200 bg-white'
                          : 'bg-black text-white'
                      }`}
                    >
                      {isActive ? 'Close' : 'Reopen'}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  {batch.groups.map((g) => (
                    <GroupBar key={g.group} tally={g} />
                  ))}
                </div>

                {openBatchId === batch.id && (
                  <div className="mt-5 border-t border-gray-100 pt-4">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-sm font-bold text-gray-700">
                        Participants ({roster.length})
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={copyCompletedPids}
                          className="text-xs px-3 h-8 rounded-lg border border-gray-200 bg-white font-semibold"
                        >
                          Copy completed PIDs
                        </button>
                        <button
                          onClick={() => downloadRosterCsv(batch)}
                          className="text-xs px-3 h-8 rounded-lg border border-gray-200 bg-white font-semibold"
                        >
                          Download CSV
                        </button>
                      </div>
                    </div>

                    {rosterLoading ? (
                      <p className="text-sm text-gray-400">Loading…</p>
                    ) : roster.length === 0 ? (
                      <p className="text-sm text-gray-400">No participants yet.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-[13px]">
                          <thead>
                            <tr className="text-left text-gray-500 border-b border-gray-200">
                              <th className="py-1.5 pr-3 font-semibold">Prolific PID</th>
                              <th className="py-1.5 pr-3 font-semibold">Group</th>
                              <th className="py-1.5 pr-3 font-semibold">Status</th>
                              <th className="py-1.5 pr-3 font-semibold">Assigned</th>
                            </tr>
                          </thead>
                          <tbody>
                            {roster.map((p) => (
                              <tr key={p.id} className="border-b border-gray-50">
                                <td className="py-1.5 pr-3 font-mono text-[12px]">
                                  {p.prolificPid}
                                </td>
                                <td className="py-1.5 pr-3">
                                  <span
                                    className="font-bold"
                                    style={{ color: GROUP_COLOR[p.groupCondition] }}
                                  >
                                    {p.groupCondition}
                                  </span>
                                </td>
                                <td className="py-1.5 pr-3">
                                  <span
                                    className={`inline-block text-[11px] font-bold px-2 py-0.5 rounded-full border ${
                                      STATUS_STYLE[p.status] ?? ''
                                    }`}
                                  >
                                    {p.status}
                                  </span>
                                </td>
                                <td className="py-1.5 pr-3 text-gray-500 tabular-nums">
                                  {new Date(p.assignedAt).toLocaleString()}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
