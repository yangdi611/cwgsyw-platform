'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const frontendRoot = path.resolve(__dirname, '..')

test('old visual entries are deleted and PermissionGuard remains', () => {
  assert.equal(fs.existsSync(path.join(frontendRoot, 'src/components/design-system')), false)
  assert.equal(fs.existsSync(path.join(frontendRoot, 'src/components/v2')), false)
  assert.equal(fs.existsSync(path.join(frontendRoot, 'src/components/ui')), false)
  assert.equal(fs.existsSync(path.join(frontendRoot, 'src/components/shared/PageHeader.tsx')), false)
  assert.equal(fs.existsSync(path.join(frontendRoot, 'src/components/shared/DataTable.tsx')), false)
  assert.equal(fs.existsSync(path.join(frontendRoot, 'src/components/shared/PermissionGuard.tsx')), true)
  const index = fs.readFileSync(path.join(frontendRoot, 'src/components/shared/index.ts'), 'utf8')
  assert.match(index, /PermissionGuard/)
  assert.doesNotMatch(index, /PageHeader|DataTable|DetailDrawer/)
  assert.equal(fs.existsSync(path.join(frontendRoot, 'src/components/account/PasswordStrengthHints.tsx')), false)
})
