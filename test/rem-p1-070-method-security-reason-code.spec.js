const { test, expect, request } = require('@playwright/test')

const baseURL = process.env.FQA_BASE_URL || 'http://127.0.0.1'
const suffix = Date.now()
const runId = `REM_P1_070_${suffix}`

async function responseData(response, expectedStatus = 200) {
  const body = await response.json()
  expect(response.status(), JSON.stringify(body)).toBe(expectedStatus)
  return body.data
}

async function login(api, username, password) {
  const data = await responseData(await api.post('/api/auth/login', {
    data: { username, password },
  }))
  return { headers: { Authorization: `Bearer ${data.token}` } }
}

test('method security denial returns the functional permission reason code', async () => {
  test.skip(!process.env.FQA_SUPERADMIN_PASSWORD, 'FQA_SUPERADMIN_PASSWORD is required')
  test.setTimeout(120_000)

  const api = await request.newContext({ baseURL })
  const initialPassword = `Fqa!${Math.random().toString(36).slice(2, 10)}A9`
  const password = `Fqa!${Math.random().toString(36).slice(2, 10)}B8`
  const username = `fqa_rem_p1_070_${suffix}`
  let adminHeaders
  let roleId
  let userId
  let assignmentId
  let spaceId
  let pageId

  try {
    adminHeaders = (await login(api, 'superadmin', process.env.FQA_SUPERADMIN_PASSWORD)).headers
    const groups = await responseData(await api.get('/api/groups?page=1&size=64', { headers: adminHeaders }))
    const group = (Array.isArray(groups) ? groups : groups.records).find(
      (candidate) => !candidate.isBuiltin && candidate.groupType === 'business',
    )
    expect(group).toBeTruthy()

    const permissions = await responseData(await api.get('/api/rbac/permissions', { headers: adminHeaders }))
    const wikiRead = permissions.find((permission) => permission.code === 'wiki:read')
    expect(wikiRead).toBeTruthy()

    const role = await responseData(await api.post('/api/rbac/roles', {
      headers: adminHeaders,
      data: {
        name: `${runId}_role`,
        code: `fqa_rem_p1_070_${suffix}`,
        description: runId,
        permissionIds: [wikiRead.id],
      },
    }))
    roleId = role.id

    const user = await responseData(await api.post('/api/users', {
      headers: adminHeaders,
      data: {
        username,
        password: initialPassword,
        realName: runId,
        email: `${username}@example.test`,
        phone: '13800138000',
        groupId: group.id,
      },
    }))
    userId = user.id

    const setup = await login(api, username, initialPassword)
    expect((await api.post('/api/account/setup', {
      headers: setup.headers,
      data: {
        currentPassword: initialPassword,
        newPassword: password,
        confirmPassword: password,
        email: `${username}@example.test`,
        phone: '13800138000',
      },
    })).status()).toBe(200)

    expect((await api.post(`/api/users/${userId}/role-assignments`, {
      headers: adminHeaders,
      data: { roleId, scopeType: 'group', scopeId: group.id },
    })).status()).toBe(200)
    const assignments = await responseData(await api.get(`/api/users/${userId}/role-assignments`, {
      headers: adminHeaders,
    }))
    assignmentId = assignments.find((assignment) => assignment.roleId === roleId).id

    spaceId = (await responseData(await api.post('/api/wiki/spaces', {
      headers: adminHeaders,
      data: { name: `${runId}_space`, description: runId, ownerGroupId: group.id },
    }))).id
    pageId = (await responseData(await api.post('/api/wiki/pages', {
      headers: adminHeaders,
      data: { spaceId, title: `${runId}_page` },
    }))).id

    const session = await login(api, username, password)
    expect((await api.get(`/api/wiki/pages/${pageId}`, { headers: session.headers })).status()).toBe(200)
    expect((await api.delete(`/api/users/${userId}/role-assignments/${assignmentId}`, {
      headers: adminHeaders,
    })).status()).toBe(200)
    assignmentId = undefined

    const denied = await api.get(`/api/wiki/pages/${pageId}`, { headers: session.headers })
    expect(denied.status()).toBe(403)
    const deniedBody = await denied.json()
    expect(deniedBody).toMatchObject({
      code: 403,
      errorCode: 'FUNCTION_PERMISSION_DENIED',
    })
    expect(deniedBody.data ?? null).toBeNull()
  } finally {
    if (pageId) expect((await api.delete(`/api/wiki/pages/${pageId}`, { headers: adminHeaders })).status()).toBe(200)
    if (spaceId) expect((await api.delete(`/api/wiki/spaces/${spaceId}`, { headers: adminHeaders })).status()).toBe(200)
    if (assignmentId) {
      expect((await api.delete(`/api/users/${userId}/role-assignments/${assignmentId}`, {
        headers: adminHeaders,
      })).status()).toBe(200)
    }
    if (userId) expect((await api.delete(`/api/users/${userId}`, { headers: adminHeaders })).status()).toBe(200)
    if (roleId) expect((await api.delete(`/api/rbac/roles/${roleId}`, { headers: adminHeaders })).status()).toBe(200)
    await api.dispose()
  }
})
