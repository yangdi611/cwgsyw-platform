const { test, expect, request } = require('@playwright/test')
const fs = require('fs')
const path = require('path')

const baseURL = process.env.FQA_BASE_URL || 'http://127.0.0.1'
const runId = `REM_P1_064_${Date.now()}`
const evidenceDir = process.env.FQA_REM_P1_064_EVIDENCE_DIR || '/tmp/rem-p1-064-l3-r1'

function formalRule(rules) {
  return rules.find((rule) => rule.taskType === 'daily_report' && rule.name === '日报未提交提醒')
}

function writableRule(rule, overrides = {}) {
  return {
    name: rule.name,
    description: rule.description,
    taskType: rule.taskType,
    triggerType: rule.triggerType,
    triggerConfig: rule.triggerConfig,
    generateDaysAhead: rule.generateDaysAhead,
    reminderConfig: rule.reminderConfig,
    dueConfig: rule.dueConfig,
    assigneeRule: rule.assigneeRule,
    recipientRule: rule.recipientRule,
    escalationRule: rule.escalationRule,
    templateId: rule.templateId,
    checklistTemplateId: rule.checklistTemplateId,
    visibility: rule.visibility,
    publicSummary: rule.publicSummary,
    sensitive: rule.sensitive,
    ...overrides,
  }
}

test('remP1064NotificationConfigControlsFormalRuleAndRestoresExactly', async ({ page }) => {
  test.skip(!process.env.FQA_SUPERADMIN_PASSWORD, 'FQA_SUPERADMIN_PASSWORD is required')
  test.setTimeout(90_000)

  const api = await request.newContext({ baseURL })
  const consoleErrors = []
  const serverFailures = []
  let headers
  let userId
  let configBefore
  let ruleBefore
  let changed = false
  let cleanupFailure

  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })
  page.on('pageerror', (error) => consoleErrors.push(error.message))
  page.on('response', (response) => {
    if (response.status() >= 500) serverFailures.push(`${response.status()} ${response.url()}`)
  })

  try {
    const login = await api.post('/api/auth/login', {
      data: { username: 'superadmin', password: process.env.FQA_SUPERADMIN_PASSWORD },
    })
    expect(login.status()).toBe(200)
    const loginData = (await login.json()).data
    userId = loginData.userId
    headers = { Authorization: `Bearer ${loginData.token}` }

    configBefore = (await (await api.get('/api/admin/config', { headers })).json()).data
    ruleBefore = formalRule((await (await api.get('/api/ops-calendar/rules', { headers })).json()).data)
    expect(ruleBefore).toBeTruthy()
    fs.mkdirSync(evidenceDir, { recursive: true })
    fs.writeFileSync(path.join(evidenceDir, 'manifest.json'), `${JSON.stringify({ runId, objects: [], cleanupFailures: 0 }, null, 2)}\n`)

    await page.goto(`${baseURL}/login`)
    await page.locator('#username').fill('superadmin')
    await page.locator('#password').fill(process.env.FQA_SUPERADMIN_PASSWORD)
    await page.getByRole('button', { name: '登录', exact: true }).click()
    await page.waitForURL(`${baseURL}/`)
    await page.goto(`${baseURL}/admin/config`)
    await page.getByRole('button', { name: '日报提醒', exact: true }).click()

    const cron = '0 7 3 * * MON-FRI'
    const template = `${runId} 请在 {calendarDate} 提交日报`
    const reminderPanel = page.getByRole('heading', { name: '日报提醒 + Prometheus 告警' }).locator('..')
    const enabledSwitch = reminderPanel.getByRole('switch', { name: '启用日报提交提醒' })
    if (await enabledSwitch.isChecked()) await enabledSwitch.click()
    await reminderPanel.getByPlaceholder('0 0 17 * * MON-FRI').fill(cron)
    await reminderPanel.getByPlaceholder('请尽快提交今日日报').fill(template)

    const saveResponse = page.waitForResponse((response) =>
      response.url().endsWith('/api/admin/config/notification') && response.request().method() === 'PUT')
    await reminderPanel.getByRole('button', { name: '保存提醒配置', exact: true }).click()
    expect((await saveResponse).status()).toBe(200)
    changed = true
    await expect(page.getByText('提醒配置已保存')).toBeVisible()

    const configAfter = (await (await api.get('/api/admin/config', { headers })).json()).data
    const rulesAfter = (await (await api.get('/api/ops-calendar/rules', { headers })).json()).data
    const ruleAfter = formalRule(rulesAfter)
    expect(rulesAfter.filter((rule) => rule.taskType === 'daily_report' && rule.name === '日报未提交提醒')).toHaveLength(1)
    expect(configAfter).toMatchObject({
      'notify.reminder.enabled': 'false',
      'notify.reminder.cron': cron,
      'notify.reminder.template': template,
    })
    expect(ruleAfter).toMatchObject({
      id: ruleBefore.id,
      enabled: false,
      triggerType: 'cron',
      triggerConfig: { expression: cron },
      description: ruleBefore.description,
    })
    expect(ruleAfter.reminderConfig).toMatchObject({
      ...ruleBefore.reminderConfig,
      bodyTemplate: template,
    })

    const preview = await api.post('/api/ops-calendar/rules/preview', {
      headers,
      data: writableRule(ruleAfter),
    })
    expect(preview.status()).toBe(200)
    expect((await preview.json()).data.length).toBeGreaterThan(0)

    const beforeInvalidConfig = (await (await api.get('/api/admin/config', { headers })).json()).data
    const beforeInvalidRule = formalRule((await (await api.get('/api/ops-calendar/rules', { headers })).json()).data)
    const invalid = await api.put('/api/admin/config/notification', {
      headers,
      data: { reminderEnabled: true, reminderCron: 'not-a-cron', reminderTemplate: `${runId}_invalid` },
    })
    expect(invalid.status()).toBe(400)
    expect((await (await api.get('/api/admin/config', { headers })).json()).data).toMatchObject({
      'notify.reminder.enabled': beforeInvalidConfig['notify.reminder.enabled'],
      'notify.reminder.cron': beforeInvalidConfig['notify.reminder.cron'],
      'notify.reminder.template': beforeInvalidConfig['notify.reminder.template'],
    })
    expect(formalRule((await (await api.get('/api/ops-calendar/rules', { headers })).json()).data)).toMatchObject({
      enabled: beforeInvalidRule.enabled,
      triggerType: beforeInvalidRule.triggerType,
      triggerConfig: beforeInvalidRule.triggerConfig,
      reminderConfig: beforeInvalidRule.reminderConfig,
    })

    fs.writeFileSync(path.join(evidenceDir, 'result.json'), `${JSON.stringify({
      runId,
      configBefore: {
        enabled: configBefore['notify.reminder.enabled'],
        cron: configBefore['notify.reminder.cron'],
        template: configBefore['notify.reminder.template'],
      },
      ruleBefore,
      configAfter: {
        enabled: configAfter['notify.reminder.enabled'],
        cron: configAfter['notify.reminder.cron'],
        template: configAfter['notify.reminder.template'],
      },
      ruleAfter,
      invalidStatus: invalid.status(),
      consoleErrors,
      serverFailures,
    }, null, 2)}\n`)
    expect(consoleErrors).toEqual([])
    expect(serverFailures).toEqual([])
  } finally {
    try {
      if (headers && configBefore && ruleBefore && changed) {
        const restoreConfig = await api.put('/api/admin/config/notification', {
          headers,
          data: {
            reminderEnabled: configBefore['notify.reminder.enabled'] === 'true',
            reminderCron: configBefore['notify.reminder.cron'],
            reminderTemplate: configBefore['notify.reminder.template'],
          },
        })
        expect(restoreConfig.status()).toBe(200)

        const restoreWithAssignable = await api.put(`/api/ops-calendar/rules/${ruleBefore.id}`, {
          headers,
          data: writableRule(ruleBefore, { assigneeRule: { type: 'fixed', userId } }),
        })
        expect(restoreWithAssignable.status()).toBe(200)
        if (ruleBefore.enabled) {
          expect((await api.post(`/api/ops-calendar/rules/${ruleBefore.id}/enable`, { headers })).status()).toBe(200)
        } else {
          expect((await api.post(`/api/ops-calendar/rules/${ruleBefore.id}/disable`, { headers })).status()).toBe(200)
        }
        expect((await api.put(`/api/ops-calendar/rules/${ruleBefore.id}`, {
          headers,
          data: writableRule(ruleBefore),
        })).status()).toBe(200)

        const restoredConfig = (await (await api.get('/api/admin/config', { headers })).json()).data
        const restoredRule = formalRule((await (await api.get('/api/ops-calendar/rules', { headers })).json()).data)
        expect(restoredConfig).toMatchObject({
          'notify.reminder.enabled': configBefore['notify.reminder.enabled'],
          'notify.reminder.cron': configBefore['notify.reminder.cron'],
          'notify.reminder.template': configBefore['notify.reminder.template'],
        })
        expect(restoredRule).toMatchObject({
          name: ruleBefore.name,
          description: ruleBefore.description,
          taskType: ruleBefore.taskType,
          enabled: ruleBefore.enabled,
          triggerType: ruleBefore.triggerType,
          triggerConfig: ruleBefore.triggerConfig,
          generateDaysAhead: ruleBefore.generateDaysAhead,
          reminderConfig: ruleBefore.reminderConfig,
          dueConfig: ruleBefore.dueConfig,
          assigneeRule: ruleBefore.assigneeRule,
          recipientRule: ruleBefore.recipientRule,
          escalationRule: ruleBefore.escalationRule,
          visibility: ruleBefore.visibility,
          sensitive: ruleBefore.sensitive,
        })
      }
    } catch (error) {
      cleanupFailure = error
    }
    fs.writeFileSync(path.join(evidenceDir, 'manifest.json'), `${JSON.stringify({
      runId,
      objects: [],
      cleanupFailures: cleanupFailure ? 1 : 0,
    }, null, 2)}\n`)
    await api.dispose()
    if (cleanupFailure) throw cleanupFailure
  }
})
