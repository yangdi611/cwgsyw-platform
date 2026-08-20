'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const frontendRoot = path.resolve(__dirname, '..')
const leftovers = [
  'src/components/cmdb/InstanceTopologyTab.tsx',
  'src/components/cmdb/InstanceAssociationsTab.tsx',
  'src/components/cmdb/ChangeRecordItem.tsx',
  'src/components/cmdb/JsonDiffView.tsx',
  'src/components/cmdb/CsvImportDialog.tsx',
  'src/components/cmdb/BatchEditDialog.tsx',
  'src/components/cmdb/CiInstanceDrawer.tsx',
  'src/components/cmdb/ColumnPicker.tsx',
  'src/components/cmdb/CiInstanceSelect.tsx',
  'src/components/cmdb/CiLinkSelector.tsx',
  'src/components/cmdb/RackAssignmentCard.tsx',
  'src/components/cmdb/EndpointLinksCard.tsx',
  'src/components/layout/Header.tsx',
  'src/components/layout/CommandPalette.tsx',
  'src/features/cmdb-spatial/viewer/SpatialRoomViewer.tsx',
  'src/features/cmdb-spatial/components/SpatialSelectionPanel.tsx',
  'src/features/cmdb-spatial/viewer/SpatialViewerCanvas.tsx',
  'src/features/cmdb-spatial/editor/SpatialEditor.tsx',
  'src/components/wiki/WikiTreeSidebar.tsx',
  'src/components/authorization/ResourceAccessDialog.tsx',
  'src/components/authorization/PermissionDiffDetails.tsx',
]

test('M8 leftover chrome leaves old visual entries', () => {
  for (const rel of leftovers) {
    const source = fs.readFileSync(path.join(frontendRoot, rel), 'utf8')
    assert.doesNotMatch(source, /@\/components\/design-system/, rel)
    assert.doesNotMatch(source, /@\/components\/shared/, rel)
    assert.doesNotMatch(source, /text-v2-|bg-v2-|border-v2-|--v2-/, rel)
  }
})
