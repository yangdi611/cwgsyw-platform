const { test, expect, request } = require('@playwright/test')
const { execFileSync } = require('child_process')

const baseURL = process.env.FQA_BASE_URL || 'http://127.0.0.1'
const suffix = Date.now()
const runId = `REM_P1_071_${suffix}`

function mockServerPut(path, body) {
  const payload = JSON.stringify(body)
  const requestText = [
    `PUT ${path} HTTP/1.1`,
    'Host: external-api-mock:1080',
    'Content-Type: application/json',
    `Content-Length: ${Buffer.byteLength(payload)}`,
    'Connection: close',
    '',
    payload,
  ].join('\r\n')
  return execFileSync('docker', [
    'exec', '-i', 'cwgsyw-platform-backend-1',
    'nc', 'external-api-mock', '1080',
  ], { input: requestText, encoding: 'utf8' })
}

async function responseData(response, expectedStatus = 200) {
  const body = await response.json()
  expect(response.status(), JSON.stringify(body)).toBe(expectedStatus)
  return body.data
}

test('run-scoped CMDB alert cleanup is exact, soft-delete audited, and reversible', async () => {
  test.skip(!process.env.FQA_SUPERADMIN_PASSWORD, 'FQA_SUPERADMIN_PASSWORD is required')
  test.setTimeout(180_000)

  const api = await request.newContext({ baseURL })
  let headers
  let configBefore
  let alertId
  let prometheusChanged = false
  let expectationCreated = false

  try {
    headers = (await responseData(await api.post('/api/auth/login', {
      data: { username: 'superadmin', password: process.env.FQA_SUPERADMIN_PASSWORD },
    }))).token
    headers = { Authorization: `Bearer ${headers}` }
    configBefore = await responseData(await api.get('/api/admin/config', { headers }))

    const alertBody = {
      status: 'success',
      data: {
        alerts: [{
          fingerprint: `remp1071${suffix}`,
          status: 'firing',
          labels: { alertname: runId, severity: 'warning', run_id: runId },
          annotations: { summary: runId, description: runId },
          startsAt: new Date().toISOString(),
          endsAt: '0001-01-01T00:00:00Z',
        }],
      },
    }
    const expectationResponse = mockServerPut('/mockserver/expectation', {
      httpRequest: { method: 'GET', path: '/api/v1/alerts' },
      httpResponse: {
        statusCode: 200,
        headers: { 'Content-Type': ['application/json'] },
        body: JSON.stringify(alertBody),
      },
      priority: 100,
    })
    expectationCreated = true
    expect(expectationResponse).toContain('201 Created')

    expect((await api.put('/api/admin/config/prometheus', {
      headers,
      data: { enabled: true, url: 'http://external-api-mock:1080', scrapeInterval: 10 },
    })).status()).toBe(200)
    prometheusChanged = true

    await expect.poll(async () => {
      const page = await responseData(await api.get('/api/cmdb/alerts?page=1&size=100', { headers }))
      const alert = page.records.find((candidate) => candidate.alertName === runId)
      alertId = alert?.id
      return Boolean(alertId)
    }, { timeout: 90_000, intervals: [1000] }).toBe(true)

    expect((await api.put('/api/admin/config/prometheus', {
      headers,
      data: {
        enabled: configBefore['prometheus.enabled'] === 'true',
        url: configBefore['prometheus.url'],
        scrapeInterval: Number(configBefore['prometheus.scrape_interval']),
      },
    })).status()).toBe(200)
    prometheusChanged = false
    const clearResponse = mockServerPut('/mockserver/clear', {
      path: '/api/v1/alerts',
    })
    expect(clearResponse).toContain('200 OK')
    expectationCreated = false

    expect((await api.delete(`/api/cmdb/alerts/${alertId}/remediation-test`, {
      headers,
      params: { remediationRunId: `${runId}_wrong` },
    })).status()).toBe(400)
    const beforeCleanup = await responseData(await api.get('/api/cmdb/alerts?page=1&size=100', { headers }))
    expect(beforeCleanup.records.some((alert) => alert.id === alertId)).toBe(true)

    expect((await api.delete(`/api/cmdb/alerts/${alertId}/remediation-test`, {
      headers,
      params: { remediationRunId: runId },
    })).status()).toBe(200)
    const afterCleanup = await responseData(await api.get('/api/cmdb/alerts?page=1&size=100', { headers }))
    expect(afterCleanup.records.some((alert) => alert.id === alertId)).toBe(false)
    expect((await api.delete(`/api/cmdb/alerts/${alertId}/remediation-test`, {
      headers,
      params: { remediationRunId: runId },
    })).status()).toBe(400)

    const audits = await responseData(await api.get('/api/audit-logs', {
      headers,
      params: { module: 'cmdb', action: 'purge_remediation_test', page: 1, size: 100 },
    }))
    expect(audits.records).toEqual(expect.arrayContaining([
      expect.objectContaining({ targetId: alertId, targetType: 'cmdb_alert' }),
    ]))
  } finally {
    if (headers && configBefore && prometheusChanged) {
      await api.put('/api/admin/config/prometheus', {
        headers,
        data: {
          enabled: configBefore['prometheus.enabled'] === 'true',
          url: configBefore['prometheus.url'],
          scrapeInterval: Number(configBefore['prometheus.scrape_interval']),
        },
      })
    }
    if (expectationCreated) {
      mockServerPut('/mockserver/clear', { path: '/api/v1/alerts' })
    }
    if (headers && alertId) {
      const alerts = await responseData(await api.get('/api/cmdb/alerts?page=1&size=100', { headers }))
      if (alerts.records.some((alert) => alert.id === alertId)) {
        await api.delete(`/api/cmdb/alerts/${alertId}/remediation-test`, {
          headers,
          params: { remediationRunId: runId },
        })
      }
    }
    await api.dispose()
  }
})
