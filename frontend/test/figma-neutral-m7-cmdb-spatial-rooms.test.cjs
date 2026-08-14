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
const editPath = path.join(frontendRoot, 'src/app/(dashboard)/cmdb/spatial/rooms/[roomId]/edit/page.tsx')
const versionsPath = path.join(frontendRoot, 'src/app/(dashboard)/cmdb/spatial/rooms/[roomId]/versions/page.tsx')
const spikePath = path.join(frontendRoot, 'src/app/(dashboard)/cmdb/spatial/spike/page.tsx')

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
        spatialQueryKeys: { layouts: () => ['cmdb', 'spatial', 'layouts'] },
        listSpatialLayouts: async () => [{ layoutId: 4, roomInstanceId: 9, name: '机房A' }],
      }
    }
    if (request === '@tanstack/react-query') {
      return {
        useQuery: () => ({ data: [{ layoutId: 4, roomInstanceId: 9, name: '机房A' }], isLoading: false, isError: false }),
      }
    }
    if (request.includes('SpatialRoomViewer')) return { SpatialRoomViewer: ({ roomId }) => React.createElement('div', null, `room-viewer-${roomId}`) }
    if (request.includes('SpatialEditor') && !request.includes('SpatialEditorStage')) return { SpatialEditor: ({ roomId, layoutId }) => React.createElement('div', null, `spatial-editor-${roomId}-${layoutId}`) }
    if (request.includes('SpatialVersionHistory')) return { SpatialVersionHistory: ({ roomId }) => React.createElement('div', null, `spatial-versions-${roomId}`) }
    if (request.includes('SpatialCanvasSpike')) return { SpatialCanvasSpike: () => React.createElement('div', null, 'spatial-spike') }
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
  assert.match(edit, /spatial-editor-9-4/)
  assert.match(versions, /spatial-versions-9/)
  assert.match(spike, /spatial-spike/)
})
