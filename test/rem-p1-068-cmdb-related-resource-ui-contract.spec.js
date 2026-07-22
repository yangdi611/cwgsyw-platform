const { test, expect } = require('@playwright/test')

const baseURL = process.env.FQA_BASE_URL || 'http://127.0.0.1'

function apiBody(data) {
  return JSON.stringify({ code: 200, message: 'success', data })
}

test('CMDB related resources consume API DTO fields and link to real detail routes', async ({ page }) => {
  test.skip(!process.env.FQA_SUPERADMIN_PASSWORD, 'FQA_SUPERADMIN_PASSWORD is required')
  const consoleErrors = []
  const serverFailures = []
  page.on('pageerror', error => consoleErrors.push(error.message))
  page.on('console', message => {
    if (message.type() === 'error') consoleErrors.push({ text: message.text(), location: message.location() })
  })
  page.on('response', response => {
    if (response.status() >= 500) serverFailures.push(`${response.status()} ${response.url()}`)
  })

  await page.goto(`${baseURL}/login`)
  await page.locator('#username').fill('superadmin')
  await page.locator('#password').fill(process.env.FQA_SUPERADMIN_PASSWORD)
  await page.getByRole('button', { name: '登录', exact: true }).click()
  await page.waitForURL(`${baseURL}/`)

  await page.route(/\/api\/cmdb\/instances\/680068$/, async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: apiBody({
        id: 680068,
        modelId: 'REM_P1_068',
        modelName: 'REM-P1-068 Model',
        name: 'REM-P1-068 Instance',
        status: 'online',
        fieldsData: {},
        fieldConfig: [],
        attributes: [],
        createdAt: '2026-07-21T10:00:00',
        updatedAt: '2026-07-21T10:00:00',
        createdByName: 'superadmin',
      }),
    })
  })
  await page.route('**/api/cmdb/models/REM_P1_068**', async route => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: apiBody({ id: 6800, modelId: 'REM_P1_068', name: 'REM-P1-068 Model', attributes: [] }) })
  })
  await page.route('**/api/cmdb/instances/680068/devices', async route => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: apiBody([]) })
  })
  await page.route('**/api/cmdb/instances/680068/relations/reverse-defs', async route => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: apiBody([]) })
  })
  await page.route('**/api/cmdb/instances/680068/change-docs', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: apiBody([{ id: 680069, changeNo: 'REM-P1-068-CHANGE', title: '关联变更', status: 'draft', applicantName: '测试人', impactLevel: 'high', linkCreatedAt: '2026-07-21T10:00:00' }]),
    })
  })
  await page.route('**/api/cmdb/instances/680068/daily-reports', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: apiBody([{ id: 680070, reporterName: '日报人', reportDate: '2026-07-21', status: 'DRAFT', completedItemsBrief: '完成事项' }]),
    })
  })

  await page.goto(`${baseURL}/cmdb/instances/by-model/REM_P1_068/680068`)
  await expect(page.getByRole('heading', { name: 'REM-P1-068 Instance', exact: true })).toBeVisible()
  await page.getByRole('button', { name: '关联资源', exact: true }).click()
  await expect(page.getByText('关联变更', { exact: true })).toBeVisible()
  await expect(page.getByText(/REM-P1-068-CHANGE/)).toBeVisible()
  await expect(page.getByText('2026-07-21', { exact: true })).toBeVisible()
  await expect(page.getByText('日报人', { exact: true })).toBeVisible()
  await expect(page.locator('a[href="/change-docs/680069"]')).toBeVisible()
  await expect(page.locator('a[href="/daily/680070"]')).toBeVisible()
  expect(consoleErrors).toEqual([])
  expect(serverFailures).toEqual([])
})
