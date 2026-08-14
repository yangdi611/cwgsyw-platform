'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const frontendRoot = path.resolve(__dirname, '..')
const srcRoot = path.join(frontendRoot, 'src')
const skipDirs = new Set(['node_modules', '.next'])

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (skipDirs.has(entry.name)) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full, files)
    else if (/\.(tsx?|css)$/.test(entry.name)) files.push(full)
  }
  return files
}

test('frontend source no longer imports sonner', () => {
  const hits = []
  for (const file of walk(srcRoot)) {
    const source = fs.readFileSync(file, 'utf8')
    if (/from ['"]sonner['"]/.test(source) || /data-sonner/.test(source)) {
      hits.push(path.relative(frontendRoot, file))
    }
  }
  assert.deepEqual(hits, [])
})

test('layout mounts NeutralToaster', () => {
  const source = fs.readFileSync(path.join(srcRoot, 'app/layout.tsx'), 'utf8')
  assert.match(source, /NeutralToaster/)
  assert.match(source, /design-system\/figma-neutral\/toast/)
})
