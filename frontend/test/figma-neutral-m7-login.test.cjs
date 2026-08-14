'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const Module = require('node:module')
const path = require('node:path')
const test = require('node:test')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const ts = require('typescript')

const frontendRoot = path.resolve(__dirname, '..')
const pagePath = path.join(frontendRoot, 'src/app/(auth)/login/page.tsx')
const authPath = path.join(frontendRoot, 'src/hooks/useAuth.ts')

function compileTs(filePath) {
  return ts.transpileModule(fs.readFileSync(filePath, 'utf8'), {
    compilerOptions: {
      esModuleInterop: true,
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
    fileName: filePath,
  }).outputText
}

function loadCompiled(filePath) {
  const compiled = compileTs(filePath)
  const originalLoad = Module._load
  Module._load = function load(request, parent, isMain) {
    if (request.endsWith('.css')) return {}
    if (request === '@/hooks/useAuth') {
      return { useAuth: () => ({ login: async () => {}, logout() {}, user: null }) }
    }
    if (request.startsWith('@/')) {
      const resolved = path.join(frontendRoot, 'src', request.slice(2))
      const hit = [resolved, `${resolved}.tsx`, `${resolved}.ts`, `${resolved}/index.ts`, `${resolved}/index.tsx`].find(
        (candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile(),
      )
      if (hit) return loadCompiled(hit)
    }
    if (request.startsWith('./') && parent && parent.filename) {
      const resolved = path.join(path.dirname(parent.filename), request)
      const hit = [`${resolved}.tsx`, `${resolved}.ts`, resolved].find(
        (candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile(),
      )
      if (hit && (hit.endsWith('.ts') || hit.endsWith('.tsx'))) return loadCompiled(hit)
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

test('login page leaves old visual entries and keeps the auth hook', () => {
  const page = fs.readFileSync(pagePath, 'utf8')
  const auth = fs.readFileSync(authPath, 'utf8')
  assert.match(page, /FormSettingsPage/)
  assert.match(page, /figma-neutral\/index\.css/)
  assert.match(page, /useAuth/)
  assert.match(page, /用户名或密码错误/)
  assert.doesNotMatch(page, /@\/components\/design-system/)
  assert.doesNotMatch(page, /bg-v2-bg/)
  assert.match(auth, /api\.post\('\/auth\/login'/)
  assert.match(auth, /router\.push\('\/account\/setup'\)/)
})

test('login page renders Neutral form composition', () => {
  const page = loadCompiled(pagePath)
  const html = renderToStaticMarkup(React.createElement(page.default))
  assert.match(html, /cwgsyw-page--centered/)
  assert.match(html, /CWGSYW 运维平台/)
  assert.match(html, /用户名/)
  assert.match(html, /显示密码/)
  assert.match(html, /type="submit"/)
  assert.doesNotMatch(html, /<main/)
})
