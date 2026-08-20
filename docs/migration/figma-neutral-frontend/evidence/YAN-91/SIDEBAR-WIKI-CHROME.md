# YAN-91 leftover closeout: sidebar + wiki status dots

Date: 2026-08-14

## Scope
- `frontend/src/components/layout/Sidebar.tsx` collapse/expand -> Neutral `IconButton`
- `frontend/src/components/wiki/WikiTreeSidebar.tsx` `STATUS_DOT` restored from empty classes to Neutral status tokens

## Non-goals
- Did not force Neutral `Button` onto calendar cells or sidebar nav group rows
- No commit / push / PR
- Visual audit remains WAIVED

## GitNexus
- `Sidebar` upstream: LOW, 1 direct, DashboardLayout
- `WikiTreeSidebar` upstream: LOW, 1 direct

## Validation
`cd /Users/byron/AI/worktrees/YAN-71/frontend && node --test test/figma-neutral-*.test.cjs`
Result: 219/219 PASS

## Rollback
Revert the two source files and the two leftover tests.
