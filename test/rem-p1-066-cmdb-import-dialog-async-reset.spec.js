const { test, expect } = require('@playwright/test')

const baseURL = process.env.FQA_BASE_URL || 'http://127.0.0.1'

async function login(page) {
  await page.goto(`${baseURL}/login`)
  await page.locator('#username').fill('superadmin')
  await page.locator('#password').fill(process.env.FQA_SUPERADMIN_PASSWORD || '')
  await page.getByRole('button', { name: '登录', exact: true }).click()
  await page.waitForURL(`${baseURL}/`)
}

async function openImportDialog(page) {
  await page.getByRole('button', { name: '导入 CSV', exact: true }).click()
  return page.locator('[role="dialog"]:visible').filter({ hasText: '批量导入' })
}

async function installModelRoutes(page) {
  await page.route('**/api/cmdb/models/REM_P1_066', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ code: 0, message: 'ok', data: { id: 1, modelId: 'REM_P1_066', name: 'REM-P1-066', attributes: [] } }),
    })
  })
  await page.route(/\/api\/cmdb\/instances\?.*model=REM_P1_066/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ code: 0, message: 'ok', data: { records: [], total: 0, page: 1, size: 20 } }),
    })
  })
}

test.beforeEach(async ({ page }) => {
  test.skip(!process.env.FQA_SUPERADMIN_PASSWORD, 'FQA_SUPERADMIN_PASSWORD is required')
  await login(page)
  await installModelRoutes(page)
  await page.goto(`${baseURL}/cmdb/instances/by-model/REM_P1_066`)
})

test('late preview completion cannot advance a reopened dialog', async ({ page }) => {
  let releasePreview
  let previewStarted
  const previewGate = new Promise((resolve) => { releasePreview = resolve })
  const previewSeen = new Promise((resolve) => { previewStarted = resolve })
  await page.route('**/api/cmdb/instances/import/preview', async (route) => {
    previewStarted()
    await previewGate
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        code: 0,
        message: 'ok',
        data: { batchId: 'REM_P1_066_PREVIEW', totalRows: 1, toCreate: 1, toUpdate: 0, toSkip: 0, failedRows: [], encoding: 'UTF-8', previewData: [] },
      }),
    })
  })

  const dialog = await openImportDialog(page)
  await dialog.locator('input[type="file"]').setInputFiles({ name: 'preview.csv', mimeType: 'text/csv', buffer: Buffer.from('name\nREM_P1_066\n') })
  await dialog.getByRole('button', { name: '下一步', exact: true }).click()
  await previewSeen
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  releasePreview()
  await page.waitForTimeout(100)

  const reopened = await openImportDialog(page)
  await expect(reopened).toContainText('1. 上传文件')
  await expect(reopened.locator('input[type="file"]')).toHaveValue('')
})

test('late execute completion cannot leak result state into a reopened dialog', async ({ page }) => {
  await page.route('**/api/cmdb/instances/import/preview', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        code: 0,
        message: 'ok',
        data: { batchId: 'REM_P1_066_EXECUTE', totalRows: 1, toCreate: 1, toUpdate: 0, toSkip: 0, failedRows: [], encoding: 'UTF-8', previewData: [] },
      }),
    })
  })
  let releaseExecute
  let executeStarted
  const executeGate = new Promise((resolve) => { releaseExecute = resolve })
  const executeSeen = new Promise((resolve) => { executeStarted = resolve })
  await page.route('**/api/cmdb/instances/import/execute', async (route) => {
    executeStarted()
    await executeGate
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ code: 0, message: 'ok', data: { batchId: 'REM_P1_066_EXECUTE', totalRows: 1, created: 1, updated: 0, skipped: 0, failed: 0, durationMs: 10 } }),
    })
  })

  const dialog = await openImportDialog(page)
  await dialog.locator('input[type="file"]').setInputFiles({ name: 'execute.csv', mimeType: 'text/csv', buffer: Buffer.from('name\nREM_P1_066\n') })
  await dialog.getByRole('button', { name: '下一步', exact: true }).click()
  await dialog.getByRole('button', { name: '确认导入', exact: true }).click()
  await executeSeen
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  releaseExecute()
  await page.waitForTimeout(100)

  const reopened = await openImportDialog(page)
  await expect(reopened).toContainText('1. 上传文件')
  await expect(reopened.locator('input[type="file"]')).toHaveValue('')
  await expect(reopened.getByText('创建', { exact: true })).toHaveCount(0)
})
