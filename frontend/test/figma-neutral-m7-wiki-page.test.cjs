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
const pagePath = path.join(frontendRoot, 'src/app/(dashboard)/wiki/[spaceId]/[pageId]/page.tsx')

function compileTs(filePath) {
  return ts.transpileModule(fs.readFileSync(filePath, 'utf8'), {
    compilerOptions: { esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    fileName: filePath,
  }).outputText
}

function loadCompiled(filePath) {
  const compiled = compileTs(filePath)
  const originalLoad = Module._load
  Module._load = function load(request, parent, isMain) {
    if (request.endsWith('.css')) return {}
    if (request === 'next/navigation') {
      return {
        useRouter: () => ({ replace() {}, push() {} }),
        useParams: () => ({ spaceId: '1', pageId: '10' }),
      }
    }
    if (request === 'next-themes') return { useTheme: () => ({ resolvedTheme: 'light' }) }
    if (request === 'sonner' || request === '@/design-system/figma-neutral/toast') return { toast: { success() {}, error() {}, warning() {}, info() {}, message() {} }, NeutralToaster() { return null } }
    if (request === '@/hooks/useBreadcrumbLabel') return { useBreadcrumbLabel() {} }
    if (request === '@/components/wiki/WikiMarkdown') {
      return { WikiMarkdown: ({ content }) => React.createElement('div', null, content) }
    }
    if (request === '@/components/authorization/ResourceAccessDialog') {
      return { ResourceAccessDialog: () => null }
    }
    if (request === '@/lib/wiki-api') {
      return {
        wikiApi: {
          listSpaces: async () => [],
          getTree: async () => [],
          getPage: async () => ({}),
          listComments: async () => ({ records: [], total: 0 }),
          submitPage: async () => {},
          publishPage: async () => {},
          exportPage: async () => {},
          getBacklinks: async () => [],
          getVersions: async () => [],
        },
      }
    }
    if (request === '@tanstack/react-query') {
      return {
        useQueryClient: () => ({ invalidateQueries() {} }),
        useMutation: () => ({ mutate() {}, isPending: false }),
        useQuery: (options) => {
          const key = options && options.queryKey ? options.queryKey[0] : ''
          if (key === 'wiki-spaces') {
            return { data: [{ id: 1, name: '运维手册', readOnly: false }], isLoading: false, isError: false, refetch() {} }
          }
          if (key === 'wiki-tree') {
            return {
              data: [{ id: 10, title: '入门指南', status: 'draft', slug: 'intro', sortOrder: 1, spaceId: 1, children: [] }],
              isLoading: false,
              isError: false,
              refetch() {},
            }
          }
          if (key === 'wiki-page') {
            return {
              data: {
                id: 10,
                title: '入门指南',
                content: '# 入门',
                status: 'draft',
                currentVersion: 2,
                updatedByName: 'admin',
                updatedAt: '2026-08-14T10:00:00Z',
                canWrite: true,
                canPublish: true,
                canManageAcl: true,
                aclCustom: false,
              },
              isLoading: false,
              isError: false,
              refetch() {},
            }
          }
          if (key === 'wiki-comments-count') return { data: { records: [], total: 3 }, isLoading: false, isError: false, refetch() {} }
          if (key === 'wiki-backlinks') return { data: [], isLoading: false, isError: false, refetch() {} }
          return { data: [], isLoading: false, isError: false, refetch() {} }
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
      const hit = [resolved, resolved + '.tsx', resolved + '.ts', resolved + '/index.ts', resolved + '/index.tsx'].find((c) => fs.existsSync(c) && fs.statSync(c).isFile())
      if (hit) return loadCompiled(hit)
    }
    if ((request.startsWith('./') || request.startsWith('../')) && parent && parent.filename) {
      const resolved = path.join(path.dirname(parent.filename), request)
      const hit = [resolved + '.tsx', resolved + '.ts', resolved].find((c) => fs.existsSync(c) && fs.statSync(c).isFile())
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

test('wiki page reader leaves old visual entries and keeps APIs', () => {
  const page = fs.readFileSync(pagePath, 'utf8')
  assert.match(page, /figma-neutral\/index\.css/)
  assert.doesNotMatch(page, /> \$\{currentSpace/)
  assert.match(page, /queryKey: \['wiki-page', pid\]/)
  assert.match(page, /wikiApi\.getPage/)
  assert.match(page, /wikiApi\.submitPage/)
  assert.match(page, /wikiApi\.publishPage/)
  assert.match(page, /wikiApi\.exportPage/)
  assert.match(page, /wikiApi\.listComments/)
  assert.match(page, /cwgsyw-wiki-page__info-actions/)
  assert.match(page, /cwgsyw-wiki-page__info-actions[\s\S]*权限设置/)
  assert.doesNotMatch(page, /WikiShellHeader/)
  assert.match(page, /WikiShellToggle/)
  assert.doesNotMatch(page, /PageHeader/)
  assert.doesNotMatch(page, /@\/components\/design-system/)
  assert.doesNotMatch(page, /text-v2-/)
  assert.doesNotMatch(page, /border-v2-/)
  for (const rel of ['components/wiki/WikiBacklinksPanel.tsx', 'components/wiki/WikiVersionsPanel.tsx', 'components/wiki/WikiCommentsDrawer.tsx']) {
    const source = fs.readFileSync(path.join(frontendRoot, 'src', rel), 'utf8')
    assert.doesNotMatch(source, /@\/components\/design-system/)
    assert.doesNotMatch(source, /text-v2-/)
    if (rel.endsWith('WikiVersionsPanel.tsx')) {
      assert.match(source, /queryKey: \['wiki-versions', pageId\]/)
      assert.match(source, /wikiApi\.exportPageVersion/)
      assert.match(source, /wikiApi\.revertPage/)
      assert.match(source, /NeutralTooltip content="导出"/)
      assert.match(source, /NeutralTooltip content="回滚"/)
      assert.match(source, /figma-action-icon--download/)
      assert.match(source, /figma-action-icon--undo/)
      assert.doesNotMatch(source, />\s*导出\s*<\/Button>/)
      assert.doesNotMatch(source, />\s*回滚\s*<\/Button>/)
    }
  }
})

test('wiki page reader renders Neutral reader chrome', () => {
  const page = loadCompiled(pagePath)
  const html = renderToStaticMarkup(React.createElement(page.default))
  assert.match(html, /正文/)
  assert.match(html, /cwgsyw-wiki-page__body-head/)
  assert.match(html, /页面信息/)
  assert.match(html, /cwgsyw-wiki-page__info-actions/)
  assert.doesNotMatch(html, /cwgsyw-page-header/)
  assert.match(html, /编辑/)
  assert.match(html, /发布/)
  assert.match(html, /评论 3/)
  assert.match(html, /权限设置/)
})
