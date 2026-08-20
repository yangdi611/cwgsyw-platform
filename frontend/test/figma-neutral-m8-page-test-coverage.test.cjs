'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const frontendRoot = path.resolve(__dirname, '..')
const appRoot = path.join(frontendRoot, 'src/app')
const testRoot = path.join(frontendRoot, 'test')
const excluded = new Set([
  'src/app/(dashboard)/cmdb/associations/page.tsx',
  'src/app/(dashboard)/cmdb/instances/page.tsx',
  'src/app/(dashboard)/cmdb/models/page.tsx',
])

function walkPages(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walkPages(full, files)
    else if (entry.name === 'page.tsx') files.push(full)
  }
  return files
}

test('every Neutral page entry is mentioned by an m7 isolation test', () => {
  const pages = walkPages(appRoot).map((file) => path.relative(frontendRoot, file)).sort()
  const blobs = fs.readdirSync(testRoot)
    .filter((name) => name.startsWith('figma-neutral-m7-') && name.endsWith('.test.cjs'))
    .map((name) => fs.readFileSync(path.join(testRoot, name), 'utf8'))
    .join('\n')
  const missing = []
  for (const rel of pages) {
    if (excluded.has(rel)) continue
    const route = `/${rel
      .replace(/^src\/app\//, '')
      .replace(/\/page\.tsx$/, '')
      .replace(/^\(auth\)\//, '')
      .replace(/^\(dashboard\)\//, '')
      .replace(/^\(dashboard\)$/, '')}`
    const keys = [rel, route === '//' ? '/' : route]
    if (!keys.some((key) => key && blobs.includes(key))) missing.push(rel)
  }
  assert.deepEqual(missing, [])
})
