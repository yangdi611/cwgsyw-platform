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
      const hit = [`${resolved}.tsx`, `${resolved}.ts`].find((candidate) => fs.existsSync(candidate))
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

const { EmptyState, ErrorState, LoadingState, Alert, Toast, Progress, Skeleton } = loadTsx('Feedback.tsx')

test('Empty and Error states keep titles and actions', () => {
  const empty = renderToStaticMarkup(React.createElement(EmptyState, { title: '暂无内容', action: React.createElement('button', { type: 'button' }, '新建') }))
  const error = renderToStaticMarkup(React.createElement(ErrorState, { title: '加载失败' }))
  assert.match(empty, /暂无内容/)
  assert.match(empty, /新建/)
  assert.match(error, /role="alert"/)
  assert.match(error, /重试/)
})

test('Loading and Skeleton announce busy state', () => {
  const loading = renderToStaticMarkup(React.createElement(LoadingState, { label: '正在加载内容' }))
  const skeleton = renderToStaticMarkup(React.createElement(Skeleton, { type: 'card', state: 'loading' }))
  assert.match(loading, /aria-busy="true"/)
  assert.match(loading, /正在加载内容/)
  assert.match(skeleton, /cwgsyw-skeleton--loading/)
})

test('Alert and Toast use live feedback tokens and dismiss names', () => {
  const alert = renderToStaticMarkup(React.createElement(Alert, { tone: 'danger', title: '校验失败' }))
  const toast = renderToStaticMarkup(React.createElement(Toast, { tone: 'success', title: '已保存' }))
  assert.match(alert, /data-cwgsyw-feedback="danger"/)
  assert.match(alert, /data-feedback-context="danger"/)
  assert.match(alert, /aria-label="关闭提示"/)
  assert.match(toast, /aria-live="polite"/)
  assert.match(toast, /已保存/)
  assert.match(toast, /data-cwgsyw-feedback="success"/)
  assert.match(toast, /cwgsyw-toast__icon--check-circle/)
  assert.doesNotMatch(toast, /data-feedback-context/)
  assert.match(toast, /aria-label="关闭通知"/)
})

test('Toast icons are official Figma assets', () => {
  const icons = [
    'toast-check-circle.svg',
    'toast-alert-triangle.svg',
    'toast-x-circle.svg',
    'toast-alert-circle.svg',
    'cmdb-spatial-close.svg',
  ]
  for (const name of icons) {
    const svg = fs.readFileSync(path.resolve(__dirname, '../public/figma-icons', name), 'utf8')
    assert.match(svg, /<svg/)
    assert.match(svg, /path/i)
  }
})

test('Progress exposes a readable value', () => {
  const html = renderToStaticMarkup(React.createElement(Progress, { value: 60, label: '处理进度' }))
  assert.match(html, /role="progressbar"/)
  assert.match(html, /aria-valuenow="60"/)
  assert.match(html, /60%/)
})
