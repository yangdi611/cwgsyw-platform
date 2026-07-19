const { test, expect, request } = require('@playwright/test')

const baseURL = process.env.FQA_BASE_URL || 'http://127.0.0.1'
const runId = `REM_P1_045_${Date.now()}`

test('remP1045RosterCrudAndRunIdCleanup', async () => {
  test.skip(!process.env.FQA_SUPERADMIN_PASSWORD, 'FQA_SUPERADMIN_PASSWORD is required')
  const api = await request.newContext({ baseURL })
  let headers
  let rosterId
  try {
    const login = await api.post('/api/auth/login', { data: { username: 'superadmin', password: process.env.FQA_SUPERADMIN_PASSWORD } })
    expect(login.status()).toBe(200)
    const loginData = (await login.json()).data
    headers = { Authorization: `Bearer ${loginData.token}` }
    const groupsBody = (await (await api.get('/api/groups?page=1&size=100', { headers })).json()).data
    const groups = groupsBody.records ?? groupsBody
    const group = groups.find(item => item.groupType === 'business' || item.group_type === 'business') ?? groups.find(item => item.id !== 1)
    expect(group).toBeTruthy()
    const dutyDate = '2098-12-30'

    const invalid = await api.post('/api/ops-calendar/rosters', {
      headers,
      data: {
        dutyDate,
        startAt: `${dutyDate}T18:00:00`,
        endAt: `${dutyDate}T09:00:00`,
        shiftName: runId,
        assigneeId: loginData.userId,
        groupId: group.id,
        remark: runId,
      },
    })
    expect(invalid.status()).toBe(400)

    const created = await api.post('/api/ops-calendar/rosters', {
      headers,
      data: {
        dutyDate,
        startAt: `${dutyDate}T09:00:00`,
        endAt: `${dutyDate}T18:00:00`,
        shiftName: `${runId}_day`,
        assigneeId: loginData.userId,
        backupAssigneeId: loginData.userId,
        phoneOverride: '13800138000',
        groupId: group.id,
        remark: runId,
      },
    })
    expect(created.status()).toBe(200)
    rosterId = (await created.json()).data.id

    const equalUpdate = await api.put(`/api/ops-calendar/rosters/${rosterId}`, {
      headers,
      data: {
        dutyDate,
        startAt: `${dutyDate}T10:00:00`,
        endAt: `${dutyDate}T10:00:00`,
        shiftName: `${runId}_invalid_update`,
        assigneeId: loginData.userId,
        groupId: group.id,
        remark: runId,
      },
    })
    expect(equalUpdate.status()).toBe(400)

    const updated = await api.put(`/api/ops-calendar/rosters/${rosterId}`, {
      headers,
      data: {
        dutyDate,
        startAt: `${dutyDate}T22:00:00`,
        endAt: '2098-12-31T06:00:00',
        shiftName: `${runId}_updated`,
        assigneeId: loginData.userId,
        backupAssigneeId: loginData.userId,
        phoneOverride: '13900139000',
        groupId: group.id,
        remark: `${runId}_updated`,
      },
    })
    expect(updated.status()).toBe(200)
    expect((await updated.json()).data).toMatchObject({
      id: rosterId,
      shiftName: `${runId}_updated`,
      backupAssigneeId: loginData.userId,
      phoneOverride: '13900139000',
      endAt: '2098-12-31T06:00:00',
    })

    const wrongRun = await api.delete(`/api/ops-calendar/rosters/${rosterId}/remediation-test`, {
      headers,
      params: { runId: `${runId}_wrong` },
    })
    expect(wrongRun.status()).toBe(400)
    const beforeCleanup = (await (await api.get('/api/ops-calendar/rosters', {
      headers,
      params: { from: dutyDate, to: dutyDate, groupId: group.id },
    })).json()).data
    expect(beforeCleanup.some(item => item.id === rosterId)).toBe(true)

    expect((await api.delete(`/api/ops-calendar/rosters/${rosterId}/remediation-test`, {
      headers,
      params: { runId },
    })).status()).toBe(200)
    const afterCleanup = (await (await api.get('/api/ops-calendar/rosters', {
      headers,
      params: { from: dutyDate, to: dutyDate, groupId: group.id },
    })).json()).data
    expect(afterCleanup.some(item => item.id === rosterId)).toBe(false)
    expect((await api.delete(`/api/ops-calendar/rosters/${rosterId}/remediation-test`, {
      headers,
      params: { runId },
    })).status()).toBe(400)

    const audits = (await (await api.get('/api/audit-logs', {
      headers,
      params: { module: 'ops_calendar', action: 'purge_remediation_test', keyword: runId, page: 1, size: 20 },
    })).json()).data
    expect((audits.records ?? audits).some(item => item.targetId === rosterId)).toBe(true)
  } finally {
    if (headers && rosterId) {
      const list = await api.get('/api/ops-calendar/rosters', { headers, params: { from: '2098-12-30', to: '2098-12-30' } })
      if (list.status() === 200 && (await list.json()).data.some(item => item.id === rosterId)) {
        await api.delete(`/api/ops-calendar/rosters/${rosterId}/remediation-test`, { headers, params: { runId } })
      }
    }
    await api.dispose()
  }
})
