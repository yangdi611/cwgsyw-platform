'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const frontendRoot = path.resolve(__dirname, '..')
const srcRoot = path.join(frontendRoot, 'src')
const skipDirs = new Set(['node_modules', '.next', 'design-system'])

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (skipDirs.has(entry.name)) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full, files)
    else if (/\.(tsx?|css)$/.test(entry.name)) files.push(full)
  }
  return files
}

test('wiki lightbox uses Neutral overlay scrim and IconButton', () => {
  const source = fs.readFileSync(path.join(frontendRoot, 'src/components/wiki/WikiImage.tsx'), 'utf8')
  assert.match(source, /cwgsyw-overlay-scrim/)
  assert.match(source, /<IconButton/)
  assert.match(source, /icon="close"/)
  assert.doesNotMatch(source, /bg-black\//)
  assert.doesNotMatch(source, /bg-white\//)
  assert.doesNotMatch(source, /from 'lucide-react'/)
})

test('spatial publish dialog uses NeutralDialog instead of custom overlay', () => {
  const source = fs.readFileSync(
    path.join(frontendRoot, 'src/features/cmdb-spatial/editor/SpatialEditor.tsx'),
    'utf8',
  )
  assert.match(source, /<NeutralDialog/)
  assert.match(source, /htmlFor="spatial-publish-note"/)
  assert.doesNotMatch(source, /bg-black\//)
  assert.doesNotMatch(source, /role="dialog"/)
})

test('frontend chrome has no leftover bg-black overlay', () => {
  const hits = []
  for (const file of walk(srcRoot)) {
    if (file.includes(`${path.sep}design-system${path.sep}figma-neutral${path.sep}`)) continue
    const source = fs.readFileSync(file, 'utf8')
    if (/bg-black\//.test(source)) hits.push(path.relative(frontendRoot, file))
  }
  assert.deepEqual(hits, [])
})
