const { test, expect, request } = require('@playwright/test')
const fs = require('fs')
const path = require('path')

const baseURL = process.env.FQA_BASE_URL || 'http://127.0.0.1'
const l4RunId = process.env.FQA_L4_RUN_ID || 'FQA_20260718_1616_remp0008'
const runId = `${l4RunId}_ops_manage_${Date.now()}`
const manifestPath = path.join(__dirname, '..', 'docs', 'acceptance', 'full-platform-exhaustive-functional-test-v1.0', 'runs', l4RunId, 'test-data-manifest.json')

function updateManifest(objects) {
  fs.writeFileSync(manifestPath, JSON.stringify({ runId: l4RunId, objects, cleanupFailures: 0 }, null, 2) + '\n')
}

test('ops011013014015020ManageContractsWithExactCleanup', async () => {
  const api = await request.newContext({ baseURL })
  let headers
  let templateId
  let ruleId
  let holidayId
  try {
    const login = await api.post('/api/auth/login', { data: { username: 'superadmin', password: process.env.FQA_SUPERADMIN_PASSWORD } })
    expect(login.status()).toBe(200)
    headers = { Authorization: `Bearer ${(await login.json()).data.token}` }

    const template = await api.post('/api/ops-calendar/templates', { headers, data: {
      name: runId, templateType: 'notification', taskType: 'inspection',
      titleTemplate: `${runId} title`, bodyTemplate: `${runId} body`, enabled: true,
    } })
    expect(template.status()).toBe(200)
    templateId = (await template.json()).data
    updateManifest([{ caseId: 'OPS-011', type: 'ops-template', id: templateId, runId }])
    expect((await api.put(`/api/ops-calendar/templates/${templateId}`, { headers, data: {
      name: `${runId}_updated`, templateType: 'notification', taskType: 'inspection',
      titleTemplate: `${runId} updated`, bodyTemplate: `${runId} body`, enabled: false,
    } })).status()).toBe(200)
    const templates = await api.get('/api/ops-calendar/templates', { headers })
    expect((await templates.json()).data.find(item => item.id === templateId)).toMatchObject({ name: `${runId}_updated`, enabled: false })

    const ruleBody = {
      name: runId, description: runId, taskType: 'inspection', triggerType: 'daily',
      triggerConfig: { time: '09:00' }, generateDaysAhead: 0,
      dueConfig: { offsetDays: 0, time: '18:00' }, templateId,
      visibility: 'private', sensitive: false, enabled: false,
    }
    expect((await api.post('/api/ops-calendar/rules/preview', { headers, data: ruleBody })).status()).toBe(200)
    const rule = await api.post('/api/ops-calendar/rules', { headers, data: ruleBody })
    expect(rule.status()).toBe(200)
    ruleId = (await rule.json()).data
    updateManifest([{ caseId: 'OPS-011', type: 'ops-template', id: templateId, runId }, { caseId: 'OPS-013', type: 'ops-rule', id: ruleId, runId }])
    const referencedTemplateDelete = await api.delete(`/api/ops-calendar/templates/${templateId}`, { headers })
    if (referencedTemplateDelete.status() === 200) templateId = undefined
    expect(referencedTemplateDelete.status()).toBe(400)
    expect((await api.put(`/api/ops-calendar/rules/${ruleId}`, { headers, data: { ...ruleBody, name: `${runId}_updated` } })).status()).toBe(200)
    const rules = await api.get('/api/ops-calendar/rules', { headers })
    expect((await rules.json()).data.find(item => item.id === ruleId)).toMatchObject({ name: `${runId}_updated`, enabled: false })
    for (const invalidRule of [
      { ...ruleBody, name: '', triggerType: 'invalid' },
      { ...ruleBody, generateDaysAhead: 367 },
      { ...ruleBody, dueConfig: { offsetDays: -1, time: '08:00' } },
    ]) expect((await api.post('/api/ops-calendar/rules', { headers, data: invalidRule })).status()).toBe(400)

    const holiday = await api.post('/api/ops-calendar/holidays', { headers, data: {
      name: runId, startDate: '2030-01-02', endDate: '2030-01-03', holidayType: 'company',
      workdayOverrides: '["2030-01-05"]', enabled: true, remark: runId,
    } })
    expect(holiday.status()).toBe(200)
    holidayId = (await holiday.json()).data.id
    updateManifest([{ caseId: 'OPS-011', type: 'ops-template', id: templateId, runId }, { caseId: 'OPS-013', type: 'ops-rule', id: ruleId, runId }, { caseId: 'OPS-015', type: 'ops-holiday', id: holidayId, runId }])
    expect((await api.put(`/api/ops-calendar/holidays/${holidayId}`, { headers, data: {
      name: `${runId}_updated`, startDate: '2030-01-02', endDate: '2030-01-04', holidayType: 'company', workdayOverrides: '[]', enabled: false, remark: runId,
    } })).status()).toBe(200)
    expect((await api.post('/api/ops-calendar/holidays', { headers, data: {
      name: `${runId}_invalid`, startDate: '2030-01-04', endDate: '2030-01-02', holidayType: 'company', enabled: true,
    } })).status()).toBe(400)
  } finally {
    if (holidayId) expect((await api.delete(`/api/ops-calendar/holidays/${holidayId}`, { headers })).status()).toBe(200)
    if (ruleId) expect((await api.delete(`/api/ops-calendar/rules/${ruleId}`, { headers })).status()).toBe(200)
    if (templateId) expect((await api.delete(`/api/ops-calendar/templates/${templateId}`, { headers })).status()).toBe(200)
    updateManifest([])
    await api.dispose()
  }
})
