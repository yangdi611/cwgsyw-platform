# Figma Neutral components

Shared components used by the migrated application. Use the exports in `index.ts`
and their actual TypeScript props; do not recreate removed legacy UI directories
or impose another library's API. Button variants use `variant`, not `intent`.

The former M1-only instruction forbidding imports from application pages applied
to the initial isolated migration stage, not the current shared components.
