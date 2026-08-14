'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const frontendRoot = path.resolve(__dirname, '..')
const mermaid = fs.readFileSync(path.join(frontendRoot, 'src/components/wiki/WikiMermaid.tsx'), 'utf8')
const globals = fs.readFileSync(path.join(frontendRoot, 'src/app/globals.css'), 'utf8')

test('wiki mermaid chrome uses Neutral components instead of globals page CSS', () => {
  assert.doesNotMatch(globals, /\.wiki-mermaid/)
  assert.match(mermaid, /from '@\/design-system\/figma-neutral\/components'/)
  assert.match(mermaid, /\bButton\b/)
  assert.match(mermaid, /\bAlert\b/)
  assert.match(mermaid, /\bLoadingState\b/)
  assert.match(mermaid, /\bIconButton\b/)
  assert.match(mermaid, /CANVAS_NEUTRAL/)
  assert.doesNotMatch(mermaid, /wiki-mermaid__button/)
})
