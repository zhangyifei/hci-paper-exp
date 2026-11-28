import { expect, test } from '@playwright/test'
import {
  EVENT_UPLOAD_MAX_BYTES,
  eventUploadBodyBytes,
  splitEventUploadChunks,
  type ExperimentEvent,
} from '../../lib/logger'

function event(sequenceId: number, payloadSize = 800): ExperimentEvent {
  return {
    eventName: 'survey.item_answered',
    eventId: `00000000-0000-4000-8000-${String(sequenceId).padStart(12, '0')}`,
    sessionId: '10000000-0000-4000-8000-000000000000',
    participantId: '6a08c54900faffdc114eb097',
    sequenceId,
    flow: 'survey',
    state: 'survey_active',
    timestamp: 1_795_820_400_000 + sequenceId,
    clientMonoMs: sequenceId,
    payload: { response: 'x'.repeat(payloadSize) },
    condition: 'G2',
    prolificStudyId: '6b05fc967abaa54d5fd0da66',
    prolificSessionId: '6b09d72e5f04b3b1216e700f',
  }
}

test.describe('event upload chunking', () => {
  test('keeps a large completion trail below the browser keepalive limit', () => {
    const events = Array.from({ length: 100 }, (_, index) => event(index))
    expect(eventUploadBodyBytes(events)).toBeGreaterThan(64 * 1024)

    const chunks = splitEventUploadChunks(events)
    expect(chunks.length).toBeGreaterThan(1)
    expect(chunks.flat().map((item) => item.eventId)).toEqual(
      events.map((item) => item.eventId),
    )
    for (const chunk of chunks) {
      expect(eventUploadBodyBytes(chunk)).toBeLessThanOrEqual(EVENT_UPLOAD_MAX_BYTES)
    }
  })

  test('preserves an individually oversized event for a normal fetch', () => {
    const oversized = event(1, EVENT_UPLOAD_MAX_BYTES * 2)
    const chunks = splitEventUploadChunks([oversized])

    expect(chunks).toEqual([[oversized]])
    expect(eventUploadBodyBytes(chunks[0])).toBeGreaterThan(EVENT_UPLOAD_MAX_BYTES)
  })
})
