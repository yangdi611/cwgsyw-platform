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
const pagePath = path.join(frontendRoot, 'src/app/(dashboard)/account/password/page.tsx')
const formPath = path.join(frontendRoot, 'src/components/account/PasswordForm.tsx')
const accountApiPath = path.join(frontendRoot, 'src/lib/account-api.ts')

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
    if (request === 'next/navigation') return { useRouter: () => ({ back() {}, replace() {} }) }
    if (request === 'sonner' || request === '@/design-system/figma-neutral/toast') return { toast: { success() {}, error() {}, warning() {}, info() {}, message() {} }, NeutralToaster() { return null } }
    if (request === '@/lib/account-api') {
      return {
        changeAccountPassword: async () => ({}),
      }
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

test('password page and form leave old visual entries and keep the password API contract', () => {
  const page = fs.readFileSync(pagePath, 'utf8')
  const form = fs.readFileSync(formPath, 'utf8')
  const api = fs.readFileSync(accountApiPath, 'utf8')
  assert.match(page, /FormSettingsPage/)
  assert.match(page, /figma-neutral\/index\.css/)
  assert.doesNotMatch(page, /@\/components\/design-system/)
  assert.doesNotMatch(page, /@\/components\/shared/)
  assert.match(form, /@\/design-system\/figma-neutral\/components/)
  assert.doesNotMatch(form, /text-v2-/)
  assert.doesNotMatch(form, /@\/components\/design-system/)
  assert.match(form, /changeAccountPassword/)
  assert.match(form, /inspectPassword/)
  assert.match(api, /export function changeAccountPassword/)
  assert.equal(fs.existsSync(path.join(frontendRoot, 'src/components/account/PasswordStrengthHints.tsx')), false)
})

test('password form renders Neutral fields and policy hints', () => {
  const { PasswordForm } = loadCompiled(formPath)
  const html = renderToStaticMarkup(React.createElement(PasswordForm))
  assert.match(html, /cwgsyw-form/)
  assert.match(html, /当前密码/)
  assert.match(html, /新密码/)
  assert.match(html, /确认新密码/)
  assert.match(html, /cwgsyw-password-hints/)
  assert.match(html, /密码至少/)
  assert.match(html, /type="submit"/)
})

test('password page uses Form Settings composition instead of a nested main landmark', () => {
  const page = loadCompiled(pagePath)
  const html = renderToStaticMarkup(React.createElement(page.default))
  assert.match(html, /cwgsyw-page--embedded/)
  assert.match(html, /修改密码/)
  assert.doesNotMatch(html, /<main/)
})
