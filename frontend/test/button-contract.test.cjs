/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict')
const fs = require('node:fs')
const Module = require('node:module')
const path = require('node:path')
const test = require('node:test')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const ts = require('typescript')

const buttonPath = path.resolve(__dirname, '../src/components/design-system/Button.tsx')
const source = fs.readFileSync(buttonPath, 'utf8')
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    esModuleInterop: true,
    jsx: ts.JsxEmit.ReactJSX,
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
  },
  fileName: buttonPath,
}).outputText

const originalLoad = Module._load
Module._load = function load(request, parent, isMain) {
  if (request === '@/lib/utils') {
    return { cn: (...values) => values.flat(Infinity).filter(Boolean).join(' ') }
  }
  return originalLoad.call(this, request, parent, isMain)
}

const buttonModule = new Module(buttonPath, module)
buttonModule.filename = buttonPath
buttonModule.paths = Module._nodeModulePaths(path.dirname(buttonPath))
buttonModule._compile(compiled, buttonPath)
Module._load = originalLoad

const { Button, buttonVariants } = buttonModule.exports

test('Button and buttonVariants share canonical defaults', () => {
  const html = renderToStaticMarkup(React.createElement(Button, null, '操作'))
  const helperClasses = buttonVariants().split(' ')

  assert.match(html, /type="button"/)
  assert.match(html, /bg-v2-surface/)
  assert.match(html, /h-10/)
  for (const className of helperClasses) assert.match(html, new RegExp(`(?:class="[^"]*)?${className}`))
})

test('Button preserves legacy ui variant and size aliases', () => {
  const primary = renderToStaticMarkup(
    React.createElement(Button, { variant: 'default', size: 'default' }, '保存'),
  )
  const compact = renderToStaticMarkup(
    React.createElement(Button, { variant: 'outline', size: 'ui-sm' }, '取消'),
  )

  assert.match(primary, /bg-v2-primary/)
  assert.match(primary, /h-8/)
  assert.match(compact, /bg-v2-surface/)
  assert.match(compact, /h-7/)
})

test('Button defaults to type button and preserves explicit submit type', () => {
  const defaultType = renderToStaticMarkup(React.createElement(Button, null, '取消'))
  const submitType = renderToStaticMarkup(
    React.createElement(Button, { type: 'submit' }, '保存'),
  )

  assert.match(defaultType, /type="button"/)
  assert.match(submitType, /type="submit"/)
})

test('loading disables the button and preserves its accessible text', () => {
  const html = renderToStaticMarkup(
    React.createElement(Button, { loading: true }, '保存修改'),
  )

  assert.match(html, /aria-busy="true"/)
  assert.match(html, /disabled=""/)
  assert.match(html, />保存修改</)
})
