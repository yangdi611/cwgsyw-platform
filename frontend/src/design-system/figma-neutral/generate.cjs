'use strict'

const fs = require('node:fs')
const path = require('node:path')
const { buildCss, buildSourceMap, exportTokens } = require('./export-tokens.cjs')
const { buildRecipeCss, buildRecipes } = require('./recipes.cjs')

const ROOT = __dirname
const SOURCE = path.join(ROOT, 'source', 'live-baseline.json')
const GENERATED = path.join(ROOT, 'generated')

function generate(manifestPath = SOURCE, outputDir = GENERATED) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  const exported = exportTokens(manifest)
  const recipes = buildRecipes(manifest)
  const tokensCss = buildCss(exported)
  const recipesCss = buildRecipeCss(recipes)
  const sourceMap = {
    ...buildSourceMap(exported),
    recipes,
    generatedAt: new Date().toISOString(),
  }
  const fixtureHtml = buildFixtureHtml(exported, recipes)

  fs.mkdirSync(outputDir, { recursive: true })
  fs.writeFileSync(path.join(outputDir, 'tokens.css'), tokensCss)
  fs.writeFileSync(path.join(outputDir, 'recipes.css'), recipesCss)
  fs.writeFileSync(path.join(outputDir, 'source-map.json'), `${JSON.stringify(sourceMap, null, 2)}\n`)
  fs.writeFileSync(path.join(outputDir, 'token-fixture.html'), fixtureHtml)

  return {
    officialVariableCount: exported.officialVariableCount,
    declarationCount: exported.declarations.length,
    typographyCount: recipes.typography.length,
    effectCount: recipes.effects.length,
    outputDir,
  }
}

function swatchArticle(item) {
  return `<article class="swatch"><div class="chip" style="background: var(${item.cssName})"></div><div class="meta">${item.cssName}</div></article>`
}

function buildFixtureHtml(exported, recipes) {
  const semanticSwatches = pickDeclarations(exported, ':root', [
    '--cwgsyw-bg-canvas',
    '--cwgsyw-bg-surface',
    '--cwgsyw-bg-surface-subtle',
    '--cwgsyw-bg-surface-hover',
    '--cwgsyw-bg-surface-selected',
    '--cwgsyw-text-primary',
    '--cwgsyw-text-secondary',
    '--cwgsyw-text-tertiary',
    '--cwgsyw-text-disabled',
    '--cwgsyw-border-subtle',
    '--cwgsyw-border-default',
    '--cwgsyw-border-strong',
    '--cwgsyw-action-primary',
    '--cwgsyw-action-primary-hover',
    '--cwgsyw-focus-ring',
    '--cwgsyw-overlay-scrim',
  ])
  const statusSwatches = pickDeclarations(exported, ':root', [
    '--cwgsyw-status-info-bg',
    '--cwgsyw-status-info-fg',
    '--cwgsyw-status-success-bg',
    '--cwgsyw-status-success-fg',
    '--cwgsyw-status-warning-bg',
    '--cwgsyw-status-warning-fg',
    '--cwgsyw-status-danger-bg',
    '--cwgsyw-status-danger-fg',
  ])
  const spaces = exported.declarations.filter(
    (item) => item.selector === ':root' && item.cssName.startsWith('--cwgsyw-space-'),
  )
  const radii = exported.declarations.filter(
    (item) => item.selector === ':root' && item.cssName.startsWith('--cwgsyw-radius-'),
  )

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>CWGSYW Neutral Token Fixture</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Roboto+Mono:wght@400&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="./tokens.css" />
  <link rel="stylesheet" href="./recipes.css" />
  <style>
    html, body {
      margin: 0;
      min-height: 100%;
      background: var(--cwgsyw-bg-canvas);
      color: var(--cwgsyw-text-primary);
      font-family: var(--cwgsyw-font-family-sans);
    }
    body { padding: var(--cwgsyw-space-6); }
    .page {
      max-width: 1200px;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      gap: var(--cwgsyw-pattern-gap);
    }
    .hero, .panel {
      background: var(--cwgsyw-bg-surface);
      border: var(--cwgsyw-border-width-default) solid var(--cwgsyw-border-default);
      border-radius: var(--cwgsyw-radius-lg);
      padding: var(--cwgsyw-pattern-padding);
      box-shadow: var(--cwgsyw-elevation-sm);
    }
    .kicker { color: var(--cwgsyw-text-secondary); margin: 0 0 var(--cwgsyw-space-2); }
    h1, h2, p { margin: 0; }
    .lede {
      margin-top: var(--cwgsyw-space-3);
      color: var(--cwgsyw-text-secondary);
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      gap: var(--cwgsyw-space-3);
      margin-top: var(--cwgsyw-space-4);
    }
    .swatch {
      border: var(--cwgsyw-border-width-default) solid var(--cwgsyw-border-subtle);
      border-radius: var(--cwgsyw-radius-md);
      overflow: hidden;
      background: var(--cwgsyw-bg-surface);
    }
    .chip { height: var(--cwgsyw-control-height-lg); }
    .meta {
      padding: var(--cwgsyw-space-2) var(--cwgsyw-space-3);
      color: var(--cwgsyw-text-secondary);
      font-size: var(--cwgsyw-font-size-body-xs);
      line-height: var(--cwgsyw-font-line-height-body-xs);
    }
    .row {
      display: flex;
      flex-wrap: wrap;
      gap: var(--cwgsyw-space-3);
      margin-top: var(--cwgsyw-space-4);
      align-items: flex-end;
    }
    .space { background: var(--cwgsyw-bg-surface-subtle); border-radius: var(--cwgsyw-radius-sm); }
    .radius {
      background: var(--cwgsyw-action-primary);
      color: var(--cwgsyw-text-inverse);
      width: var(--cwgsyw-control-height-lg);
      height: var(--cwgsyw-control-height-lg);
      display: grid;
      place-items: center;
    }
    .type-card, .shadow-card {
      border: var(--cwgsyw-border-width-default) solid var(--cwgsyw-border-subtle);
      border-radius: var(--cwgsyw-radius-md);
      padding: var(--cwgsyw-space-4);
      background: var(--cwgsyw-bg-surface);
    }
    .actions {
      display: flex;
      gap: var(--cwgsyw-space-3);
      margin-top: var(--cwgsyw-space-4);
      flex-wrap: wrap;
    }
    .btn {
      height: var(--cwgsyw-control-height-md);
      padding: 0 var(--cwgsyw-space-4);
      border: 0;
      border-radius: var(--cwgsyw-radius-md);
      background: var(--cwgsyw-action-primary);
      color: var(--cwgsyw-text-inverse);
      font: inherit;
    }
    .btn:hover { background: var(--cwgsyw-action-primary-hover); }
    .btn:focus-visible {
      outline: var(--cwgsyw-border-width-strong) solid var(--cwgsyw-focus-ring);
      outline-offset: var(--cwgsyw-space-1);
    }
    .btn-secondary {
      background: var(--cwgsyw-bg-surface);
      color: var(--cwgsyw-text-primary);
      border: var(--cwgsyw-border-width-default) solid var(--cwgsyw-border-default);
    }
    .btn-destructive {
      background: var(--cwgsyw-action-destructive);
      color: var(--cwgsyw-action-destructive-fg);
    }
    .status {
      display: inline-flex;
      align-items: center;
      min-height: var(--cwgsyw-control-height-sm);
      padding: 0 var(--cwgsyw-space-3);
      border-radius: var(--cwgsyw-radius-full);
      border: var(--cwgsyw-border-width-default) solid var(--feedback-border);
      background: var(--feedback-bg);
      color: var(--feedback-fg);
    }
    .toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--cwgsyw-pattern-gap);
      min-height: var(--cwgsyw-pattern-toolbar-height);
      padding: 0 var(--cwgsyw-pattern-padding);
      background: var(--cwgsyw-bg-surface-subtle);
      border: var(--cwgsyw-border-width-default) solid var(--cwgsyw-border-subtle);
      border-radius: var(--cwgsyw-radius-md);
    }
    .toolbar-actions { display: flex; flex-wrap: wrap; gap: var(--cwgsyw-space-2); }
    .pager {
      display: flex;
      gap: var(--cwgsyw-pagination-gap);
      margin-top: var(--cwgsyw-space-4);
    }
    .page-item {
      width: var(--cwgsyw-pagination-item-size);
      height: var(--cwgsyw-pagination-item-size);
      display: grid;
      place-items: center;
      border-radius: var(--cwgsyw-radius-sm);
      border: var(--cwgsyw-border-width-default) solid var(--cwgsyw-border-default);
      background: var(--cwgsyw-bg-surface);
    }
    .page-item[aria-current="page"] {
      background: var(--cwgsyw-bg-surface-selected);
      border-color: var(--cwgsyw-border-strong);
    }
    .overlay-demo {
      position: relative;
      height: var(--cwgsyw-control-height-lg);
      border-radius: var(--cwgsyw-radius-md);
      overflow: hidden;
      background: var(--cwgsyw-bg-surface-subtle);
      margin-top: var(--cwgsyw-space-4);
    }
    .overlay-demo::after {
      content: "";
      position: absolute;
      inset: 0;
      background: var(--cwgsyw-overlay-scrim);
    }
    .vp {
      position: sticky;
      top: 0;
      z-index: 2;
      color: var(--cwgsyw-text-secondary);
      background: var(--cwgsyw-bg-canvas);
      padding-bottom: var(--cwgsyw-space-2);
    }
    @media (max-width: 430px) {
      body { padding: var(--cwgsyw-space-4); }
      .grid { grid-template-columns: 1fr; }
      .actions, .toolbar, .toolbar-actions { flex-direction: column; align-items: stretch; }
      .btn { width: 100%; }
      .toolbar { align-items: flex-start; }
    }
  </style>
</head>
<body>
  <script>
    const params = new URLSearchParams(location.search);
    const theme = params.get('theme') === 'dark' ? 'dark' : 'light';
    document.documentElement.dataset.theme = theme;
    const compact = window.innerWidth <= 430;
    document.documentElement.dataset.patternLayout = compact ? 'compact' : 'default';
    document.documentElement.dataset.paginationDensity = compact ? 'compact' : 'default';
  </script>
  <div class="page">
    <p class="vp cwgsyw-type-label-sm">CWGSYW Neutral token fixture · <span id="theme-label"></span> · <span id="vp-label"></span> · <span id="layout-label"></span></p>
    <section class="hero">
      <p class="kicker cwgsyw-type-label-md">M0 Token pipeline</p>
      <h1 class="cwgsyw-type-title-lg">Neutral surfaces, type and status recipes</h1>
      <p class="cwgsyw-type-body-md lede">Regular UI uses Neutral only. Status color appears only in labeled status examples. This isolated fixture is not a product route.</p>
      <div class="actions">
        <button class="btn" type="button">Primary action</button>
        <button class="btn btn-secondary" type="button">Secondary</button>
        <button class="btn btn-destructive" type="button">Destructive</button>
      </div>
    </section>
    <section class="panel">
      <h2 class="cwgsyw-type-title-sm">Composition</h2>
      <p class="cwgsyw-type-body-sm lede">Shared tokens must hold together as a page header, toolbar, status row and overlay, not only as isolated swatches.</p>
      <div class="toolbar" style="margin-top: var(--cwgsyw-space-4);">
        <div>
          <p class="cwgsyw-type-label-sm">Workspace</p>
          <p class="cwgsyw-type-title-sm">Account settings</p>
        </div>
        <div class="toolbar-actions">
          <button class="btn btn-secondary" type="button">Cancel</button>
          <button class="btn" type="button">Save</button>
        </div>
      </div>
      <div class="row">
        <span class="status" data-feedback-context="info">Info</span>
        <span class="status" data-feedback-context="success">Success</span>
        <span class="status" data-feedback-context="warning">Warning</span>
        <span class="status" data-feedback-context="danger">Danger</span>
      </div>
      <div class="pager" aria-label="Pagination sample">
        <span class="page-item" aria-current="page">1</span>
        <span class="page-item">2</span>
        <span class="page-item">3</span>
      </div>
      <div class="overlay-demo" aria-hidden="true"></div>
    </section>
    <section class="panel">
      <h2 class="cwgsyw-type-title-sm">Semantic color</h2>
      <div class="grid">
        ${semanticSwatches.map(swatchArticle).join('\n        ')}
      </div>
    </section>
    <section class="panel">
      <h2 class="cwgsyw-type-title-sm">Status color</h2>
      <p class="cwgsyw-type-body-sm lede">These tokens are only for real status semantics.</p>
      <div class="grid">
        ${statusSwatches.map(swatchArticle).join('\n        ')}
      </div>
    </section>
    <section class="panel">
      <h2 class="cwgsyw-type-title-sm">Space and radius</h2>
      <div class="row">
        ${spaces
          .map((item) => `<div><div class="space" style="width:${item.value};height:${item.value}"></div><div class="meta">${item.cssName}</div></div>`)
          .join('\n        ')}
      </div>
      <div class="row">
        ${radii
          .map((item) => `<div class="radius cwgsyw-type-label-xs" style="border-radius:${item.value}">${item.cssName.replace('--cwgsyw-radius-', '')}</div>`)
          .join('\n        ')}
      </div>
    </section>
    <section class="panel">
      <h2 class="cwgsyw-type-title-sm">Typography recipes</h2>
      <div class="grid">
        ${recipes.typography
          .map((item) => `<article class="type-card"><div class="${item.className}">${item.name}</div><div class="meta">${item.className}</div></article>`)
          .join('\n        ')}
      </div>
    </section>
    <section class="panel">
      <h2 class="cwgsyw-type-title-sm">Elevation recipes</h2>
      <div class="grid">
        ${recipes.effects
          .map((item) => `<article class="shadow-card ${item.className}"><div class="cwgsyw-type-label-sm">${item.name}</div><div class="meta">${item.className}</div></article>`)
          .join('\n        ')}
      </div>
    </section>
  </div>
  <script>
    document.getElementById('theme-label').textContent = document.documentElement.dataset.theme;
    document.getElementById('layout-label').textContent = document.documentElement.dataset.patternLayout + ' layout';
    const setVp = () => { document.getElementById('vp-label').textContent = window.innerWidth + 'x' + window.innerHeight; };
    setVp();
    window.addEventListener('resize', setVp);
  </script>
</body>
</html>
`
}

function pickDeclarations(exported, selector, names) {
  return names
    .map((cssName) => exported.declarations.find((item) => item.selector === selector && item.cssName === cssName))
    .filter(Boolean)
}

if (require.main === module) {
  const result = generate()
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
}

module.exports = {
  generate,
  buildFixtureHtml,
}
