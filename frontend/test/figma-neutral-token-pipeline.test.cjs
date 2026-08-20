'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const test = require('node:test')

const {
  LEGACY_COLLECTION_NAME,
  TokenExportError,
} = require('../src/design-system/figma-neutral/contract.cjs')
const { buildCss, exportTokens } = require('../src/design-system/figma-neutral/export-tokens.cjs')
const { generate } = require('../src/design-system/figma-neutral/generate.cjs')
const { buildRecipes } = require('../src/design-system/figma-neutral/recipes.cjs')

const LIVE_BASELINE = path.resolve(
  __dirname,
  '../src/design-system/figma-neutral/source/live-baseline.json',
)
const GENERATED_DIR = path.resolve(__dirname, '../src/design-system/figma-neutral/generated')

function loadLiveBaseline() {
  return JSON.parse(fs.readFileSync(LIVE_BASELINE, 'utf8'))
}

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function officialCollections(manifest) {
  return manifest.collections.filter((collection) => collection.name.startsWith('CWGSYW / '))
}

test('live official export is 176 variables and excludes Collection 1', () => {
  const manifest = loadLiveBaseline()
  const exported = exportTokens(manifest)
  const css = buildCss(exported)
  const recipes = buildRecipes(manifest)

  assert.equal(exported.officialVariableCount, 176)
  assert.equal(officialCollections(manifest).reduce((sum, collection) => sum + collection.variables.length, 0), 176)
  assert.match(css, /:root \{/)
  assert.match(css, /\[data-theme="dark"\] \{/)
  assert.match(css, /--cwgsyw-bg-canvas: var\(--cwgsyw-neutral-50\);/)
  assert.match(css, /--feedback-bg: var\(--cwgsyw-bg-surface\);/)
  assert.doesNotMatch(css, /--cwgsyw-tabs-segmented-rail-item-width/)
  assert.equal(
    exported.declarations.some((item) => item.sources.some((source) => source.collection === LEGACY_COLLECTION_NAME)),
    false,
  )
  assert.equal(recipes.typography.length, 10)
  assert.equal(recipes.effects.length, 5)
  assert.equal(recipes.effects.some((item) => item.className === 'cwgsyw-shadow-sm'), true)
  assert.equal((css.match(/--cwgsyw-space-4:/g) || []).length, 1)
  const colorDecls = exported.declarations.filter((item) => item.selector === ':root' && item.sources.some((source) => source.collection === 'CWGSYW / Color'))
  assert.equal(colorDecls.every((item) => item.value.startsWith('var(')), true)
})

test('generated artifacts stay isolated from old pages and keep aliases', () => {
  const result = generate()
  const tokensCss = fs.readFileSync(path.join(GENERATED_DIR, 'tokens.css'), 'utf8')
  const fixtureHtml = fs.readFileSync(path.join(GENERATED_DIR, 'token-fixture.html'), 'utf8')
  const globalsCss = fs.readFileSync(path.resolve(__dirname, '../src/app/globals.css'), 'utf8')
  assert.equal(fs.existsSync(path.resolve(__dirname, '../src/components/design-system')), false)

  assert.equal(result.officialVariableCount, 176)
  assert.match(tokensCss, /\[data-theme="dark"\]/)
  assert.match(tokensCss, /--cwgsyw-action-primary: var\(--cwgsyw-neutral-/)
  assert.doesNotMatch(tokensCss, /--cwgsyw-tabs-segmented-rail-item-width/)
  assert.match(fixtureHtml, /style="background: var\(--cwgsyw-bg-canvas\)"/)
  assert.doesNotMatch(fixtureHtml, /var\(--cwgsyw-bg-canvas\)--cwgsyw-bg-canvas\)/)
  assert.match(fixtureHtml, /data-feedback-context="success"/)
  assert.equal(globalsCss.includes('design-system/figma-neutral'), false)
})

test('Collection 1, remote, missing WEB, illegal WEB and unresolved alias fail closed', () => {
  const manifest = loadLiveBaseline()

  assert.throws(
    () => exportTokens(manifest, { collections: [LEGACY_COLLECTION_NAME] }),
    (error) => error instanceof TokenExportError && error.code === 'LEGACY_OR_UNOFFICIAL_COLLECTION',
  )

  const remoteManifest = clone(manifest)
  remoteManifest.collections.find((collection) => collection.name === 'CWGSYW / Color').remote = true
  assert.throws(
    () => exportTokens(remoteManifest),
    (error) => error instanceof TokenExportError && error.code === 'REMOTE_COLLECTION',
  )

  const remoteVariableManifest = clone(manifest)
  remoteVariableManifest.collections.find((collection) => collection.name === 'CWGSYW / Color').variables[0].remote = true
  assert.throws(
    () => exportTokens(remoteVariableManifest),
    (error) => error instanceof TokenExportError && error.code === 'REMOTE_VARIABLE',
  )

  const missingWebManifest = clone(manifest)
  delete missingWebManifest.collections.find((collection) => collection.name === 'CWGSYW / Color').variables[0].web
  assert.throws(
    () => exportTokens(missingWebManifest),
    (error) => error instanceof TokenExportError && error.code === 'MISSING_WEB_SYNTAX',
  )

  const illegalWebManifest = clone(manifest)
  illegalWebManifest.collections.find((collection) => collection.name === 'CWGSYW / Color').variables[0].web = '--not-legal'
  assert.throws(
    () => exportTokens(illegalWebManifest),
    (error) => error instanceof TokenExportError && error.code === 'ILLEGAL_WEB_SYNTAX',
  )

  const unresolvedManifest = clone(manifest)
  const colorVariable = unresolvedManifest.collections.find((collection) => collection.name === 'CWGSYW / Color').variables[0]
  const firstModeId = Object.keys(colorVariable.valuesByMode)[0]
  colorVariable.valuesByMode[firstModeId] = { type: 'VARIABLE_ALIAS', id: 'VariableID:missing' }
  assert.throws(
    () => exportTokens(unresolvedManifest),
    (error) => error instanceof TokenExportError && error.code === 'UNRESOLVED_ALIAS',
  )
})

test('conflicting values for the same public CSS name fail', () => {
  const manifest = clone(loadLiveBaseline())
  const dimensions = manifest.collections.find((collection) => collection.name === 'CWGSYW / Dimensions')
  const donor = clone(dimensions.variables[0])
  donor.id = 'VariableID:conflict-public-token'
  donor.name = 'conflict/bg-canvas'
  donor.web = 'var(--cwgsyw-bg-canvas)'
  donor.valuesByMode = { [dimensions.defaultModeId]: 99 }
  dimensions.variables.push(donor)

  assert.throws(
    () => exportTokens(manifest),
    (error) => error instanceof TokenExportError && error.code === 'CONFLICTING_PUBLIC_TOKEN',
  )
})

test('same public name can merge a concrete primitive with a self alias', () => {
  const manifest = loadLiveBaseline()
  const exported = exportTokens(manifest)
  const icon = exported.declarations.find((item) => item.selector === ':root' && item.cssName === '--cwgsyw-size-icon-lg')

  assert.ok(icon)
  assert.notEqual(icon.value, 'var(--cwgsyw-size-icon-lg)')
  assert.match(icon.value, /px$/)
  assert.equal(icon.sources.length >= 2, true)
})

test('generate writes a complete isolated fixture directory', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'figma-neutral-'))
  const result = generate(LIVE_BASELINE, tempDir)
  const fixture = fs.readFileSync(path.join(tempDir, 'token-fixture.html'), 'utf8')

  assert.equal(result.officialVariableCount, 176)
  assert.equal(result.typographyCount, 10)
  assert.equal(result.effectCount, 5)
  assert.equal(fs.existsSync(path.join(tempDir, 'tokens.css')), true)
  assert.equal(fs.existsSync(path.join(tempDir, 'recipes.css')), true)
  assert.match(fixture, /Neutral surfaces, type and status recipes/)
  assert.match(fixture, /dataset.patternLayout/)
})
