'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'

const BehavioralChart = dynamic(
  () => import('@/components/stats/BehavioralChart').then((m) => m.BehavioralChart),
  { ssr: false },
)
const SurveyChart = dynamic(
  () => import('@/components/stats/SurveyChart').then((m) => m.SurveyChart),
  { ssr: false },
)

// ── Types ────────────────────────────────────────────────────────────────────

interface NumericStat {
  mean: number
  sd: number
  median?: number
  min?: number
  max?: number
  n: number
  values: number[]
}

interface BannerUptake {
  used: number
  total: number
}

interface ConditionStat {
  total: number
  completed: number
  completionRate: number
  navLag: NumericStat | null
  s2Dur: NumericStat | null
  bannerUptake: BannerUptake | null
}

interface SurveyStat {
  n: number
  cognitiveLoad: { mean: number; sd: number; values: number[] }
  usability: { mean: number; sd: number; values: number[] }
  continuance: { mean: number; sd: number; values: number[] }
  manipCheck: { mean: number; sd: number; values: number[] }
}

interface GroupComparison {
  label: string
  n: number
  cl: { mean: number | null; sd: number | null }
  pu: { mean: number | null; sd: number | null }
  ci: { mean: number | null; sd: number | null }
  mc?: { mean: number | null; sd: number | null }
}

interface SessionDetail {
  sessionId: string
  condition: string
  participantId: string
  isBot: boolean
  eventCount: number
  navLagS: number | null
  s2DurS: number | null
  bannerTapped: boolean
  completed: boolean
}

interface StatsData {
  generatedAt: string
  overview: {
    totalRows: number
    totalSessions: number
    botSessions: number
    realSessions: number
    completedRealSessions: number
    completionRate: number
  }
  sessionDetail: SessionDetail[]
  conditionStats: Record<string, ConditionStat>
  surveyByCondition: Record<string, SurveyStat | null>
  heterogeneityComparison: {
    low: GroupComparison
    high: GroupComparison
  }
  interrelatednessComparison: {
    noBridge: GroupComparison
    bridge: GroupComparison
  }
  demographics: {
    ages: Record<string, number>
    genders: Record<string, number>
    famFreqs: Record<string, number>
  }
  eventNameCounts: Record<string, number>
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const f2 = (n: number | null | undefined) => (n == null ? '—' : n.toFixed(2))
const f1 = (n: number | null | undefined) => (n == null ? '—' : n.toFixed(1))
const pct = (n: number) => `${n.toFixed(1)}%`

/** Format as "M (SD)" */
const msd = (m: number | null | undefined, s: number | null | undefined, dec = 2) =>
  m == null ? '—' : `${m.toFixed(dec)} (${(s ?? 0).toFixed(dec)})`

const COND_COLOR: Record<string, string> = {
  G1: '#1d4ed8', // blue-700
  G2: '#0369a1', // sky-700
  G3: '#7c3aed', // violet-700
  G4: '#b45309', // amber-700
}

const COND_BG: Record<string, string> = {
  G1: '#eff6ff',
  G2: '#f0f9ff',
  G3: '#f5f3ff',
  G4: '#fffbeb',
}

// ── Shared UI atoms ───────────────────────────────────────────────────────────

function CondTag({ cond }: { cond: string }) {
  return (
    <span
      style={{ color: COND_COLOR[cond] ?? '#374151', background: COND_BG[cond] ?? '#f9fafb' }}
      className="inline-block font-bold text-xs px-2 py-0.5 rounded-sm border border-current/20"
    >
      {cond}
    </span>
  )
}

/** Thin horizontal-rule APA-style table */
function PaperTable({
  caption,
  note,
  headers,
  rows,
}: {
  caption?: string
  note?: string
  headers: string[]
  rows: (string | number | React.ReactNode)[][]
}) {
  return (
    <div className="my-4">
      {caption && (
        <p className="text-[13px] font-semibold text-gray-800 mb-1 italic">{caption}</p>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-[13px] border-collapse">
          <thead>
            {/* thick top rule */}
            <tr>
              <td colSpan={headers.length} className="pb-0 pt-0">
                <div className="border-t-2 border-gray-800" />
              </td>
            </tr>
            <tr>
              {headers.map((h, i) => (
                <th
                  key={i}
                  className="px-3 py-1.5 text-left font-semibold text-gray-700 whitespace-nowrap"
                >
                  {h}
                </th>
              ))}
            </tr>
            {/* thin rule under header */}
            <tr>
              <td colSpan={headers.length}>
                <div className="border-t border-gray-500" />
              </td>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="hover:bg-gray-50 transition-colors">
                {row.map((cell, j) => (
                  <td key={j} className="px-3 py-1.5 text-gray-800 whitespace-nowrap">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
            {/* thick bottom rule */}
            <tr>
              <td colSpan={headers.length} className="pt-0">
                <div className="border-t-2 border-gray-800" />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      {note && (
        <p className="text-[12px] text-gray-500 mt-1">
          <span className="italic font-semibold">Note.</span> {note}
        </p>
      )}
    </div>
  )
}

function Section({
  id,
  title,
  children,
}: {
  id: string
  title: string
  children: React.ReactNode
}) {
  return (
    <section id={id} className="mb-12 scroll-mt-16">
      <h2 className="text-[15px] font-bold uppercase tracking-widest text-gray-400 mb-4 flex items-center gap-3">
        <span>{title}</span>
        <span className="flex-1 h-px bg-gray-200" />
      </h2>
      {children}
    </section>
  )
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded p-4 text-center">
      <div className="text-[26px] font-bold text-gray-800 leading-tight tabular-nums">{value}</div>
      <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mt-1">{label}</div>
      {sub && <div className="text-[11px] text-gray-400 mt-0.5">{sub}</div>}
    </div>
  )
}

// ── Nav ───────────────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { id: 'overview', label: 'Overview' },
  { id: 'behavioral', label: 'Behavioral Metrics' },
  { id: 'survey', label: 'Survey Scales' },
  { id: 'comparisons', label: 'Group Comparisons' },
  { id: 'demographics', label: 'Demographics' },
  { id: 'events', label: 'Event Log' },
  { id: 'sessions', label: 'Sessions' },
]

// ── Main page ────────────────────────────────────────────────────────────────

export default function StatsPage() {
  const [password, setPassword] = useState('')
  const [authed, setAuthed] = useState(false)
  const [pwError, setPwError] = useState('')
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<StatsData | null>(null)
  const [fetchError, setFetchError] = useState('')
  const [showSessions, setShowSessions] = useState(false)

  function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault()
    void loadStats(password)
  }

  async function loadStats(passwordOverride?: string) {
    const submittedPassword = passwordOverride ?? password
    if (!submittedPassword) {
      setPwError('Enter the access password.')
      return
    }

    setLoading(true)
    setFetchError('')
    setPwError('')

    try {
      const res = await fetch('/api/paper-stats', {
        headers: { 'x-stats-password': submittedPassword },
      })

      if (res.status === 401) {
        setAuthed(false)
        setPwError('Incorrect password.')
        return
      }

      if (!res.ok) {
        setFetchError(`API responded with ${res.status}`)
        return
      }

      setAuthed(true)
      setData((await res.json()) as StatsData)
    } catch (err) {
      setFetchError(String(err))
    } finally {
      setLoading(false)
    }
  }

  // Escape the device-frame from root layout
  const outerStyle: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    overflowY: 'auto',
    background: '#f8f9fa',
    fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
    zIndex: 9999,
  }

  // ── Password gate ─────────────────────────────────────────────────────────

  if (!authed) {
    return (
      <div style={outerStyle} className="flex items-center justify-center">
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-10 w-96">
          <div className="mb-6">
            <h1 className="text-xl font-bold text-gray-900 tracking-tight">Experiment Results</h1>
            <p className="text-[13px] text-gray-500 mt-1">HCI 2×2 Between-Subjects Study · Restricted Access</p>
          </div>
          <form onSubmit={handlePasswordSubmit} className="space-y-3">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Access password"
              autoFocus
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {pwError && <p className="text-red-600 text-[13px]">{pwError}</p>}
            <button
              type="submit"
              className="w-full bg-gray-900 text-white rounded px-4 py-2 text-sm font-semibold hover:bg-gray-700 transition"
            >
              Access Dashboard
            </button>
          </form>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div style={outerStyle} className="flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-800 mx-auto mb-3" />
          <p className="text-[13px] text-gray-500">Querying database…</p>
        </div>
      </div>
    )
  }

  if (fetchError) {
    return (
      <div style={outerStyle} className="flex items-center justify-center">
        <div className="bg-white border border-gray-200 rounded-lg p-8 w-96 text-center">
          <p className="text-red-600 font-semibold text-sm mb-2">Query failed</p>
          <p className="text-gray-500 text-[13px] mb-4">{fetchError}</p>
          <button onClick={() => void loadStats()} className="bg-gray-900 text-white rounded px-4 py-2 text-sm hover:bg-gray-700">
            Retry
          </button>
        </div>
      </div>
    )
  }

  if (!data) return null

  const CONDITIONS = ['G1', 'G2', 'G3', 'G4'] as const

  // ── Dashboard ─────────────────────────────────────────────────────────────

  return (
    <div style={outerStyle}>
      {/* Sticky header */}
      <header className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-screen-xl mx-auto px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <span className="font-bold text-gray-900 text-[15px] tracking-tight whitespace-nowrap">
              HCI Experiment · Results
            </span>
            <nav className="hidden lg:flex items-center gap-0.5">
              {NAV_ITEMS.map((item) => (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  className="px-3 py-1 text-[12px] font-medium text-gray-500 hover:text-gray-900 rounded transition"
                >
                  {item.label}
                </a>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[11px] text-gray-400 hidden md:block">
              {new Date(data.generatedAt).toLocaleString('en-US', {
                month: 'short', day: 'numeric', year: 'numeric',
                hour: '2-digit', minute: '2-digit',
              })}
            </span>
            <button
              onClick={() => void loadStats()}
              className="text-[12px] bg-gray-900 text-white rounded px-3 py-1.5 hover:bg-gray-700 transition font-medium"
            >
              Refresh
            </button>
          </div>
        </div>
      </header>

      {/* Page body */}
      <div className="max-w-screen-xl mx-auto px-8 py-10">

        {/* ── Overview ──────────────────────────────────────────────────── */}
        <Section id="overview" title="Overview">
          <div className="grid grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
            <StatCard label="DB Rows" value={data.overview.totalRows} />
            <StatCard label="Total Sessions" value={data.overview.totalSessions} />
            <StatCard label="Bot Sessions" value={data.overview.botSessions} />
            <StatCard label="Real Sessions" value={data.overview.realSessions} />
            <StatCard label="Completed" value={data.overview.completedRealSessions} sub="real sessions" />
            <StatCard
              label="Completion Rate"
              value={pct(data.overview.completionRate)}
              sub="real sessions"
            />
          </div>

          {/* Condition allocation */}
          <PaperTable
            caption="Table 1. Participant Allocation and Completion by Condition"
            note="Bot sessions are excluded from real session counts. Completion defined as reaching experiment.completed event."
            headers={['Condition', 'Service', 'Bridge', 'n (real)', 'n (completed)', 'Completion Rate']}
            rows={CONDITIONS.map((cond) => {
              const s = data.conditionStats[cond]
              const svc = { G1: 'Courier', G2: 'Courier', G3: 'Eats', G4: 'Eats' }[cond]
              const bridge = { G1: 'Absent', G2: 'Present', G3: 'Absent', G4: 'Present' }[cond]
              return [
                <CondTag key="c" cond={cond} />,
                svc,
                bridge,
                s.total,
                s.completed,
                pct(s.completionRate),
              ]
            })}
          />
        </Section>

        {/* ── Behavioral Metrics ────────────────────────────────────────── */}
        <Section id="behavioral" title="Behavioral Metrics">
          <PaperTable
            caption="Table 2. Navigation Latency and Service-2 Task Completion Time by Condition (Real, Completed Sessions)"
            note="Navigation latency = time from trip_complete.viewed to service2.entry. Task time = duration_ms on service2.task.complete event. M (SD) format; seconds."
            headers={[
              'Condition', 'n',
              'Nav Latency M (SD)', 'Median', 'Min', 'Max',
              'Task Time M (SD)', 'Median', 'Min', 'Max',
              'Banner Uptake',
            ]}
            rows={CONDITIONS.map((cond) => {
              const s = data.conditionStats[cond]
              return [
                <CondTag key="c" cond={cond} />,
                s.navLag?.n ?? s.completed,
                msd(s.navLag?.mean, s.navLag?.sd, 1),
                f1(s.navLag?.median),
                f1(s.navLag?.min),
                f1(s.navLag?.max),
                msd(s.s2Dur?.mean, s.s2Dur?.sd, 1),
                f1(s.s2Dur?.median),
                f1(s.s2Dur?.min),
                f1(s.s2Dur?.max),
                s.bannerUptake
                  ? `${s.bannerUptake.used}/${s.bannerUptake.total} (${s.bannerUptake.total > 0 ? pct((s.bannerUptake.used / s.bannerUptake.total) * 100) : '—'})`
                  : 'N/A',
              ]
            })}
          />

          <BehavioralChart conditionStats={data.conditionStats} />

          {/* Individual values for inspection */}
          <div className="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-4">
            {CONDITIONS.map((cond) => {
              const s = data.conditionStats[cond]
              return (
                <div key={cond} className="bg-white border border-gray-200 rounded p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <CondTag cond={cond} />
                    <span className="text-[11px] text-gray-400 uppercase tracking-wide">
                      {{ G1: 'Courier / No Bridge', G2: 'Courier / Bridge', G3: 'Eats / No Bridge', G4: 'Eats / Bridge' }[cond]}
                    </span>
                  </div>
                  <div className="space-y-2 text-[12px]">
                    <div>
                      <div className="text-gray-500 font-medium mb-0.5">Navigation Latency (s)</div>
                      <div className="font-mono text-gray-700 leading-relaxed">
                        {s.navLag?.values.map((v) => f1(v)).join(', ') || '—'}
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-500 font-medium mb-0.5">Task Time (s)</div>
                      <div className="font-mono text-gray-700 leading-relaxed">
                        {s.s2Dur?.values.map((v) => f1(v)).join(', ') || '—'}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </Section>

        {/* ── Survey Scales ─────────────────────────────────────────────── */}
        <Section id="survey" title="Survey Scales">
          <p className="text-[13px] text-gray-500 mb-4">
            All items measured on a 7-point Likert scale. CL = Cognitive Load (CL1–CL3; higher = more load); PU = Perceived Usability (PU1–PU2; higher = better); CI = Continuance Intention (CI1–CI2; higher = stronger intent); MC = Manipulation Check (MC1–MC2; higher = more recognized bridge).
          </p>
          <PaperTable
            caption="Table 3. Survey Scale Descriptives by Condition"
            note="Values represent condition means with standard deviations in parentheses."
            headers={['Condition', 'n', 'CL M (SD)', 'PU M (SD)', 'CI M (SD)', 'MC M (SD)']}
            rows={CONDITIONS.map((cond) => {
              const s = data.surveyByCondition[cond]
              if (!s) return [<CondTag key="c" cond={cond} />, 0, '—', '—', '—', '—']
              return [
                <CondTag key="c" cond={cond} />,
                s.n,
                msd(s.cognitiveLoad.mean, s.cognitiveLoad.sd),
                msd(s.usability.mean, s.usability.sd),
                msd(s.continuance.mean, s.continuance.sd),
                msd(s.manipCheck.mean, s.manipCheck.sd),
              ]
            })}
          />

          <SurveyChart surveyByCondition={data.surveyByCondition} />

          {/* Raw values per condition */}
          <div className="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-4">
            {CONDITIONS.map((cond) => {
              const s = data.surveyByCondition[cond]
              if (!s) return (
                <div key={cond} className="bg-white border border-gray-200 rounded p-4">
                  <CondTag cond={cond} />
                  <p className="text-[12px] text-gray-400 mt-2">No survey data</p>
                </div>
              )
              return (
                <div key={cond} className="bg-white border border-gray-200 rounded p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <CondTag cond={cond} />
                    <span className="text-[11px] text-gray-400">n = {s.n}</span>
                  </div>
                  <div className="space-y-1.5 text-[12px]">
                    {[
                      { label: 'CL', vals: s.cognitiveLoad.values },
                      { label: 'PU', vals: s.usability.values },
                      { label: 'CI', vals: s.continuance.values },
                      { label: 'MC', vals: s.manipCheck.values },
                    ].map(({ label, vals }) => (
                      <div key={label} className="flex gap-2">
                        <span className="font-semibold text-gray-500 w-5 flex-shrink-0">{label}</span>
                        <span className="font-mono text-gray-700">{vals.map((v) => f2(v)).join(', ')}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </Section>

        {/* ── Group Comparisons ─────────────────────────────────────────── */}
        <Section id="comparisons" title="Group Comparisons">
          <div className="grid lg:grid-cols-2 gap-8">
            {/* Heterogeneity */}
            <div>
              <p className="text-[13px] font-semibold text-gray-700 mb-1">
                Factor A: Service Heterogeneity
              </p>
              <p className="text-[12px] text-gray-500 mb-3">
                Low = Courier (G1+G2) · High = Eats (G3+G4)
              </p>
              <PaperTable
                caption="Table 4a. Heterogeneity Comparison"
                headers={['Group', 'n', 'CL M (SD)', 'PU M (SD)', 'CI M (SD)']}
                rows={(['low', 'high'] as const).map((key) => {
                  const g = data.heterogeneityComparison[key]
                  return [
                    <span key="l" className="font-semibold text-[12px]">{g.label}</span>,
                    g.n,
                    msd(g.cl.mean, g.cl.sd),
                    msd(g.pu.mean, g.pu.sd),
                    msd(g.ci.mean, g.ci.sd),
                  ]
                })}
              />
            </div>

            {/* Interrelatedness */}
            <div>
              <p className="text-[13px] font-semibold text-gray-700 mb-1">
                Factor B: Cross-Service Interrelatedness
              </p>
              <p className="text-[12px] text-gray-500 mb-3">
                Low = No bridge (G1+G3) · High = Bridge present (G2+G4)
              </p>
              <PaperTable
                caption="Table 4b. Interrelatedness Comparison"
                headers={['Group', 'n', 'CL M (SD)', 'PU M (SD)', 'CI M (SD)', 'MC M (SD)']}
                rows={(['noBridge', 'bridge'] as const).map((key) => {
                  const g = data.interrelatednessComparison[key]
                  return [
                    <span key="l" className="font-semibold text-[12px]">{g.label}</span>,
                    g.n,
                    msd(g.cl.mean, g.cl.sd),
                    msd(g.pu.mean, g.pu.sd),
                    msd(g.ci.mean, g.ci.sd),
                    g.mc ? msd(g.mc.mean, g.mc.sd) : '—',
                  ]
                })}
              />
            </div>
          </div>
        </Section>

        {/* ── Demographics ──────────────────────────────────────────────── */}
        <Section id="demographics" title="Demographics">
          <div className="grid grid-cols-3 gap-6">
            {[
              { label: 'Age Group (DEM1)', dist: data.demographics.ages },
              { label: 'Gender (DEM2)', dist: data.demographics.genders },
              { label: 'App Familiarity (FAM1)', dist: data.demographics.famFreqs },
            ].map(({ label, dist }) => {
              const total = Object.values(dist).reduce((a, b) => a + b, 0)
              return (
                <div key={label} className="bg-white border border-gray-200 rounded p-5">
                  <p className="text-[13px] font-semibold text-gray-700 mb-3">{label}</p>
                  {total === 0 ? (
                    <p className="text-[12px] text-gray-400 italic">No data available</p>
                  ) : (
                    <div className="space-y-2">
                      {Object.entries(dist)
                        .sort((a, b) => b[1] - a[1])
                        .map(([k, v]) => (
                          <div key={k}>
                            <div className="flex justify-between text-[12px] text-gray-600 mb-0.5">
                              <span className="truncate mr-2">{k}</span>
                              <span className="font-mono font-semibold text-gray-800 flex-shrink-0">
                                {v} ({total > 0 ? pct((v / total) * 100) : '—'})
                              </span>
                            </div>
                            <div className="w-full bg-gray-100 rounded-full h-1.5">
                              <div
                                className="bg-gray-600 h-1.5 rounded-full"
                                style={{ width: `${(v / total) * 100}%` }}
                              />
                            </div>
                          </div>
                        ))}
                      <p className="text-[11px] text-gray-400 pt-1">N = {total}</p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </Section>

        {/* ── Event Log ─────────────────────────────────────────────────── */}
        <Section id="events" title="Event Log">
          <p className="text-[13px] text-gray-500 mb-4">
            Total instrumented event types and their frequency across all sessions.
          </p>
          <div className="bg-white border border-gray-200 rounded overflow-hidden">
            <table className="w-full text-[13px] border-collapse">
              <thead>
                <tr className="border-b-2 border-gray-800">
                  <th className="px-4 py-2 text-left font-semibold text-gray-700">Event Name</th>
                  <th className="px-4 py-2 text-right font-semibold text-gray-700">Count</th>
                  <th className="px-4 py-2 text-left font-semibold text-gray-700 w-1/2">Frequency</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const entries = Object.entries(data.eventNameCounts).sort((a, b) => b[1] - a[1])
                  const maxVal = entries[0]?.[1] ?? 1
                  return entries.map(([name, count], i) => (
                    <tr key={name} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-4 py-1.5 font-mono text-gray-700">{name}</td>
                      <td className="px-4 py-1.5 text-right font-mono text-gray-800 font-semibold">{count}</td>
                      <td className="px-4 py-1.5">
                        <div className="w-full bg-gray-100 rounded-full h-2">
                          <div
                            className="bg-blue-500 h-2 rounded-full"
                            style={{ width: `${(count / maxVal) * 100}%` }}
                          />
                        </div>
                      </td>
                    </tr>
                  ))
                })()}
                <tr>
                  <td colSpan={3}><div className="border-t-2 border-gray-800" /></td>
                </tr>
              </tbody>
            </table>
          </div>
        </Section>

        {/* ── Sessions ──────────────────────────────────────────────────── */}
        <Section id="sessions" title="Sessions">
          <div className="flex items-center gap-4 mb-4">
            <button
              onClick={() => setShowSessions((v) => !v)}
              className="text-[13px] border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 rounded px-4 py-1.5 transition font-medium"
            >
              {showSessions ? '▲ Hide' : '▼ Expand'} {data.sessionDetail.length} sessions
            </button>
            <span className="text-[12px] text-gray-400">
              {data.sessionDetail.filter((s) => !s.isBot && s.completed).length} real completed ·{' '}
              {data.sessionDetail.filter((s) => s.isBot).length} bots excluded
            </span>
          </div>
          {showSessions && (
            <PaperTable
              caption={`Table 5. Per-Session Raw Data (N = ${data.sessionDetail.filter((s) => !s.isBot).length} real sessions)`}
              note="Nav Lag and Task Time in seconds. Bot sessions shown in gray."
              headers={[
                'Cond.', 'Participant ID', 'Bot', 'Completed',
                'Nav Lag (s)', 'Task Time (s)', 'Banner', 'Events',
              ]}
              rows={[...data.sessionDetail]
                .filter((s) => !s.isBot)
                .sort((a, b) => a.condition.localeCompare(b.condition))
                .map((s) => [
                  <CondTag key="c" cond={s.condition} />,
                  <span key="p" className="font-mono text-[11px] text-gray-500">{s.participantId.substring(0, 12)}…</span>,
                  s.isBot ? <span key="bot" className="text-red-500 font-semibold text-[11px]">BOT</span> : '',
                  s.completed
                    ? <span key="y" className="text-green-700 font-semibold text-[12px]">✓</span>
                    : <span key="n" className="text-gray-400 text-[12px]">—</span>,
                  <span key="nl" className="font-mono">{f1(s.navLagS)}</span>,
                  <span key="td" className="font-mono">{f1(s.s2DurS)}</span>,
                  s.bannerTapped
                    ? <span key="bt" className="text-blue-700 font-semibold text-[12px]">✓</span>
                    : <span key="bn" className="text-gray-300 text-[12px]">—</span>,
                  s.eventCount,
                ])}
            />
          )}
        </Section>

      </div>
    </div>
  )
}
