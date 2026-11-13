import { beforeEach, expect, test } from '@playwright/test'

import {
  dataQualityTracker,
  RAPID_RESPONSE_THRESHOLD_MS,
} from '../../lib/data-quality'

beforeEach(() => {
  dataQualityTracker.reset()
})

test.describe('Data-quality assessment', () => {
  test('flags a single repeated scale value without treating it as a payment failure', () => {
    dataQualityTracker.startPage(0)
    for (let index = 0; index < 30; index += 1) {
      dataQualityTracker.recordResponse(`Q${index + 1}`, 2, (index + 1) * 1_500, true)
    }

    const assessment = dataQualityTracker.assess()
    expect(assessment.flagged).toBe(true)
    expect(assessment.reasons).toEqual(['straightlining'])
    expect(assessment.metrics.distinctScaleValues).toBe(1)
  })

  test('flags when at least 80 percent of first responses are under one second', () => {
    dataQualityTracker.startPage(0)
    let now = 0
    for (let index = 0; index < 30; index += 1) {
      now += index < 24 ? RAPID_RESPONSE_THRESHOLD_MS - 100 : 1_500
      dataQualityTracker.recordResponse(`Q${index + 1}`, (index % 5) + 1, now, true)
    }

    const assessment = dataQualityTracker.assess()
    expect(assessment.flagged).toBe(true)
    expect(assessment.reasons).toEqual(['rapid_responses'])
    expect(assessment.metrics.rapidResponseRatio).toBe(0.8)
  })

  test('does not flag varied responses completed above the speed threshold', () => {
    dataQualityTracker.startPage(0)
    for (let index = 0; index < 30; index += 1) {
      dataQualityTracker.recordResponse(
        `Q${index + 1}`,
        (index % 7) + 1,
        (index + 1) * 1_500,
        true,
      )
    }

    expect(dataQualityTracker.assess().flagged).toBe(false)
  })
})
