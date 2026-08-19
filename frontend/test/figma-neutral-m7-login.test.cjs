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
const accountCssPath = path.join(frontendRoot, 'src/components/account/account.css')
const eyeAssetPath = path.join(frontendRoot, 'public/figma-icons/account-login-eye.svg')
const eyeOffAssetPath = path.join(frontendRoot, 'public/figma-icons/account-login-eye-off.svg')

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
    if (request === 'next/image') {
      return {
        __esModule: true,
        default: ({ unoptimized, ...props }) => React.createElement('img', props),
      }
    }
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
  assert.match(page, /components\/account\/account\.css/)
  assert.match(page, /cwgsyw-account-page--login/)
  assert.match(page, /showEyebrow=\{false\}/)
  assert.match(page, /IT 基础设施运维管理平台/)
  assert.match(page, /cwgsyw-account-login-brand/)
  assert.match(page, /showSubtitle=\{false\}/)
  assert.match(page, /cwgsyw-account-login-hint/)
  assert.match(fs.readFileSync(accountCssPath, 'utf8'), /\.cwgsyw-account-page--login \.cwgsyw-account-login-brand \{[\s\S]*display: flex;[\s\S]*align-items: center/)
  assert.match(fs.readFileSync(accountCssPath, 'utf8'), /\.cwgsyw-account-login-brand__logo \{[\s\S]*width: 72px;[\s\S]*height: 72px/)
  assert.match(fs.readFileSync(accountCssPath, 'utf8'), /\.cwgsyw-account-page--login \.cwgsyw-account-login-hint \{[\s\S]*color-mix\(in srgb, var\(--cwgsyw-text-tertiary\) 62%/)
  assert.match(page, /src="\/sidebar-logo.png"/)
  assert.match(page, /size="sm"/)
  assert.match(page, /account-login-eye\.svg/)
  assert.match(page, /account-login-eye-off\.svg/)
  assert.match(page, /cwgsyw-account-password-toggle/)
  assert.doesNotMatch(page, /LoginDotPattern/)
  assert.equal(fs.existsSync(accountCssPath), true)
  assert.equal(fs.existsSync(eyeAssetPath), true)
  assert.equal(fs.existsSync(eyeOffAssetPath), true)
  assert.equal(fs.existsSync(path.join(frontendRoot, 'public/sidebar-logo.png')), true)
  assert.match(fs.readFileSync(eyeAssetPath, 'utf8'), /<svg/)
  assert.match(fs.readFileSync(eyeOffAssetPath, 'utf8'), /<svg/)
  assert.match(fs.readFileSync(accountCssPath, 'utf8'), /input:-webkit-autofill/)
  assert.match(fs.readFileSync(accountCssPath, 'utf8'), /background-color: transparent !important/)
  assert.match(fs.readFileSync(accountCssPath, 'utf8'), /\.cwgsyw-control:focus-within/)
  assert.match(fs.readFileSync(accountCssPath, 'utf8'), /focus-ring\) 5%, transparent/)
  assert.match(fs.readFileSync(accountCssPath, 'utf8'), /prefers-reduced-motion: reduce/)
  assert.doesNotMatch(fs.readFileSync(accountCssPath, 'utf8'), /cwgsyw-login-dot-pattern/)
  assert.match(fs.readFileSync(accountCssPath, 'utf8'), /\.cwgsyw-account-page--login \{[\s\S]*width: 100%;[\s\S]*background: var\(--cwgsyw-bg-surface-subtle\);/)
  assert.match(fs.readFileSync(accountCssPath, 'utf8'), /\.cwgsyw-account-page--login \.cwgsyw-page__grid--single \{[\s\S]*justify-self: center;/)
  assert.match(fs.readFileSync(accountCssPath, 'utf8'), /cwgsyw-account-page--login \.cwgsyw-form__actions/)
  assert.match(fs.readFileSync(accountCssPath, 'utf8'), /border-top: 0/)
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
  assert.match(html, /cwgsyw-account-page--login/)
  assert.match(html, /IT 基础设施运维管理平台/)
  assert.match(html, /cwgsyw-account-login-brand__logo/)
  assert.match(html, /sidebar-logo.png/)
  assert.match(html, /登录成功后进入工作台。/)
  assert.match(html, /联系管理员获取账号；首次登录可能需要完成账号安全设置。/)
  assert.match(html, /用户名/)
  assert.match(html, /显示密码/)
  assert.match(html, /type="submit"/)
  assert.doesNotMatch(html, /<main/)
})
