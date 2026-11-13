import { expect, test } from '@playwright/test'

import { evaluateOutcome, RELEVANT_EVENTS } from '../../lib/session-eval'

test.describe('Session outcome evaluation', () => {
  test('a timeout is always a failed outcome', () => {
    expect(evaluateOutcome(['experiment.timed_out'])).toBe('failed')
    expect(
      evaluateOutcome([
        'experiment.timed_out',
        'experiment.completed',
        'service2.task.complete',
        'survey.completed',
        'questionnaire.completed',
      ]),
    ).toBe('failed')
    expect(RELEVANT_EVENTS).toContain('experiment.timed_out')
  })
})
