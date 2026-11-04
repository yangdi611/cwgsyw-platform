# Figma Neutral Token Pipeline

Token pipeline for the CWGSYW Neutral design source, now consumed by migrated application pages. Reuse the existing component/token exports; do not reintroduce removed legacy component systems. Migration history is in `docs/migration/figma-neutral-frontend/STATUS.md` (repository root).

## Generate

From `frontend/`:

```bash
node src/design-system/figma-neutral/generate.cjs
```

Outputs:

- `generated/tokens.css`
- `generated/recipes.css`
- `generated/source-map.json`
- `generated/token-fixture.html`

Open the fixture with `?theme=light` or `?theme=dark`. Widths at or below 430px switch Pattern Layout and Pagination Density to Compact.

## Fail closed

The exporter refuses `Collection 1`, remote collections/variables, missing or illegal WEB Code Syntax, unresolved aliases, and conflicting values for the same public CSS name.
