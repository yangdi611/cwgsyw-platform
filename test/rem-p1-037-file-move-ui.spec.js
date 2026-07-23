const { test, expect, request } = require('@playwright/test')
const fs = require('fs')
const path = require('path')

const baseURL = process.env.FQA_BASE_URL || 'http://127.0.0.1'
const runId = 'FQA_20260718_1546_remp0007_FILE_012_UI'
const manifestPath = path.join(__dirname, '..', 'docs', 'acceptance', 'full-platform-exhaustive-functional-test-v1.0', 'runs', 'FQA_20260718_1546_remp0007', 'test-data-manifest.json')

function updateManifest(objects) {
  fs.writeFileSync(manifestPath, JSON.stringify({ runId: 'FQA_20260718_1546_remp0007', objects, cleanupFailures: 0 }, null, 2) + '\n')
}

test('fileMoveUiLifecycle', async ({ page }) => {
  const api = await request.newContext({ baseURL })
  let headers
  let sourceFolderId
  let targetFolderId
  let fileId
  const objects = []
  try {
    const adminLogin = await api.post('/api/auth/login', { data: { username: 'superadmin', password: process.env.FQA_SUPERADMIN_PASSWORD } })
    headers = { Authorization: `Bearer ${(await adminLogin.json()).data.token}` }
    const groups = await api.get('/api/groups', { headers })
    const groupBody = await groups.json()
    const group = (groupBody.data?.records ?? groupBody.data ?? []).find(value => value.name === '管理组')
    const source = await api.post('/api/files/folders', { headers, data: { name: `${runId}_source`, ownerGroupId: group.id } })
    const target = await api.post('/api/files/folders', { headers, data: { name: `${runId}_target`, ownerGroupId: group.id } })
    sourceFolderId = (await source.json()).data.id
    targetFolderId = (await target.json()).data.id
    objects.push({ caseId: 'FILE-012', type: 'folder', id: sourceFolderId, runId })
    updateManifest(objects)
    objects.push({ caseId: 'FILE-012', type: 'folder', id: targetFolderId, runId })
    updateManifest(objects)
    const upload = await api.post('/api/files/upload', {
      headers,
      multipart: { file: { name: `${runId}.txt`, mimeType: 'text/plain', buffer: Buffer.from('move via UI') }, folder_id: String(sourceFolderId) },
    })
    fileId = (await upload.json()).data.id
    objects.push({ caseId: 'FILE-012', type: 'file', id: fileId, runId })
    updateManifest(objects)

    await page.goto(`${baseURL}/login`)
    await page.locator('#username').fill('superadmin')
    await page.locator('#password').fill(process.env.FQA_SUPERADMIN_PASSWORD || '')
    await page.getByRole('button', { name: '登录' }).click()
    await expect(page.getByLabel('打开用户菜单')).toBeVisible()
    await page.goto(`${baseURL}/files`)
    await page.getByRole('button', { name: `${runId}_source`, exact: true }).click()
    await expect(page.getByText(runId, { exact: true })).toBeVisible()
    await page.getByTitle('移动文件').click()
    await expect(page.getByRole('heading', { name: '移动文件' })).toBeVisible()
    await page.getByRole('combobox').selectOption(String(targetFolderId))
    await page.getByRole('button', { name: '保存' }).click()
    await expect(page.getByText('文件已移动')).toBeVisible()
    await page.getByRole('button', { name: `${runId}_target`, exact: true }).click()
    await expect(page.getByText(runId, { exact: true })).toBeVisible()
  } finally {
    if (fileId) {
      expect((await api.delete(`/api/files/${fileId}`, { headers })).status()).toBe(200)
      objects.splice(objects.findIndex(object => object.type === 'file' && object.id === fileId), 1)
      updateManifest(objects)
    }
    if (sourceFolderId) {
      expect((await api.delete(`/api/files/folders/${sourceFolderId}`, { headers })).status()).toBe(200)
      objects.splice(objects.findIndex(object => object.type === 'folder' && object.id === sourceFolderId), 1)
      updateManifest(objects)
    }
    if (targetFolderId) {
      expect((await api.delete(`/api/files/folders/${targetFolderId}`, { headers })).status()).toBe(200)
      objects.splice(objects.findIndex(object => object.type === 'folder' && object.id === targetFolderId), 1)
      updateManifest(objects)
    }
    await api.dispose()
  }
})
