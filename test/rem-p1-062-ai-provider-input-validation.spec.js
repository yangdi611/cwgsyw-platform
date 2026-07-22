const { test, expect, request } = require('@playwright/test')

const baseURL = process.env.FQA_BASE_URL || 'http://127.0.0.1'

test('REM-P1-062 validates AI provider inputs and preserves secrets', async () => {
  test.skip(!process.env.FQA_SUPERADMIN_PASSWORD, 'FQA_SUPERADMIN_PASSWORD is required')
  const api = await request.newContext({ baseURL })
  let headers
  let before
  try {
    const login = await api.post('/api/auth/login', { data: { username: 'superadmin', password: process.env.FQA_SUPERADMIN_PASSWORD } })
    expect(login.status()).toBe(200)
    headers = { Authorization: `Bearer ${(await login.json()).data.token}` }
    before = (await (await api.get('/api/admin/ai/providers', { headers })).json()).data.find((row) => row.provider === 'deepseek')

    for (const data of [
      { baseUrl: '', model: before.model },
      { baseUrl: 'not a url', model: before.model },
      { baseUrl: 'ftp://example.test', model: before.model },
      { baseUrl: 'https:///missing-host', model: before.model },
      { baseUrl: before.baseUrl, model: '   ' },
      { baseUrl: before.baseUrl, model: 'm'.repeat(256) },
      { baseUrl: before.baseUrl, model: before.model, apiKey: 'k'.repeat(513) },
      { baseUrl: before.baseUrl, model: before.model, systemPrompt: 'p'.repeat(4097) },
    ]) {
      const response = await api.put('/api/admin/ai/providers/deepseek', { headers, data })
      expect(response.status(), JSON.stringify(data)).toBe(400)
      const current = (await (await api.get('/api/admin/ai/providers', { headers })).json()).data.find((row) => row.provider === 'deepseek')
      expect(current).toEqual(before)
    }

    const key = `rem-p1-062-${Date.now()}`
    expect((await api.put('/api/admin/ai/providers/deepseek', { headers, data: {
      apiKey: key, baseUrl: '  http://external-api-mock:1080///  ', model: '  fixture-model  ', enabled: true, systemPrompt: 'REM-P1-062',
    } })).status()).toBe(200)
    let current = (await (await api.get('/api/admin/ai/providers', { headers })).json()).data.find((row) => row.provider === 'deepseek')
    expect(current).toMatchObject({ baseUrl: 'http://external-api-mock:1080', model: 'fixture-model', configured: true })
    expect(JSON.stringify(current)).not.toContain(key)

    expect((await api.put('/api/admin/ai/providers/deepseek', { headers, data: {
      apiKey: '', baseUrl: current.baseUrl, model: current.model, enabled: true, systemPrompt: current.systemPrompt,
    } })).status()).toBe(200)
    current = (await (await api.get('/api/admin/ai/providers', { headers })).json()).data.find((row) => row.provider === 'deepseek')
    expect(current.configured).toBe(true)
    const success = await api.post('/api/admin/ai/providers/deepseek/test', { headers })
    expect(success.status()).toBe(200)
    expect((await success.json()).data).toBe('isolated mock reply')
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
