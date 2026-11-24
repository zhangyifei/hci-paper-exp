import { expect, test } from '@playwright/test'
import {
  completeWithResearcherCode,
  researcherCompletionCode,
  uniqueProlificId,
} from '../../lib/prolific-completion'

const STUDY_ID = '6b05fc967abaa54d5fd0da66'
const SUBMISSION_ID = '6afa22a4d1d094651d61d974'
const participantCode = {
  code: 'VALID12',
  actor: 'participant',
  code_type: 'COMPLETED',
  actions: [{ action: 'MANUALLY_REVIEW' }],
}
const researcherCode = {
  code: 'SERVER12',
  actor: 'researcher',
  code_type: 'COMPLETED',
  actions: [{ action: 'MANUALLY_REVIEW' }],
}

test.describe('Prolific server completion', () => {
  test('uses the researcher code from the matching study', async () => {
    const transitions: { submissionId: string; code: string }[] = []
    const result = await completeWithResearcherCode(SUBMISSION_ID, STUDY_ID, {
      loadCodes: async (studyId) => {
        expect(studyId).toBe(STUDY_ID)
        return [participantCode, researcherCode]
      },
      complete: async (submissionId, code) => {
        transitions.push({ submissionId, code })
      },
    })

    expect(result).toBe(true)
    expect(transitions).toEqual([{ submissionId: SUBMISSION_ID, code: 'SERVER12' }])
  })

  test('does not complete with a participant-only code or automatic action', async () => {
    let transitions = 0
    const result = await completeWithResearcherCode(SUBMISSION_ID, STUDY_ID, {
      loadCodes: async () => [
        participantCode,
        { ...researcherCode, actions: [{ action: 'AUTOMATICALLY_APPROVE' }] },
      ],
      complete: async () => {
        transitions += 1
      },
    })

    expect(result).toBe(false)
    expect(transitions).toBe(0)
  })

  test('does not choose an ambiguous researcher path', () => {
    expect(researcherCompletionCode([researcherCode, { ...researcherCode, code: 'OTHER' }]))
      .toBeNull()
  })

  test('does not call Prolific when the study or submission identity is invalid', async () => {
    let lookups = 0
    const dependencies = {
      loadCodes: async () => {
        lookups += 1
        return [researcherCode]
      },
      complete: async () => {},
    }
    expect(await completeWithResearcherCode(SUBMISSION_ID, null, dependencies)).toBe(false)
    expect(await completeWithResearcherCode('{{%SESSION_ID%}}', STUDY_ID, dependencies)).toBe(false)
    expect(lookups).toBe(0)
  })

  test('requires consistent stored Prolific identifiers', () => {
    expect(uniqueProlificId([null, STUDY_ID, STUDY_ID])).toBe(STUDY_ID)
    expect(uniqueProlificId([STUDY_ID, SUBMISSION_ID])).toBeNull()
    expect(uniqueProlificId([STUDY_ID, '{{%STUDY_ID%}}'])).toBeNull()
  })
})
