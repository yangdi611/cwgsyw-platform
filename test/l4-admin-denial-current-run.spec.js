const { test, expect, request } = require('@playwright/test')
const fs = require('fs')
const path = require('path')

const baseURL = process.env.FQA_BASE_URL || 'http://127.0.0.1'
const l4RunId = process.env.FQA_L4_RUN_ID || 'FQA_20260718_2050_remp1038'
const suffix = Date.now()
const runId = `${l4RunId}_admin_denial_${suffix}`
const username = `fqa_l4_admin_denial_${suffix}`
const roleCode = `fqa_l4_admin_denial_${suffix}`
const initialPassword = `Fqa!${Math.random().toString(36).slice(2, 10)}A9`
const finalPassword = `Fqa!${Math.random().toString(36).slice(2, 10)}B8`
const manifestPath = path.join(__dirname, '..', 'docs', 'acceptance', 'full-platform-exhaustive-functional-test-v1.0', 'runs', l4RunId, 'test-data-manifest.json')

function updateManifest(objects) {
  fs.writeFileSync(manifestPath, JSON.stringify({ runId: l4RunId, objects, cleanupFailures: 0 }, null, 2) + '\n')
}

test('configAiAndBackupRequireAuthenticatedPermissions', async ({ page }) => {
  test.skip(!process.env.FQA_SUPERADMIN_PASSWORD, 'FQA_SUPERADMIN_PASSWORD is required')
  const api = await request.newContext({ baseURL })
  let adminHeaders
  let roleId
  let userId
  let assignmentId
  try {
    const adminLogin = await api.post('/api/auth/login', { data: { username: 'superadmin', password: process.env.FQA_SUPERADMIN_PASSWORD } })
    expect(adminLogin.status()).toBe(200)
    adminHeaders = { Authorization: `Bearer ${(await adminLogin.json()).data.token}` }
    const role = await api.post('/api/rbac/roles', { headers: adminHeaders, data: { name: runId, code: roleCode, description: runId, permissionIds: [] } })
    expect(role.status()).toBe(200)
    roleId = (await role.json()).data.id
    updateManifest([{ caseId: 'CONFIG-006', type: 'role', id: roleId, runId }])
    const user = await api.post('/api/users', { headers: adminHeaders, data: { username, password: initialPassword, realName: runId, email: `${username}@example.test`, phone: '13800138000', groupId: 1 } })
    expect(user.status()).toBe(200)
    userId = (await user.json()).data.id
    updateManifest([{ caseId: 'CONFIG-006', type: 'role', id: roleId, runId }, { caseId: 'CONFIG-006', type: 'user', id: userId, runId }])
    expect((await api.post(`/api/users/${userId}/role-assignments`, { headers: adminHeaders, data: { roleId, scopeType: 'group', scopeId: 1 } })).status()).toBe(200)
    assignmentId = (await (await api.get(`/api/users/${userId}/role-assignments`, { headers: adminHeaders })).json()).data.find(item => item.roleId === roleId).id
    updateManifest([{ caseId: 'CONFIG-006', type: 'role', id: roleId, runId }, { caseId: 'CONFIG-006', type: 'user', id: userId, runId }, { caseId: 'CONFIG-006', type: 'role-assignment', id: assignmentId, userId, runId }])
    const initialLogin = await api.post('/api/auth/login', { data: { username, password: initialPassword } })
    expect(initialLogin.status()).toBe(200)
    const initialHeaders = { Authorization: `Bearer ${(await initialLogin.json()).data.token}` }
    expect((await api.post('/api/account/setup', { headers: initialHeaders, data: { currentPassword: initialPassword, newPassword: finalPassword, confirmPassword: finalPassword, email: `${username}@example.test`, phone: '13800138000' } })).status()).toBe(200)
    const login = await api.post('/api/auth/login', { data: { username, password: finalPassword } })
    expect(login.status()).toBe(200)
    const headers = { Authorization: `Bearer ${(await login.json()).data.token}` }
    for (const endpoint of ['/api/admin/config', '/api/admin/ai/providers', '/api/backups?page=1&size=1']) {
      expect((await api.get(endpoint, { headers })).status()).toBe(403)
    }
    expect((await api.put('/api/admin/config/prometheus', { headers, data: { enabled: false } })).status()).toBe(403)
    expect((await api.post('/api/admin/ai/providers/deepseek/test', { headers })).status()).toBe(403)
    expect((await api.post('/api/backups', { headers })).status()).toBe(403)
    await page.goto(`${baseURL}/login`)
    await page.locator('#username').fill(username)
    await page.locator('#password').fill(finalPassword)
    await page.getByRole('button', { name: '登录', exact: true }).click()
    await page.waitForURL(`${baseURL}/`)
    for (const route of ['/admin/config', '/admin/ai', '/admin/backup']) {
      await page.goto(`${baseURL}${route}`)
      await expect(page).toHaveURL(`${baseURL}/`)
    }
  } finally {
    if (assignmentId && userId) expect((await api.delete(`/api/users/${userId}/role-assignments/${assignmentId}`, { headers: adminHeaders })).status()).toBe(200)
    if (userId) expect((await api.delete(`/api/users/${userId}`, { headers: adminHeaders })).status()).toBe(200)
    if (roleId) expect((await api.delete(`/api/rbac/roles/${roleId}`, { headers: adminHeaders })).status()).toBe(200)
    updateManifest([])
    await api.dispose()
  }
})
