'use strict'

const {
  LEGACY_COLLECTION_NAME,
  MODE_SELECTORS,
  OFFICIAL_COLLECTIONS,
  TokenExportError,
  cssNameFromWebSyntax,
  isLegalWebSyntax,
  isOfficialCollectionName,
} = require('./contract.cjs')

function exportTokens(manifest, options = {}) {
  if (!manifest || typeof manifest !== 'object') {
    throw new TokenExportError('INVALID_MANIFEST', 'Token manifest must be an object')
  }

  const requestedNames = options.collections
    ? [...options.collections]
    : [...OFFICIAL_COLLECTIONS]
  const collections = Array.isArray(manifest.collections) ? manifest.collections : []
  const byName = new Map(collections.map((collection) => [collection.name, collection]))

  for (const name of requestedNames) {
    if (name === LEGACY_COLLECTION_NAME || !isOfficialCollectionName(name)) {
      throw new TokenExportError('LEGACY_OR_UNOFFICIAL_COLLECTION', `Refusing to export unofficial collection: ${name}`, {
        collection: name,
      })
    }
    if (!OFFICIAL_COLLECTIONS.includes(name)) {
      throw new TokenExportError('UNKNOWN_OFFICIAL_COLLECTION', `Collection is not on the official whitelist: ${name}`, {
        collection: name,
      })
    }
    if (!byName.has(name)) {
      throw new TokenExportError('MISSING_COLLECTION', `Official collection missing from manifest: ${name}`, {
        collection: name,
      })
    }
  }

  const officialVars = []
  const varsById = new Map()

  for (const name of requestedNames) {
    const collection = byName.get(name)
    if (collection.remote) {
      throw new TokenExportError('REMOTE_COLLECTION', `Remote collection is not allowed: ${name}`, {
        collection: name,
      })
    }
    for (const variable of collection.variables || []) {
      if (variable.remote) {
        throw new TokenExportError('REMOTE_VARIABLE', `Remote variable is not allowed: ${variable.name}`, {
          collection: name,
          variableId: variable.id,
        })
      }
      if (!isLegalWebSyntax(variable.web)) {
        throw new TokenExportError(
          variable.web ? 'ILLEGAL_WEB_SYNTAX' : 'MISSING_WEB_SYNTAX',
          `Official variable is missing a legal WEB code syntax: ${name} / ${variable.name}`,
          { collection: name, variableId: variable.id, web: variable.web || null },
        )
      }
      const cssName = cssNameFromWebSyntax(variable.web)
      if (!cssName) {
        throw new TokenExportError('ILLEGAL_WEB_SYNTAX', `Unable to parse WEB code syntax: ${variable.web}`, {
          collection: name,
          variableId: variable.id,
          web: variable.web,
        })
      }
      const record = {
        ...variable,
        collection: name,
        collectionId: collection.id,
        cssName,
        modes: collection.modes,
        defaultModeId: collection.defaultModeId,
      }
      officialVars.push(record)
      varsById.set(variable.id, record)
    }
  }

  const sameCollectionWeb = new Map()
  for (const variable of officialVars) {
    const key = `${variable.collection}::${variable.web}`
    if (!sameCollectionWeb.has(key)) sameCollectionWeb.set(key, [])
    sameCollectionWeb.get(key).push(variable.id)
  }
  for (const [key, ids] of sameCollectionWeb) {
    if (ids.length > 1) {
      throw new TokenExportError('DUPLICATE_WEB_IN_COLLECTION', `Duplicate WEB syntax in the same collection: ${key}`, {
        variableIds: ids,
      })
    }
  }

  for (const variable of officialVars) {
    for (const [modeId, value] of Object.entries(variable.valuesByMode || {})) {
      if (isAlias(value) && !varsById.has(value.id)) {
        throw new TokenExportError('UNRESOLVED_ALIAS', `Unresolved alias on ${variable.name}`, {
          collection: variable.collection,
          variableId: variable.id,
          modeId,
          targetId: value.id,
        })
      }
    }
  }

  const declarations = []
  const declarationIndex = new Map()

  const collectionOrder = new Map(OFFICIAL_COLLECTIONS.map((name, index) => [name, index]))
  const sortedVars = [...officialVars].sort((left, right) => {
    const collectionDelta = (collectionOrder.get(left.collection) ?? 99) - (collectionOrder.get(right.collection) ?? 99)
    if (collectionDelta !== 0) return collectionDelta
    return left.name.localeCompare(right.name)
  })

  for (const variable of sortedVars) {
    const modeMap = MODE_SELECTORS[variable.collection] || null
    const modes = variable.modes || []
    for (const mode of modes) {
      const selector = modeMap ? modeMap[mode.name] : ':root'
      if (!selector) {
        throw new TokenExportError('UNKNOWN_MODE', `No selector mapping for ${variable.collection} / ${mode.name}`, {
          collection: variable.collection,
          mode: mode.name,
        })
      }
      const rawValue = (variable.valuesByMode || {})[mode.id]
      if (rawValue === undefined) {
        throw new TokenExportError('MISSING_MODE_VALUE', `Missing mode value for ${variable.name} / ${mode.name}`, {
          collection: variable.collection,
          variableId: variable.id,
          modeId: mode.id,
        })
      }
      const formatted = formatTokenValue(rawValue, variable, varsById)
      const key = `${selector}::${variable.cssName}`
      const existing = declarationIndex.get(key)
      if (existing) {
        if (!samePublicTokenValue(existing.value, formatted, variable.cssName)) {
          throw new TokenExportError(
            'CONFLICTING_PUBLIC_TOKEN',
            `Public CSS token ${variable.cssName} has conflicting values in ${selector}`,
            {
              cssName: variable.cssName,
              selector,
              first: existing,
              second: { collection: variable.collection, variableId: variable.id, value: formatted },
            },
          )
        }
        if (isSelfAlias(existing.value, variable.cssName) && !isSelfAlias(formatted, variable.cssName)) {
          existing.value = formatted
        }
        existing.sources.push(buildSource(variable, mode, rawValue, varsById))
        continue
      }
      const declaration = {
        selector,
        cssName: variable.cssName,
        value: formatted,
        sources: [buildSource(variable, mode, rawValue, varsById)],
      }
      declarationIndex.set(key, declaration)
      declarations.push(declaration)
    }
  }

  const selectorRank = (selector) => {
    if (selector === ':root') return '0'
    if (selector === '[data-theme="dark"]') return '1'
    return `2:${selector}`
  }

  declarations.sort((left, right) => {
    const selectorDelta = selectorRank(left.selector).localeCompare(selectorRank(right.selector))
    if (selectorDelta !== 0) return selectorDelta
    return left.cssName.localeCompare(right.cssName)
  })

  return {
    fileKey: manifest.fileKey || null,
    readAt: manifest.readAt || null,
    officialVariableCount: officialVars.length,
    variables: officialVars,
    declarations,
    varsById,
  }
}

function buildCss(exportResult) {
  const blocks = new Map()
  for (const declaration of exportResult.declarations) {
    if (!blocks.has(declaration.selector)) blocks.set(declaration.selector, [])
    blocks.get(declaration.selector).push(declaration)
  }

  const lines = [
    '/* Generated by frontend/src/design-system/figma-neutral. Do not edit by hand. */',
    '/* Source: CWGSYW official Figma variables. Collection 1 / remote / illegal WEB syntax fail the build. */',
    '',
  ]

  for (const [selector, decls] of blocks) {
    lines.push(`${selector} {`)
    for (const declaration of decls) {
      lines.push(`  ${declaration.cssName}: ${declaration.value};`)
    }
    lines.push('}')
    lines.push('')
  }

  return `${lines.join('\n').trim()}\n`
}

function buildSourceMap(exportResult) {
  return {
    version: 1,
    fileKey: exportResult.fileKey,
    readAt: exportResult.readAt,
    officialVariableCount: exportResult.officialVariableCount,
    declarations: exportResult.declarations.map((declaration) => ({
      selector: declaration.selector,
      cssName: declaration.cssName,
      value: declaration.value,
      sources: declaration.sources,
    })),
  }
}

function buildSource(variable, mode, rawValue, varsById) {
  return {
    collection: variable.collection,
    collectionId: variable.collectionId,
    variableId: variable.id,
    name: variable.name,
    mode: mode.name,
    modeId: mode.id,
    aliasChain: buildAliasChain(variable.id, mode.id, varsById),
  }
}

function buildAliasChain(variableId, modeId, varsById, seen = new Set()) {
  if (seen.has(`${variableId}:${modeId}`)) {
    throw new TokenExportError('ALIAS_CYCLE', `Alias cycle at ${variableId}`, { variableId, modeId })
  }
  seen.add(`${variableId}:${modeId}`)
  const variable = varsById.get(variableId)
  if (!variable) return [variableId]
  const value = (variable.valuesByMode || {})[modeId] ?? firstValue(variable)
  if (!isAlias(value)) return [variableId]
  const target = varsById.get(value.id)
  const nextModeId = target ? target.defaultModeId : modeId
  return [variableId, ...buildAliasChain(value.id, nextModeId, varsById, seen)]
}

function firstValue(variable) {
  const values = variable.valuesByMode || {}
  const keys = Object.keys(values)
  return keys.length ? values[keys[0]] : undefined
}

function isAlias(value) {
  return Boolean(value && typeof value === 'object' && value.type === 'VARIABLE_ALIAS' && value.id)
}

function formatTokenValue(value, variable, varsById) {
  if (isAlias(value)) {
    const target = varsById.get(value.id)
    if (!target) {
      throw new TokenExportError('UNRESOLVED_ALIAS', `Unresolved alias target ${value.id}`, {
        variableId: variable.id,
        targetId: value.id,
      })
    }
    return target.web
  }

  if (value && typeof value === 'object' && value.type === 'COLOR') {
    return formatColor(value)
  }

  if (typeof value === 'number') {
    if (isUnitlessNumber(variable)) return String(value)
    return `${value}px`
  }

  if (typeof value === 'string') {
    return JSON.stringify(value)
  }

  if (typeof value === 'boolean') {
    return value ? '1' : '0'
  }

  throw new TokenExportError('UNSUPPORTED_VALUE', `Unsupported token value for ${variable.name}`, {
    variableId: variable.id,
    value,
  })
}

function isUnitlessNumber(variable) {
  const scopes = variable.scopes || []
  if (scopes.includes('FONT_WEIGHT')) return true
  return /weight/i.test(variable.name || '')
}

function formatColor(value) {
  const red = clampByte(value.r)
  const green = clampByte(value.g)
  const blue = clampByte(value.b)
  const alpha = value.a == null ? 1 : value.a
  if (alpha >= 1) {
    return `#${toHex(red)}${toHex(green)}${toHex(blue)}`
  }
  const roundedAlpha = Math.round(alpha * 1000) / 1000
  return `rgba(${red}, ${green}, ${blue}, ${roundedAlpha})`
}

function clampByte(channel) {
  return Math.min(255, Math.max(0, Math.round(Number(channel) * 255)))
}

function toHex(value) {
  return value.toString(16).padStart(2, '0')
}

module.exports = {
  buildCss,
  buildSourceMap,
  exportTokens,
  formatTokenValue,
}

function isSelfAlias(value, cssName) {
  return value === `var(${cssName})`
}

function samePublicTokenValue(existingValue, nextValue, cssName) {
  if (existingValue === nextValue) return true
  if (isSelfAlias(existingValue, cssName) || isSelfAlias(nextValue, cssName)) return true
  return false
}
