const { test, expect } = require('@playwright/test')

const baseURL = process.env.FQA_BASE_URL || 'http://127.0.0.1'
const remediationRunId = 'FQA_20260717_1245_final_l4_DAILY_STATE'

test('cleanupDailyRunIdFixture', async ({ page }) => {
  test.skip(!process.env.FQA_SUPERADMIN_PASSWORD, 'FQA_SUPERADMIN_PASSWORD is required')
  await page.goto(`${baseURL}/login`)
  await page.locator('#username').fill('superadmin')
  await page.locator('#password').fill(process.env.FQA_SUPERADMIN_PASSWORD || '')
  await page.getByRole('button', { name: '登录' }).click()
  await expect(page.getByLabel('打开用户菜单')).toBeVisible()

  const outcome = await page.evaluate(async ({ remediationRunId }) => {
    const token = localStorage.getItem('cwgsyw_token')
    const headers = { Authorization: `Bearer ${token}` }
    const listResponse = await fetch('/api/daily-reports/group?page=1&size=200&month=2026-07', { headers })
    const listBody = await listResponse.json()
    const reports = listBody.data?.records ?? []
    const matches = reports.filter(report => [report.completedItems, report.issues, report.tomorrowPlan]
      .filter(Boolean).some(value => value.includes(remediationRunId)))
    const statuses = []
    for (const report of matches) {
      const response = await fetch(`/api/daily-reports/${report.id}/remediation-test?remediationRunId=${encodeURIComponent(remediationRunId)}`, {
        method: 'DELETE',
        headers,
      })
      statuses.push(response.status)
    }
    return { matched: matches.length, statuses }
  }, { remediationRunId })
  expect(outcome.statuses.every(status => status === 200)).toBe(true)
})
