import { test, expect } from '@playwright/test'
import { assignCondition } from '../../../lib/assignment'

/**
 * Unit-style tests for between-subjects assignment logic.
 * Run via Playwright's test runner (no browser needed — pure logic).
 */
test.describe('Assignment — between-subjects condition assignment', () => {
  test('returns a valid condition for any PID', () => {
    const conditions = ['G1', 'G2', 'G3', 'G4']
    const testPIDs = [
      'abc123',
      'PROLIFIC_001',
      'TEST_USER',
      '60f4c2d8e3b2a1f0c9d8e7b6',
      'participant_xyz',
    ]
    for (const pid of testPIDs) {
      const condition = assignCondition(pid)
      expect(conditions).toContain(condition)
    }
  })

  test('assignment is stable (same PID always gets same condition)', () => {
    const pid = 'stable_test_participant'
    const first = assignCondition(pid)
    for (let i = 0; i < 10; i++) {
      expect(assignCondition(pid)).toBe(first)
    }
  })

  test('condition override is respected', () => {
    expect(assignCondition('any_pid', 'G1')).toBe('G1')
    expect(assignCondition('any_pid', 'G2')).toBe('G2')
    expect(assignCondition('any_pid', 'G3')).toBe('G3')
    expect(assignCondition('any_pid', 'G4')).toBe('G4')
  })

  test('invalid override falls back to hash assignment', () => {
    const conditions = ['G1', 'G2', 'G3', 'G4']
    const result = assignCondition('test_pid', 'INVALID')
    expect(conditions).toContain(result)
  })

  test('distribution across 100 participants is roughly balanced', () => {
    const counts: Record<string, number> = { G1: 0, G2: 0, G3: 0, G4: 0 }
    for (let i = 0; i < 100; i++) {
      const pid = `participant_${i}`
      const condition = assignCondition(pid)
      counts[condition]++
    }
    // Each condition should have at least 15 and at most 35 out of 100
    for (const count of Object.values(counts)) {
      expect(count).toBeGreaterThanOrEqual(15)
      expect(count).toBeLessThanOrEqual(35)
    }
  })
})

test.describe('API — /api/assign endpoint', () => {
  test('returns a valid condition for a test PID', async ({ request }) => {
    const response = await request.get('/api/assign?pid=TEST_USER_001')
    expect(response.status()).toBe(200)
    const body = await response.json()
    expect(['G1', 'G2', 'G3', 'G4']).toContain(body.condition)
    expect(body.pid).toBe('TEST_USER_001')
  })

  test('condition override via query param works', async ({ request }) => {
    const response = await request.get('/api/assign?pid=TEST&condition=G3')
    expect(response.status()).toBe(200)
    const body = await response.json()
    expect(body.condition).toBe('G3')
  })
})

test.describe('API — /api/events endpoint', () => {
  test('POST with empty events array returns ok', async ({ request }) => {
    const response = await request.post('/api/events', {
      data: { events: [] },
    })
    expect(response.status()).toBe(200)
    const body = await response.json()
    expect(body.ok).toBe(true)
    expect(body.inserted).toBe(0)
  })

  test('POST with malformed body returns 400', async ({ request }) => {
    const response = await request.post('/api/events', {
      data: { notEvents: 'bad' },
    })
    expect(response.status()).toBe(400)
  })
})
