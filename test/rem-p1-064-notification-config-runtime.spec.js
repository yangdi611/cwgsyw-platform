const { test, expect, request } = require('@playwright/test')
const fs = require('fs')
const path = require('path')

const baseURL = process.env.FQA_BASE_URL || 'http://127.0.0.1'
const runId = `REM_P1_064_RUNTIME_${Date.now()}`
const evidenceDir = process.env.FQA_REM_P1_064_RUNTIME_EVIDENCE_DIR || '/tmp/rem-p1-064-l3-runtime-r1'

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

function isoDate(date) {
  return date.toISOString().slice(0, 10)
}

test('remP1064FormalSchedulerUsesConfiguredTemplateForOneTestRecipient', async () => {
  test.skip(!process.env.FQA_SUPERADMIN_PASSWORD, 'FQA_SUPERADMIN_PASSWORD is required')
  test.setTimeout(180_000)

  const api = await request.newContext({ baseURL })
  let headers
  let userId
  let configBefore
  let ruleBefore
  let taskIds = []
  let changed = false
  let cleanupFailure

  fs.mkdirSync(evidenceDir, { recursive: true })
  fs.writeFileSync(path.join(evidenceDir, 'manifest.json'), `${JSON.stringify({ runId, objects: [], cleanupFailures: 0 }, null, 2)}\n`)

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

    const startDate = new Date()
    const endDate = new Date(startDate.getTime() + 2 * 24 * 60 * 60 * 1000)
    const taskParams = { startDate: isoDate(startDate), endDate: isoDate(endDate), taskType: 'daily_report' }
    const tasksBefore = (await (await api.get('/api/ops-calendar/tasks', { headers, params: taskParams })).json()).data
    const taskIdsBefore = new Set(tasksBefore.map((task) => task.id))
    const noticesBefore = (await (await api.get('/api/notifications', { headers, params: { page: 1, size: 100 } })).json()).data.records
    const noticeIdsBefore = new Set(noticesBefore.map((notice) => notice.id))

    const now = new Date()
    const nextMinute = new Date(now.getTime() + (now.getUTCSeconds() < 25 ? 60_000 : 120_000))
    nextMinute.setUTCSeconds(0, 0)
    const cron = `0 ${nextMinute.getUTCMinutes()} ${nextMinute.getUTCHours()} * * *`
    const template = `${runId} 请在 {calendarDate} 提交 {taskTitle}`

    expect((await api.post(`/api/ops-calendar/rules/${ruleBefore.id}/disable`, { headers })).status()).toBe(200)
    expect((await api.put(`/api/ops-calendar/rules/${ruleBefore.id}`, {
      headers,
      data: writableRule(ruleBefore, {
        triggerType: 'cron',
        triggerConfig: { expression: cron },
        generateDaysAhead: 1,
        reminderConfig: { ...ruleBefore.reminderConfig, bodyTemplate: template },
        dueConfig: { offsetDays: 1, time: '23:59' },
        assigneeRule: { type: 'fixed', userId },
        recipientRule: { type: 'assignee' },
      }),
    })).status()).toBe(200)
    changed = true

    const enable = await api.put('/api/admin/config/notification', {
      headers,
      data: { reminderEnabled: true, reminderCron: cron, reminderTemplate: template },
    })
    expect(enable.status()).toBe(200)

    await expect.poll(async () => {
      const tasks = (await (await api.get('/api/ops-calendar/tasks', { headers, params: taskParams })).json()).data
      taskIds = tasks.filter((task) => task.ruleId === ruleBefore.id && !taskIdsBefore.has(task.id)).map((task) => task.id)
      return taskIds.length
    }, { timeout: 130_000, intervals: [1_000, 2_000, 5_000] }).toBeGreaterThan(0)

    fs.writeFileSync(path.join(evidenceDir, 'manifest.json'), `${JSON.stringify({
      runId,
      objects: taskIds.map((id) => ({ type: 'ops-task', id, cleanup: 'product-api-remediation-test' })),
      cleanupFailures: 0,
    }, null, 2)}\n`)

    let notification
    await expect.poll(async () => {
      const notices = (await (await api.get('/api/notifications', { headers, params: { page: 1, size: 100 } })).json()).data.records
      notification = notices.find((notice) => !noticeIdsBefore.has(notice.id)
        && notice.refType === 'ops_task' && taskIds.includes(notice.refId))
      return notification?.content || ''
    }, { timeout: 30_000, intervals: [500, 1_000] }).toContain(runId)
    expect(notification.content).not.toContain('{calendarDate}')
    expect(notification.content).not.toContain('{taskTitle}')

    fs.writeFileSync(path.join(evidenceDir, 'result.json'), `${JSON.stringify({
      runId,
      cron,
      taskIds,
      notification: {
        id: notification.id,
        refType: notification.refType,
        refId: notification.refId,
        content: notification.content,
      },
    }, null, 2)}\n`)
  } finally {
    try {
      if (headers && taskIds.length) {
        for (const id of taskIds) {
          expect((await api.delete(`/api/ops-calendar/tasks/${id}/remediation-test`, {
            headers,
            params: { remediationRunId: runId },
          })).status()).toBe(200)
        }
        taskIds = []
      }
      if (headers && configBefore && ruleBefore && changed) {
        expect((await api.put('/api/admin/config/notification', {
          headers,
          data: {
            reminderEnabled: configBefore['notify.reminder.enabled'] === 'true',
            reminderCron: configBefore['notify.reminder.cron'],
            reminderTemplate: configBefore['notify.reminder.template'],
          },
        })).status()).toBe(200)
        expect((await api.put(`/api/ops-calendar/rules/${ruleBefore.id}`, {
          headers,
          data: writableRule(ruleBefore, { assigneeRule: { type: 'fixed', userId } }),
        })).status()).toBe(200)
        if (ruleBefore.enabled) {
          expect((await api.post(`/api/ops-calendar/rules/${ruleBefore.id}/enable`, { headers })).status()).toBe(200)
        } else {
          expect((await api.post(`/api/ops-calendar/rules/${ruleBefore.id}/disable`, { headers })).status()).toBe(200)
        }
        expect((await api.put(`/api/ops-calendar/rules/${ruleBefore.id}`, {
          headers,
          data: writableRule(ruleBefore),
        })).status()).toBe(200)
      }

      if (headers) {
        const startDate = new Date()
        const endDate = new Date(startDate.getTime() + 2 * 24 * 60 * 60 * 1000)
        const tasks = (await (await api.get('/api/ops-calendar/tasks', {
          headers,
          params: { startDate: isoDate(startDate), endDate: isoDate(endDate), taskType: 'daily_report' },
        })).json()).data
        expect(tasks.some((task) => JSON.stringify(task).includes(runId))).toBe(false)
        const notices = (await (await api.get('/api/notifications', { headers, params: { page: 1, size: 100 } })).json()).data.records
        expect(notices.some((notice) => JSON.stringify(notice).includes(runId))).toBe(false)
      }
    } catch (error) {
      cleanupFailure = error
    }

    fs.writeFileSync(path.join(evidenceDir, 'manifest.json'), `${JSON.stringify({
      runId,
      objects: taskIds.map((id) => ({ type: 'ops-task', id })),
      cleanupFailures: cleanupFailure ? 1 : 0,
    }, null, 2)}\n`)
    await api.dispose()
    if (cleanupFailure) throw cleanupFailure
  }
})
