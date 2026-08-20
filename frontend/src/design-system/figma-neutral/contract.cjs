'use strict'

const OFFICIAL_COLLECTIONS = Object.freeze([
  'CWGSYW / Primitives',
  'CWGSYW / Color',
  'CWGSYW / Dimensions',
  'CWGSYW / Typography',
  'CWGSYW / Icon Context',
  'CWGSYW / Metric Context',
  'CWGSYW / Pagination Density',
  'CWGSYW / Feedback Context',
  'CWGSYW / Pattern Layout',
])

const LEGACY_COLLECTION_NAME = 'Collection 1'
const OFFICIAL_PREFIX = 'CWGSYW / '
const WEB_SYNTAX = /^var\(--[A-Za-z0-9_-]+(?:\s*,\s*[^)]+)?\)$/

const MODE_SELECTORS = Object.freeze({
  'CWGSYW / Color': Object.freeze({
    Light: ':root',
    Dark: '[data-theme="dark"]',
  }),
  'CWGSYW / Icon Context': Object.freeze({
    Default: ':root',
    Inverse: '[data-icon-context="inverse"]',
    Disabled: '[data-icon-context="disabled"]',
    Danger: '[data-icon-context="danger"]',
  }),
  'CWGSYW / Metric Context': Object.freeze({
    Neutral: ':root',
    Info: '[data-metric-context="info"]',
    Success: '[data-metric-context="success"]',
    Warning: '[data-metric-context="warning"]',
    Danger: '[data-metric-context="danger"]',
  }),
  'CWGSYW / Pagination Density': Object.freeze({
    Default: ':root',
    Compact: '[data-pagination-density="compact"]',
  }),
  'CWGSYW / Feedback Context': Object.freeze({
    Neutral: ':root',
    Info: '[data-feedback-context="info"]',
    Success: '[data-feedback-context="success"]',
    Warning: '[data-feedback-context="warning"]',
    Danger: '[data-feedback-context="danger"]',
  }),
  'CWGSYW / Pattern Layout': Object.freeze({
    Default: ':root',
    Compact: '[data-pattern-layout="compact"]',
  }),
})

const CONSUMER_LAYER_COLLECTIONS = Object.freeze([
  'CWGSYW / Color',
  'CWGSYW / Typography',
  'CWGSYW / Icon Context',
  'CWGSYW / Metric Context',
  'CWGSYW / Pagination Density',
  'CWGSYW / Feedback Context',
  'CWGSYW / Pattern Layout',
  'CWGSYW / Dimensions',
])

class TokenExportError extends Error {
  constructor(code, message, details = undefined) {
    super(message)
    this.name = 'TokenExportError'
    this.code = code
    this.details = details
  }
}

function isOfficialCollectionName(name) {
  return typeof name === 'string' && name.startsWith(OFFICIAL_PREFIX)
}

function isLegalWebSyntax(syntax) {
  return typeof syntax === 'string' && WEB_SYNTAX.test(syntax.trim())
}

function cssNameFromWebSyntax(syntax) {
  const match = String(syntax)
    .trim()
    .match(/^var\((--[A-Za-z0-9_-]+)(?:\s*,\s*[^)]+)?\)$/)
  return match ? match[1] : null
}

module.exports = {
  CONSUMER_LAYER_COLLECTIONS,
  LEGACY_COLLECTION_NAME,
  MODE_SELECTORS,
  OFFICIAL_COLLECTIONS,
  OFFICIAL_PREFIX,
  TokenExportError,
  WEB_SYNTAX,
  cssNameFromWebSyntax,
  isLegalWebSyntax,
  isOfficialCollectionName,
}
