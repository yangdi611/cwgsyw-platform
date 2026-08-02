const { test, expect, request } = require('@playwright/test')
const { randomUUID } = require('node:crypto')
const fs = require('fs')
const path = require('path')

const baseURL = process.env.FQA_BASE_URL || 'http://127.0.0.1'
const l4RunId = process.env.FQA_L4_RUN_ID || 'FQA_20260718_2050_remp1038'
const suffix = Date.now()
const marker = `remp1069_${suffix}`
const manifestPath = process.env.REM_P1_069_MANIFEST || path.join('/tmp', 'rem-p1-069-runtime', 'manifest.json')

async function dataOf(response, expectedStatus = 200) {
  const body = await response.json()
  expect(response.status(), JSON.stringify(body)).toBe(expectedStatus)
  return body.data
}

function records(body) {
  return Array.isArray(body.data) ? body.data : body.data?.records ?? []
}

function writeManifest(objects, cleanupFailures = 0) {
  fs.mkdirSync(path.dirname(manifestPath), { recursive: true })
  fs.writeFileSync(manifestPath, `${JSON.stringify({ runId: marker, objects, cleanupFailures }, null, 2)}\n`)
}

async function login(api, username, password) {
  return dataOf(await api.post('/api/auth/login', { data: { username, password } }))
}

test('effective non-primary group receives owner-mode access and revocation converges', async () => {
  test.skip(!process.env.FQA_SUPERADMIN_PASSWORD, 'FQA_SUPERADMIN_PASSWORD is required')
  test.setTimeout(120_000)
  const api = await request.newContext({ baseURL })
  const objects = []
  const cleanupErrors = []
  let adminHeaders
  let roleId
  let userId
  let primaryMembershipId
  let secondMembershipId
  let firstSpaceId
  let secondSpaceId

  const sync = () => writeManifest(objects, cleanupErrors.length)
  const register = (object) => { objects.push(object); sync() }
  const remove = (type, id) => {
    const index = objects.findIndex((object) => object.type === type && String(object.id) === String(id))
    if (index >= 0) objects.splice(index, 1)
    sync()
  }
  const cleanup = async (label, action, type, id) => {
    if (!id || !adminHeaders) return
    try {
      const response = await action()
      if (response.status() !== 200) cleanupErrors.push(`${label}:${response.status()}`)
      else remove(type, id)
    } catch (error) {
      cleanupErrors.push(`${label}:${error instanceof Error ? error.message : String(error)}`)
      sync()
    }
  }

  try {
    writeManifest([])
    adminHeaders = { Authorization: `Bearer ${(await login(api, 'superadmin', process.env.FQA_SUPERADMIN_PASSWORD)).token}` }
    const groups = records(await (await api.get('/api/groups?page=1&size=64', { headers: adminHeaders })).json())
      .filter((group) => !group.isBuiltin && group.groupType === 'business')
    expect(groups.length).toBeGreaterThanOrEqual(2)
    const [firstGroup, secondGroup] = groups
    const permissions = await dataOf(await api.get('/api/rbac/permissions', { headers: adminHeaders }))
    const wikiRead = permissions.find((permission) => permission.code === 'wiki:read')
    expect(wikiRead).toBeTruthy()

    roleId = (await dataOf(await api.post('/api/rbac/roles', {
      headers: adminHeaders,
      data: { name: `${marker}_reader`, code: `${marker}_reader`, description: l4RunId, permissionIds: [wikiRead.id] },
    }))).id
    register({ caseId: 'XL-RBAC-002', type: 'role', id: roleId, runId: marker })

    const username = `${marker}_user`
    const initialPassword = `Fqa!${randomUUID().replaceAll('-', '').slice(0, 8)}A9`
    const password = `Fqa!${randomUUID().replaceAll('-', '').slice(0, 8)}B8`
    userId = (await dataOf(await api.post('/api/users', {
      headers: adminHeaders,
      data: { username, password: initialPassword, realName: marker, email: `${username}@example.test`, phone: '13800138000', groupId: firstGroup.id },
    }))).id
    register({ caseId: 'XL-RBAC-002', type: 'user', id: userId, runId: marker })
    primaryMembershipId = (await dataOf(await api.get(`/api/users/${userId}/group-memberships`, { headers: adminHeaders })))[0].id
    register({ caseId: 'XL-RBAC-002', type: 'membership', id: primaryMembershipId, userId, groupId: firstGroup.id, runId: marker })

    expect((await api.post(`/api/users/${userId}/group-memberships`, {
      headers: adminHeaders,
      data: { groupId: secondGroup.id, membershipRole: 'member', primary: true },
    })).status()).toBe(200)
    const memberships = await dataOf(await api.get(`/api/users/${userId}/group-memberships`, { headers: adminHeaders }))
    secondMembershipId = memberships.find((membership) => membership.groupId === secondGroup.id).id
    register({ caseId: 'XL-RBAC-002', type: 'membership', id: secondMembershipId, userId, groupId: secondGroup.id, runId: marker })

    for (const group of [firstGroup, secondGroup]) {
      expect((await api.post(`/api/users/${userId}/role-assignments`, {
        headers: adminHeaders,
        data: { roleId, scopeType: 'group', scopeId: group.id },
      })).status()).toBe(200)
    }
    for (const assignment of await dataOf(await api.get(`/api/users/${userId}/role-assignments`, { headers: adminHeaders }))) {
      if (assignment.roleId === roleId) register({ caseId: 'XL-RBAC-002', type: 'role-assignment', id: assignment.id, userId, runId: marker })
    }

    firstSpaceId = (await dataOf(await api.post('/api/wiki/spaces', {
      headers: adminHeaders,
      data: { name: `${marker}_a`, description: marker, ownerGroupId: firstGroup.id },
    }))).id
    register({ caseId: 'XL-RBAC-002', type: 'wiki-space', id: firstSpaceId, runId: marker })
    secondSpaceId = (await dataOf(await api.post('/api/wiki/spaces', {
      headers: adminHeaders,
      data: { name: `${marker}_b`, description: marker, ownerGroupId: secondGroup.id },
    }))).id
    register({ caseId: 'XL-RBAC-002', type: 'wiki-space', id: secondSpaceId, runId: marker })

    const setup = await login(api, username, initialPassword)
    expect((await api.post('/api/account/setup', {
      headers: { Authorization: `Bearer ${setup.token}` },
      data: { currentPassword: initialPassword, newPassword: password, confirmPassword: password, email: `${username}@example.test`, phone: '13800138000' },
    })).status()).toBe(200)
    const oldHeaders = { Authorization: `Bearer ${(await login(api, username, password)).token}` }
    const visibleBefore = (await dataOf(await api.get('/api/wiki/spaces', { headers: oldHeaders }))).map((space) => space.id)
    expect(visibleBefore).toEqual(expect.arrayContaining([firstSpaceId, secondSpaceId]))

    expect((await api.delete(`/api/users/${userId}/group-memberships/${primaryMembershipId}`, { headers: adminHeaders })).status()).toBe(200)
    remove('membership', primaryMembershipId)
    primaryMembershipId = undefined
    const removedAssignment = objects.find((object) => object.type === 'role-assignment' && object.id)
    const activeAssignments = await dataOf(await api.get(`/api/users/${userId}/role-assignments`, { headers: adminHeaders }))
    for (const object of [...objects]) {
      if (object.type === 'role-assignment' && !activeAssignments.some((assignment) => assignment.id === object.id)) remove('role-assignment', object.id)
    }
    expect(removedAssignment).toBeTruthy()

    for (const headers of [oldHeaders, { Authorization: `Bearer ${(await login(api, username, password)).token}` }]) {
      const visibleAfter = (await dataOf(await api.get('/api/wiki/spaces', { headers }))).map((space) => space.id)
      expect(visibleAfter).not.toContain(firstSpaceId)
      expect(visibleAfter).toContain(secondSpaceId)
    }
  } finally {
    await cleanup('space-b', () => api.delete(`/api/wiki/spaces/${secondSpaceId}`, { headers: adminHeaders }), 'wiki-space', secondSpaceId)
    await cleanup('space-a', () => api.delete(`/api/wiki/spaces/${firstSpaceId}`, { headers: adminHeaders }), 'wiki-space', firstSpaceId)
    await cleanup('user', () => api.delete(`/api/users/${userId}`, { headers: adminHeaders }), 'user', userId)
    if (userId && !objects.some((object) => object.type === 'user' && object.id === userId)) {
      for (const object of [...objects]) {
        if (object.userId === userId && ['membership', 'role-assignment'].includes(object.type)) remove(object.type, object.id)
      }
    }
    await cleanup('role', () => api.delete(`/api/rbac/roles/${roleId}`, { headers: adminHeaders }), 'role', roleId)
    sync()
    await api.dispose()
    expect(cleanupErrors).toEqual([])
    expect(objects).toEqual([])
  }
})
