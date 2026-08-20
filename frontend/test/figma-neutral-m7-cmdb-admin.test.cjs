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
const pagePath = path.join(frontendRoot, 'src/app/(dashboard)/cmdb/admin/page.tsx')
const catalogPath = path.join(frontendRoot, 'src/app/(dashboard)/cmdb/admin/components/ModelCatalogTab.tsx')
const modelCardPath = path.join(frontendRoot, 'src/app/(dashboard)/cmdb/admin/components/ModelCard.tsx')
const attributeGroupsPath = path.join(frontendRoot, 'src/app/(dashboard)/cmdb/admin/components/AttributeGroupsTab.tsx')
const associationDefsPath = path.join(frontendRoot, 'src/app/(dashboard)/cmdb/admin/components/AssociationDefsSection.tsx')
const associationsPath = path.join(frontendRoot, 'src/app/(dashboard)/cmdb/admin/components/AssociationsTab.tsx')
const actionIconPath = path.join(frontendRoot, 'src/app/(dashboard)/cmdb/admin/components/CmdbAdminActionIcon.tsx')
const disclosureIconPath = path.join(frontendRoot, 'src/app/(dashboard)/cmdb/admin/components/CmdbAdminDisclosureIcon.tsx')
const modelMenuIconPath = path.join(frontendRoot, 'src/app/(dashboard)/cmdb/admin/components/CmdbAdminModelMenuIcon.tsx')
const modelMenuItemIconPath = path.join(frontendRoot, 'src/app/(dashboard)/cmdb/admin/components/CmdbAdminModelMenuItemIcon.tsx')
const patternsPath = path.join(frontendRoot, 'src/design-system/figma-neutral/components/patterns.css')
const editIconAssetPath = path.join(frontendRoot, 'public/figma-icons/cmdb-admin-edit-outline.svg')
const trashIconAssetPath = path.join(frontendRoot, 'public/figma-icons/cmdb-admin-trash-2.svg')
const disclosureIconAssetPath = path.join(frontendRoot, 'public/figma-icons/cmdb-admin-chevron-down.svg')
const modelMenuIconAssetPath = path.join(frontendRoot, 'public/figma-icons/cmdb-admin-more-horizontal.svg')
const settingsIconAssetPath = path.join(frontendRoot, 'public/figma-icons/cmdb-admin-settings-2.svg')
const moveIconAssetPath = path.join(frontendRoot, 'public/figma-icons/cmdb-admin-move.svg')
const moveOverlayIconAssetPath = path.join(frontendRoot, 'public/figma-icons/cmdb-admin-move-overlay.svg')

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
    if (request === 'next/navigation') return { useRouter: () => ({ replace() {}, push() {}, back() {} }) }
    if (request === 'sonner' || request === '@/design-system/figma-neutral/toast') return { toast: { success() {}, error() {}, warning() {}, info() {}, message() {} }, NeutralToaster() { return null } }
    if (request === '@/hooks/usePermission') return { usePermission: () => ({ hasPermission: () => true, isHydrated: true }) }
    if (request === '@/lib/api') {
      return {
        get: async () => ({ data: { data: { records: [{ id: '1', name: '变更审批流', key: 'changeDocApproval', version: 2, category: '审批', activeVersion: 2 }], total: 1 } } }),
        put: async () => ({ data: {} }),
        post: async () => ({ data: {} }),
        delete: async () => ({ data: {} }),
      }
    }
    if (request === '@/lib/api-error') return { getApiErrorMessage: (_err, fallback) => fallback }
    if (request === '@/types/api') {
      return { extractPaginated: (r) => r.data.data }
    }
    if (request === '@tanstack/react-query') {
      return {
        useQueryClient: () => ({ invalidateQueries() {} }),
        useMutation: () => ({ mutate() {}, isPending: false }),
        useQuery: ({ queryKey } = {}) => {
          const key = String(queryKey || '')
          if (key.includes('cmdb-model-groups')) return { data: [{ id: 1, code: 'hardware', name: '硬件', sortOrder: 1, isBuiltIn: true, modelCount: 1 }], isLoading: false }
          if (key.includes('cmdb-models')) return { data: [{ modelId: 'server', name: '服务器', displayName: '服务器', group: 'hardware', isBuiltIn: false }], isLoading: false }
          if (key.includes('cmdb-association-kinds')) return { data: [{ id: 1, code: 'run_on', name: '运行于', isBuiltIn: true }] }
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

test('cmdb admin leaves old visual entries', () => {
  const page = fs.readFileSync(pagePath, 'utf8')
  const catalog = fs.readFileSync(catalogPath, 'utf8')
  const modelCard = fs.readFileSync(modelCardPath, 'utf8')
  const attributeGroups = fs.readFileSync(attributeGroupsPath, 'utf8')
  const associationDefs = fs.readFileSync(associationDefsPath, 'utf8')
  const associations = fs.readFileSync(associationsPath, 'utf8')
  const actionIcon = fs.readFileSync(actionIconPath, 'utf8')
  const disclosureIcon = fs.readFileSync(disclosureIconPath, 'utf8')
  const modelMenuIcon = fs.readFileSync(modelMenuIconPath, 'utf8')
  const modelMenuItemIcon = fs.readFileSync(modelMenuItemIconPath, 'utf8')
  const patterns = fs.readFileSync(patternsPath, 'utf8')
  const editIconAsset = fs.readFileSync(editIconAssetPath, 'utf8')
  const trashIconAsset = fs.readFileSync(trashIconAssetPath, 'utf8')
  const disclosureIconAsset = fs.readFileSync(disclosureIconAssetPath, 'utf8')
  const modelMenuIconAsset = fs.readFileSync(modelMenuIconAssetPath, 'utf8')
  const settingsIconAsset = fs.readFileSync(settingsIconAssetPath, 'utf8')
  const moveIconAsset = fs.readFileSync(moveIconAssetPath, 'utf8')
  const moveOverlayIconAsset = fs.readFileSync(moveOverlayIconAssetPath, 'utf8')
  assert.match(page, /figma-neutral\/index\.css/)
  assert.match(page, /hasPermission\('cmdb_model', 'read'\)/)
  assert.match(page, /ModelCatalogTab/)
  assert.match(page, /AttributeGroupsTab/)
  assert.match(page, /AssociationsTab/)
  assert.doesNotMatch(page, /@\/components\/design-system/)
  assert.doesNotMatch(page, /@\/components\/shared/)
  assert.doesNotMatch(page, /text-v2-/)
  assert.doesNotMatch(page, /border-v2-/)
  assert.match(page, /cwgsyw-cmdb-admin/)
  assert.match(page, /cwgsyw-cmdb-overview__catalog-note/)
  assert.doesNotMatch(page, /<Breadcrumb/)
  assert.match(catalog, /cwgsyw-cmdb-admin__model-grid/)
  assert.match(catalog, /expandedGroupCode/)
  assert.doesNotMatch(catalog, /expandedGroups/)
  assert.match(catalog, /AnimatePresence/)
  assert.match(catalog, /pendingGroupCode/)
  assert.match(catalog, /onExitComplete=\{completeGroupExit\}/)
  assert.match(catalog, /setPendingGroupCode\(code\)[\s\S]*setExpandedGroupCode\(null\)/)
  assert.doesNotMatch(catalog, /LayoutGroup/)
  assert.match(catalog, /animate=\{\{ height: 'auto', opacity: 1 \}\}/)
  assert.match(catalog, /duration: 0\.22/)
  assert.match(catalog, /<CmdbAdminDisclosureIcon expanded=\{isExpanded\}/)
  assert.match(catalog, /<CmdbAdminActionIcon name="edit"/)
  assert.match(catalog, /<CmdbAdminActionIcon name="trash"/)
  assert.doesNotMatch(catalog, />\s*\{isExpanded \? '收起' : '展开'\}\s*</)
  assert.match(disclosureIcon, /cmdb-admin__disclosure-icon/)
  assert.match(disclosureIconAsset, /id="Vector"/)
  assert.match(modelCard, /<CmdbAdminModelMenuIcon/)
  assert.match(modelCard, /<CmdbAdminModelMenuItemIcon name="settings"/)
  assert.match(modelCard, /<CmdbAdminModelMenuItemIcon name="move"/)
  assert.match(modelCard, />打开设置</)
  assert.match(modelCard, />移动到分类</)
  assert.match(modelCard, /<MenuItem label="删除模型" type="destructive"/)
  assert.doesNotMatch(modelCard, />\s*操作\s*</)
  assert.match(modelMenuIcon, /cmdb-admin__model-menu-icon/)
  assert.match(modelMenuIconAsset, /id="Union"/)
  assert.match(modelMenuItemIcon, /cmdb-admin__model-menu-item-icon/)
  assert.match(settingsIconAsset, /id="Union"/)
  assert.match(moveIconAsset, /id="Union"/)
  assert.match(moveOverlayIconAsset, /id="Union"/)
  assert.doesNotMatch(catalog, /<strong className="cwgsyw-type-title-sm"/)
  assert.match(attributeGroups, /cwgsyw-cmdb-admin__model-select/)
  assert.match(attributeGroups, /aria-label="选择模型"/)
  assert.doesNotMatch(attributeGroups, /<Field label="模型"/)
  assert.match(attributeGroups, /label: '', align: 'right'/)
  assert.match(associationDefs, /label: '', align: 'right'/)
  assert.match(associations, /label: '', align: 'right'/)
  assert.match(attributeGroups, /<CmdbAdminActionIcon name="edit"/)
  assert.match(attributeGroups, /<CmdbAdminActionIcon name="trash"/)
  assert.match(actionIcon, /cmdb-admin__figma-action-icon/)
  assert.match(editIconAsset, /id="edit_outline"/)
  assert.match(trashIconAsset, /id="Union"/)
  assert.match(associationDefs, /cwgsyw-cmdb-admin__delete-action/)
  assert.match(associations, /cwgsyw-cmdb-admin__row-actions/)
  assert.match(patterns, /\.cwgsyw-cmdb-admin__model-grid[\s\S]*repeat\(4, minmax\(0, 1fr\)\)/)
  assert.match(patterns, /\.cwgsyw-cmdb-admin__catalog[\s\S]*font-weight: var\(--cwgsyw-font-weight-regular\)/)
  assert.match(patterns, /cmdb-admin-chevron-down\.svg/)
  assert.match(patterns, /\.cwgsyw-cmdb-admin__group-panel[\s\S]*overflow: hidden/)
  assert.doesNotMatch(patterns, /\.cwgsyw-cmdb-admin__group-card:hover/)
  assert.match(patterns, /\.cwgsyw-cmdb-admin__model-card:hover[\s\S]*bg-surface-subtle/)
  assert.match(patterns, /cmdb-admin-more-horizontal\.svg/)
  assert.match(patterns, /cmdb-admin-settings-2\.svg/)
  assert.match(patterns, /cmdb-admin-move\.svg/)
  assert.match(patterns, /cmdb-admin-move-overlay\.svg/)
  assert.match(patterns, /\.cwgsyw-menu:has\(> \.cwgsyw-cmdb-admin__model-menu\)[\s\S]*width: 220px[\s\S]*padding: var\(--cwgsyw-space-1\)/)
  assert.match(patterns, /model-menu\)[\s\S]*transition: opacity 140ms ease-out, transform 140ms/)
  assert.match(patterns, /\[data-ending-style\][\s\S]*transition-duration: 110ms/)
  assert.match(patterns, /\[data-starting-style\][\s\S]*translateY\(-4px\) scale\(0\.98\)/)
  assert.match(patterns, /\.cwgsyw-cmdb-admin__model-select[\s\S]*280px/)
  assert.match(patterns, /\.cwgsyw-cmdb-admin__action-table[\s\S]*width: 92px/)
  assert.match(patterns, /\.cwgsyw-cmdb-admin__row-actions[\s\S]*flex-wrap: nowrap/)
  assert.match(patterns, /cwgsyw-cmdb-admin__row-actions \.cwgsyw-icon-btn:not\(:disabled\)[\s\S]*background: transparent/)
  assert.match(patterns, /cwgsyw-icon-btn:active:not\(:disabled\)[\s\S]*scale\(0\.92\)/)
  assert.match(patterns, /cwgsyw-cmdb-admin__row-actions \.cwgsyw-icon-btn:disabled[\s\S]*background: transparent/)
  assert.match(patterns, /cwgsyw-cmdb-admin__row-actions \.cwgsyw-icon-btn:disabled[\s\S]*neutral-400/)
  assert.match(patterns, /cmdb-admin-edit-outline\.svg/)
  assert.match(patterns, /cmdb-admin-trash-2\.svg/)
  assert.match(patterns, /cwgsyw-cmdb-admin__delete-action:not\(:disabled\)[\s\S]*status-danger-fg/)
})

test('cmdb admin renders Neutral tabs', () => {
  const page = loadCompiled(pagePath)
  const html = renderToStaticMarkup(React.createElement(page.default))
  assert.match(html, /模型管理/)
  assert.match(html, /模型目录/)
  assert.match(html, /属性分组/)
  assert.match(html, /关联定义/)
})
