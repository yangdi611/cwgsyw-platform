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
const roomPath = path.join(frontendRoot, 'src/app/(dashboard)/cmdb/spatial/rooms/[roomId]/page.tsx')
const viewerPath = path.join(frontendRoot, 'src/features/cmdb-spatial/viewer/SpatialRoomViewer.tsx')
const viewerCanvasPath = path.join(frontendRoot, 'src/features/cmdb-spatial/viewer/SpatialViewerCanvas.tsx')
const canvasStagePath = path.join(frontendRoot, 'src/features/cmdb-spatial/viewer/SpatialCanvasStage.tsx')
const selectionPanelPath = path.join(frontendRoot, 'src/features/cmdb-spatial/components/SpatialSelectionPanel.tsx')
const editPath = path.join(frontendRoot, 'src/app/(dashboard)/cmdb/spatial/rooms/[roomId]/edit/page.tsx')
const versionsPath = path.join(frontendRoot, 'src/app/(dashboard)/cmdb/spatial/rooms/[roomId]/versions/page.tsx')
const versionHistoryPath = path.join(frontendRoot, 'src/features/cmdb-spatial/components/SpatialVersionHistory.tsx')
const spikePath = path.join(frontendRoot, 'src/app/(dashboard)/cmdb/spatial/spike/page.tsx')
const patternsPath = path.join(frontendRoot, 'src/design-system/figma-neutral/components/patterns.css')
const overlayPath = path.join(frontendRoot, 'src/design-system/figma-neutral/components/Overlay.tsx')
const overlayCssPath = path.join(frontendRoot, 'src/design-system/figma-neutral/components/overlay.css')
const editorSourcePath = path.join(frontendRoot, 'src/features/cmdb-spatial/editor/SpatialEditor.tsx')
const figmaIconPaths = [
  'cmdb-spatial-check-circle.svg',
  'cmdb-spatial-save.svg',
  'cmdb-spatial-send.svg',
  'cmdb-spatial-archive-restore.svg',
  'cmdb-spatial-grip-horizontal.svg',
].map((name) => path.join(frontendRoot, 'public/figma-icons', name))

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
    if (request === 'next/navigation') return { useRouter: () => ({ replace() {}, push() {} }), useParams: () => ({ roomId: '9' }) }
    if (request === '@/hooks/usePermission') return { usePermission: () => ({ hasPermission: () => true, isHydrated: true }) }
    if (request.includes('spatial-api') || request.endsWith('../api/spatial-api')) {
      return {
        spatialQueryKeys: { layouts: () => ['cmdb', 'spatial', 'layouts'], rooms: () => ['cmdb', 'spatial', 'rooms'] },
        listSpatialLayouts: async () => [{ layoutId: 4, roomInstanceId: 9, name: '机房A' }],
        listSpatialRooms: async () => [{ roomInstanceId: 9, name: '机房A', configured: true, layoutId: 4 }],
      }
    }
    if (request === '@tanstack/react-query') {
      return {
        useQuery: () => ({ data: [{ layoutId: 4, roomInstanceId: 9, name: '机房A' }], isLoading: false, isError: false }),
      }
    }
    if (request.includes('SpatialRoomViewer')) return { SpatialRoomViewer: ({ roomId }) => React.createElement('div', null, `room-viewer-${roomId}`) }
    if (request.includes('SpatialEditor') && !request.includes('SpatialEditorStage')) return { SpatialEditor: ({ roomId, roomName, layoutId }) => React.createElement('div', null, `spatial-editor-${roomId}-${roomName}-${layoutId}`) }
    if (request.includes('SpatialVersionHistory')) return { SpatialVersionHistory: ({ roomId }) => React.createElement('div', null, `spatial-versions-${roomId}`) }
    if (request.includes('SpatialCanvasSpike')) return { SpatialCanvasSpike: () => React.createElement('div', null, 'spatial-spike') }
    if (request === '@/lib/api-error') return { getApiErrorMessage: (_error, fallback) => fallback }
    if (request === '@/design-system/figma-neutral/components') {
      return {
        Button: ({ children }) => React.createElement('button', null, children),
        DashboardFeedbackPage: ({ header, feedback }) => React.createElement('main', null, header, feedback),
        EmptyState: ({ title }) => React.createElement('div', null, title),
        ErrorState: ({ title }) => React.createElement('div', null, title),
        LoadingState: ({ label }) => React.createElement('div', null, label),
        PageHeader: ({ title, subtitle }) => React.createElement('header', null, title, subtitle),
      }
    }
    if (request.startsWith('@/')) {
      const resolved = path.join(frontendRoot, 'src', request.slice(2))
      const hit = [resolved, `${resolved}.tsx`, `${resolved}.ts`].find((c) => fs.existsSync(c) && fs.statSync(c).isFile())
      if (hit) return loadCompiled(hit)
    }
    return originalLoad.call(this, request, parent, isMain)
  }
  const mod = new Module(filePath, module)
  mod.filename = filePath
  mod.paths = Module._nodeModulePaths(path.dirname(filePath))
  try { mod._compile(compiled, filePath) } finally { Module._load = originalLoad }
  return mod.exports
}

test('spatial room pages leave old visual entries and keep Neutral CSS', () => {
  for (const filePath of [roomPath, editPath, versionsPath, spikePath]) {
    const source = fs.readFileSync(filePath, 'utf8')
    assert.match(source, /figma-neutral\/index\.css/, filePath)
    assert.doesNotMatch(source, /@\/components\/design-system/, filePath)
    assert.doesNotMatch(source, /@\/components\/shared/, filePath)
    assert.doesNotMatch(source, /text-v2-|bg-v2-/, filePath)
  }
  assert.match(fs.readFileSync(roomPath, 'utf8'), /cmdb_spatial/)
  assert.match(fs.readFileSync(editPath, 'utf8'), /listSpatialLayouts/)
  assert.match(fs.readFileSync(versionsPath, 'utf8'), /SpatialVersionHistory/)
})

test('spatial room pages render Neutral shells', () => {
  const room = renderToStaticMarkup(React.createElement(loadCompiled(roomPath).default))
  const edit = renderToStaticMarkup(React.createElement(loadCompiled(editPath).default))
  const versions = renderToStaticMarkup(React.createElement(loadCompiled(versionsPath).default))
  const spike = renderToStaticMarkup(React.createElement(loadCompiled(spikePath).default))
  assert.match(room, /room-viewer-9/)
  assert.match(edit, /spatial-editor-9-机房A-4/)
  assert.match(versions, /spatial-versions-9/)
  assert.match(spike, /spatial-spike/)
})

test('published room viewer uses the CMDB detail pattern and exposes query states', () => {
  const roomSource = fs.readFileSync(roomPath, 'utf8')
  const viewerSource = fs.readFileSync(viewerPath, 'utf8')
  const canvasStageSource = fs.readFileSync(canvasStagePath, 'utf8')

  assert.match(roomSource, /DashboardFeedbackPage/)
  assert.match(roomSource, /正在准备机房空间布局/)
  assert.match(roomSource, /无权查看机房空间布局/)
  assert.doesNotMatch(roomSource, /return null/)

  assert.match(viewerSource, /DetailDrawerPage/)
  assert.match(viewerSource, /PageHeader/)
  assert.match(viewerSource, /aria-label="搜索机柜或设备"/)
  assert.match(viewerSource, /onClear=\{clearSearch\}/)
  assert.match(viewerSource, /refetchVersion/)
  assert.match(viewerSource, /refetchRuntime/)
  assert.match(viewerSource, /refetchLocations/)
  assert.match(viewerSource, /aria-label="空间布局图层"/)
  assert.match(viewerSource, /role="tablist"/)
  assert.match(viewerSource, /role="tab"/)
  assert.match(viewerSource, /role="tabpanel"/)
  assert.match(viewerSource, /layoutId="spatial-room-layer-indicator"/)
  assert.match(viewerSource, /MotionConfig reducedMotion="user"/)
  assert.match(viewerSource, /RACK_STATE_LEGEND\.map/)
  assert.match(viewerSource, /style=\{\{ color: item\.color \}\}/)
  assert.match(canvasStageSource, /export const RACK_STATE_LEGEND/)
  assert.match(canvasStageSource, /color: RACK_LAYOUT_PALETTES\.normal\.stroke/)
  assert.match(canvasStageSource, /color: RACK_LAYOUT_PALETTES\.alert\.stroke/)
  assert.match(canvasStageSource, /\? RACK_LAYOUT_PALETTES\.reserved/)
  assert.doesNotMatch(viewerSource, /<Chip/)
  assert.doesNotMatch(viewerSource, /cwgsyw-stack-list/)
})

test('published room selection uses a right parent drawer and a Vaul nested rack drawer', () => {
  const viewerSource = fs.readFileSync(viewerPath, 'utf8')
  const selectionSource = fs.readFileSync(selectionPanelPath, 'utf8')
  const patterns = fs.readFileSync(patternsPath, 'utf8')

  assert.match(viewerSource, /<NeutralDrawer[\s\S]*open=\{selected !== null\}/)
  assert.match(viewerSource, /className="cwgsyw-cmdb-preview-drawer cwgsyw-cmdb-spatial-room__selection-drawer"/)
  assert.match(viewerSource, /<DrawerPrimitive\.NestedRoot[\s\S]*direction="right"/)
  assert.match(viewerSource, /if \(!open\) setRackElevationId\(null\)/)
  assert.match(viewerSource, /aria-label="关闭机柜视图" onClick=\{\(\) => onOpenChange\(false\)\}/)
  assert.doesNotMatch(viewerSource, /<DrawerClose/)
  assert.match(viewerSource, /if \(!open\) closeSelection\(\)/)
  assert.match(selectionSource, /CmdbInstancePreview/)
  assert.match(selectionSource, /label: '机柜容量'/)
  assert.match(selectionSource, /className="cwgsyw-cmdb-spatial-room__rack-view-cta"/)
  assert.match(patterns, /\.cwgsyw-btn\.cwgsyw-cmdb-spatial-room__rack-view-cta\s*\{[^}]*linear-gradient[\s\S]*background-size:\s*260% 100%[^}]*animation:\s*cwgsyw-rack-view-gradient/s)
  assert.match(patterns, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.cwgsyw-btn\.cwgsyw-cmdb-spatial-room__rack-view-cta\s*\{[^}]*animation:\s*none/s)
  assert.doesNotMatch(selectionSource, /cwgsyw-stack-list|>关闭<\/Button>/)
  assert.match(patterns, /\.cwgsyw-drawer\.cwgsyw-cmdb-spatial-room__selection-drawer\s*\{[^}]*width:\s*min\(360px, 100vw\)/s)
  assert.match(patterns, /\.cwgsyw-cmdb-spatial-room__selection-drawer \.cwgsyw-cmdb-preview__actions \.cwgsyw-btn\s*\{[^}]*font-weight:\s*var\(--cwgsyw-font-weight-regular\)/s)
  assert.match(patterns, /\.cwgsyw-drawer\.cwgsyw-cmdb-spatial-room__rack-drawer\s*\{[^}]*width:\s*min\(680px, 100vw\)/s)
})

test('published room canvas uses scoped responsive recipes without utility or inline positioning', () => {
  const canvasSource = fs.readFileSync(viewerCanvasPath, 'utf8')
  const patterns = fs.readFileSync(patternsPath, 'utf8')

  assert.match(canvasSource, /cwgsyw-cmdb-spatial-room__canvas/)
  assert.match(canvasSource, /cwgsyw-cmdb-spatial-room__zoom/)
  assert.match(canvasSource, /aria-label="画布缩放"/)
  assert.doesNotMatch(canvasSource, /min-h-\[460px\]|className="relative|style=\{/)

  assert.match(patterns, /\.cwgsyw-cmdb-spatial-room__canvas\s*\{[^}]*height:\s*520px/s)
  assert.match(patterns, /\.cwgsyw-cmdb-spatial-room__canvas\s*\{\s*height:\s*440px/s)
  assert.match(patterns, /\.cwgsyw-cmdb-spatial-room__canvas\s*\{\s*height:\s*360px/s)
  assert.match(patterns, /\.cwgsyw-cmdb-spatial-room__zoom\s*\{[^}]*position:\s*absolute/s)
  assert.match(patterns, /\.cwgsyw-cmdb-spatial-room__layers\s*\{[^}]*min-height:\s*40px/s)
  assert.match(patterns, /\.cwgsyw-cmdb-spatial-room__layer-tab\.cwgsyw-btn\s*\{[^}]*min-width:\s*64px[^}]*height:\s*28px/s)
  assert.match(patterns, /\.cwgsyw-cmdb-spatial-room__layer-indicator\s*\{[^}]*background:\s*var\(--cwgsyw-bg-surface\)/s)
})

test('spatial edit route exposes permission, loading, error and missing-layout states', () => {
  const source = fs.readFileSync(editPath, 'utf8')

  assert.match(source, /DashboardFeedbackPage/)
  assert.match(source, /listSpatialRooms\('', true\)/)
  assert.match(source, /roomName=\{roomName \?\? layout\.name\.replace\(\/逻辑布局\$\/, ''\)\}/)
  assert.match(source, /正在准备空间布局编辑器/)
  assert.match(source, /无权编辑空间布局/)
  assert.match(source, /空间布局列表加载失败/)
  assert.match(source, /未找到可编辑的活动布局/)
  assert.match(source, /refetch/)
  assert.doesNotMatch(source, /return null|style=\{/)
})

test('spatial editor keeps all three work areas available at tablet and mobile widths', () => {
  const editorSource = fs.readFileSync(editorSourcePath, 'utf8')
  const patterns = fs.readFileSync(patternsPath, 'utf8')

  assert.match(editorSource, /cwgsyw-cmdb-spatial-editor__workspace/)
  assert.match(editorSource, /cwgsyw-cmdb-spatial-editor__library/)
  assert.match(editorSource, /cwgsyw-cmdb-spatial-editor__canvas/)
  assert.match(editorSource, /cwgsyw-cmdb-spatial-editor__canvas-room-name/)
  assert.match(editorSource, /\{roomName\}/)
  assert.match(editorSource, /cwgsyw-cmdb-spatial-editor__inspector/)
  assert.match(editorSource, /编辑草稿加载失败/)
  assert.doesNotMatch(editorSource, /h-\[calc\(100vh-8rem\)\]|-m-4 flex h-\[calc\(100vh-4rem\)\]|hidden w-52|hidden w-80/)

  assert.match(patterns, /\.cwgsyw-cmdb-spatial-editor__workspace\s*\{[^}]*display:\s*flex/s)
  assert.match(patterns, /@media \(max-width: 1100px\)[\s\S]*\.cwgsyw-cmdb-spatial-editor__workspace\s*\{[^}]*grid-template-columns:\s*repeat\(2/s)
  assert.match(patterns, /@media \(max-width: 520px\)[\s\S]*\.cwgsyw-cmdb-spatial-editor__workspace\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\)/s)
  assert.match(patterns, /\.cwgsyw-cmdb-spatial-editor__canvas\s*\{\s*grid-column:\s*1;\s*height:\s*360px/s)
  assert.match(patterns, /\.cwgsyw-cmdb-spatial-editor__canvas-room-name\s*\{[^}]*top:\s*var\(--cwgsyw-space-3\)[^}]*left:\s*50%[^}]*font-weight:\s*var\(--cwgsyw-font-weight-regular\)[^}]*pointer-events:\s*none[^}]*translateX\(-50%\)/s)
})

test('spatial editor uses compact verified Figma actions and drag handles', () => {
  const editorSource = fs.readFileSync(editorSourcePath, 'utf8')
  const patterns = fs.readFileSync(patternsPath, 'utf8')

  for (const iconPath of figmaIconPaths) {
    assert.equal(fs.existsSync(iconPath), true, iconPath)
    assert.match(fs.readFileSync(iconPath, 'utf8'), /^<svg[\s\S]*<path/)
  }

  assert.match(editorSource, /SpatialActionIcon name="check-circle"/)
  assert.match(editorSource, /SpatialActionIcon name="save"/)
  assert.match(editorSource, /SpatialActionIcon name="send"/)
  assert.match(editorSource, /cwgsyw-cmdb-spatial-editor__primary-actions/)
  assert.doesNotMatch(editorSource, /lucide-react/)
  assert.doesNotMatch(editorSource, /\bCheckCircle2\b|\bSave\b|\bSend\b/)
  assert.equal((editorSource.match(/cwgsyw-cmdb-spatial-editor__range/g) || []).length, 2)
  assert.match(patterns, /\.cwgsyw-cmdb-spatial-editor__figma-icon\s*\{[^}]*width:\s*14px[^}]*height:\s*14px/s)
  assert.match(patterns, /\.cwgsyw-cmdb-spatial-editor__palette-item\.cwgsyw-btn\s*\{[^}]*height:\s*var\(--cwgsyw-control-height-sm\)[^}]*justify-content:\s*flex-start[^}]*gap:\s*var\(--cwgsyw-space-2\)[^}]*text-align:\s*left/s)
  assert.match(patterns, /\.cwgsyw-cmdb-spatial-editor__palette-item\.cwgsyw-btn\s*>\s*span\s*\{[^}]*display:\s*flex[^}]*align-items:\s*center[^}]*gap:\s*var\(--cwgsyw-space-2\)/s)
  assert.doesNotMatch(patterns, /\.cwgsyw-cmdb-spatial-editor__palette-item\.cwgsyw-btn\s*\{[^}]*flex-direction:\s*column/s)
  assert.match(patterns, /\.cwgsyw-cmdb-spatial-editor__primary-actions\s*\{[^}]*flex-wrap:\s*nowrap/s)
  assert.match(patterns, /cmdb-spatial-grip-horizontal\.svg/)
})

test('spatial versions route and history expose complete query and permission states', () => {
  const routeSource = fs.readFileSync(versionsPath, 'utf8')
  const historySource = fs.readFileSync(versionHistoryPath, 'utf8')
  const overlaySource = fs.readFileSync(overlayPath, 'utf8')
  const overlayCss = fs.readFileSync(overlayCssPath, 'utf8')
  const patterns = fs.readFileSync(patternsPath, 'utf8')

  assert.match(routeSource, /DashboardFeedbackPage/)
  assert.match(routeSource, /正在准备布局版本历史/)
  assert.match(routeSource, /无权查看布局版本历史/)
  assert.doesNotMatch(routeSource, /return null/)

  assert.match(historySource, /isLayoutsLoading/)
  assert.match(historySource, /isLayoutsError/)
  assert.match(historySource, /refetchLayouts/)
  assert.match(historySource, /refetchVersions/)
  assert.match(historySource, /未找到空间布局/)
  assert.match(historySource, /尚无已发布版本/)
  assert.match(historySource, /version\.state === 'PUBLISHED'/)
  assert.match(historySource, /StatusBadge label="已发布"/)
  assert.match(historySource, /density="compact"/)
  assert.match(patterns, /\.cwgsyw-cmdb-spatial-versions \.cwgsyw-page-header__row > \.cwgsyw-btn\s*\{[^}]*margin-left:\s*auto/s)
  assert.match(historySource, /\{ key: 'checksum', label: '校验码' \}/)
  assert.doesNotMatch(historySource, /label: '校验和'/)
  assert.match(historySource, /<IconButton/)
  assert.match(historySource, /<NeutralTooltip content="恢复为草稿" className="cwgsyw-tooltip--pill" followCursor>/)
  assert.doesNotMatch(historySource, /title="恢复为草稿"/)
  assert.match(historySource, /aria-label=\{`恢复版本 V\$\{version\.versionNo\} 为草稿`\}/)
  assert.match(historySource, /cmdb-spatial-versions__restore-icon/)
  assert.match(overlayCss, /\.cwgsyw-tooltip\.cwgsyw-tooltip--pill\s*\{[^}]*min-width:\s*0[^}]*border-radius:\s*999px[^}]*background:\s*var\(--cwgsyw-bg-surface\)[^}]*font-weight:\s*var\(--cwgsyw-font-weight-regular\)/s)
  assert.match(overlayCss, /\.cwgsyw-tooltip\.cwgsyw-tooltip--pill\[data-starting-style\]/)
  assert.match(overlaySource, /trackCursorAxis=\{followCursor \? 'both' : 'none'\}/)
  assert.match(overlaySource, /delay=\{followCursor \? 80 : undefined\}/)
  assert.match(overlaySource, /side=\{followCursor \? 'bottom' : 'top'\}/)
  assert.match(overlaySource, /sideOffset=\{followCursor \? 18 : 6\}/)
  assert.match(overlaySource, /collisionAvoidance=\{\{ side: 'flip', align: 'shift', fallbackAxisSide: 'none' \}\}/)
  assert.match(patterns, /\.cwgsyw-cmdb-spatial-versions__restore\.cwgsyw-icon-btn--ghost:hover[^}]*background:\s*transparent/s)
  assert.doesNotMatch(historySource, />恢复为草稿<\/Button>/)
  assert.match(historySource, /router\.push\(`\/cmdb\/spatial\/rooms\/\$\{roomId\}`\)/)
  assert.doesNotMatch(historySource, /<Breadcrumb|window\.location\.href/)
})

test('spatial versions use a fixed desktop table and compact two-column mobile cards', () => {
  const patterns = fs.readFileSync(patternsPath, 'utf8')

  assert.match(patterns, /\.cwgsyw-cmdb-spatial-versions__table \.cwgsyw-table\s*\{[^}]*table-layout:\s*fixed/s)
  assert.match(patterns, /\.cwgsyw-cmdb-spatial-versions__table \.cwgsyw-table\s*\{[^}]*min-width:\s*760px/s)
  assert.match(patterns, /\.cwgsyw-cmdb-spatial-versions__table \.cwgsyw-table-mobile \.cwgsyw-card\s*\{[^}]*grid-template-columns:\s*repeat\(2/s)
  assert.match(patterns, /\.cwgsyw-cmdb-spatial-versions__table \.cwgsyw-table-mobile \.cwgsyw-btn\s*\{\s*width:\s*100%/s)
})
