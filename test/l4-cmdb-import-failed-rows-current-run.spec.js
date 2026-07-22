const { test, expect, request } = require('@playwright/test')
const fs = require('fs')
const path = require('path')

const baseURL = process.env.FQA_BASE_URL || 'http://127.0.0.1'
const l4RunId = process.env.FQA_L4_RUN_ID || 'FQA_20260718_2050_remp1038'
const suffix = Date.now()
const runId = `${l4RunId}_xlexport004_${suffix}`
const manifestPath = path.join(__dirname, '..', 'docs', 'acceptance', 'full-platform-exhaustive-functional-test-v1.0', 'runs', l4RunId, 'test-data-manifest.json')

function updateManifest(objects, cleanupFailures = 0) {
  fs.writeFileSync(manifestPath, JSON.stringify({ runId: l4RunId, objects, cleanupFailures }, null, 2) + '\n')
}

async function dataOf(response, expectedStatus = 200) {
  const body = await response.json()
  expect(response.status(), JSON.stringify(body)).toBe(expectedStatus)
  return body.data
}

test('XL-EXPORT-004 downloads real failed rows after CSV execution', async () => {
  test.skip(!process.env.FQA_SUPERADMIN_PASSWORD, 'FQA_SUPERADMIN_PASSWORD is required')
  const api = await request.newContext({ baseURL })
  const objects = []
  let headers
  let modelCode
  let modelGroupId
  let modelId
  let attributeGroupId
  let attributeId
  let instanceId
  try {
    headers = { Authorization: `Bearer ${(await dataOf(await api.post('/api/auth/login', {
      data: { username: 'superadmin', password: process.env.FQA_SUPERADMIN_PASSWORD },
    }))).token}` }

    const groupCode = `gxlexp004${suffix}`
    modelCode = `mxlexp004${suffix}`
    const attributeGroupCode = `axlexp004${suffix}`
    modelGroupId = (await dataOf(await api.post('/api/cmdb/model-groups', {
      headers, data: { code: groupCode, name: runId, sortOrder: 1 },
    }))).id
    objects.push({ caseId: 'XL-EXPORT-004', type: 'cmdb-model-group', id: modelGroupId, runId })
    updateManifest(objects)

    modelId = (await dataOf(await api.post('/api/cmdb/models', {
      headers, data: { modelId: modelCode, name: runId, groupCode },
    }))).id
    objects.push({ caseId: 'XL-EXPORT-004', type: 'cmdb-model', id: modelId, modelCode, runId })
    updateManifest(objects)

    attributeGroupId = (await dataOf(await api.post(`/api/cmdb/models/${modelCode}/attribute-groups`, {
      headers, data: { groupId: attributeGroupCode, name: runId, sortOrder: 1 },
    }))).id
    objects.push({ caseId: 'XL-EXPORT-004', type: 'cmdb-attribute-group', id: attributeGroupId, modelCode, runId })
    updateManifest(objects)

    attributeId = (await dataOf(await api.post(`/api/cmdb/models/${modelCode}/attributes`, {
      headers,
      data: { fieldKey: 'asset_name', name: '资产名称', groupId: attributeGroupCode,
        fieldType: 'text', isRequired: true, isUnique: true, isEditable: true,
        isListShow: true, isDrawerShow: true, sortOrder: 1 },
    }))).id
    objects.push({ caseId: 'XL-EXPORT-004', type: 'cmdb-attribute', id: attributeId, modelCode, runId })
    updateManifest(objects)

    instanceId = (await dataOf(await api.post('/api/cmdb/instances', {
      headers, data: { modelId: modelCode, name: runId, status: 'online', fieldsData: { asset_name: runId } },
    }))).id
    objects.push({ caseId: 'XL-EXPORT-004', type: 'cmdb-instance', id: instanceId, runId })
    updateManifest(objects)

    const preview = await dataOf(await api.post('/api/cmdb/instances/import/preview', {
      headers,
      multipart: { file: { name: `${runId}.csv`, mimeType: 'text/csv', buffer: Buffer.from(`asset_name\n${runId}\n`, 'utf8') },
        model: modelCode, conflictStrategy: 'override', uniqueKeyFields: 'asset_name', encoding: 'UTF-8' },
    }))
    expect(preview).toMatchObject({ totalRows: 1, toCreate: 0, toUpdate: 1, failedRows: [] })

    expect((await api.delete(`/api/cmdb/instances/${instanceId}`, { headers })).status()).toBe(200)
    instanceId = undefined
    updateManifest(objects.filter((object) => object.type !== 'cmdb-instance'))

    const result = await dataOf(await api.post('/api/cmdb/instances/import/execute', {
      headers, data: { batchId: preview.batchId },
    }))
    expect(result).toMatchObject({ totalRows: 1, created: 0, updated: 0, skipped: 0, failed: 1 })
    expect(result.failedRows).toEqual(expect.arrayContaining([
      expect.objectContaining({ rowNumber: 1, rowData: expect.objectContaining({ asset_name: runId }) }),
    ]))

    const failedRows = await api.get(`/api/cmdb/instances/import/${preview.batchId}/failed-rows`, { headers })
    expect(failedRows.status(), await failedRows.text()).toBe(200)
    expect(failedRows.headers()['content-type']).toContain('text/csv')
    const body = (await failedRows.body()).toString('utf8')
    expect(body).toContain('失败原因')
    expect(body).toContain(runId)
    expect(body.startsWith('=')).toBe(false)
  } finally {
    let cleanupFailures = 0
    if (headers && instanceId && ![200, 400, 404].includes((await api.delete(`/api/cmdb/instances/${instanceId}`, { headers })).status())) cleanupFailures += 1
    if (headers && attributeId && (await api.delete(`/api/cmdb/models/${modelCode}/attributes/${attributeId}`, { headers })).status() !== 200) cleanupFailures += 1
    if (headers && attributeGroupId && (await api.delete(`/api/cmdb/models/${modelCode}/attribute-groups/${attributeGroupId}`, { headers })).status() !== 200) cleanupFailures += 1
    if (headers && modelId && (await api.delete(`/api/cmdb/models/${modelId}`, { headers })).status() !== 200) cleanupFailures += 1
    if (headers && modelGroupId && (await api.delete(`/api/cmdb/model-groups/${modelGroupId}`, { headers })).status() !== 200) cleanupFailures += 1
    updateManifest([], cleanupFailures)
    await api.dispose()
  }
})
