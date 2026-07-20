const { test, expect, request } = require('@playwright/test')
const fs = require('fs')
const path = require('path')

const baseURL = process.env.FQA_BASE_URL || 'http://127.0.0.1'
const eventRunId = process.env.FQA_EVENT_RUN_ID || 'REM_P1_056_20260720'
const suffix = Date.now()
const manifestPath = path.join(
  __dirname, '..', 'docs', 'plan', 'full-platform-remediation', '03-cmdb-assets',
  'REM-P1-056-cmdb-attribute-canonical-action-guards', 'test-data-manifest.json',
)

function updateManifest(objects, cleanupFailures = 0) {
  const temporaryPath = `${manifestPath}.${process.pid}.tmp`
  fs.writeFileSync(
    temporaryPath,
    `${JSON.stringify({ runId: 'REM_P1_056_20260720', objects, cleanupFailures }, null, 2)}\n`,
    { mode: 0o600 },
  )
  fs.renameSync(temporaryPath, manifestPath)
}

async function responseData(response, expectedStatus = 200) {
  const body = await response.json()
  expect(response.status(), JSON.stringify(body)).toBe(expectedStatus)
  return body.data
}

async function login(api, username, password) {
  const result = await responseData(await api.post('/api/auth/login', {
    data: { username, password },
  }))
  return {
    username,
    password,
    permissions: result.permissions,
    headers: { Authorization: `Bearer ${result.token}` },
  }
}

test('canonical CMDB attribute actions align API and UI with exact cleanup', async ({ browser }) => {
  test.setTimeout(240_000)
  test.skip(!process.env.FQA_SUPERADMIN_PASSWORD, 'FQA_SUPERADMIN_PASSWORD is required')

  const api = await request.newContext({ baseURL })
  const objects = []
  const roles = []
  const users = []
  const assignments = []
  const attributes = []
  const cleanupFailures = []
  let admin
  let modelGroupId
  let modelId
  let attributeGroupId

  const runToken = `${eventRunId}_${suffix}`.toLowerCase().replace(/[^a-z0-9_]/g, '_')
  const modelGroupCode = `g_${runToken}`
  const modelCode = `m_${runToken}`
  const attributeGroupCode = `a_${runToken}`
  const attributeUrl = `/api/cmdb/models/${modelCode}/attributes`

  const addObject = (object) => {
    objects.push({ ...object, runId: eventRunId })
    updateManifest(objects, cleanupFailures.length)
  }
  const removeObject = (type, id) => {
    const index = objects.findIndex(object => object.type === type && object.id === id)
    if (index >= 0) objects.splice(index, 1)
    updateManifest(objects, cleanupFailures.length)
  }
  const clean = async (label, callback, type, id) => {
    try {
      const response = await callback()
      expect(response.status(), `${label}: ${await response.text()}`).toBe(200)
      removeObject(type, id)
    } catch (error) {
      cleanupFailures.push(`${label}: ${error.message}`)
      updateManifest(objects, cleanupFailures.length)
    }
  }

  try {
    updateManifest([])
    admin = await login(api, 'superadmin', process.env.FQA_SUPERADMIN_PASSWORD)
    const permissions = await responseData(await api.get('/api/rbac/permissions', {
      headers: admin.headers,
    }))
    const permissionId = (code) => {
      const permission = permissions.find(candidate => candidate.code === code)
      expect(permission, `permission ${code}`).toBeTruthy()
      return permission.id
    }

    const modelGroup = await responseData(await api.post('/api/cmdb/model-groups', {
      headers: admin.headers,
      data: { code: modelGroupCode, name: `${eventRunId} model group`, sortOrder: 1 },
    }))
    modelGroupId = modelGroup.id
    addObject({ type: 'cmdb-model-group', id: modelGroupId })

    const model = await responseData(await api.post('/api/cmdb/models', {
      headers: admin.headers,
      data: { modelId: modelCode, name: `${eventRunId} model`, groupCode: modelGroupCode },
    }))
    modelId = model.id
    addObject({ type: 'cmdb-model', id: modelId, modelCode })

    const attributeGroup = await responseData(await api.post(`/api/cmdb/models/${modelCode}/attribute-groups`, {
      headers: admin.headers,
      data: { groupId: attributeGroupCode, name: `${eventRunId} attributes`, sortOrder: 1 },
    }))
    attributeGroupId = attributeGroup.id
    addObject({ type: 'cmdb-attribute-group', id: attributeGroupId, modelCode })

    const canonicalCodes = [
      'cmdb_attribute:read',
      'cmdb_attribute:create',
      'cmdb_attribute:update',
      'cmdb_attribute:delete',
    ]
    const identitySpecs = [
      { key: 'full', codes: ['cmdb_model:read', ...canonicalCodes] },
      { key: 'no_read', codes: ['cmdb_model:read', ...canonicalCodes.filter(code => code !== 'cmdb_attribute:read')] },
      { key: 'no_create', codes: ['cmdb_model:read', ...canonicalCodes.filter(code => code !== 'cmdb_attribute:create')] },
      { key: 'no_update', codes: ['cmdb_model:read', ...canonicalCodes.filter(code => code !== 'cmdb_attribute:update')] },
      { key: 'no_delete', codes: ['cmdb_model:read', ...canonicalCodes.filter(code => code !== 'cmdb_attribute:delete')] },
      { key: 'legacy', codes: ['cmdb_model:read', 'cmdb_model:update'] },
    ]
    const identities = {}

    for (const spec of identitySpecs) {
      const role = await responseData(await api.post('/api/rbac/roles', {
        headers: admin.headers,
        data: {
          name: `${eventRunId} ${spec.key}`,
          code: `rem_p1_056_${spec.key}_${suffix}`.toLowerCase(),
          description: eventRunId,
          permissionIds: spec.codes.map(permissionId),
        },
      }))
      roles.push(role.id)
      addObject({ type: 'role', id: role.id })

      const username = `rem_p1_056_${spec.key}_${suffix}`.toLowerCase()
      const initialPassword = `Fqa!${Math.random().toString(36).slice(2, 10)}A9`
      const finalPassword = `Fqa!${Math.random().toString(36).slice(2, 10)}B8`
      const user = await responseData(await api.post('/api/users', {
        headers: admin.headers,
        data: {
          username,
          password: initialPassword,
          realName: `${eventRunId}_${spec.key}`,
          email: `${username}@example.test`,
          phone: '13800138000',
          groupId: 1,
        },
      }))
      users.push(user.id)
      addObject({ type: 'user', id: user.id })

      expect((await api.post(`/api/users/${user.id}/role-assignments`, {
        headers: admin.headers,
        data: { roleId: role.id, scopeType: 'tenant' },
      })).status()).toBe(200)
      const assignment = (await responseData(await api.get(`/api/users/${user.id}/role-assignments`, {
        headers: admin.headers,
      }))).find(candidate => candidate.roleId === role.id)
      assignments.push({ id: assignment.id, userId: user.id })
      addObject({ type: 'role-assignment', id: assignment.id, userId: user.id })

      const setupIdentity = await login(api, username, initialPassword)
      expect((await api.post('/api/account/setup', {
        headers: setupIdentity.headers,
        data: {
          currentPassword: initialPassword,
          newPassword: finalPassword,
          confirmPassword: finalPassword,
          email: `${username}@example.test`,
          phone: '13800138000',
        },
      })).status()).toBe(200)
      identities[spec.key] = await login(api, username, finalPassword)
      expect(identities[spec.key].permissions).toEqual(expect.arrayContaining(spec.codes))
    }

    const createPayload = (key) => ({
      fieldKey: `f_${key}_${suffix}`,
      name: `${eventRunId} ${key}`,
      groupId: attributeGroupCode,
      fieldType: 'text',
      isRequired: false,
      isEditable: true,
      isListShow: true,
      isDrawerShow: true,
      sortOrder: 1,
    })

    const fullCreated = await responseData(await api.post(attributeUrl, {
      headers: identities.full.headers,
      data: createPayload('full'),
    }))
    attributes.push(fullCreated.id)
    addObject({ type: 'cmdb-attribute', id: fullCreated.id, modelCode })
    expect((await responseData(await api.get(attributeUrl, { headers: identities.full.headers })))
      .some(attribute => attribute.id === fullCreated.id)).toBe(true)
    const fullUpdated = await responseData(await api.put(`${attributeUrl}/${fullCreated.id}`, {
      headers: identities.full.headers,
      data: { name: `${eventRunId} full updated` },
    }))
    expect(fullUpdated.name).toBe(`${eventRunId} full updated`)
    expect((await api.delete(`${attributeUrl}/${fullCreated.id}`, {
      headers: identities.full.headers,
    })).status()).toBe(200)
    attributes.splice(attributes.indexOf(fullCreated.id), 1)
    removeObject('cmdb-attribute', fullCreated.id)

    const guarded = await responseData(await api.post(attributeUrl, {
      headers: admin.headers,
      data: createPayload('guarded'),
    }))
    attributes.push(guarded.id)
    addObject({ type: 'cmdb-attribute', id: guarded.id, modelCode })

    expect((await api.get(attributeUrl, { headers: identities.no_read.headers })).status()).toBe(403)
    expect((await api.post(attributeUrl, {
      headers: identities.no_create.headers,
      data: createPayload('denied_create'),
    })).status()).toBe(403)
    const originalName = guarded.name
    expect((await api.put(`${attributeUrl}/${guarded.id}`, {
      headers: identities.no_update.headers,
      data: { name: `${eventRunId} denied update` },
    })).status()).toBe(403)
    expect((await api.delete(`${attributeUrl}/${guarded.id}`, {
      headers: identities.no_delete.headers,
    })).status()).toBe(403)

    expect((await api.get(attributeUrl, { headers: identities.legacy.headers })).status()).toBe(403)
    expect((await api.post(attributeUrl, {
      headers: identities.legacy.headers,
      data: createPayload('legacy_create'),
    })).status()).toBe(403)
    expect((await api.put(`${attributeUrl}/${guarded.id}`, {
      headers: identities.legacy.headers,
      data: { name: `${eventRunId} legacy update` },
    })).status()).toBe(403)
    expect((await api.delete(`${attributeUrl}/${guarded.id}`, {
      headers: identities.legacy.headers,
    })).status()).toBe(403)

    const afterDenials = await responseData(await api.get(attributeUrl, { headers: admin.headers }))
    expect(afterDenials.find(attribute => attribute.id === guarded.id).name).toBe(originalName)
    expect(afterDenials.filter(attribute => attribute.fieldKey.includes(`${suffix}`)))
      .toEqual([expect.objectContaining({ id: guarded.id })])

    const assertUi = async (key, expected) => {
      const context = await browser.newContext()
      const page = await context.newPage()
      const pageErrors = []
      const serverErrors = []
      page.on('pageerror', error => pageErrors.push(error.message))
      page.on('response', response => {
        if (response.status() >= 500) serverErrors.push(`${response.status()} ${response.url()}`)
      })
      await page.goto(`${baseURL}/login`)
      await page.locator('#username').fill(identities[key].username)
      await page.locator('#password').fill(identities[key].password)
      await page.getByRole('button', { name: '登录', exact: true }).click()
      await page.waitForURL(`${baseURL}/`)
      await page.goto(`${baseURL}/cmdb/admin/models/${modelCode}`)
      await expect(page.getByRole('heading', { name: `${eventRunId} model` })).toBeVisible()
      await expect(page.getByRole('button', { name: '新建属性', exact: true }))
        .toHaveCount(expected.create ? 1 : 0)
      if (!expected.read) {
        await expect(page.getByText('无权查看模型属性。', { exact: true })).toBeVisible()
        await expect(page.getByText(originalName, { exact: true })).toHaveCount(0)
      } else {
        await expect(page.getByText(originalName, { exact: true })).toBeVisible()
        await expect(page.getByRole('button', { name: `编辑属性 ${originalName}` }))
          .toHaveCount(expected.update ? 1 : 0)
        await expect(page.getByRole('button', { name: `删除属性 ${originalName}` }))
          .toHaveCount(expected.delete ? 1 : 0)
      }
      expect(pageErrors).toEqual([])
      expect(serverErrors).toEqual([])
      await context.close()
    }

    await assertUi('full', { read: true, create: true, update: true, delete: true })
    await assertUi('no_read', { read: false, create: true, update: true, delete: true })
    await assertUi('no_create', { read: true, create: false, update: true, delete: true })
    await assertUi('no_update', { read: true, create: true, update: false, delete: true })
    await assertUi('no_delete', { read: true, create: true, update: true, delete: false })
    await assertUi('legacy', { read: false, create: false, update: false, delete: false })
  } finally {
    if (admin) {
      for (const attributeId of [...attributes].reverse()) {
        await clean(`attribute ${attributeId}`, () => api.delete(`${attributeUrl}/${attributeId}`, {
          headers: admin.headers,
        }), 'cmdb-attribute', attributeId)
      }
      if (attributeGroupId) {
        await clean(`attribute group ${attributeGroupId}`, () => api.delete(
          `/api/cmdb/models/${modelCode}/attribute-groups/${attributeGroupId}`,
          { headers: admin.headers },
        ), 'cmdb-attribute-group', attributeGroupId)
      }
      for (const assignment of [...assignments].reverse()) {
        await clean(`assignment ${assignment.id}`, () => api.delete(
          `/api/users/${assignment.userId}/role-assignments/${assignment.id}`,
          { headers: admin.headers },
        ), 'role-assignment', assignment.id)
      }
      for (const userId of [...users].reverse()) {
        await clean(`user ${userId}`, () => api.delete(`/api/users/${userId}`, {
          headers: admin.headers,
        }), 'user', userId)
      }
      for (const roleId of [...roles].reverse()) {
        await clean(`role ${roleId}`, () => api.delete(`/api/rbac/roles/${roleId}`, {
          headers: admin.headers,
        }), 'role', roleId)
      }
      if (modelId) {
        await clean(`model ${modelId}`, () => api.delete(`/api/cmdb/models/${modelId}`, {
          headers: admin.headers,
        }), 'cmdb-model', modelId)
      }
      if (modelGroupId) {
        await clean(`model group ${modelGroupId}`, () => api.delete(`/api/cmdb/model-groups/${modelGroupId}`, {
          headers: admin.headers,
        }), 'cmdb-model-group', modelGroupId)
      }
    }
    updateManifest(objects, cleanupFailures.length)
    expect(cleanupFailures).toEqual([])
    expect(objects).toEqual([])
    await api.dispose()
  }
})
