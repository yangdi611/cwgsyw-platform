'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const Module = require('node:module')
const path = require('node:path')
const test = require('node:test')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const ts = require('typescript')

const root = path.resolve(__dirname, '../src/design-system/figma-neutral/components')

function loadTsx(rel) {
  const filePath = path.join(root, rel)
  const source = fs.readFileSync(filePath, 'utf8')
  const compiled = ts.transpileModule(source, {
    compilerOptions: { esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    fileName: filePath,
  }).outputText
  const originalLoad = Module._load
  Module._load = function load(request, parent, isMain) {
    if (request.startsWith('./') && parent && parent.filename && String(parent.filename).startsWith(root)) {
      const resolved = path.join(path.dirname(parent.filename), request)
      const hit = [`${resolved}.tsx`, `${resolved}.ts`].find((c) => fs.existsSync(c))
      if (hit) return loadTsx(path.relative(root, hit))
    }
    return originalLoad.call(this, request, parent, isMain)
  }
  const mod = new Module(filePath, module)
  mod.filename = filePath
  mod.paths = Module._nodeModulePaths(path.dirname(filePath))
  try { mod._compile(compiled, filePath) } finally { Module._load = originalLoad }
  return mod.exports
}

const overlay = loadTsx('Overlay.tsx')

test('MenuItem exposes menuitem role and destructive type', () => {
  const html = renderToStaticMarkup(React.createElement(overlay.MenuItem, { label: '删除', type: 'destructive', shortcut: '⌘⌫' }))
  assert.match(html, /role="menuitem"/)
  assert.match(html, /data-type="destructive"/)
  assert.match(html, /⌘⌫/)
})

test('Calendar renders a grid and selected day', () => {
  const html = renderToStaticMarkup(React.createElement(overlay.Calendar, { selected: 14, monthLabel: '2026 年 8 月' }))
  assert.match(html, /role="grid"/)
  assert.match(html, /2026 年 8 月/)
  assert.match(html, /aria-selected="true"/)
})

test('Command palette has a dialog name and empty state', () => {
  const html = renderToStaticMarkup(React.createElement(overlay.CommandPalette, { items: [], state: 'empty' }))
  assert.match(html, /role="dialog"/)
  assert.match(html, /命令面板/)
  assert.match(html, /无结果/)
})

test('DatePicker keeps the date input', () => {
  const html = renderToStaticMarkup(React.createElement(overlay.DatePicker, { error: true }))
  assert.match(html, /cwgsyw-control--error/)
})

test('DateRangePicker exposes start and end date inputs', () => {
  const html = renderToStaticMarkup(React.createElement(overlay.DateRangePicker, { error: true, startValue: '2026-08-01', endValue: '2026-08-14' }))
  assert.match(html, /开始日期/)
  assert.match(html, /结束日期/)
  assert.match(html, /cwgsyw-control--error/)
  assert.match(html, /data-state="error"/)
})

test('Dialog composition keeps the close affordance and actions in their Figma slots', () => {
  const source = fs.readFileSync(path.join(root, 'Overlay.tsx'), 'utf8')
  const dialogSource = fs.readFileSync(path.join(root, 'Dialog.tsx'), 'utf8')
  const alertDialogSource = fs.readFileSync(path.join(root, 'AlertDialog.tsx'), 'utf8')
  const css = fs.readFileSync(path.join(root, 'overlay.css'), 'utf8')
  assert.match(dialogSource, /@radix-ui\/react-dialog/)
  assert.match(alertDialogSource, /@radix-ui\/react-alert-dialog/)
  assert.doesNotMatch(source, /@base-ui\/react\/dialog/)
  assert.match(source, /cwgsyw-dialog__header/)
  assert.match(source, /aria-label="关闭对话框"/)
  assert.match(source, /cwgsyw-dialog__body/)
  assert.match(source, /cwgsyw-dialog__footer/)
  assert.match(source, /cwgsyw-dialog__action-group/)
  assert.match(source, /<AlertDialogContent/)
  assert.match(source, /cwgsyw-dialog--alert/)
  assert.match(source, /intent === 'destructive' \? 'cwgsyw-dialog--destructive'/)
  assert.match(source, /className\?: string/)
  assert.match(source, /icon\?: ReactNode/)
  assert.match(source, /cwgsyw-dialog__alert-icon/)
  assert.match(source, /onOpenAutoFocus/)
  assert.match(source, /onCloseAutoFocus/)
  assert.match(source, /focusReturnRef\.current\.focus\(\)/)
  assert.match(css, /\.cwgsyw-dialog__footer \{[\s\S]*justify-content: flex-end/)
  assert.match(css, /\.cwgsyw-dialog__body \{[\s\S]*background: var\(--cwgsyw-bg-surface-subtle\)/)
  assert.match(css, /\.cwgsyw-dialog__footer \.cwgsyw-btn,[\s\S]*width: auto/)
  assert.match(css, /\.cwgsyw-dialog--alert \{ width: min\(440px/)
  assert.match(css, /\.cwgsyw-dialog--destructive \{ border-color: var\(--cwgsyw-status-danger-border\)/)
  assert.match(css, /cwgsyw-dialog-content-in 200ms ease/)
  assert.match(css, /cwgsyw-dialog-overlay-in 150ms ease-out/)
  assert.match(css, /scale\(0\.95\)/)
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.cwgsyw-dialog\[data-state\]/)
})

test('NeutralDrawer delegates every consumer to the shadcn Vaul drawer', () => {
  const source = fs.readFileSync(path.join(root, 'Overlay.tsx'), 'utf8')
  const drawerSource = fs.readFileSync(path.join(root, 'Drawer.tsx'), 'utf8')
  const drawerSection = source.slice(source.indexOf('export function NeutralDrawer'), source.indexOf('export function Calendar'))

  assert.match(drawerSource, /from 'vaul'/)
  assert.match(drawerSection, /<Drawer open=\{open\} onOpenChange=\{onOpenChange\} direction=\{side\}>/)
  assert.match(drawerSection, /<DrawerContent className=/)
  assert.match(drawerSection, /<DrawerClose asChild>/)
  assert.doesNotMatch(drawerSection, /<Dialog\./)
})

test('shared scrims soften and blur the page behind every overlay surface', () => {
  const css = fs.readFileSync(path.join(root, 'overlay.css'), 'utf8')

  assert.match(css, /\.cwgsyw-overlay-scrim,[\s\S]*\.cwgsyw-mobile-nav-scrim,[\s\S]*\.wiki-mermaid__fullscreen/)
  assert.match(css, /background: color-mix\(in srgb, var\(--cwgsyw-overlay-scrim\) 58%, transparent\)/)
  assert.match(css, /-webkit-backdrop-filter: blur\(6px\) saturate\(0\.9\)/)
  assert.match(css, /backdrop-filter: blur\(6px\) saturate\(0\.9\)/)
  assert.match(css, /@media \(prefers-reduced-transparency: reduce\)[\s\S]*backdrop-filter: none/)
})
