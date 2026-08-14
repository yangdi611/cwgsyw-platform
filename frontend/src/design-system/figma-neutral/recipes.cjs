'use strict'

const FONT_WEIGHT_TOKENS = {
  Regular: 'var(--cwgsyw-font-weight-regular)',
  Medium: 'var(--cwgsyw-font-weight-medium)',
  'Semi Bold': 'var(--cwgsyw-font-weight-semibold)',
  Bold: 'var(--cwgsyw-font-weight-bold)',
}

function recipeNameFromStyle(name) {
  return name
    .replace(/^CWGSYW\/Type\//, 'type-')
    .replace(/^CWGSYW\/Shadows\/Shadow\s+/i, 'shadow-')
    .replace(/^CWGSYW\/Shadows\//, 'shadow-')
    .replace(/^CWGSYW\/Elevation\//, 'elevation-')
    .replace(/\s+/g, '-')
    .toLowerCase()
}

function cssVarFromRecipe(recipeName) {
  return `--cwgsyw-${recipeName}`
}

function classFromRecipe(recipeName) {
  return `cwgsyw-${recipeName}`
}

function buildRecipes(manifest) {
  const textStyles = Array.isArray(manifest.textStyles) ? manifest.textStyles : []
  const effectStyles = Array.isArray(manifest.effectStyles) ? manifest.effectStyles : []

  const typography = textStyles.map((style) => {
    const recipeName = recipeNameFromStyle(style.name)
    const fontStyle = style.fontName && style.fontName.style
    return {
      id: style.id,
      name: style.name,
      recipeName,
      cssVar: cssVarFromRecipe(recipeName),
      className: classFromRecipe(recipeName),
      fontFamily: style.fontName && style.fontName.family === 'Roboto Mono'
        ? 'var(--cwgsyw-font-family-mono)'
        : 'var(--cwgsyw-font-family-sans)',
      fontSize: `${style.fontSize}px`,
      lineHeight: formatLineHeight(style.lineHeight),
      fontWeight: FONT_WEIGHT_TOKENS[fontStyle] || String(style.fontWeight || 400),
      letterSpacing: formatLetterSpacing(style.letterSpacing),
    }
  })

  const effects = effectStyles.map((style) => {
    const recipeName = recipeNameFromStyle(style.name)
    return {
      id: style.id,
      name: style.name,
      recipeName,
      cssVar: cssVarFromRecipe(recipeName),
      className: classFromRecipe(recipeName),
      boxShadow: formatEffects(style.effects || []),
    }
  })

  return { typography, effects }
}

function buildRecipeCss(recipes) {
  const lines = [
    '/* Generated typography and effect recipes from official Figma styles. */',
    ':root {',
  ]
  for (const recipe of recipes.typography) {
    lines.push(`  ${recipe.cssVar}-font-family: ${recipe.fontFamily};`)
    lines.push(`  ${recipe.cssVar}-font-size: ${recipe.fontSize};`)
    lines.push(`  ${recipe.cssVar}-line-height: ${recipe.lineHeight};`)
    lines.push(`  ${recipe.cssVar}-font-weight: ${recipe.fontWeight};`)
    lines.push(`  ${recipe.cssVar}-letter-spacing: ${recipe.letterSpacing};`)
  }
  for (const recipe of recipes.effects) {
    lines.push(`  ${recipe.cssVar}: ${recipe.boxShadow};`)
  }
  lines.push('}')
  lines.push('')

  for (const recipe of recipes.typography) {
    lines.push(`.${recipe.className} {`)
    lines.push(`  font-family: var(${recipe.cssVar}-font-family);`)
    lines.push(`  font-size: var(${recipe.cssVar}-font-size);`)
    lines.push(`  line-height: var(${recipe.cssVar}-line-height);`)
    lines.push(`  font-weight: var(${recipe.cssVar}-font-weight);`)
    lines.push(`  letter-spacing: var(${recipe.cssVar}-letter-spacing);`)
    lines.push('}')
    lines.push('')
  }

  for (const recipe of recipes.effects) {
    lines.push(`.${recipe.className} {`)
    lines.push(`  box-shadow: var(${recipe.cssVar});`)
    lines.push('}')
    lines.push('')
  }

  return `${lines.join('\n').trim()}\n`
}

function formatLineHeight(lineHeight) {
  if (!lineHeight) return 'normal'
  if (lineHeight.unit === 'PIXELS') return `${lineHeight.value}px`
  if (lineHeight.unit === 'PERCENT') return `${lineHeight.value}%`
  if (lineHeight.unit === 'AUTO') return 'normal'
  return 'normal'
}

function formatLetterSpacing(letterSpacing) {
  if (!letterSpacing) return '0'
  if (letterSpacing.unit === 'PIXELS') return `${letterSpacing.value}px`
  if (letterSpacing.unit === 'PERCENT') return `${letterSpacing.value / 100}em`
  return '0'
}

function formatEffects(effects) {
  const visible = effects.filter((effect) => effect && effect.visible !== false)
  if (!visible.length) return 'none'
  return visible.map(formatEffect).join(', ')
}

function formatEffect(effect) {
  if (effect.type !== 'DROP_SHADOW' && effect.type !== 'INNER_SHADOW') {
    return 'none'
  }
  const inset = effect.type === 'INNER_SHADOW' ? 'inset ' : ''
  const x = effect.offset && effect.offset.x != null ? effect.offset.x : 0
  const y = effect.offset && effect.offset.y != null ? effect.offset.y : 0
  const blur = effect.radius || 0
  const spread = effect.spread || 0
  return `${inset}${x}px ${y}px ${blur}px ${spread}px ${formatEffectColor(effect.color)}`
}

function formatEffectColor(color) {
  if (!color) return 'rgba(0, 0, 0, 0.12)'
  const red = Math.round(color.r * 255)
  const green = Math.round(color.g * 255)
  const blue = Math.round(color.b * 255)
  const alpha = Math.round((color.a == null ? 1 : color.a) * 1000) / 1000
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`
}

module.exports = {
  buildRecipeCss,
  buildRecipes,
  recipeNameFromStyle,
}
