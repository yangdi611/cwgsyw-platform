const { test, expect, request } = require('@playwright/test')

const baseURL = process.env.FQA_BASE_URL || 'http://127.0.0.1'

test('stAuthz007008015016021RollbackIsIdempotentAndEnforceRestoresRollout', async () => {
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
    expect(before).toMatchObject({ cutoverStatus: 'enforced', effectiveMode: 'enforced' })

    const rollback = await api.post('/api/rbac/migration/cutover/rollback', {
      headers, data: { confirmation: 'ROLLBACK' },
    })
    expect(rollback.status()).toBe(200)
    const legacy = (await rollback.json()).data
    expect(legacy).toMatchObject({ cutoverStatus: 'rollback', effectiveMode: 'legacy', cutoverEpoch: before.cutoverEpoch })

    const duplicate = await api.post('/api/rbac/migration/cutover/rollback', {
      headers, data: { confirmation: 'ROLLBACK' },
    })
    expect(duplicate.status()).toBe(409)
    const afterDuplicateResponse = await api.get('/api/rbac/migration/cutover', { headers })
    expect(afterDuplicateResponse.status()).toBe(200)
    expect((await afterDuplicateResponse.json()).data).toEqual(legacy)

    const preflight = await api.get('/api/rbac/migration/preflight', { headers })
    expect(preflight.status()).toBe(200)
    expect((await preflight.json()).data).toMatchObject({ eligible: true, issues: [] })
    const enforce = await api.post('/api/rbac/migration/cutover/enforce', {
      headers, data: { confirmation: 'ENFORCE' },
    })
    expect(enforce.status()).toBe(200)
    expect((await enforce.json()).data).toMatchObject({
      cutoverStatus: 'enforced', effectiveMode: 'enforced', cutoverEpoch: before.cutoverEpoch + 1,
    })
  } finally {
    await api.dispose()
  }
})
