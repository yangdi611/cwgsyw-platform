const { test, expect, request } = require('@playwright/test')

const baseURL = process.env.FQA_BASE_URL || 'http://127.0.0.1'
const fixture = { id: 343, username: 'FQA_20260718_0245_remp1037_l4_AUTHZ_database' }

function password() {
  return `Fqa!${Math.random().toString(36).slice(2, 10)}A9`
}

async function login(api, username, userPassword) {
  const response = await api.post('/api/auth/login', { data: { username, password: userPassword } })
  expect(response.status()).toBe(200)
  return { Authorization: `Bearer ${(await response.json()).data.token}` }
}

test('migration endpoints and UI deny non-platform scope with standard 403', async ({ page }) => {
  test.skip(!process.env.FQA_SUPERADMIN_PASSWORD, 'FQA_SUPERADMIN_PASSWORD is required')
  const api = await request.newContext({ baseURL })
  try {
    const superadminHeaders = await login(api, 'superadmin', process.env.FQA_SUPERADMIN_PASSWORD)
    const before = await api.get('/api/rbac/migration/cutover', { headers: superadminHeaders })
    expect(before.status()).toBe(200)
    const initialPassword = password()
    expect((await api.post(`/api/users/${fixture.id}/reset-password`, {
      headers: superadminHeaders,
      data: { newPassword: initialPassword, confirmPassword: initialPassword },
    })).status()).toBe(200)
    const setupHeaders = await login(api, fixture.username, initialPassword)
    const finalPassword = password()
    expect((await api.post('/api/account/setup', { headers: setupHeaders, data: {
      currentPassword: initialPassword, newPassword: finalPassword, confirmPassword: finalPassword,
      email: `${fixture.username}@example.test`, phone: '13800138000',
    } })).status()).toBe(200)
    const fixtureHeaders = await login(api, fixture.username, finalPassword)
    for (const path of [
      '/api/rbac/migration/preflight',
      '/api/rbac/migration/cutover',
      '/api/rbac/migration/pending-users',
      '/api/rbac/migration/exceptions?status=open&page=1&size=20',
    ]) {
      const response = await api.get(path, { headers: fixtureHeaders })
      expect(response.status()).toBe(403)
      expect((await response.json()).code).toBe(403)
    }
    expect((await api.get('/api/rbac/migration/preflight', { headers: superadminHeaders })).status()).toBe(200)
    const after = await api.get('/api/rbac/migration/cutover', { headers: superadminHeaders })
    expect(after.status()).toBe(200)
    expect((await after.json()).data).toEqual((await before.json()).data)

    await page.goto('/login')
    await page.locator('#username').fill(fixture.username)
    await page.locator('#password').fill(finalPassword)
    await page.getByRole('button', { name: '登录' }).click()
    await expect(page).toHaveURL(/\/$/)
    await expect(page.getByText('迁移异常', { exact: true })).toHaveCount(0)
    await page.goto('/rbac/migration-exceptions')
    await expect(page).toHaveURL(/\/$/)
  } finally {
    await api.dispose()
  }
})
