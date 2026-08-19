'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const source = fs.readFileSync(
  path.resolve(__dirname, '../src/components/wiki/WikiTreeSidebar.tsx'),
  'utf8',
)

test('wiki tree sidebar uses Neutral Button and IconButton instead of native buttons', () => {
  assert.doesNotMatch(source, /<button[\s>]/)
  assert.match(source, /\bButton\b/)
  assert.match(source, /\bIconButton\b/)
  assert.match(source, /aria-label="新建页面"/)
  assert.match(source, /aria-label=\{`删除 \$\{node\.title \|\| '页面'\}`\}/)
  assert.doesNotMatch(source, /h-7 w-7 px-0/)
  assert.match(source, /cwgsyw-cmdb-admin__figma-action-icon--plus/)
  assert.doesNotMatch(source, /from 'lucide-react'/)
  assert.match(source, /content="重命名" className="cwgsyw-tooltip--pill" side="right"/)
  assert.doesNotMatch(source, /content="重命名"[^>]*followCursor/)
  const css = fs.readFileSync(
    path.resolve(__dirname, '../src/design-system/figma-neutral/components/patterns.css'),
    'utf8',
  )
  assert.match(css, /\.cwgsyw-wiki-tree__title \{[\s\S]{0,160}flex: 1 1 0/)
  assert.match(css, /\.cwgsyw-wiki-tree__row-actions \{[\s\S]{0,120}flex: 0 0 auto/)
})
