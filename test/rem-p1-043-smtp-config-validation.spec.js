const { test, expect, request } = require('@playwright/test')
const { execFileSync } = require('child_process')

const baseURL = process.env.FQA_BASE_URL || 'http://127.0.0.1'
const runId = `REM_P1_043_${Date.now()}`

function mailbox() {
  return JSON.parse(execFileSync('docker', [
    'exec', 'cwgsyw-platform-mailpit-1', 'wget', '-qO-', 'http://127.0.0.1:8025/api/v1/messages',
  ], { encoding: 'utf8' }))
}

function historicalDate(offset) {
  const value = new Date()
  value.setUTCDate(value.getUTCDate() - 600 - offset)
  return value.toISOString().slice(0, 10)
}

test('smtpConfigRejectsInvalidBoundariesAndRestoresAfterMailpitDelivery', async ({ page }) => {
  test.skip(!process.env.FQA_SUPERADMIN_PASSWORD, 'FQA_SUPERADMIN_PASSWORD is required')
  const api = await request.newContext({ baseURL })
  let headers
  let before
  let reportId
  let smtpChanged = false
  try {
    const login = await api.post('/api/auth/login', { data: { username: 'superadmin', password: process.env.FQA_SUPERADMIN_PASSWORD } })
    expect(login.status()).toBe(200)
    headers = { Authorization: `Bearer ${(await login.json()).data.token}` }
    before = (await (await api.get('/api/admin/config', { headers })).json()).data
    expect(before['smtp.password']).not.toBe('••••••••')

    const invalidPayloads = [
      { host: 'bad host with spaces' },
      { host: 'https://smtp.example.test' },
      { host: 'smtp.example.test/path' },
      { port: 0 },
      { port: 65536 },
      { from: 'not-an-email' },
      { host: 'a'.repeat(254) },
    ]
    for (const payload of invalidPayloads) {
      expect((await api.put('/api/admin/config/smtp', { headers, data: payload })).status(), JSON.stringify(payload)).toBe(400)
    }
    const afterInvalid = (await (await api.get('/api/admin/config', { headers })).json()).data
    for (const key of ['smtp.enabled', 'smtp.host', 'smtp.port', 'smtp.username', 'smtp.password', 'smtp.from', 'smtp.from_name', 'smtp.ssl']) {
      expect(afterInvalid[key], key).toBe(before[key])
    }

    await page.goto(`${baseURL}/login`)
    await page.locator('#username').fill('superadmin')
    await page.locator('#password').fill(process.env.FQA_SUPERADMIN_PASSWORD)
    await page.getByRole('button', { name: '登录', exact: true }).click()
    await page.waitForURL(`${baseURL}/`)
    const consoleErrors = []
    const smtpResponses = []
    page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()) })
    page.on('response', (response) => {
      if (response.url().endsWith('/api/admin/config/smtp') && response.request().method() === 'PUT') {
        smtpResponses.push(response)
      }
    })
    await page.goto(`${baseURL}/admin/config`)
    await expect(page.getByRole('heading', { name: '邮件服务 (SMTP)' })).toBeVisible()
    const smtpInputs = page.locator('input')
    await smtpInputs.nth(1).fill('bad host with spaces')
    await page.getByRole('button', { name: '保存 SMTP 配置' }).click()
    await expect.poll(() => smtpResponses.length).toBe(1)
    await expect(page.getByText('SMTP 配置已保存')).toHaveCount(0)
    expect(smtpResponses[0].status()).toBe(400)
    expect((await smtpResponses[0].json()).message).toBe('SMTP 主机名格式不正确')
    expect(consoleErrors.filter((message) => !message.includes('server responded with a status of 400'))).toEqual([])

    expect((await api.put('/api/admin/config/smtp', {
      headers,
      data: { enabled: true, host: 'mailpit', port: 1025, username: '', password: '', from: 'fixture@example.test', fromName: 'FQA Fixture', ssl: false },
    })).status()).toBe(200)
    smtpChanged = true
    const beforeMailbox = mailbox()
    for (let offset = 0; offset < 31; offset += 1) {
      const create = await api.post('/api/daily-reports', {
        headers,
        data: { reportDate: historicalDate(offset), groupId: 1, completedItems: `${runId} complete`, issues: `${runId} issues`, tomorrowPlan: `${runId} plan`, workHours: 1 },
      })
      if (create.status() === 200) {
        reportId = (await create.json()).data.id
        break
      }
      expect(create.status()).toBe(400)
    }
    expect(reportId).toBeTruthy()
    expect((await api.post(`/api/daily-reports/${reportId}/submit`, { headers })).status()).toBe(200)
    await expect.poll(() => {
      const current = mailbox()
      return current.total > beforeMailbox.total && current.messages.some((message) =>
        message.Subject === '日报待审批' && message.From?.Address === 'fixture@example.test')
    }, { timeout: 15000 }).toBe(true)
  } finally {
    if (headers && before && smtpChanged) {
      await api.put('/api/admin/config/smtp', {
        headers,
        data: {
          enabled: before['smtp.enabled'] === 'true', host: before['smtp.host'], port: Number(before['smtp.port']),
          username: before['smtp.username'], password: before['smtp.password'], from: before['smtp.from'],
          fromName: before['smtp.from_name'], ssl: before['smtp.ssl'] === 'true',
        },
      })
    }
    if (headers && reportId) {
      await api.delete(`/api/daily-reports/${reportId}/remediation-test?remediationRunId=${encodeURIComponent(runId)}`, { headers })
    }
    await api.dispose()
  }
})
