const { test, expect, request } = require('@playwright/test')
const fs = require('fs')
const path = require('path')

const baseURL = process.env.FQA_BASE_URL || 'http://127.0.0.1'
const runId = 'REM_P1_054_20260720'
const manifestPath = path.join(__dirname, '..', 'docs', 'plan', 'full-platform-remediation',
  '07-platform-integration', 'REM-P1-054-watermark-angle-preview-contract', 'test-data-manifest.json')

function updateManifest(objects, cleanupFailures = 0) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  expect(manifest.runId).toBe(runId)
  const temporaryPath = `${manifestPath}.${process.pid}.${Date.now()}.tmp`
  fs.writeFileSync(temporaryPath, `${JSON.stringify({ ...manifest, objects, cleanupFailures }, null, 2)}\n`, { flag: 'wx' })
  fs.renameSync(temporaryPath, manifestPath)
}

async function responseData(response, expectedStatus = 200) {
  const body = await response.json()
  expect(response.status(), JSON.stringify(body)).toBe(expectedStatus)
  return body.data
}

test('watermark angle, preview, persistence and exact restoration', async ({ page }) => {
  test.skip(!process.env.FQA_SUPERADMIN_PASSWORD, 'FQA_SUPERADMIN_PASSWORD is required')
  const api = await request.newContext({ baseURL })
  const objects = []
  const errors = []
  const failures = []
  let headers
  let before
  let changed = false
  let cleanupFailures = 0

  page.on('pageerror', error => errors.push(error.message))
  page.on('response', response => { if (response.status() >= 500) failures.push(`${response.status()} ${response.url()}`) })

  try {
    updateManifest([])
    const login = await responseData(await api.post('/api/auth/login', {
      data: { username: 'superadmin', password: process.env.FQA_SUPERADMIN_PASSWORD },
    }))
    headers = { Authorization: `Bearer ${login.token}` }
    before = await responseData(await api.get('/api/admin/config', { headers }))
    objects.push({ type: 'config-restore', id: 'watermark', runId })
    updateManifest(objects)

    for (const invalid of [
      { enabled: true, text: `${runId}_invalid`, opacity: -0.01, angle: 45, position: 'center' },
      { enabled: true, text: `${runId}_invalid`, opacity: 1.01, angle: 45, position: 'center' },
      { enabled: true, text: `${runId}_invalid`, opacity: 0.5, angle: -181, position: 'center' },
      { enabled: true, text: `${runId}_invalid`, opacity: 0.5, angle: 181, position: 'center' },
      { enabled: true, text: `${runId}_invalid`, opacity: 0.5, angle: 45, position: 'diagonal' },
    ]) {
      expect((await api.put('/api/admin/config/watermark', { headers, data: invalid })).status()).toBe(400)
      const unchanged = await responseData(await api.get('/api/admin/config', { headers }))
      expect(unchanged).toMatchObject({
        'watermark.enabled': before['watermark.enabled'],
        'watermark.text': before['watermark.text'],
        'watermark.opacity': before['watermark.opacity'],
        'watermark.angle': before['watermark.angle'],
        'watermark.position': before['watermark.position'],
      })
    }

    await page.goto(`${baseURL}/login`)
    await page.locator('#username').fill('superadmin')
    await page.locator('#password').fill(process.env.FQA_SUPERADMIN_PASSWORD)
    await page.getByRole('button', { name: '登录', exact: true }).click()
    await page.waitForURL(`${baseURL}/`)
    await page.goto(`${baseURL}/admin/config`)
    await page.getByRole('button', { name: '文档水印', exact: true }).click()

    const panel = page.getByRole('heading', { name: '文档水印', exact: true }).locator('..')
    const enabled = panel.getByRole('switch', { name: '启用水印' })
    if (!(await enabled.isChecked())) await enabled.click()
    const text = `${runId}_即时预览`
    await panel.getByPlaceholder('内部资料 请勿外传').fill(text)
    await panel.getByPlaceholder('0.3').fill('0.55')
    await page.locator('#watermark-angle').fill('-30')
    await panel.getByRole('combobox').click()
    await page.getByRole('option', { name: '左上角', exact: true }).click()

    const preview = page.getByTestId('watermark-preview-text')
    await expect(preview).toHaveText(text)
    await expect(preview).toHaveClass(/left-4/)
    await expect(preview).toHaveClass(/top-4/)
    await expect(preview).toHaveCSS('opacity', '0.55')
    await expect(preview).toHaveCSS('rotate', '-30deg')

    const saveResponse = page.waitForResponse(response =>
      response.request().method() === 'PUT' && response.url().endsWith('/api/admin/config/watermark'))
    await panel.getByRole('button', { name: '保存水印配置', exact: true }).click()
    expect((await saveResponse).status()).toBe(200)
    changed = true

    const saved = await responseData(await api.get('/api/admin/config', { headers }))
    expect(saved).toMatchObject({
      'watermark.enabled': 'true',
      'watermark.text': text,
      'watermark.opacity': '0.55',
      'watermark.angle': '-30',
      'watermark.position': 'top-left',
    })
    await page.reload()
    await page.getByRole('button', { name: '文档水印', exact: true }).click()
    await expect(page.locator('#watermark-angle')).toHaveValue('-30')
    await expect(page.getByTestId('watermark-preview-text')).toHaveCSS('rotate', '-30deg')
    expect(errors).toEqual([])
    expect(failures).toEqual([])
  } finally {
    try {
      if (headers && before && changed) {
        const restore = await api.put('/api/admin/config/watermark', {
          headers,
          data: {
            enabled: before['watermark.enabled'] === 'true',
            text: before['watermark.text'] ?? '',
            opacity: Number(before['watermark.opacity']),
            angle: Number(before['watermark.angle']),
            position: before['watermark.position'] || 'bottom-right',
          },
        })
        expect(restore.status()).toBe(200)
        const restored = await responseData(await api.get('/api/admin/config', { headers }))
        expect(restored).toMatchObject({
          'watermark.enabled': before['watermark.enabled'],
          'watermark.text': before['watermark.text'],
          'watermark.opacity': before['watermark.opacity'],
          'watermark.angle': before['watermark.angle'],
          'watermark.position': before['watermark.position'],
        })
      }
      objects.length = 0
    } catch (error) {
      cleanupFailures += 1
      throw error
    } finally {
      updateManifest(objects, cleanupFailures)
      await api.dispose()
    }
  }
  expect(objects).toEqual([])
  expect(cleanupFailures).toBe(0)
})
