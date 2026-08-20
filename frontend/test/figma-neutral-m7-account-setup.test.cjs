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
const pagePath = path.join(frontendRoot, 'src/app/(dashboard)/account/setup/page.tsx')
const formPath = path.join(frontendRoot, 'src/components/account/AccountSetupForm.tsx')
const accountApiPath = path.join(frontendRoot, 'src/lib/account-api.ts')
const accountCssPath = path.join(frontendRoot, 'src/components/account/account.css')

const profile = {
  id: 1,
  username: 'byron',
  realName: '杨迪',
  email: null,
  phone: null,
  avatarUrl: null,
  mustChangePassword: true,
  profileCompleted: false,
  passwordChangedAt: null,
  lastLoginAt: null,
  requiredActions: ['CHANGE_PASSWORD', 'COMPLETE_PROFILE'],
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

function loadCompiled(filePath) {
  const compiled = compileTs(filePath)
  const originalLoad = Module._load
  Module._load = function load(request, parent, isMain) {
    if (request.endsWith('.css')) return {}
    if (request === 'next/navigation') return { useRouter: () => ({ back() {}, replace() {}, push() {} }) }
    if (request === 'sonner' || request === '@/design-system/figma-neutral/toast') return { toast: { success() {}, error() {}, warning() {}, info() {}, message() {} }, NeutralToaster() { return null } }
    if (request === '@/lib/account-api') {
      return {
        getAccountProfile: async () => profile,
        submitAccountSetup: async () => ({ ...profile, requiredActions: [] }),
      }
    }
    if (request === '@/store/authStore') {
      return {
        useAuthStore: (selector) =>
          selector({
            user: { username: 'byron' },
            setRequiredActions() {},
          }),
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

test('setup page and form leave old visual entries and keep the setup API contract', () => {
  const page = fs.readFileSync(pagePath, 'utf8')
  const form = fs.readFileSync(formPath, 'utf8')
  const api = fs.readFileSync(accountApiPath, 'utf8')
  assert.match(page, /FormSettingsPage/)
  assert.match(page, /figma-neutral\/index\.css/)
  assert.match(page, /components\/account\/account\.css/)
  assert.match(page, /cwgsyw-account-page/)
  assert.match(page, /showBreadcrumb=\{false\}/)
  assert.match(page, /showEyebrow=\{false\}/)
  assert.doesNotMatch(page, /bg-v2-bg/)
  assert.doesNotMatch(page, /@\/components\/design-system/)
  assert.doesNotMatch(form, /text-v2-/)
  assert.match(form, /submitAccountSetup/)
  assert.match(form, /PASSWORD_REUSED/)
  assert.match(form, /cwgsyw-account-form__section/)
  assert.match(form, /cwgsyw-account-form__section-title/)
  assert.match(form, /size="sm"/)
  assert.equal(fs.existsSync(accountCssPath), true)
  assert.match(api, /export function submitAccountSetup/)
})

test('setup form shows password step only when required', () => {
  const { AccountSetupForm } = loadCompiled(formPath)
  const withPassword = renderToStaticMarkup(
    React.createElement(AccountSetupForm, {
      username: 'byron',
      mustChangePassword: true,
      onSuccess() {},
    }),
  )
  const profileOnly = renderToStaticMarkup(
    React.createElement(AccountSetupForm, {
      username: 'byron',
      mustChangePassword: false,
      onSuccess() {},
    }),
  )
  assert.match(withPassword, /第一步：修改初始密码/)
  assert.match(withPassword, /cwgsyw-account-form__section-title/)
  assert.match(withPassword, /cwgsyw-password-hints/)
  assert.doesNotMatch(profileOnly, /第一步：修改初始密码/)
  assert.match(profileOnly, /补全个人资料/)
})

test('setup page uses Form Settings composition instead of a nested main landmark', () => {
  const page = loadCompiled(pagePath)
  const html = renderToStaticMarkup(React.createElement(page.default))
  assert.match(html, /cwgsyw-page--embedded/)
  assert.match(html, /完善账号安全/)
  assert.doesNotMatch(html, /<main/)
})
