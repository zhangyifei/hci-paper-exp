'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import type { Condition } from '@/lib/experiment-config'
import { CONDITIONS, getConditionConfig } from '@/lib/experiment-config'
import { logger } from '@/lib/logger'
import ExperimentFlow from '@/components/ExperimentFlow'

export default function ExperimentPage() {
  const params = useParams()
  const condition = params.condition as Condition
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!CONDITIONS.includes(condition)) {
      setError(`Invalid condition: ${condition}`)
      return
    }

    // Read session params from sessionStorage (set by landing page)
    const participantId = sessionStorage.getItem('prolific_pid') ?? 'anonymous'
    const expSessionId = sessionStorage.getItem('exp_session_id') ?? crypto.randomUUID()
    const prolificStudyId = sessionStorage.getItem('study_id') ?? undefined
    const prolificSessionId = sessionStorage.getItem('session_id_prolific') ?? undefined

    logger.init({
      sessionId: expSessionId,
      participantId,
      condition,
      prolificStudyId: prolificStudyId || undefined,
      prolificSessionId: prolificSessionId || undefined,
    })

    setReady(true)

    return () => {
      logger.destroy()
    }
  }, [condition])

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen p-8 text-center">
        <p className="text-red-500 text-sm">{error}</p>
      </div>
    )
  }

  if (!ready) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="w-8 h-8 border-4 border-black border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const config = getConditionConfig(condition)
  return <ExperimentFlow condition={condition} config={config} />
}
