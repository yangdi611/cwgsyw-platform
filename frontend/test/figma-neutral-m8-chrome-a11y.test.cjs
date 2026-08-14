'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const frontendRoot = path.resolve(__dirname, '..')

test('sidebar and notification chrome expose accessible names', () => {
  const sidebar = fs.readFileSync(path.join(frontendRoot, 'src/components/layout/Sidebar.tsx'), 'utf8')
  const bell = fs.readFileSync(path.join(frontendRoot, 'src/components/layout/NotificationBell.tsx'), 'utf8')
  const group = fs.readFileSync(path.join(frontendRoot, 'src/components/layout/sidebar/NavGroupItem.tsx'), 'utf8')
  assert.match(sidebar, /aria-label="收起侧栏"/)
  assert.match(sidebar, /aria-label="展开侧栏"/)
  assert.match(bell, /aria-label=\{count > 0 \? `通知，\$\{count\} 条未读` : '通知'\}/)
  assert.match(group, /aria-expanded=\{isOpen\}/)
})
