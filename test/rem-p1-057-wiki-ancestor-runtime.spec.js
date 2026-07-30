const { test, expect, request } = require('@playwright/test')
const { randomUUID } = require('node:crypto')
const fs = require('fs')
const path = require('path')

const baseURL = process.env.FQA_BASE_URL || 'http://127.0.0.1'
const l4RunId = process.env.FQA_L4_RUN_ID || 'REM_P1_057_20260720'
const suffix = Date.now()
const runId = `${l4RunId}_wiki024_${suffix}`
const username = `fqa_l4_wiki024_${suffix}`
const roleCode = `fqa_l4_wiki024_${suffix}`
const initialPassword = `Fqa!${randomUUID().replaceAll('-', '').slice(0, 8)}A9`
const finalPassword = `Fqa!${randomUUID().replaceAll('-', '').slice(0, 8)}B8`
const manifestPath = path.join(__dirname, '..', 'docs', 'acceptance', 'full-platform-exhaustive-functional-test-v1.0', 'runs', l4RunId, 'test-data-manifest.json')

function updateManifest(objects, cleanupFailures = 0) {
  fs.writeFileSync(manifestPath, JSON.stringify({ runId: l4RunId, objects, cleanupFailures }, null, 2) + '\n')
}

test('wiki024DeniesChildReadWhenAnAncestorLosesTraverseWithoutLeakingContent', async () => {
  test.skip(!process.env.FQA_SUPERADMIN_PASSWORD, 'FQA_SUPERADMIN_PASSWORD is required')
  const api = await request.newContext({ baseURL })
  const objects = []
  const cleanupErrors = []
  let adminHeaders
  let roleId
  let userId
  let assignmentId
  let spaceId
  let rootPageId
  let childPageId

  try {
    const adminLogin = await api.post('/api/auth/login', {
      data: { username: 'superadmin', password: process.env.FQA_SUPERADMIN_PASSWORD },
    })
    expect(adminLogin.status()).toBe(200)
    adminHeaders = { Authorization: `Bearer ${(await adminLogin.json()).data.token}` }

    const groupsResponse = await api.get('/api/groups', { headers: adminHeaders })
    expect(groupsResponse.status()).toBe(200)
    const groupsBody = await groupsResponse.json()
    const groups = groupsBody.data.records ?? groupsBody.data
    const ownerGroup = groups.find((group) => group.id !== 1)
    const userGroup = groups.find((group) => group.id !== 1 && group.id !== ownerGroup.id)
    expect(ownerGroup).toBeTruthy()
    expect(userGroup).toBeTruthy()

    const permissionsResponse = await api.get('/api/rbac/permissions', { headers: adminHeaders })
    expect(permissionsResponse.status()).toBe(200)
    const readPermission = (await permissionsResponse.json()).data.find((permission) => permission.code === 'wiki:read')
    expect(readPermission).toBeTruthy()

    const roleResponse = await api.post('/api/rbac/roles', {
      headers: adminHeaders,
      data: { name: `FQA WIKI024 ${suffix}`, code: roleCode, description: runId, permissionIds: [readPermission.id] },
    })
    expect(roleResponse.status()).toBe(200)
    roleId = (await roleResponse.json()).data.id
    objects.push({ caseId: 'WIKI-024', type: 'role', id: roleId, runId })
    updateManifest(objects)

    const userResponse = await api.post('/api/users', {
      headers: adminHeaders,
      data: {
        username,
        password: initialPassword,
        realName: runId,
        email: `${username}@example.test`,
        phone: '13800138000',
        groupId: userGroup.id,
      },
    })
    expect(userResponse.status()).toBe(200)
    userId = (await userResponse.json()).data.id
    objects.push({ caseId: 'WIKI-024', type: 'user', id: userId, runId })
    updateManifest(objects)

    const assignmentResponse = await api.post(`/api/users/${userId}/role-assignments`, {
      headers: adminHeaders,
      data: { roleId, scopeType: 'tenant' },
    })
    expect(assignmentResponse.status()).toBe(200)
    const assignmentsResponse = await api.get(`/api/users/${userId}/role-assignments`, { headers: adminHeaders })
    expect(assignmentsResponse.status()).toBe(200)
    assignmentId = (await assignmentsResponse.json()).data.find((assignment) => assignment.roleId === roleId).id
    objects.push({ caseId: 'WIKI-024', type: 'role-assignment', id: assignmentId, userId, runId })
    updateManifest(objects)

    const initialLogin = await api.post('/api/auth/login', { data: { username, password: initialPassword } })
    expect(initialLogin.status()).toBe(200)
    const initialHeaders = { Authorization: `Bearer ${(await initialLogin.json()).data.token}` }
    const setupResponse = await api.post('/api/account/setup', {
      headers: initialHeaders,
      data: {
        currentPassword: initialPassword,
        newPassword: finalPassword,
        confirmPassword: finalPassword,
        email: `${username}@example.test`,
        phone: '13800138000',
      },
    })
    expect(setupResponse.status()).toBe(200)
    const userLogin = await api.post('/api/auth/login', { data: { username, password: finalPassword } })
    expect(userLogin.status()).toBe(200)
    const userHeaders = { Authorization: `Bearer ${(await userLogin.json()).data.token}` }

    const spaceResponse = await api.post('/api/wiki/spaces', {
      headers: adminHeaders,
      data: { name: runId, description: runId, ownerGroupId: ownerGroup.id },
    })
    expect(spaceResponse.status()).toBe(200)
    spaceId = (await spaceResponse.json()).data.id
    objects.push({ caseId: 'WIKI-024', type: 'wiki-space', id: spaceId, runId })
    updateManifest(objects)

    const spaceAccessResponse = await api.get(`/api/access/wiki_space/${spaceId}`, { headers: adminHeaders })
    expect(spaceAccessResponse.status()).toBe(200)
    const spaceAccess = (await spaceAccessResponse.json()).data
    const targetTraverse = { subjectType: 'user', subjectId: userId, permissions: 'r-x' }
    const savedSpaceAccess = await api.put(`/api/access/wiki_space/${spaceId}`, {
      headers: adminHeaders,
      data: {
        ...spaceAccess,
        entries: [...spaceAccess.entries, targetTraverse],
        defaultEntries: [...spaceAccess.defaultEntries, targetTraverse],
      },
    })
    expect(savedSpaceAccess.status()).toBe(200)

    const rootResponse = await api.post('/api/wiki/pages', {
      headers: adminHeaders,
      data: { spaceId, title: `${runId}_root` },
    })
    expect(rootResponse.status()).toBe(200)
    rootPageId = (await rootResponse.json()).data.id
    objects.push({ caseId: 'WIKI-024', type: 'wiki-page', id: rootPageId, spaceId, runId })
    updateManifest(objects)

    const rootAccessResponse = await api.get(`/api/access/wiki_page/${rootPageId}`, { headers: adminHeaders })
    expect(rootAccessResponse.status()).toBe(200)
    const rootAccess = (await rootAccessResponse.json()).data
    expect(rootAccess.entries).toEqual(expect.arrayContaining([expect.objectContaining(targetTraverse)]))
    const childRead = { subjectType: 'user', subjectId: userId, permissions: 'r--' }
    const savedRootAccessResponse = await api.put(`/api/access/wiki_page/${rootPageId}`, {
      headers: adminHeaders,
      data: { ...rootAccess, mode: '0700', entries: [targetTraverse], defaultEntries: [childRead] },
    })
    expect(savedRootAccessResponse.status()).toBe(200)
    const savedRootAccess = (await savedRootAccessResponse.json()).data

    const positiveRootRead = await api.get(`/api/wiki/pages/${rootPageId}`, { headers: userHeaders })
    expect(positiveRootRead.status()).toBe(200)

    const childTitle = `${runId}_child_secret_title`
    const childResponse = await api.post('/api/wiki/pages', {
      headers: adminHeaders,
      data: { spaceId, parentId: rootPageId, title: childTitle },
    })
    expect(childResponse.status()).toBe(200)
    childPageId = (await childResponse.json()).data.id
    objects.push({ caseId: 'WIKI-024', type: 'wiki-page', id: childPageId, spaceId, runId })
    updateManifest(objects)

    const childAccessResponse = await api.get(`/api/access/wiki_page/${childPageId}`, { headers: adminHeaders })
    expect(childAccessResponse.status()).toBe(200)
    expect((await childAccessResponse.json()).data).toMatchObject({ ownerGroupId: rootAccess.ownerGroupId })

    const positiveRead = await api.get(`/api/wiki/pages/${childPageId}`, { headers: userHeaders })
    expect(positiveRead.status()).toBe(200)
    expect((await positiveRead.json()).data).toMatchObject({ id: childPageId, title: childTitle, content: '' })

    const deniedRootAccessResponse = await api.put(`/api/access/wiki_page/${rootPageId}`, {
      headers: adminHeaders,
      data: { ...savedRootAccess, entries: [childRead], defaultEntries: [childRead] },
    })
    expect(deniedRootAccessResponse.status()).toBe(200)

    const deniedRead = await api.get(`/api/wiki/pages/${childPageId}`, { headers: userHeaders })
    expect(deniedRead.status()).toBe(403)
    const deniedBody = await deniedRead.text()
    expect(deniedBody).not.toContain(childTitle)

  } finally {
    const removeObject = (type, id) => {
      const index = objects.findIndex((object) => object.type === type && object.id === id)
      if (index >= 0) objects.splice(index, 1)
      updateManifest(objects, cleanupErrors.length)
    }
    const cleanup = async (label, action, type, id) => {
      if (!id || !adminHeaders) return
      try {
        const response = await action()
        if (response.status() !== 200) cleanupErrors.push(`${label}:${response.status()}`)
        else removeObject(type, id)
      } catch (error) {
        cleanupErrors.push(`${label}:${error instanceof Error ? error.message : String(error)}`)
      }
    }

    await cleanup('child-page', () => api.delete(`/api/wiki/pages/${childPageId}`, { headers: adminHeaders }), 'wiki-page', childPageId)
    await cleanup('root-page', () => api.delete(`/api/wiki/pages/${rootPageId}`, { headers: adminHeaders }), 'wiki-page', rootPageId)
    await cleanup('space', () => api.delete(`/api/wiki/spaces/${spaceId}`, { headers: adminHeaders }), 'wiki-space', spaceId)
    await cleanup('assignment', () => api.delete(`/api/users/${userId}/role-assignments/${assignmentId}`, { headers: adminHeaders }), 'role-assignment', assignmentId)
    await cleanup('user', () => api.delete(`/api/users/${userId}`, { headers: adminHeaders }), 'user', userId)
    await cleanup('role', () => api.delete(`/api/rbac/roles/${roleId}`, { headers: adminHeaders }), 'role', roleId)
    updateManifest(objects, cleanupErrors.length)
    await api.dispose()
    expect(cleanupErrors, 'cleanup failures').toEqual([])
    expect(objects, 'active manifest objects').toEqual([])
  }
})
