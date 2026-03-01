'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { assignCondition } from '@/lib/assignment'
import type { Condition } from '@/lib/experiment-config'
import { Suspense } from 'react'

function LandingInner() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const pid = searchParams.get('PROLIFIC_PID') ?? `anon_${crypto.randomUUID().slice(0, 8)}`
    const studyId = searchParams.get('STUDY_ID') ?? ''
    const sessionId = searchParams.get('SESSION_ID') ?? ''
    const conditionOverride = searchParams.get('condition')

    const condition: Condition = assignCondition(pid, conditionOverride)

    // Persist to sessionStorage so experiment pages can read them
    sessionStorage.setItem('prolific_pid', pid)
    sessionStorage.setItem('study_id', studyId)
    sessionStorage.setItem('session_id_prolific', sessionId)
    sessionStorage.setItem('condition', condition)
    sessionStorage.setItem('exp_session_id', crypto.randomUUID())

    router.replace(`/experiment/${condition}`)
  }, [router, searchParams])

  return (
    <div className="flex items-center justify-center h-screen">
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
      <div className="flex items-center justify-center h-screen">
        <div className="w-8 h-8 border-4 border-black border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <LandingInner />
    </Suspense>
  )
}
