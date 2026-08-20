'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const frontendRoot = path.resolve(__dirname, '..')

test('sidebar and notification chrome expose accessible names', () => {
  const header = fs.readFileSync(path.join(frontendRoot, 'src/components/layout/Header.tsx'), 'utf8')
  const sidebar = fs.readFileSync(path.join(frontendRoot, 'src/components/layout/Sidebar.tsx'), 'utf8')
  const bell = fs.readFileSync(path.join(frontendRoot, 'src/components/layout/NotificationBell.tsx'), 'utf8')
  const group = fs.readFileSync(path.join(frontendRoot, 'src/components/layout/sidebar/NavGroupItem.tsx'), 'utf8')
  assert.match(header, /aria-label=\{sidebarCollapsed \? '展开侧栏' : '收起侧栏'\}/)
  assert.match(sidebar, /aria-label="关闭导航"/)
  assert.match(sidebar, /aria-label="打开用户菜单"/)
  assert.match(sidebar, /aria-haspopup="menu"/)
  assert.match(sidebar, /aria-expanded=\{userMenuOpen\}/)
  assert.doesNotMatch(sidebar, /label="通知中心"/)
  assert.doesNotMatch(sidebar, /跟随系统（当前）/)
  assert.match(header, /aria-label=\{isDark \? '切换至浅色模式' : '切换至深色模式'\}/)
  assert.match(header, /<NotificationBell \/>/)
  assert.match(bell, /aria-label=\{count > 0 \? `通知，\$\{count\} 条未读` : '通知'\}/)
  assert.match(group, /aria-expanded=\{isOpen\}/)
})

test('app chrome uses the Neutral theme selector and a native menu trigger', () => {
  const providers = fs.readFileSync(path.join(frontendRoot, 'src/app/providers.tsx'), 'utf8')
  const globals = fs.readFileSync(path.join(frontendRoot, 'src/app/globals.css'), 'utf8')
  const overlay = fs.readFileSync(
    path.join(frontendRoot, 'src/design-system/figma-neutral/components/Overlay.tsx'),
    'utf8',
  )
  const sidebar = fs.readFileSync(path.join(frontendRoot, 'src/components/layout/Sidebar.tsx'), 'utf8')
  const patterns = fs.readFileSync(
    path.join(frontendRoot, 'src/design-system/figma-neutral/components/patterns.css'),
    'utf8',
  )

  assert.match(providers, /ThemeProvider attribute="data-theme"/)
  assert.match(globals, /\[data-theme="dark"\]/)
  assert.match(overlay, /<Menu\.Trigger render=\{trigger\} \/>/)
  assert.match(sidebar, /<IconButton/)
  assert.match(sidebar, /cwgsyw-sidebar__user-trigger/)
  assert.match(patterns, /@media \(max-width: 767px\)/)
})
