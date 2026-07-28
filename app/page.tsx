'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import type { Condition } from '@/lib/experiment-config'
import { CONDITIONS } from '@/lib/experiment-config'
import type { AssignOutcome } from '@/lib/types'
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
  const [blocked, setBlocked] = useState<'full' | 'closed' | null>(null)

  useEffect(() => {
    const pid = searchParams.get('PROLIFIC_PID') ?? `anon_${crypto.randomUUID().slice(0, 8)}`
    const studyId = searchParams.get('STUDY_ID') ?? ''
    const sessionId = searchParams.get('SESSION_ID') ?? ''
    const conditionOverride = searchParams.get('condition')
    const expSessionId = crypto.randomUUID()

    // Explicit override (debug / E2E): bypass the batch system entirely.
    if (conditionOverride && CONDITIONS.includes(conditionOverride as Condition)) {
      persistAndGo(router, {
        pid,
        studyId,
        sessionId,
        condition: conditionOverride as Condition,
        expSessionId,
      })
      return
    }

    let cancelled = false
    void (async () => {
      try {
        const res = await fetch('/api/assign', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pid, studyId, sessionId, expSessionId }),
        })
        const data: { outcome: AssignOutcome; condition: Condition | null } = await res.json()
        if (cancelled) return

        if ((data.outcome === 'assigned' || data.outcome === 'existing') && data.condition) {
          persistAndGo(router, { pid, studyId, sessionId, condition: data.condition, expSessionId })
          return
        }
        setBlocked(data.outcome === 'full' ? 'full' : 'closed')
      } catch {
        if (!cancelled) setBlocked('closed')
      }
    })()

    return () => {
      cancelled = true
    }
  }, [router, searchParams])

  if (blocked) {
    return <StudyClosedScreen variant={blocked} />
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
