const { test, expect, request } = require('@playwright/test')
const fs = require('fs')
const path = require('path')

const baseURL = process.env.FQA_BASE_URL || 'http://127.0.0.1'
const l4RunId = process.env.FQA_L4_RUN_ID || 'FQA_20260718_2050_remp1038'
const runId = `${l4RunId}_cmdb_types_${Date.now()}`.toLowerCase().replace(/[^a-z0-9_]/g, '_')
const manifestPath = path.join(__dirname, '..', 'docs', 'acceptance', 'full-platform-exhaustive-functional-test-v1.0', 'runs', l4RunId, 'test-data-manifest.json')

function updateManifest(objects) {
  fs.writeFileSync(manifestPath, JSON.stringify({ runId: l4RunId, objects, cleanupFailures: 0 }, null, 2) + '\n')
}

async function body(response) {
  return response.json()
}

test('cmdb008011016017AndXlCmdb001CurrentFieldTypes', async ({ page }) => {
  const api = await request.newContext({ baseURL })
  const pageErrors = []
  const serverErrors = []
  page.on('pageerror', error => pageErrors.push(error.message))
  page.on('response', response => {
    if (response.status() >= 500) serverErrors.push(`${response.status()} ${response.url()}`)
  })
  const objects = []
  let headers
  let groupId
  let modelId
  let modelCode
  let attributeGroupId
  const attributeIds = []
  let instanceId
  try {
    const login = await api.post('/api/auth/login', {
      data: { username: 'superadmin', password: process.env.FQA_SUPERADMIN_PASSWORD },
    })
    expect(login.status()).toBe(200)
    headers = { Authorization: `Bearer ${(await body(login)).data.token}` }

    const groupCode = `g_${runId}`
    modelCode = `m_${runId}`
    const attributeGroupCode = `a_${runId}`
    let response = await api.post('/api/cmdb/model-groups', { headers, data: { code: groupCode, name: runId } })
    expect(response.status()).toBe(200)
    groupId = (await body(response)).data.id
    objects.push({ type: 'cmdb-model-group', id: groupId, runId })
    updateManifest(objects)

    response = await api.post('/api/cmdb/models', { headers, data: { modelId: modelCode, name: runId, groupCode } })
    expect(response.status()).toBe(200)
    modelId = (await body(response)).data.id
    objects.push({ type: 'cmdb-model', id: modelId, modelCode, runId })
    updateManifest(objects)

    response = await api.post(`/api/cmdb/models/${modelCode}/attribute-groups`, {
      headers, data: { groupId: attributeGroupCode, name: runId },
    })
    expect(response.status()).toBe(200)
    attributeGroupId = (await body(response)).data.id
    objects.push({ type: 'cmdb-attribute-group', id: attributeGroupId, modelCode, runId })
    updateManifest(objects)

    const options = [{ id: 'prod', name: '生产' }, { id: 'test', name: '测试' }]
    const definitions = [
      ['singlechar', 'string-value'],
      ['longchar', 'long text'],
      ['int', 12],
      ['float', 12.5],
      ['date', '2026-07-20'],
      ['enum', 'prod'],
      ['enummulti', JSON.stringify(['prod', 'test'])],
      ['bool', true],
      ['objuser', 'superadmin'],
      ['table', [{ row_id: 'row-1', col1: 'cell', col2: '2' }]],
    ]
    const attrs = []
    for (const [fieldType, value] of definitions) {
      const fieldKey = `f_${fieldType}`
      const option = fieldType === 'enum' || fieldType === 'enummulti'
        ? options
        : fieldType === 'table'
          ? { schema_version: 1, row_key: 'row_id', columns: [
            { key: 'col1', name: '列1', type: 'singlechar' },
            { key: 'col2', name: '列2', type: 'singlechar' },
          ] }
          : null
      response = await api.post(`/api/cmdb/models/${modelCode}/attributes`, {
        headers,
        data: {
          fieldKey, name: `${runId}_${fieldType}`, groupId: attributeGroupCode, fieldType,
          isRequired: true, isEditable: true, isListShow: true, isDrawerShow: true,
          option, enumOptions: option && Array.isArray(option) ? JSON.stringify(option) : null,
        },
      })
      expect(response.status(), `${fieldType} create`).toBe(200)
      const attr = (await body(response)).data
      attributeIds.push(attr.id)
      attrs.push({ fieldType, fieldKey, value, id: attr.id })
      objects.push({ type: 'cmdb-attribute', id: attr.id, modelCode, runId })
      updateManifest(objects)
    }

    response = await api.post(`/api/cmdb/models/${modelCode}/attributes`, {
      headers,
      data: { fieldKey: 'f_duplicate_options', name: `${runId}_duplicate`, groupId: attributeGroupCode,
        fieldType: 'enum', option: [{ id: 'same', name: '相同' }, { id: 'same', name: '重复' }],
        enumOptions: JSON.stringify([{ id: 'same', name: '相同' }, { id: 'same', name: '重复' }]) },
    })
    expect(response.status(), 'duplicate enum option must be rejected').toBe(400)

    response = await api.get(`/api/cmdb/models/${modelCode}/attributes`, { headers })
    expect(response.status()).toBe(200)
    const listedAttrs = (await body(response)).data
    expect(listedAttrs.filter(item => item.fieldKey.startsWith('f_')).map(item => item.fieldType).sort())
      .toEqual(definitions.map(item => item[0]).sort())
    for (const attr of attrs) {
      const listed = listedAttrs.find(item => item.id === attr.id)
      expect(listed).toMatchObject({ fieldType: attr.fieldType, isRequired: true, isListShow: true, isDrawerShow: true })
    }

    response = await api.post('/api/cmdb/instances', {
      headers,
      data: { modelId: modelCode, name: `${runId}_instance`, fieldsData: Object.fromEntries(attrs.map(attr => [attr.fieldKey, attr.value])) },
    })
    expect(response.status()).toBe(200)
    instanceId = (await body(response)).data.id
    objects.push({ type: 'cmdb-instance', id: instanceId, modelCode, runId })
    updateManifest(objects)

    response = await api.get(`/api/cmdb/instances/${instanceId}`, { headers })
    expect(response.status()).toBe(200)
    expect((await body(response)).data.fieldsData).toMatchObject(Object.fromEntries(attrs.map(attr => [attr.fieldKey, attr.value])))
    response = await api.get(`/api/cmdb/instances?model=${modelCode}`, { headers })
    expect(response.status()).toBe(200)
    expect((await body(response)).data.records.some(item => item.id === instanceId)).toBe(true)

    await page.goto(`${baseURL}/login`)
    await page.locator('#username').fill('superadmin')
    await page.locator('#password').fill(process.env.FQA_SUPERADMIN_PASSWORD)
    await page.getByRole('button', { name: '登录', exact: true }).click()
    await page.waitForURL(`${baseURL}/`)
    await page.goto(`${baseURL}/cmdb/instances/by-model/${modelCode}/new`)
    await expect(page.getByText(`新建 ${runId} 实例`, { exact: true })).toBeVisible()
    for (const attr of attrs) {
      await expect(page.locator('label').filter({ hasText: new RegExp(`^${runId}_${attr.fieldType}\\*$`) })).toBeVisible()
    }
    await page.goto(`${baseURL}/cmdb/instances/by-model/${modelCode}`)
    await expect(page.getByText(`${runId} 实例列表`, { exact: true })).toBeVisible()
    await expect(page.getByText(`${runId}_instance`, { exact: true })).toBeVisible()
    await page.getByText(`${runId}_instance`, { exact: true }).click()
    const drawer = page.getByRole('dialog')
    await expect(drawer).toBeVisible()
    await expect(drawer.getByRole('button', { name: '完整详情', exact: true })).toBeVisible()
    await expect(drawer.getByText('关键属性', { exact: true })).toBeVisible()
    for (const attr of attrs) {
      await expect(drawer.getByText(`${runId}_${attr.fieldType}`, { exact: true })).toBeVisible()
      const display = Array.isArray(attr.value)
        ? attr.value.join(', ')
        : typeof attr.value === 'object'
          ? JSON.stringify(attr.value)
          : String(attr.value)
      await expect(drawer.getByText(display, { exact: true })).toBeVisible()
    }
    expect(pageErrors).toEqual([])
    expect(serverErrors).toEqual([])
  } finally {
    if (instanceId) expect((await api.delete(`/api/cmdb/instances/${instanceId}`, { headers })).status()).toBe(200)
    for (const attributeId of [...attributeIds].reverse()) {
      expect((await api.delete(`/api/cmdb/models/${modelCode}/attributes/${attributeId}`, { headers })).status()).toBe(200)
    }
    if (attributeGroupId) expect((await api.delete(`/api/cmdb/models/${modelCode}/attribute-groups/${attributeGroupId}`, { headers })).status()).toBe(200)
    if (modelId) expect((await api.delete(`/api/cmdb/models/${modelId}`, { headers })).status()).toBe(200)
    if (groupId) expect((await api.delete(`/api/cmdb/model-groups/${groupId}`, { headers })).status()).toBe(200)
    updateManifest([])
    if (modelId) expect((await api.get(`/api/cmdb/models/${modelId}`, { headers })).status()).toBe(400)
    if (groupId) {
      const groups = await api.get('/api/cmdb/model-groups', { headers })
      expect(groups.status()).toBe(200)
      expect((await groups.json()).data.some(item => item.id === groupId)).toBe(false)
    }
    await api.dispose()
  }
})
