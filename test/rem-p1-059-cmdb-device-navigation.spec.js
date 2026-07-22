const { test, expect, request } = require('@playwright/test')
const fs = require('fs')
const path = require('path')

const baseURL = process.env.FQA_BASE_URL || 'http://127.0.0.1'
const runId = process.env.REMEDIATION_RUN_ID || `REM_P1_059_${Date.now()}`
const password = process.env.FQA_SUPERADMIN_PASSWORD || ''
const suffix = Date.now().toString(36)
const groupCode = `r59g${suffix}`
const modelCode = `r59m${suffix}`
const manifestPath = path.join(__dirname, '..', 'docs', 'plan', 'full-platform-remediation',
  '03-cmdb-device', 'REM-P1-059-cmdb-device-bidirectional-navigation', 'test-data-manifest.json')

function manifest(objects, cleanupFailures = 0) {
  fs.writeFileSync(manifestPath, `${JSON.stringify({ runId, objects, cleanupFailures }, null, 2)}\n`)
}

test('remP1059CmdbDeviceBidirectionalNavigation', async ({ page }) => {
  test.skip(!password, 'FQA_SUPERADMIN_PASSWORD is required')
  test.setTimeout(60_000)
  const api = await request.newContext({ baseURL })
  const objects = []
  let headers
  let groupId
  let modelId
  let instanceId
  let deviceId
  try {
    const login = await api.post('/api/auth/login', { data: { username: 'superadmin', password } })
    expect(login.status()).toBe(200)
    headers = { Authorization: `Bearer ${(await login.json()).data.token}` }
    const group = await api.post('/api/cmdb/model-groups', {
      headers, data: { code: groupCode, name: runId },
    })
    expect(group.status()).toBe(200)
    groupId = (await group.json()).data.id
    objects.push({ type: 'cmdb-model-group', id: groupId, code: groupCode, runId }); manifest(objects)
    const model = await api.post('/api/cmdb/models', {
      headers, data: { modelId: modelCode, name: `${runId} model`, groupCode },
    })
    expect(model.status()).toBe(200)
    modelId = (await model.json()).data.id
    objects.push({ type: 'cmdb-model', id: modelId, code: modelCode, runId }); manifest(objects)
    const instance = await api.post('/api/cmdb/instances', {
      headers, data: { modelId: modelCode, name: `${runId} instance`, fieldsData: {} },
    })
    expect(instance.status()).toBe(200)
    instanceId = (await instance.json()).data.id
    objects.push({ type: 'cmdb-instance', id: instanceId, runId }); manifest(objects)
    const device = await api.post('/api/devices', {
      headers, data: { ciInstanceId: instanceId, groupId: 1, category: runId },
    })
    expect(device.status()).toBe(200)
    deviceId = (await device.json()).data.id
    objects.push({ type: 'device', id: deviceId, runId }); manifest(objects)

    const deviceDetail = await api.get(`/api/devices/${deviceId}`, { headers })
    expect(deviceDetail.status()).toBe(200)
    expect((await deviceDetail.json()).data).toMatchObject({
      id: deviceId, ciInstanceId: instanceId, ciInstanceName: `${runId} instance`, ciModelCode: modelCode,
    })
    const related = await api.get(`/api/cmdb/instances/${instanceId}/devices`, { headers })
    expect(related.status()).toBe(200)
    expect((await related.json()).data).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: deviceId, ciInstanceId: instanceId }),
    ]))
    expect((await api.delete(`/api/cmdb/instances/${instanceId}`, { headers })).status()).toBe(400)

    await page.goto(`${baseURL}/login`)
    await page.locator('#username').fill('superadmin')
    await page.locator('#password').fill(password)
    await page.getByRole('button', { name: '登录', exact: true }).click()
    await page.waitForURL(`${baseURL}/`)
    await page.goto(`${baseURL}/cmdb/instances/by-model/${modelCode}/${instanceId}`)
    await page.getByRole('button', { name: '关联资源', exact: true }).click()
    const deviceLink = page.locator(`a[href="/devices/${deviceId}"]`)
    await expect(deviceLink).toBeVisible()
    await deviceLink.click()
    await expect(page).toHaveURL(`${baseURL}/devices/${deviceId}`)
    const instanceLink = page.locator(`a[href="/cmdb/instances/by-model/${modelCode}/${instanceId}"]`)
    await expect(instanceLink).toBeVisible()
    await instanceLink.click()
    await expect(page).toHaveURL(`${baseURL}/cmdb/instances/by-model/${modelCode}/${instanceId}`)
  } finally {
    const failures = []
    const remove = async (type, id, url) => {
      if (!id || !headers) return
      const response = await api.delete(url, { headers })
      if (response.status() !== 200) failures.push(`${type}:${id}:${response.status()}`)
      else objects.splice(objects.findIndex(object => object.type === type && object.id === id), 1)
      manifest(objects, failures.length)
    }
    await remove('device', deviceId, `/api/devices/${deviceId}`)
    await remove('cmdb-instance', instanceId, `/api/cmdb/instances/${instanceId}`)
    await remove('cmdb-model', modelId, `/api/cmdb/models/${modelId}`)
    await remove('cmdb-model-group', groupId, `/api/cmdb/model-groups/${groupId}`)
    await api.dispose()
    expect(failures).toEqual([])
    expect(objects).toEqual([])
  }
})
