const { test, expect, request } = require('@playwright/test')

const baseURL = process.env.FQA_BASE_URL || 'http://127.0.0.1'

test('stAuthz020RejectsDuplicateEnforceAndHidesTheUiEntry', async ({ page }) => {
  const api = await request.newContext({ baseURL })
  try {
    const login = await api.post('/api/auth/login', {
      data: { username: 'superadmin', password: process.env.FQA_SUPERADMIN_PASSWORD },
    })
    expect(login.status()).toBe(200)
    const headers = { Authorization: `Bearer ${(await login.json()).data.token}` }
    const beforeResponse = await api.get('/api/rbac/migration/cutover', { headers })
    expect(beforeResponse.status()).toBe(200)
    const before = (await beforeResponse.json()).data
    expect(before.cutoverStatus).toBe('enforced')

    const duplicate = await api.post('/api/rbac/migration/cutover/enforce', {
      headers, data: { confirmation: 'ENFORCE' },
    })
    expect(duplicate.status()).toBe(409)
    const afterResponse = await api.get('/api/rbac/migration/cutover', { headers })
    expect(afterResponse.status()).toBe(200)
    expect((await afterResponse.json()).data).toEqual(before)

    await page.goto(`${baseURL}/login`)
    await page.locator('#username').fill('superadmin')
    await page.locator('#password').fill(process.env.FQA_SUPERADMIN_PASSWORD || '')
    await page.getByRole('button', { name: '登录', exact: true }).click()
    await page.waitForURL(`${baseURL}/`)
    await page.goto(`${baseURL}/rbac/migration-exceptions`)
    await expect(page.getByText('严格 Enforced', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: /全量切换 Enforced/ })).toHaveCount(0)
    await expect(page.getByRole('button', { name: '紧急回退', exact: true })).toBeVisible()
  } finally {
    await api.dispose()
  }
})
