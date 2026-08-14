'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const formalExports = [
  'Spinner',
  'Separator',
  'Button',
  'IconButton',
  'Input',
  'Textarea',
  'Select',
  'Combobox',
  'SearchInput',
  'DateInput',
  'Field',
  'Checkbox',
  'Radio',
  'Switch',
  'Tabs',
  'TabsList',
  'Badge',
  'StatusBadge',
  'Chip',
  'Avatar',
  'Card',
  'MetricCard',
  'TableHeaderCell',
  'TableCell',
  'TableRow',
  'TableToolbar',
  'Table',
  'PaginationPageItem',
  'Pagination',
  'Skeleton',
  'EmptyState',
  'ErrorState',
  'LoadingState',
  'Alert',
  'Toast',
  'Progress',
  'MenuItem',
  'DropdownMenu',
  'NeutralTooltip',
  'NeutralPopover',
  'NeutralDialog',
  'NeutralAlertDialog',
  'NeutralDrawer',
  'CalendarDay',
  'Calendar',
  'DatePicker',
  'DateRangePicker',
  'CommandItem',
  'CommandGroup',
  'CommandPalette',
  'Breadcrumb',
  'PageHeader',
  'DetailHeader',
  'Toolbar',
  'WorkspaceToolbar',
  'FilterBar',
  'FormSettingsPage',
  'DataManagementPage',
  'DetailDrawerPage',
  'DashboardFeedbackPage',
  'OverlayDestructivePage',
]

test('all 61 formal Figma roots have React exports', () => {
  const index = fs.readFileSync(path.resolve(__dirname, '../src/design-system/figma-neutral/components/index.ts'), 'utf8')
  assert.equal(formalExports.length, 61)
  for (const name of formalExports) {
    assert.match(index, new RegExp(`\\b${name}\\b`), name)
  }
})
