const { test, expect } = require('@playwright/test')

const baseURL = process.env.FQA_BASE_URL || 'http://127.0.0.1'
const remediationRunId = 'FQA_20260717_1245_final_l4_DAILY_STATE'

async function login(page) {
  await page.goto(`${baseURL}/login`)
  await page.locator('#username').fill('superadmin')
  await page.locator('#password').fill(process.env.FQA_SUPERADMIN_PASSWORD || '')
  await page.getByRole('button', { name: '登录' }).click()
  await expect(page).not.toHaveURL(/\/login/)
  await expect(page.getByLabel('打开用户菜单')).toBeVisible()
  await expect.poll(() => page.evaluate(() => localStorage.getItem('cwgsyw_token'))).not.toBeNull()
}

test('l4DailyAdminOwnDraftSubmitApproveAndCleanup', async ({ page }, testInfo) => {
  test.skip(!process.env.FQA_SUPERADMIN_PASSWORD, 'FQA_SUPERADMIN_PASSWORD is required')

  const today = new Date().toISOString().slice(0, 10)
  let reportId
  await login(page)

  await page.goto(`${baseURL}/daily/new`)
  const groupSelect = page.getByText('请选择所属组')
  if (await groupSelect.count()) {
    await groupSelect.first().click()
    await page.getByRole('option').first().click()
  }
  await page.locator('#reportDate').fill(today)
  await page.locator('#completedItems').fill(`${remediationRunId} complete`)
  await page.locator('#issues').fill(`${remediationRunId} no issues`)
  await page.locator('#tomorrowPlan').fill(`${remediationRunId} plan`)
  await page.locator('#workHours').fill('1')
  await page.getByRole('button', { name: '保存草稿' }).click()
  await expect(page).toHaveURL(/\/daily$/)
  reportId = await page.evaluate(async ({ remediationRunId, today }) => {
    const token = localStorage.getItem('cwgsyw_token')
    const response = await fetch(`/api/daily-reports/group?page=1&size=200&month=${today.slice(0, 7)}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const body = await response.json()
    const report = (body.data?.records ?? []).find(item => item.completedItems?.includes(remediationRunId))
    return report?.id
  }, { remediationRunId, today })
  expect(reportId).toBeTruthy()

  await page.goto(`${baseURL}/daily/${reportId}`)
  await expect(page.getByText('草稿')).toBeVisible()
  await page.goto(`${baseURL}/daily`)
  await page.getByText(String(new Date(`${today}T00:00:00`).getDate()), { exact: true }).click()
  await page.getByRole('button', { name: '提交审批' }).click()
  await expect(page.getByText('日报已提交审批')).toBeVisible()

  await page.goto(`${baseURL}/daily/${reportId}`)
  await expect(page.getByText('待审批')).toBeVisible()
  await expect(page.getByRole('button', { name: '审批此日报' })).toBeVisible()
  await page.getByRole('button', { name: '审批此日报' }).click()
  await page.getByRole('button', { name: '通过' }).click()
  await expect(page.getByText('已通过审批')).toBeVisible()
  await expect(page.getByText('已通过', { exact: true })).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('daily-approved.png') })

  const cleanupStatus = await page.evaluate(async ({ reportId, remediationRunId }) => {
    const token = localStorage.getItem('cwgsyw_token')
    const response = await fetch(`/api/daily-reports/${reportId}/remediation-test?remediationRunId=${encodeURIComponent(remediationRunId)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
    return response.status
  }, { reportId, remediationRunId })
  expect(cleanupStatus).toBe(200)
  const afterCleanupStatus = await page.evaluate(async ({ reportId }) => {
    const token = localStorage.getItem('cwgsyw_token')
    const response = await fetch(`/api/daily-reports/${reportId}`, { headers: { Authorization: `Bearer ${token}` } })
    return response.status
  }, { reportId })
  expect(afterCleanupStatus).toBe(400)
})
