'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const frontendRoot = path.resolve(__dirname, '..')
const srcRoot = path.join(frontendRoot, 'src')
const skipDirs = new Set(['node_modules', '.next'])
const leftoverAccentUtil = /(?:text|bg|border)-(?:blue|indigo|violet|purple|emerald|cyan|sky|teal)-\d+/
const leftoverEntry = /@\/components\/(?:design-system|v2|ui)(?:\/|'|"|$)/
const leftoverSelect = /<select[\s>]/
const leftoverButton = /<button[\s>]/
const leftoverSonner = /from ['"]sonner['"]/
const leftoverV2 = /text-v2-|bg-v2-|border-v2-|--color-v2-|--v2-/
const leftoverDialog = /window\.(confirm|alert|prompt)|\b(?:confirm|alert|prompt)\(/

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (skipDirs.has(entry.name)) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full, files)
    else if (/\.(tsx?|css)$/.test(entry.name)) files.push(full)
  }
  return files
}

test('consumer source has no leftover old visual shells from the M8 scan list', () => {
  const hits = []
  for (const file of walk(srcRoot)) {
    if (file.includes(`${path.sep}design-system${path.sep}figma-neutral${path.sep}`)) continue
    const source = fs.readFileSync(file, 'utf8')
    const rel = path.relative(frontendRoot, file)
    if (leftoverAccentUtil.test(source)) hits.push(`${rel} accent-util`)
    if (leftoverEntry.test(source)) hits.push(`${rel} old-entry`)
    if (leftoverSelect.test(source)) hits.push(`${rel} native-select`)
    if (leftoverButton.test(source)) hits.push(`${rel} native-button`)
    if (leftoverSonner.test(source)) hits.push(`${rel} sonner`)
    if (leftoverV2.test(source)) hits.push(`${rel} v2-token`)
    if (leftoverDialog.test(source)) hits.push(`${rel} native-dialog`)
  }
  assert.deepEqual(hits, [])
})
