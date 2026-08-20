'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const frontendRoot = path.resolve(__dirname, '..')
const repoRoot = path.resolve(frontendRoot, '..')
const appRoot = path.join(frontendRoot, 'src/app')
const matrixPath = path.join(repoRoot, 'docs/migration/figma-neutral-frontend/PAGE-MIGRATION-MATRIX.md')
const excluded = new Set([
  'src/app/(dashboard)/cmdb/associations/page.tsx',
  'src/app/(dashboard)/cmdb/instances/page.tsx',
  'src/app/(dashboard)/cmdb/models/page.tsx',
])

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full, files)
    else if (entry.name === 'page.tsx') files.push(full)
  }
  return files
}

function routeFromPage(rel) {
  const stripped = rel
    .replace(/^src\/app\//, '')
    .replace(/\/page\.tsx$/, '')
    .replace(/^\(auth\)\//, '')
    .replace(/^\(dashboard\)\//, '')
    .replace(/^\(dashboard\)$/, '')
  return stripped ? `/${stripped}` : '/'
}

test('81 page entries are in the matrix and are Neutral or approved redirects', () => {
  const pages = walk(appRoot).map((file) => path.relative(frontendRoot, file)).sort()
  assert.equal(pages.length, 81)
  const matrix = fs.readFileSync(matrixPath, 'utf8')
  const missing = []
  for (const rel of pages) {
    const route = routeFromPage(rel)
    if (!matrix.includes(`\`${route}\``) && !matrix.includes(route)) missing.push(rel)
    const source = fs.readFileSync(path.join(frontendRoot, rel), 'utf8')
    if (excluded.has(rel)) {
      assert.match(source, /redirect\(/, rel)
      assert.doesNotMatch(source, /figma-neutral/, rel)
      continue
    }
    assert.match(source, /figma-neutral/, rel)
  }
  assert.deepEqual(missing, [])
})
