const { defineConfig } = require('@playwright/test')

module.exports = defineConfig({
  testDir: './test',
  timeout: 60_000,
  use: {
    baseURL: process.env.FQA_BASE_URL || 'http://127.0.0.1',
    trace: 'retain-on-failure',
  },
})
