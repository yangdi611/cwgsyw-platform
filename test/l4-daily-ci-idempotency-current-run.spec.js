const { test, expect, request } = require('@playwright/test')
const fs = require('fs')
const path = require('path')

const baseURL = process.env.FQA_BASE_URL || 'http://127.0.0.1'
const l4RunId = process.env.FQA_L4_RUN_ID || 'FQA_20260718_2050_remp1038'
const suffix = Date.now()
const runId = `${l4RunId}_daily005009_${suffix}`
const manifestPath = path.join(__dirname, '..', 'docs', 'acceptance', 'full-platform-exhaustive-functional-test-v1.0', 'runs', l4RunId, 'test-data-manifest.json')

function updateManifest(objects) {
  fs.writeFileSync(manifestPath, JSON.stringify({ runId: l4RunId, objects, cleanupFailures: 0 }, null, 2) + '\n')
}

function historicalDate(offset) {
  const value = new Date()
  value.setUTCDate(value.getUTCDate() - 400 - offset)
  return value.toISOString().slice(0, 10)
}

async function createOnFreeDate(api, headers, marker, extra = {}) {
  for (let offset = 0; offset < 31; offset += 1) {
    const reportDate = historicalDate(offset)
    const payload = { reportDate, groupId: 1, completedItems: `${marker} complete`, issues: `${marker} issues`, tomorrowPlan: `${marker} plan`, workHours: 1, ...extra }
    const response = await api.post('/api/daily-reports', { headers, data: payload })
    if (response.status() === 200) return { report: (await response.json()).data, payload }
    expect(response.status()).toBe(400)
  }
  throw new Error('No free historical daily-report date')
}

test.describe.configure({ mode: 'serial' })

test('daily005AssociatesRemovesAndClearsCiInstances', async () => {
  test.skip(!process.env.FQA_SUPERADMIN_PASSWORD, 'FQA_SUPERADMIN_PASSWORD is required')
  const api = await request.newContext({ baseURL })
  let headers
  let reportId
  try {
    const login = await api.post('/api/auth/login', { data: { username: 'superadmin', password: process.env.FQA_SUPERADMIN_PASSWORD } })
    expect(login.status()).toBe(200)
    headers = { Authorization: `Bearer ${(await login.json()).data.token}` }
    const instances = await api.get('/api/cmdb/instances?page=1&size=20', { headers })
    expect(instances.status()).toBe(200)
    const records = (await instances.json()).data.records
    test.skip(records.length < 2, 'Two readable CI instances are required')
    const ciInstanceIds = records.slice(0, 2).map(instance => instance.id)
    const created = await createOnFreeDate(api, headers, `${runId}_ci`, { ciInstanceIds })
    reportId = created.report.id
    updateManifest([{ caseId: 'DAILY-005', type: 'daily-report', id: reportId, runId }])
    expect(created.report.ciInstanceIds).toEqual(ciInstanceIds)
    expect(created.report.ciInstances.map(instance => instance.id).sort()).toEqual([...ciInstanceIds].sort())

    expect((await api.put(`/api/daily-reports/${reportId}`, { headers, data: { ...created.payload, ciInstanceIds: [ciInstanceIds[1]] } })).status()).toBe(200)
    let readback = (await (await api.get(`/api/daily-reports/${reportId}`, { headers })).json()).data
    expect(readback.ciInstanceIds).toEqual([ciInstanceIds[1]])
    expect(readback.ciInstances.map(instance => instance.id)).toEqual([ciInstanceIds[1]])

    expect((await api.put(`/api/daily-reports/${reportId}`, { headers, data: { ...created.payload, ciInstanceIds: [] } })).status()).toBe(200)
    readback = (await (await api.get(`/api/daily-reports/${reportId}`, { headers })).json()).data
    expect(readback.ciInstanceIds).toEqual([])
    expect(readback.ciInstances ?? []).toEqual([])
  } finally {
    if (reportId) expect((await api.delete(`/api/daily-reports/${reportId}/remediation-test?remediationRunId=${encodeURIComponent(runId)}`, { headers })).status()).toBe(200)
    updateManifest([])
    await api.dispose()
  }
})

test('daily009SubmitAndApprovalDoubleActionsAreIdempotent', async () => {
  test.skip(!process.env.FQA_SUPERADMIN_PASSWORD, 'FQA_SUPERADMIN_PASSWORD is required')
  const api = await request.newContext({ baseURL })
  let headers
  let reportId
  try {
    const login = await api.post('/api/auth/login', { data: { username: 'superadmin', password: process.env.FQA_SUPERADMIN_PASSWORD } })
    expect(login.status()).toBe(200)
    headers = { Authorization: `Bearer ${(await login.json()).data.token}` }
    const created = await createOnFreeDate(api, headers, `${runId}_idempotent`)
    reportId = created.report.id
    updateManifest([{ caseId: 'DAILY-009', type: 'daily-report', id: reportId, runId }])

    const submitStatuses = await Promise.all([0, 1].map(async () => (await api.post(`/api/daily-reports/${reportId}/submit`, { headers })).status()))
    expect(submitStatuses.sort()).toEqual([200, 400])
    expect((await (await api.get(`/api/daily-reports/${reportId}`, { headers })).json()).data.status).toBe('SUBMITTED')
    const tasks = (await (await api.get('/api/workflow/tasks/group', { headers })).json()).data.filter(task => task.businessType === 'daily_report' && task.businessId === reportId)
    expect(tasks).toHaveLength(1)

    const approveStatuses = await Promise.all([0, 1].map(async () => (await api.post('/api/workflow/approve', { headers, data: { taskId: tasks[0].taskId, approved: true, comment: runId } })).status()))
    expect(approveStatuses.filter(status => status === 200)).toHaveLength(1)
    expect(approveStatuses.filter(status => status !== 200)).toHaveLength(1)
    expect((await (await api.get(`/api/daily-reports/${reportId}`, { headers })).json()).data.status).toBe('APPROVED')
  } finally {
    if (reportId) expect((await api.delete(`/api/daily-reports/${reportId}/remediation-test?remediationRunId=${encodeURIComponent(runId)}`, { headers })).status()).toBe(200)
    updateManifest([])
    await api.dispose()
  }
})
