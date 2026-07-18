const { test, expect, request } = require('@playwright/test')

const baseURL = process.env.FQA_BASE_URL || 'http://127.0.0.1'

test('remP1041ResetsNewFolderDraftForEveryClosePath', async ({ page }) => {
  test.skip(!process.env.FQA_SUPERADMIN_PASSWORD, 'FQA_SUPERADMIN_PASSWORD is required')
  let folderWrites = 0
  page.on('request', request => {
    if (request.method() === 'POST' && request.url().endsWith('/api/files/folders')) folderWrites += 1
  })
  await page.goto(`${baseURL}/login`)
  await page.locator('#username').fill('superadmin')
  await page.locator('#password').fill(process.env.FQA_SUPERADMIN_PASSWORD)
  await page.getByRole('button', { name: '登录', exact: true }).click()
  await page.waitForURL(`${baseURL}/`)
  await page.goto(`${baseURL}/files`)

  const open = async () => {
    await page.getByRole('button', { name: '新建文件夹', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: '新建文件夹' })
    await expect(dialog.getByPlaceholder('文件夹名称')).toHaveValue('')
    return dialog
  }
  const exercise = async (draft, close) => {
    const dialog = await open()
    await dialog.getByPlaceholder('文件夹名称').fill(draft)
    await close(dialog)
    await expect(dialog).toHaveCount(0)
  }

  await exercise('ESC_DRAFT', async () => page.keyboard.press('Escape'))
  await exercise('OVERLAY_DRAFT', async () => page.locator('[data-slot="dialog-overlay"]').click({ position: { x: 4, y: 4 } }))
  await exercise('CLOSE_DRAFT', async dialog => dialog.getByRole('button', { name: 'Close', exact: true }).click())
  await exercise('CANCEL_DRAFT', async dialog => dialog.getByRole('button', { name: '取消', exact: true }).click())
  const finalDialog = await open()
  await finalDialog.getByRole('button', { name: '取消', exact: true }).click()
  expect(folderWrites).toBe(0)
})

test('remP1041PreservesFolderCreateAndDeleteApi', async () => {
  test.skip(!process.env.FQA_SUPERADMIN_PASSWORD, 'FQA_SUPERADMIN_PASSWORD is required')
  const api = await request.newContext({ baseURL })
  const runId = `REM_P1_041_${Date.now()}`
  let folderId
  try {
    const login = await api.post('/api/auth/login', { data: { username: 'superadmin', password: process.env.FQA_SUPERADMIN_PASSWORD } })
    expect(login.status()).toBe(200)
    const headers = { Authorization: `Bearer ${(await login.json()).data.token}` }
    const created = await api.post('/api/files/folders', { headers, data: { name: runId, ownerGroupId: 1 } })
    expect(created.status()).toBe(200)
    folderId = (await created.json()).data.id
    const tree = await api.get('/api/files/folders', { headers })
    expect(JSON.stringify((await tree.json()).data)).toContain(runId)
    expect((await api.delete(`/api/files/folders/${folderId}`, { headers })).status()).toBe(200)
    folderId = undefined
  } finally {
    if (folderId) {
      const login = await api.post('/api/auth/login', { data: { username: 'superadmin', password: process.env.FQA_SUPERADMIN_PASSWORD } })
      const headers = { Authorization: `Bearer ${(await login.json()).data.token}` }
      expect((await api.delete(`/api/files/folders/${folderId}`, { headers })).status()).toBe(200)
    }
    await api.dispose()
  }
})
