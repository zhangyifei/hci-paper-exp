'use client'

import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import type { Condition } from '@/lib/experiment-config'
import { CONDITIONS } from '@/lib/experiment-config'
import type { AssignOutcome, AssignmentStatus } from '@/lib/types'
import { Suspense } from 'react'
import StudyClosedScreen from '@/components/shared/StudyClosedScreen'

function persistAndGo(
  router: ReturnType<typeof useRouter>,
  params: { pid: string; studyId: string; sessionId: string; condition: Condition; expSessionId: string },
) {
  sessionStorage.setItem('prolific_pid', params.pid)
  sessionStorage.setItem('study_id', params.studyId)
  sessionStorage.setItem('session_id_prolific', params.sessionId)
  sessionStorage.setItem('condition', params.condition)
  sessionStorage.setItem('exp_session_id', params.expSessionId)
  router.replace(`/experiment/${params.condition}`)
}

function LandingInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [blocked, setBlocked] = useState<'full' | 'closed' | 'already' | null>(null)
  const [phase, setPhase] = useState<'init' | 'passcode' | 'loading'>('init')
  const [passcode, setPasscode] = useState('')
  const [gateError, setGateError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const assignAndGo = useCallback(async () => {
    setPhase('loading')
    const pid = searchParams.get('PROLIFIC_PID') ?? `anon_${crypto.randomUUID().slice(0, 8)}`
    const studyId = searchParams.get('STUDY_ID') ?? ''
    const sessionId = searchParams.get('SESSION_ID') ?? ''
    const expSessionId = crypto.randomUUID()
    try {
      const res = await fetch('/api/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pid, studyId, sessionId, expSessionId }),
      })
      const data: {
        outcome: AssignOutcome
        condition: Condition | null
        status: AssignmentStatus | null
      } = await res.json()

      // A participant who already finished or was invalidated cannot retake the test.
      if (
        data.outcome === 'existing' &&
        (data.status === 'completed' || data.status === 'invalid')
      ) {
        setBlocked('already')
        return
      }
      if ((data.outcome === 'assigned' || data.outcome === 'existing') && data.condition) {
        persistAndGo(router, { pid, studyId, sessionId, condition: data.condition, expSessionId })
        return
      }
      setBlocked(data.outcome === 'full' ? 'full' : 'closed')
    } catch {
      setBlocked('closed')
    }
  }, [router, searchParams])

  useEffect(() => {
    const conditionOverride = searchParams.get('condition')

    // Explicit override (debug / E2E): bypass the passcode gate and batch system.
    if (conditionOverride && CONDITIONS.includes(conditionOverride as Condition)) {
      const pid = searchParams.get('PROLIFIC_PID') ?? `anon_${crypto.randomUUID().slice(0, 8)}`
      const studyId = searchParams.get('STUDY_ID') ?? ''
      const sessionId = searchParams.get('SESSION_ID') ?? ''
      sessionStorage.setItem('exp_debug_override', '1')
      persistAndGo(router, {
        pid,
        studyId,
        sessionId,
        condition: conditionOverride as Condition,
        expSessionId: crypto.randomUUID(),
      })
      return
    }

    sessionStorage.removeItem('exp_debug_override')

    // Passcode already cleared this session → straight to assignment.
    if (sessionStorage.getItem('gate_ok') === '1') {
      void assignAndGo()
      return
    }

    let cancelled = false
    void (async () => {
      try {
        const res = await fetch('/api/gate')
        const data: { enabled: boolean } = await res.json()
        if (cancelled) return
        if (data.enabled) {
          setPhase('passcode')
        } else {
          void assignAndGo()
        }
      } catch {
        // Fail closed: if we can't tell, ask for the code.
        if (!cancelled) setPhase('passcode')
      }
    })()

    return () => {
      cancelled = true
    }
  }, [router, searchParams, assignAndGo])

  async function submitPasscode(e: FormEvent) {
    e.preventDefault()
    if (!passcode.trim()) return
    setSubmitting(true)
    setGateError('')
    try {
      const res = await fetch('/api/gate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode }),
      })
      if (res.ok) {
        sessionStorage.setItem('gate_ok', '1')
        await assignAndGo()
      } else {
        setGateError('That access code is not correct. Please check the code on the study page.')
      }
    } catch {
      setGateError('Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (blocked) {
    return <StudyClosedScreen variant={blocked} />
  }

  if (phase === 'passcode') {
    return (
      <div className="flex items-center justify-center h-full min-h-[600px] px-6">
        <form onSubmit={submitPasscode} className="w-full max-w-sm text-center animate-fade-in">
          <h1 className="text-[22px] font-bold text-black mb-1.5">Enter access code</h1>
          <p className="text-sm text-gray-500 mb-5">
            Please enter the access code shown on the study page to begin.
          </p>
          <input
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
            placeholder="Access code"
            autoFocus
            autoComplete="off"
            className="w-full h-11 px-4 text-center tracking-wide rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-black/70"
          />
          {gateError && <p className="mt-2 text-sm text-red-600">{gateError}</p>}
          <button
            type="submit"
            disabled={submitting || !passcode.trim()}
            className="mt-4 w-full h-11 rounded-xl bg-black text-white font-bold disabled:opacity-50"
          >
            {submitting ? 'Checking…' : 'Continue'}
          </button>
        </form>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center h-full min-h-[600px]">
      <div className="text-center">
        <div className="w-8 h-8 border-4 border-black border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-sm text-gray-500">Loading experiment…</p>
      </div>
    </div>
  )
}

export default function LandingPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-full min-h-[600px]">
        <div className="w-8 h-8 border-4 border-black border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <LandingInner />
    </Suspense>
  )
}
