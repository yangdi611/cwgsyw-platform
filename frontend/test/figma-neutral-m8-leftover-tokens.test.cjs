'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const frontendRoot = path.resolve(__dirname, '..')
const srcRoot = path.join(frontendRoot, 'src')
const leftover = /text-v2-|bg-v2-|border-v2-|rounded-v2-|shadow-v2-|font-v2-|--color-v2-|--v2-/
const skipDirs = new Set(['node_modules', '.next'])

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (skipDirs.has(entry.name)) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full, files)
    else if (/\.(tsx?|css|js|cjs|mjs)$/.test(entry.name)) files.push(full)
  }
  return files
}

test('frontend source has no leftover v2 visual tokens', () => {
  const hits = []
  for (const file of walk(srcRoot)) {
    const source = fs.readFileSync(file, 'utf8')
    if (leftover.test(source)) hits.push(path.relative(frontendRoot, file))
  }
  assert.deepEqual(hits, [])
})
