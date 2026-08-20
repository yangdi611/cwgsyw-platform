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
const pagePath = path.join(frontendRoot, 'src/app/(dashboard)/cmdb/instances/by-model/[modelCode]/[id]/associations/new/page.tsx')
const patternsPath = path.join(frontendRoot, 'src/design-system/figma-neutral/components/patterns.css')
const searchIconPath = path.join(frontendRoot, 'public/figma-icons/cmdb-search.svg')
const packageSearchIconPath = path.join(frontendRoot, 'public/figma-icons/cmdb-package-search.svg')

function compile(filePath) {
  return ts.transpileModule(fs.readFileSync(filePath, 'utf8'), {
    compilerOptions: { esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    fileName: filePath,
  }).outputText
}

function loadCompiled(filePath) {
  const compiled = compile(filePath)
  const originalLoad = Module._load
  Module._load = function load(request, parent, isMain) {
    if (request.endsWith('.css')) return {}
    if (request === 'next/navigation') {
      return {
        useRouter: () => ({ replace() {}, push() {}, back() {} }),
        useParams: () => ({ modelCode: 'server', id: '11' }),
      }
    }
    if (request === 'sonner' || request === '@/design-system/figma-neutral/toast') return { toast: { success() {}, error() {}, warning() {}, info() {}, message() {} }, NeutralToaster() { return null } }
    if (request === '@/hooks/usePermission') return { usePermission: () => ({ hasPermission: () => true, isHydrated: true }) }
    if (request === '@/hooks/useBreadcrumbLabel') return { useBreadcrumbLabel() {} }
    if (request === '@/lib/api') return { get: async () => ({ data: { data: {} } }), post: async () => ({ data: {} }) }
    if (request === '@/lib/api-error') return { getApiErrorMessage: (_err, fallback) => fallback }
    if (request === '@tanstack/react-query') {
      return {
        useMutation: () => ({ mutate() {}, isPending: false }),
        useQuery: ({ queryKey } = {}) => {
          if (queryKey?.[0] === 'cmdb-instance') return { data: { name: 'web-01', modelId: 'server' } }
          if (queryKey?.[0] === 'cmdb-rel-applicable-defs') {
            return { data: [{ defId: 'connected_to', kindId: 'link', name: '连接到', srcModelId: 'server', dstModelId: 'switch', mapping: '1:n', onDelete: 'restrict' }] }
          }
          return { data: undefined, isFetching: false }
        },
      }
    }
    if (request.startsWith('@base-ui/react/')) {
      const passthrough = ({ children }) => React.createElement(React.Fragment, null, children)
      const node = ({ children, className, ...props }) => React.createElement('div', { className, ...props }, children)
      return {
        Dialog: { Root: passthrough, Portal: passthrough, Backdrop: node, Popup: node, Title: node, Description: node, Close: node },
        Menu: { Root: passthrough, Trigger: node, Portal: passthrough, Positioner: passthrough, Popup: node },
        Popover: { Root: passthrough, Trigger: node, Portal: passthrough, Positioner: passthrough, Popup: node },
        Tooltip: { Provider: passthrough, Root: passthrough, Trigger: node, Portal: passthrough, Positioner: passthrough, Popup: node },
      }
    }
    if (request.startsWith('@/')) {
      const resolved = path.join(frontendRoot, 'src', request.slice(2))
      const hit = [resolved, `${resolved}.tsx`, `${resolved}.ts`, `${resolved}/index.ts`, `${resolved}/index.tsx`].find((c) => fs.existsSync(c) && fs.statSync(c).isFile())
      if (hit) return loadCompiled(hit)
    }
    if ((request.startsWith('./') || request.startsWith('../')) && parent && parent.filename) {
      const resolved = path.join(path.dirname(parent.filename), request)
      const hit = [`${resolved}.tsx`, `${resolved}.ts`, resolved].find((c) => fs.existsSync(c) && fs.statSync(c).isFile())
      if (hit && (hit.endsWith('.ts') || hit.endsWith('.tsx'))) return loadCompiled(hit)
    }
    return originalLoad.call(this, request, parent, isMain)
  }
  const mod = new Module(filePath, module)
  mod.filename = filePath
  mod.paths = Module._nodeModulePaths(path.dirname(filePath))
  try { mod._compile(compiled, filePath) } finally { Module._load = originalLoad }
  return mod.exports
}

test('cmdb new association keeps contracts while using the compact page composition', () => {
  const page = fs.readFileSync(pagePath, 'utf8')
  const patterns = fs.readFileSync(patternsPath, 'utf8')
  assert.match(page, /figma-neutral\/index\.css/)
  assert.match(page, /cwgsyw-cmdb-instance-page/)
  assert.match(page, /cwgsyw-cmdb-association-create/)
  assert.match(page, /cwgsyw-cmdb-choice-list/)
  assert.match(page, /showEyebrow=\{false\}/)
  assert.match(page, /showBreadcrumb=\{false\}/)
  assert.match(page, /<ol className="cwgsyw-cmdb-wizard-steps" aria-label="新建关联步骤">/)
  assert.match(page, /aria-current=\{i === step \? 'step' : undefined\}/)
  assert.match(page, /data-state=\{i < step \? 'complete' : i === step \? 'current' : 'upcoming'\}/)
  assert.match(page, /cwgsyw-cmdb-wizard-steps__index/)
  assert.match(page, /cwgsyw-cmdb-association-create__step-header/)
  assert.match(page, /isInstanceError/)
  assert.match(page, /isDefsError/)
  assert.match(page, /isSearchError/)
  assert.match(page, /refetchInstance/)
  assert.match(page, /refetchDefs/)
  assert.match(page, /refetchSearch/)
  assert.match(patterns, /cmdb-association-link-2\.svg/)
  assert.match(page, /className="cwgsyw-cmdb-association-create__choice"/)
  assert.match(page, /variant=\{selectedDefId === d\.defId \? 'selected' : 'interactive'\}/)
  assert.match(page, /<span>源 \{d\.srcModelId\}<\/span>/)
  assert.match(page, /<span>目标 \{d\.dstModelId\}<\/span>/)
  assert.match(page, /aria-label="关联属性名"/)
  assert.match(page, /setAttrError\('请输入属性名'\)/)
  assert.match(page, /<fieldset className="cwgsyw-cmdb-association-create__attribute-fieldset">/)
  assert.match(page, /className="cwgsyw-cmdb-association-create__attribute-error" role="alert"/)
  assert.match(page, /api.post\(`\/cmdb\/instances\/\$\{id\}\/relations`/)
  assert.match(page, /cmdb-rel-applicable-defs/)
  assert.match(page, /queryKey: \['cmdb-rel-search', targetModelId, keyword\]/)
  assert.match(page, /enabled: !!targetModelId && step === 1 && !!keyword\.trim\(\)/)
  assert.match(patterns, /\.cwgsyw-cmdb-association-create \.cwgsyw-cmdb-choice-list \{[\s\S]*repeat\(auto-fit, minmax\(240px, 1fr\)\)/)
  assert.match(patterns, /\.cwgsyw-cmdb-wizard-steps \{[\s\S]*repeat\(3, minmax\(0, 1fr\)\)/)
  assert.match(patterns, /\.cwgsyw-cmdb-association-create__choice \{[\s\S]*grid-template-columns: 32px minmax\(0, 1fr\) 16px/)
  assert.match(patterns, /\.cwgsyw-cmdb-association-create__choice-shell \.cwgsyw-card--selected/)
  assert.equal((page.match(/showIcon=\{false\}/g) ?? []).length >= 3, true)
  assert.match(page, /cwgsyw-cmdb-association-create__empty-icon--search/)
  assert.match(page, /cwgsyw-cmdb-association-create__empty-icon--package-search/)
  assert.match(patterns, /mask: url\('\/figma-icons\/cmdb-search\.svg'\) center \/ 20px 20px no-repeat/)
  assert.match(patterns, /mask: url\('\/figma-icons\/cmdb-package-search\.svg'\) center \/ 21px 22px no-repeat/)
  assert.match(patterns, /\.cwgsyw-cmdb-association-create__empty \.cwgsyw-type-title-sm \{[\s\S]*font-size: 13px;[\s\S]*font-weight: var\(--cwgsyw-font-weight-regular\)/)
  assert.equal(fs.existsSync(searchIconPath), true)
  assert.equal(fs.existsSync(packageSearchIconPath), true)
  assert.match(fs.readFileSync(searchIconPath, 'utf8'), /<svg[\s\S]*id="Union"/)
  assert.match(fs.readFileSync(packageSearchIconPath, 'utf8'), /<svg[\s\S]*id="Union"/)
  assert.match(patterns, /\.cwgsyw-cmdb-association-create__attribute-row \{[\s\S]*grid-template-columns: minmax\(160px, 1fr\) minmax\(160px, 1fr\) auto/)
  assert.match(patterns, /@media \(max-width: 520px\)[\s\S]*\.cwgsyw-cmdb-association-create \.cwgsyw-cmdb-choice-list \{[\s\S]*grid-template-columns: minmax\(0, 1fr\)/)
  assert.doesNotMatch(page, /@\/components\/design-system/)
  assert.doesNotMatch(page, /@\/components\/shared/)
  assert.doesNotMatch(page, /text-v2-/)
  assert.doesNotMatch(page, /lucide-react/)
  assert.doesNotMatch(page, /\bBreadcrumb\b/)
  assert.doesNotMatch(page, /→/)
})

test('cmdb new association renders Neutral wizard', () => {
  const page = loadCompiled(pagePath)
  const html = renderToStaticMarkup(React.createElement(page.default))
  assert.match(html, /新建关联/)
  assert.match(html, /选择关联定义/)
  assert.match(html, /连接到/)
  assert.match(html, /下一步/)
  assert.match(html, /aria-label="新建关联步骤"/)
  assert.match(html, /aria-current="step"/)
  assert.match(html, /源 server/)
  assert.match(html, /目标 switch/)
  assert.match(html, /cwgsyw-cmdb-association-create__choice-icon/)
})
