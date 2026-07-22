const { test, expect, request } = require('@playwright/test')

const baseURL = process.env.FQA_BASE_URL || 'http://127.0.0.1'
const runId = `REM_P1_047_${Date.now()}`

async function login(api) {
  const response = await api.post('/api/auth/login', {
    data: { username: 'superadmin', password: process.env.FQA_SUPERADMIN_PASSWORD },
  })
  expect(response.status()).toBe(200)
  return { Authorization: `Bearer ${(await response.json()).data.token}` }
}

async function detail(api, headers, taskId) {
  const response = await api.get(`/api/ops-calendar/tasks/${taskId}`, { headers })
  expect(response.status()).toBe(200)
  return (await response.json()).data
}

async function auditCount(api, headers, taskId) {
  const response = await api.get('/api/audit-logs', {
    headers,
    params: { module: 'ops_calendar', keyword: String(taskId), page: 1, size: 100 },
  })
  expect(response.status()).toBe(200)
  const data = (await response.json()).data
  return data.records.filter((record) => record.targetType === 'ops_schedule_task' && record.targetId === taskId).length
}

test.describe.serial('REM-P1-047 ops task title boundaries', () => {
  test.skip(!process.env.FQA_SUPERADMIN_PASSWORD, 'FQA_SUPERADMIN_PASSWORD is required')

  test('api accepts 255 and rejects blank or 256 before writes', async () => {
    const api = await request.newContext({ baseURL })
    let headers
    let taskId
    try {
      headers = await login(api)
      const createTitle = '任'.repeat(255)
      const created = await api.post('/api/ops-calendar/tasks', {
        headers,
        data: {
          title: createTitle,
          content: `remediationRunId=${runId}`,
          taskType: 'inspection',
          visibility: 'private',
        },
      })
      expect(created.status()).toBe(200)
      taskId = (await created.json()).data
      expect((await detail(api, headers, taskId)).task.title).toBe(createTitle)

      const updateTitle = '😀'.repeat(255)
      const updated = await api.put(`/api/ops-calendar/tasks/${taskId}`, {
        headers,
        data: { title: updateTitle },
      })
      expect(updated.status()).toBe(200)
      expect((await detail(api, headers, taskId)).task.title).toBe(updateTitle)
      const auditsBeforeInvalid = await auditCount(api, headers, taskId)

      for (const title of ['   ', '😀'.repeat(256)]) {
        const rejected = await api.put(`/api/ops-calendar/tasks/${taskId}`, {
          headers,
          data: { title },
        })
        expect(rejected.status()).toBe(400)
        expect((await detail(api, headers, taskId)).task.title).toBe(updateTitle)
      }
      expect(await auditCount(api, headers, taskId)).toBe(auditsBeforeInvalid)

      const overlengthCreate = await api.post('/api/ops-calendar/tasks', {
        headers,
        data: {
          title: '😀'.repeat(256),
          content: `remediationRunId=${runId}`,
          taskType: 'inspection',
          visibility: 'private',
        },
      })
      expect(overlengthCreate.status()).toBe(400)
    } finally {
      if (headers && taskId) {
        const cleanup = await api.delete(`/api/ops-calendar/tasks/${taskId}/remediation-test`, {
          headers,
          params: { remediationRunId: runId },
        })
        expect(cleanup.status()).toBe(200)
        expect((await api.get(`/api/ops-calendar/tasks/${taskId}`, { headers })).status()).toBe(400)
      }
      await api.dispose()
    }
  })

  test('ui counts Unicode and blocks overlength without POST', async ({ page }) => {
    const createRequests = []
    const pageErrors = []
    page.on('pageerror', (error) => pageErrors.push(error.message))
    page.on('request', (outgoing) => {
      if (outgoing.method() === 'POST' && new URL(outgoing.url()).pathname === '/api/ops-calendar/tasks') {
        createRequests.push(outgoing.url())
      }
    })

    await page.goto(`${baseURL}/login`)
    await page.locator('#username').fill('superadmin')
    await page.locator('#password').fill(process.env.FQA_SUPERADMIN_PASSWORD)
    await page.getByRole('button', { name: '登录', exact: true }).click()
    await page.waitForURL(`${baseURL}/`)
    await page.goto(`${baseURL}/ops-calendar`)
    await expect(page.getByRole('heading', { name: '运维日历', exact: true })).toBeVisible()
    await page.getByRole('button', { name: '新建任务', exact: true }).click()
    await page.getByPlaceholder('如：节前数据库巡检').fill('😀'.repeat(256))
    await expect(page.locator('#ops-task-title-count')).toHaveText('256/255')
    await page.getByRole('button', { name: '创建', exact: true }).click()
    await expect(page.getByText('标题不能超过 255 个字符', { exact: true })).toBeVisible()

    expect(createRequests).toEqual([])
    expect(pageErrors).toEqual([])
  })
})
