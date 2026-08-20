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
const componentsRoot = path.join(frontendRoot, 'src/design-system/figma-neutral/components')
const pagePath = path.join(frontendRoot, 'src/app/(dashboard)/account/profile/page.tsx')
const formPath = path.join(frontendRoot, 'src/components/account/ProfileForm.tsx')
const accountApiPath = path.join(frontendRoot, 'src/lib/account-api.ts')
const accountCssPath = path.join(frontendRoot, 'src/components/account/account.css')
const breadcrumbConfigPath = path.join(frontendRoot, 'src/lib/breadcrumb-config.ts')
const inputPath = path.join(componentsRoot, 'Input.tsx')

const profile = {
  id: 1,
  username: 'byron',
  realName: '杨迪',
  email: 'byron@example.com',
  phone: '13800000000',
  avatarUrl: null,
  mustChangePassword: false,
  profileCompleted: true,
  passwordChangedAt: null,
  lastLoginAt: null,
  requiredActions: [],
}

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

function loadCompiled(filePath, extraMocks = {}) {
  const compiled = compileTs(filePath)
  const originalLoad = Module._load
  Module._load = function load(request, parent, isMain) {
    if (request.endsWith('.css')) return {}
    if (request === 'next/navigation') {
      return extraMocks.navigation || { useRouter: () => ({ back() {}, replace() {} }) }
    }
    if (request === 'sonner' || request === '@/design-system/figma-neutral/toast') return { toast: { success() {}, error() {}, warning() {}, info() {}, message() {} }, NeutralToaster() { return null } }
    if (request === '@/lib/account-api' || request === '../lib/account-api' || request === '../../lib/account-api') {
      return extraMocks.accountApi || {
        getAccountProfile: async () => profile,
        updateAccountProfile: extraMocks.updateAccountProfile || (async (data) => ({ ...profile, ...data })),
      }
    }
    if (request.startsWith('@/')) {
      const resolved = path.join(frontendRoot, 'src', request.slice(2))
      const hit = [resolved, `${resolved}.tsx`, `${resolved}.ts`, `${resolved}/index.ts`, `${resolved}/index.tsx`].find(
        (candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile(),
      )
      if (hit) return loadCompiled(hit, extraMocks)
    }
    if (request.startsWith('./') && parent && parent.filename) {
      const resolved = path.join(path.dirname(parent.filename), request)
      const hit = [`${resolved}.tsx`, `${resolved}.ts`, resolved].find(
        (candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile(),
      )
      if (hit && (hit.endsWith('.ts') || hit.endsWith('.tsx'))) return loadCompiled(hit, extraMocks)
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

test('profile page and form leave old visual entries and keep the account API contract', () => {
  const page = fs.readFileSync(pagePath, 'utf8')
  const form = fs.readFileSync(formPath, 'utf8')
  const api = fs.readFileSync(accountApiPath, 'utf8')

  assert.match(page, /FormSettingsPage/)
  assert.match(page, /figma-neutral\/index\.css/)
  assert.match(page, /components\/account\/account\.css/)
  assert.match(page, /cwgsyw-account-page/)
  assert.match(page, /showBreadcrumb=\{false\}/)
  assert.match(page, /showEyebrow=\{false\}/)
  assert.doesNotMatch(page, /<Breadcrumb/)
  assert.doesNotMatch(page, /@\/components\/design-system/)
  assert.doesNotMatch(page, /@\/components\/shared/)
  assert.match(form, /@\/design-system\/figma-neutral\/components/)
  assert.doesNotMatch(form, /text-v2-muted/)
  assert.doesNotMatch(form, /@\/components\/design-system/)
  assert.match(form, /updateAccountProfile/)
  assert.match(form, /cwgsyw-account-form__fields--profile/)
  assert.match(form, /size="sm"/)
  assert.doesNotMatch(form, /helperText="真实姓名由管理员维护/)
  assert.match(page, /真实姓名由管理员维护，如需修改请联系管理员。/)
  assert.equal(fs.existsSync(accountCssPath), true)
  assert.match(api, /export function getAccountProfile/)
  assert.match(api, /export function updateAccountProfile/)
})

test('profile form renders Neutral fields and keeps realName read-only', () => {
  const { ProfileForm } = loadCompiled(formPath)
  const html = renderToStaticMarkup(React.createElement(ProfileForm, { profile }))
  assert.match(html, /cwgsyw-form/)
  assert.match(html, /cwgsyw-account-form--profile/)
  assert.match(html, /cwgsyw-account-form__fields--profile/)
  assert.match(html, /用户名/)
  assert.match(html, /真实姓名/)
  assert.doesNotMatch(html, /管理员维护/)
  assert.match(html, /value="杨迪"/)
  assert.match(html, /保存资料/)
  assert.match(html, /type="submit"/)
})

test('profile page uses Form Settings composition instead of a nested main landmark', () => {
  const page = loadCompiled(pagePath)
  const html = renderToStaticMarkup(React.createElement(page.default))
  assert.match(html, /cwgsyw-page--embedded/)
  assert.match(html, /cwgsyw-page__grid/)
  assert.match(html, /个人资料/)
  assert.doesNotMatch(html, /<main/)
})

test('account routes resolve to Chinese header breadcrumbs', () => {
  const { resolveBreadcrumb } = loadCompiled(breadcrumbConfigPath)
  assert.deepEqual(resolveBreadcrumb('/account/profile').map(({ label }) => label), ['账号', '个人资料'])
  assert.deepEqual(resolveBreadcrumb('/account/password').map(({ label }) => label), ['账号', '修改密码'])
  assert.deepEqual(resolveBreadcrumb('/account/setup').map(({ label }) => label), ['账号', '首次设置'])
})

test('Input forwards the native ref to the inner control', () => {
  const source = fs.readFileSync(inputPath, 'utf8')
  assert.match(source, /forwardRef/)
  assert.match(source, /ref=\{ref\}/)
  const { Input } = loadCompiled(inputPath)
  const html = renderToStaticMarkup(React.createElement(Input, { defaultValue: 'hello', name: 'email' }))
  assert.match(html, /name="email"/)
  assert.match(html, /cwgsyw-control/)
  assert.equal(typeof Input, 'object')
})
