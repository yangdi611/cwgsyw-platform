const { test, expect } = require('@playwright/test')

const baseURL = process.env.FQA_BASE_URL || 'http://127.0.0.1'

test('auth003InvalidLoginMatrix', async ({ page }, testInfo) => {
  const attempts = [
    { username: 'superadmin', password: 'Fqa!Wrong1', expectsRequest: true },
    { username: 'FQA_AUTH003_DOES_NOT_EXIST', password: 'Fqa!Wrong1', expectsRequest: true },
    { username: '', password: '', expectsRequest: false },
    { username: 'superadmin', password: '', expectsRequest: false },
  ]
  const errors = []
  page.on('pageerror', error => errors.push(error.message))

  for (const attempt of attempts) {
    await page.goto(`${baseURL}/login`)
    await page.locator('#username').fill(attempt.username)
    await page.locator('#password').fill(attempt.password)
    const responsePromise = attempt.expectsRequest
      ? page.waitForResponse(response => response.url().endsWith('/api/auth/login') && response.request().method() === 'POST')
      : null

    await page.getByRole('button', { name: '登录' }).click()
    await expect(page).toHaveURL(/\/login/)

    if (responsePromise) {
      expect((await responsePromise).status()).toBe(401)
      await expect(page.getByText('用户名或密码错误')).toBeVisible()
    } else {
      expect(await page.locator('input:invalid').count()).toBeGreaterThan(0)
      expect(await page.evaluate(() => [...document.querySelectorAll('input:invalid')]
        .every(input => input.validationMessage !== ''))).toBe(true)
    }

    await expect(page.evaluate(() => localStorage.getItem('cwgsyw_token'))).resolves.toBeNull()
  }

  await expect(errors).toEqual([])
  await page.screenshot({ path: testInfo.outputPath('invalid-login.png') })
})

test('auth003StillRedirectsInvalidSessions', async ({ page }) => {
  const password = process.env.FQA_SUPERADMIN_PASSWORD
  expect(password).toBeTruthy()

  await page.goto(`${baseURL}/login`)
  await page.locator('#username').fill('superadmin')
  await page.locator('#password').fill(password)
  const loginResponse = page.waitForResponse(response => response.url().endsWith('/api/auth/login') && response.request().method() === 'POST')
  await page.getByRole('button', { name: '登录' }).click()
  expect((await loginResponse).status()).toBe(200)
  await expect(page).not.toHaveURL(/\/login/)

  await page.goto(`${baseURL}/login`)
  await page.evaluate(() => localStorage.setItem('cwgsyw_token', 'REM_P1_036_INVALID_TOKEN'))
  await page.goto(`${baseURL}/daily`)
  await expect(page).toHaveURL(/\/login/)
})
