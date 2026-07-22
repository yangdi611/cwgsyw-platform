const { test, expect, request } = require('@playwright/test')
const fs = require('fs')
const path = require('path')

const baseURL = process.env.FQA_BASE_URL || 'http://127.0.0.1'
const suffix = Date.now()
const runId = `REM_P1_058_${suffix}`
const manifestPath = path.join(
  __dirname,
  '..',
  'docs',
  'plan',
  'full-platform-remediation',
  '02-account-organization',
  'REM-P1-058-group-active-name-uniqueness',
  'test-data-manifest.json',
)

function writeManifest(objects, cleanupFailures = 0) {
  fs.writeFileSync(manifestPath, `${JSON.stringify({ runId, objects, cleanupFailures }, null, 2)}\n`)
}

function records(body) {
  return Array.isArray(body.data) ? body.data : body.data?.records ?? []
}

test('group active names are unique across API and real UI', async ({ page }) => {
  test.skip(!process.env.FQA_SUPERADMIN_PASSWORD, 'FQA_SUPERADMIN_PASSWORD is required')
  const api = await request.newContext({ baseURL })
  const objects = []
  const cleanupErrors = []
  let headers

  const syncManifest = () => writeManifest(objects, cleanupErrors.length)
  const register = (id, name) => {
    objects.push({ caseId: 'RBAC-007', type: 'group', id, name, runId })
    syncManifest()
  }
  const remove = (id) => {
    const index = objects.findIndex((object) => object.id === id)
    if (index >= 0) objects.splice(index, 1)
    syncManifest()
  }
  const activeGroups = async () => {
    const response = await api.get('/api/groups?state=active', { headers })
    expect(response.status()).toBe(200)
    return records(await response.json())
  }
  const archive = async (id) => {
    const group = (await activeGroups()).find((candidate) => candidate.id === id)
    if (!group) return
    const preflightResponse = await api.get(`/api/groups/${id}/lifecycle-preflight?action=archive`, { headers })
    expect(preflightResponse.status()).toBe(200)
    const preflight = (await preflightResponse.json()).data
    expect(preflight.eligible).toBe(true)
    const response = await api.post(`/api/groups/${id}/archive`, {
      headers,
      data: {
        reason: `${runId} exact cleanup`,
        confirmationName: preflight.group.name,
        expectedUpdatedAt: preflight.group.updatedAt,
      },
    })
    expect(response.status()).toBe(200)
    remove(id)
  }

  const firstName = `${runId}_primary`
  const secondName = `${runId}_secondary`
  let firstId
  let secondId

  try {
    const login = await api.post('/api/auth/login', {
      data: { username: 'superadmin', password: process.env.FQA_SUPERADMIN_PASSWORD },
    })
    expect(login.status()).toBe(200)
    headers = { Authorization: `Bearer ${(await login.json()).data.token}` }

    const first = await api.post('/api/groups', {
      headers,
      data: { name: `  ${firstName}  `, description: runId },
    })
    expect(first.status()).toBe(200)
    firstId = (await first.json()).data.id
    register(firstId, firstName)

    const duplicate = await api.post('/api/groups', {
      headers,
      data: { name: firstName, description: `${runId}_duplicate` },
    })
    expect(duplicate.status()).toBe(400)
    expect(await duplicate.json()).toMatchObject({ code: 400, message: '用户组名称已存在' })
    expect((await activeGroups()).filter((group) => group.name === firstName)).toHaveLength(1)

    const second = await api.post('/api/groups', {
      headers,
      data: { name: secondName, description: `${runId}_original` },
    })
    expect(second.status()).toBe(200)
    secondId = (await second.json()).data.id
    register(secondId, secondName)

    await page.goto(`${baseURL}/login`)
    await page.locator('#username').fill('superadmin')
    await page.locator('#password').fill(process.env.FQA_SUPERADMIN_PASSWORD)
    await page.getByRole('button', { name: '登录', exact: true }).click()
    await page.waitForURL(`${baseURL}/`)
    await page.goto(`${baseURL}/groups`)

    await page.getByRole('button', { name: '新建组', exact: true }).click()
    await page.getByRole('dialog').locator('#name').fill(` ${firstName} `)
    const duplicateUiResponse = page.waitForResponse((response) =>
      response.url().endsWith('/api/groups') && response.request().method() === 'POST')
    await page.getByRole('dialog').getByRole('button', { name: '保存', exact: true }).click()
    expect((await duplicateUiResponse).status()).toBe(400)
    await expect(page.getByText('用户组名称已存在').last()).toBeVisible()
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.getByRole('dialog').getByRole('button', { name: '取消', exact: true }).click()

    const secondRow = page.getByRole('row').filter({ hasText: secondName })
    await secondRow.getByRole('button', { name: '编辑', exact: true }).click()
    await page.getByRole('dialog').locator('#name').fill(firstName)
    const updateUiResponse = page.waitForResponse((response) =>
      response.url().endsWith(`/api/groups/${secondId}`) && response.request().method() === 'PUT')
    await page.getByRole('dialog').getByRole('button', { name: '保存', exact: true }).click()
    expect((await updateUiResponse).status()).toBe(400)
    await expect(page.getByText('用户组名称已存在').last()).toBeVisible()
    await expect(page.getByRole('dialog')).toBeVisible()

    const secondReadback = (await activeGroups()).find((group) => group.id === secondId)
    expect(secondReadback).toMatchObject({ name: secondName, description: `${runId}_original` })
    expect((await activeGroups()).filter((group) => group.name === firstName)).toHaveLength(1)
  } finally {
    if (headers) {
      if (secondId) {
        try { await archive(secondId) } catch (error) { cleanupErrors.push(String(error)) }
      }
      if (firstId) {
        try { await archive(firstId) } catch (error) { cleanupErrors.push(String(error)) }
      }
    }
    syncManifest()
    await api.dispose()
    expect(cleanupErrors, 'cleanup failures').toEqual([])
    expect(objects, 'active manifest objects').toEqual([])
  }
})
