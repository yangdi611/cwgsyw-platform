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
  assert.match(source, /aria-label="删除页面"/)
  assert.doesNotMatch(source, /h-7 w-7 px-0/)
  assert.match(source, /icon=\{<Plus \/>\}/)
})
