const { test, expect, request } = require('@playwright/test')
const fs = require('fs')
const path = require('path')

const baseURL = process.env.FQA_BASE_URL || 'http://127.0.0.1'
const runId = `REM_P1_067_${Date.now()}`
const evidenceDir = process.env.REM_P1_067_EVIDENCE_DIR
const result = { runId, reportId: null, businessKey: null, cleanupFailures: 0 }

async function workflowMatches(api, headers, businessKey) {
  const matches = []
  for (const state of ['running', 'finished']) {
    const response = await api.get(`/api/workflow/instances/${state}`, { headers, params: { page: 1, size: 200 } })
    expect(response.status()).toBe(200)
    for (const instance of (await response.json()).data.records ?? []) {
      if (instance.businessKey === businessKey) matches.push({ state, id: instance.id })
    }
  }
  return matches
}

test.afterAll(() => {
  if (!evidenceDir) return
  fs.mkdirSync(evidenceDir, { recursive: true })
  fs.writeFileSync(path.join(evidenceDir, 'result.json'), `${JSON.stringify(result, null, 2)}\n`)
})

test('remediation cleanup removes every workflow instance for the exact daily business key', async () => {
  test.skip(!process.env.FQA_SUPERADMIN_PASSWORD, 'FQA_SUPERADMIN_PASSWORD is required')
  expect(evidenceDir, 'set REM_P1_067_EVIDENCE_DIR').toBeTruthy()
  const api = await request.newContext({ baseURL })
  let headers
  try {
    const login = await api.post('/api/auth/login', { data: { username: 'superadmin', password: process.env.FQA_SUPERADMIN_PASSWORD } })
    expect(login.status()).toBe(200)
    headers = { Authorization: `Bearer ${(await login.json()).data.token}` }
    const reportDate = new Date(Date.now() - 500 * 86400000).toISOString().slice(0, 10)
    const created = await api.post('/api/daily-reports', { headers, data: {
      reportDate,
      groupId: 1,
      completedItems: `${runId} complete`,
      issues: `${runId} issues`,
      tomorrowPlan: `${runId} plan`,
      workHours: 1,
    } })
    expect(created.status()).toBe(200)
    result.reportId = (await created.json()).data.id
    result.businessKey = `daily_report:${result.reportId}`

    expect((await api.post(`/api/daily-reports/${result.reportId}/submit`, { headers })).status()).toBe(200)
    const before = await workflowMatches(api, headers, result.businessKey)
    expect(before.length).toBeGreaterThan(0)
    result.beforeCleanup = before

    expect((await api.delete(`/api/daily-reports/${result.reportId}/remediation-test`, {
      headers,
      params: { remediationRunId: runId },
    })).status()).toBe(200)
    expect((await api.get(`/api/daily-reports/${result.reportId}`, { headers })).status()).toBe(400)
    result.afterCleanup = await workflowMatches(api, headers, result.businessKey)
    expect(result.afterCleanup).toEqual([])
  } finally {
    if (result.reportId && headers) {
      const readback = await api.get(`/api/daily-reports/${result.reportId}`, { headers })
      if (readback.status() === 200) {
        const cleanup = await api.delete(`/api/daily-reports/${result.reportId}/remediation-test`, {
          headers,
          params: { remediationRunId: runId },
        })
        if (cleanup.status() !== 200) result.cleanupFailures += 1
      }
    }
    await api.dispose()
  }
})
