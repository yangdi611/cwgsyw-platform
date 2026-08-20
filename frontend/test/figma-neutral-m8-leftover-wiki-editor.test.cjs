'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const frontendRoot = path.resolve(__dirname, '..')
const globals = fs.readFileSync(path.join(frontendRoot, 'src/app/globals.css'), 'utf8')
const page = fs.readFileSync(
  path.join(frontendRoot, 'src/app/(dashboard)/wiki/[spaceId]/[pageId]/edit/page.tsx'),
  'utf8',
)
const css = fs.readFileSync(path.join(frontendRoot, 'src/components/wiki/WikiEditor.css'), 'utf8')

test('wiki editor theme lives next to the editor and uses Neutral tokens', () => {
  assert.doesNotMatch(globals, /\.wiki-editor/)
  assert.match(page, /WikiEditor\.css/)
  assert.match(css, /--cwgsyw-bg-surface/)
  assert.match(css, /--cwgsyw-control-height-sm/)
  assert.doesNotMatch(css, /oklch\(/)
  assert.doesNotMatch(css, /#2563eb|#1d4ed8/)
})
