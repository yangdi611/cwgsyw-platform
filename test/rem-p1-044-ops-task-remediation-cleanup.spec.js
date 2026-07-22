const { test, expect, request } = require('@playwright/test')

const baseURL = process.env.FQA_BASE_URL || 'http://127.0.0.1'
const runId = `REM_P1_044_${Date.now()}`

test('remP1044OpsTaskCleanupIsRunIdLimitedAndAudited', async ({ page }) => {
  test.skip(!process.env.FQA_SUPERADMIN_PASSWORD, 'FQA_SUPERADMIN_PASSWORD is required')
  const api = await request.newContext({ baseURL })
  let headers
  let taskId
  try {
    const login = await api.post('/api/auth/login', {
      data: { username: 'superadmin', password: process.env.FQA_SUPERADMIN_PASSWORD },
    })
    expect(login.status()).toBe(200)
    headers = { Authorization: `Bearer ${(await login.json()).data.token}` }

    const created = await api.post('/api/ops-calendar/tasks', {
      headers,
      data: {
        title: `${runId} cleanup contract`,
        taskType: 'inspection',
        content: `remediationRunId=${runId}`,
        visibility: 'private',
      },
    })
    expect(created.status()).toBe(200)
    taskId = (await created.json()).data

    const wrongRun = await api.delete(`/api/ops-calendar/tasks/${taskId}/remediation-test`, {
      headers,
      params: { remediationRunId: `${runId}_wrong` },
    })
    expect(wrongRun.status()).toBe(400)
    expect((await api.get(`/api/ops-calendar/tasks/${taskId}`, { headers })).status()).toBe(200)

    const cleanup = await api.delete(`/api/ops-calendar/tasks/${taskId}/remediation-test`, {
      headers,
      params: { remediationRunId: runId },
    })
    expect(cleanup.status()).toBe(200)
    expect((await api.get(`/api/ops-calendar/tasks/${taskId}`, { headers })).status()).toBe(400)
    expect((await api.delete(`/api/ops-calendar/tasks/${taskId}/remediation-test`, {
      headers,
      params: { remediationRunId: runId },
    })).status()).toBe(400)

    const audits = await api.get('/api/audit-logs', {
      headers,
      params: { module: 'ops_calendar', action: 'purge_remediation_test', keyword: runId, page: 1, size: 20 },
    })
    expect(audits.status()).toBe(200)
    const auditData = (await audits.json()).data
    expect(auditData.records ?? auditData).toEqual(expect.arrayContaining([
      expect.objectContaining({ targetId: taskId, action: 'purge_remediation_test' }),
    ]))

    await page.goto(`${baseURL}/login`)
    await page.locator('#username').fill('superadmin')
    await page.locator('#password').fill(process.env.FQA_SUPERADMIN_PASSWORD)
    await page.getByRole('button', { name: '登录', exact: true }).click()
    await page.waitForURL(`${baseURL}/`)
    await page.goto(`${baseURL}/ops-calendar`)
    await expect(page.getByText(runId)).toHaveCount(0)
  } finally {
    if (headers && taskId) {
      const detail = await api.get(`/api/ops-calendar/tasks/${taskId}`, { headers })
      if (detail.status() === 200) {
        await api.delete(`/api/ops-calendar/tasks/${taskId}/remediation-test`, {
          headers,
          params: { remediationRunId: runId },
        })
      }
    }
    await api.dispose()
  }
})
