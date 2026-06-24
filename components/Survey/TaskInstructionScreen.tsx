'use client'

import React, { useEffect } from 'react'
import ResearchPage from '../shared/ResearchPage'
import type { TaskInfo } from '@/lib/experiment-config'
import { logger } from '@/lib/logger'

interface TaskInstructionScreenProps {
  task: TaskInfo
  taskNumber: number
  totalTasks: number
  onStart: () => void
}

/**
 * Full-browser research page shown immediately before each task. States the
 * task number, the participant's goal, the service to use, and the
 * information to enter — then a single clear "Start Task N" button.
 *
 * Deliberately avoids step-by-step click-by-click instructions so the
 * participant explores the Super App independently.
 */
export default function TaskInstructionScreen({
  task,
  taskNumber,
  totalTasks,
  onStart,
}: TaskInstructionScreenProps) {
  useEffect(() => {
    logger.trackEvent('task.instruction_viewed', 'task', 'task_instruction', {
      payload: { taskNumber, totalTasks, service: task.service },
    })
  }, [taskNumber, totalTasks, task.service])

  const handleStart = () => {
    logger.trackEvent('task.started', 'task', 'task_active', {
      payload: { taskNumber, totalTasks, service: task.service },
    })
    onStart()
  }

  return (
    <ResearchPage
      data-testid={`screen-task-instruction-${taskNumber}`}
      footer={
        <button
          type="button"
          onClick={handleStart}
          data-testid="btn-start-task"
          className="w-full h-[54px] rounded-[14px] bg-black text-white font-bold text-[16px] hover:bg-gray-900 active:scale-[0.98] transition-all"
        >
          Start Task {taskNumber}
        </button>
      }
    >
      <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-[12px] font-bold uppercase tracking-wider text-gray-500">
        Task {taskNumber} of {totalTasks}
      </span>

      <h1 className="mt-4 text-[26px] sm:text-[30px] font-bold tracking-tight text-black">
        {task.title}
      </h1>

      <p className="mt-3 text-[16px] leading-relaxed text-gray-600">{task.goal}</p>

      <dl className="mt-7 space-y-3">
        <div className="flex items-start gap-3 rounded-[14px] border border-gray-100 bg-gray-50 px-4 py-3.5">
          <span aria-hidden className="mt-0.5 text-[18px]">🧭</span>
          <div>
            <dt className="text-[12px] font-bold uppercase tracking-wider text-gray-400">
              Service to use
            </dt>
            <dd className="mt-0.5 text-[15px] font-semibold text-black">{task.service}</dd>
          </div>
        </div>

        <div className="flex items-start gap-3 rounded-[14px] border border-gray-100 bg-gray-50 px-4 py-3.5">
          <span aria-hidden className="mt-0.5 text-[18px]">✏️</span>
          <div>
            <dt className="text-[12px] font-bold uppercase tracking-wider text-gray-400">
              Information to enter
            </dt>
            <dd className="mt-0.5 text-[15px] font-semibold text-black">{task.infoToEnter}</dd>
          </div>
        </div>
      </dl>

      <p className="mt-6 text-[13px] leading-relaxed text-gray-400">
        Take your time and explore the app on your own. When you are ready, select
        <span className="font-semibold text-gray-500"> Start Task {taskNumber}</span>.
      </p>
    </ResearchPage>
  )
}
