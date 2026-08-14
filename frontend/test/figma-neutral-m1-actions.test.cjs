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
    compilerOptions: {
      esModuleInterop: true,
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
    fileName: filePath,
  }).outputText
  const originalLoad = Module._load
  Module._load = function load(request, parent, isMain) {
    if (request.startsWith('./') && parent.filename.startsWith(root)) {
      const resolved = path.join(path.dirname(parent.filename), request)
      const candidates = [`${resolved}.tsx`, `${resolved}.ts`, resolved]
      const hit = candidates.find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile())
      if (hit) return loadTsx(path.relative(root, hit))
    }
    return originalLoad.call(this, request, parent, isMain)
  }
  const mod = new Module(filePath, module)
  mod.filename = filePath
  mod.paths = Module._nodeModulePaths(path.dirname(filePath))
  try {
    mod._compile(compiled, filePath)
  } finally {
    Module._load = originalLoad
  }
  return mod.exports
}

const { Button } = loadTsx('Button.tsx')
const { IconButton } = loadTsx('IconButton.tsx')
const { Spinner } = loadTsx('Spinner.tsx')
const { Separator } = loadTsx('Separator.tsx')

test('Button defaults to Neutral primary and type=button', () => {
  const html = renderToStaticMarkup(React.createElement(Button, null, '确认'))
  assert.match(html, /type="button"/)
  assert.match(html, /cwgsyw-btn--primary/)
  assert.match(html, />确认</)
  assert.doesNotMatch(html, /bg-v2-primary|blue/)
})

test('Button loading keeps the label, disables, and announces busy', () => {
  const html = renderToStaticMarkup(React.createElement(Button, { loading: true }, '确认'))
  assert.match(html, /aria-busy="true"/)
  assert.match(html, /disabled=""/)
  assert.match(html, />确认</)
  assert.match(html, /role="status"/)
})

test('IconButton requires an accessible name and stays square', () => {
  const html = renderToStaticMarkup(
    React.createElement(IconButton, { 'aria-label': '关闭', icon: 'close' }),
  )
  assert.match(html, /aria-label="关闭"/)
  assert.match(html, /cwgsyw-icon-btn--md/)
  assert.match(html, /cwgsyw-icon--md/)
})

test('Spinner tone is a status axis and can hide visible label', () => {
  const html = renderToStaticMarkup(
    React.createElement(Spinner, { tone: 'danger', showLabel: false, label: '加载中' }),
  )
  assert.match(html, /cwgsyw-spinner--danger/)
  assert.match(html, /sr-only/)
  assert.match(html, /加载中/)
})

test('Separator exposes orientation', () => {
  const horizontal = renderToStaticMarkup(React.createElement(Separator))
  const vertical = renderToStaticMarkup(React.createElement(Separator, { orientation: 'vertical' }))
  assert.match(horizontal, /aria-orientation="horizontal"/)
  assert.match(vertical, /aria-orientation="vertical"/)
})

test('old design-system entry is gone and globals stay isolated', () => {
  const globalsCss = fs.readFileSync(path.resolve(__dirname, '../src/app/globals.css'), 'utf8')
  assert.equal(fs.existsSync(path.resolve(__dirname, '../src/components/design-system')), false)
  assert.equal(fs.existsSync(path.resolve(__dirname, '../src/components/v2')), false)
  assert.equal(globalsCss.includes('figma-neutral'), false)
})
