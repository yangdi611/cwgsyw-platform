const { test, expect, request } = require('@playwright/test')

const baseURL = process.env.FQA_BASE_URL || 'http://127.0.0.1'

test('stAuthz019RejectsInvalidCutoverConfirmationsWithoutStateChange', async () => {
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

    for (const action of ['enforce', 'rollback']) {
      for (const confirmation of ['', 'enforce', 'rollback', 'INVALID']) {
        const response = await api.post(`/api/rbac/migration/cutover/${action}`, {
          headers, data: { confirmation },
        })
        expect(response.status(), `${action}:${confirmation || 'empty'}`).toBe(400)
        const afterResponse = await api.get('/api/rbac/migration/cutover', { headers })
        expect(afterResponse.status()).toBe(200)
        expect((await afterResponse.json()).data).toEqual(before)
      }
    }
  } finally {
    await api.dispose()
  }
})
