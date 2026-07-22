const { test, expect, request } = require('@playwright/test')

const baseURL = process.env.FQA_BASE_URL || 'http://127.0.0.1'

test('AI-003 shows clear provider test failure and success feedback', async ({ page }) => {
  test.setTimeout(90_000)
  test.skip(!process.env.FQA_SUPERADMIN_PASSWORD, 'FQA_SUPERADMIN_PASSWORD is required')
  const api = await request.newContext({ baseURL })
  let headers
  let before
  try {
    const login = await api.post('/api/auth/login', { data: { username: 'superadmin', password: process.env.FQA_SUPERADMIN_PASSWORD } })
    expect(login.status()).toBe(200)
    headers = { Authorization: `Bearer ${(await login.json()).data.token}` }
    before = (await (await api.get('/api/admin/ai/providers', { headers })).json()).data.find((row) => row.provider === 'deepseek')
    expect((await api.put('/api/admin/ai/providers/deepseek', { headers, data: {
      apiKey: `fqa-ai003-${Date.now()}`, baseUrl: 'http://external-api-mock:1080/no-match',
      model: 'fixture-model', enabled: true, systemPrompt: 'AI-003',
    } })).status()).toBe(200)

    await page.goto(`${baseURL}/login`)
    await page.locator('#username').fill('superadmin')
    await page.locator('#password').fill(process.env.FQA_SUPERADMIN_PASSWORD)
    await page.getByRole('button', { name: '登录', exact: true }).click()
    await page.waitForURL(`${baseURL}/`)
    await page.goto(`${baseURL}/admin/ai`)
    const card = page.getByRole('heading', { name: 'DeepSeek', exact: true })
      .locator('xpath=ancestor::div[.//button[normalize-space()="测试"]][1]')
    const failurePromise = page.waitForResponse((response) => response.url().endsWith('/api/admin/ai/providers/deepseek/test'))
    await card.getByRole('button', { name: '测试', exact: true }).click()
    const failure = await failurePromise
    expect(failure.status()).toBe(400)
    expect(await failure.json()).toMatchObject({ code: 400, errorCode: 'AI_PROVIDER_TEST_FAILED' })
    await expect(page.getByText('测试失败', { exact: true })).toBeVisible()

    expect((await api.put('/api/admin/ai/providers/deepseek', { headers, data: {
      baseUrl: 'http://external-api-mock:1080', model: 'fixture-model', enabled: true, systemPrompt: 'AI-003',
    } })).status()).toBe(200)
    await page.reload()
    const successCard = page.getByRole('heading', { name: 'DeepSeek', exact: true })
      .locator('xpath=ancestor::div[.//button[normalize-space()="测试"]][1]')
    const successPromise = page.waitForResponse((response) => response.url().endsWith('/api/admin/ai/providers/deepseek/test'))
    await successCard.getByRole('button', { name: '测试', exact: true }).click()
    expect((await successPromise).status()).toBe(200)
    await expect(page.getByText('测试成功：isolated mock reply', { exact: true })).toBeVisible()
    await expect(successCard.locator('input[type="password"]')).toHaveValue('')
  } finally {
    if (headers && before) {
      await api.put('/api/admin/ai/providers/deepseek', { headers, data: {
        baseUrl: before.baseUrl, model: before.model, enabled: before.enabled, systemPrompt: before.systemPrompt,
      } })
      if (!before.configured) await api.delete('/api/admin/ai/providers/deepseek/api-key', { headers })
    }
    await api.dispose()
  }
})
