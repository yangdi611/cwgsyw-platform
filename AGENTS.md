<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **cwgsyw-platform** (3419 symbols, 6972 relationships, 285 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> If any GitNexus tool warns the index is stale, run `npx gitnexus analyze` in terminal first.

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `gitnexus_impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `gitnexus_detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `gitnexus_query({query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `gitnexus_context({name: "symbolName"})`.

## Never Do

- NEVER edit a function, class, or method without first running `gitnexus_impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `gitnexus_rename` which understands the call graph.
- NEVER commit changes without running `gitnexus_detect_changes()` to check affected scope.

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/cwgsyw-platform/context` | Codebase overview, check index freshness |
| `gitnexus://repo/cwgsyw-platform/clusters` | All functional areas |
| `gitnexus://repo/cwgsyw-platform/processes` | All execution flows |
| `gitnexus://repo/cwgsyw-platform/process/{name}` | Step-by-step execution trace |

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |
| Work in the Changedoc area (127 symbols) | `.claude/skills/generated/changedoc/SKILL.md` |
| Work in the Cmdb area (81 symbols) | `.claude/skills/generated/cmdb/SKILL.md` |
| Work in the [id] area (66 symbols) | `.claude/skills/generated/id/SKILL.md` |
| Work in the Ui area (56 symbols) | `.claude/skills/generated/ui/SKILL.md` |
| Work in the Rbac area (27 symbols) | `.claude/skills/generated/rbac/SKILL.md` |
| Work in the Config area (23 symbols) | `.claude/skills/generated/config/SKILL.md` |
| Work in the Device area (19 symbols) | `.claude/skills/generated/device/SKILL.md` |
| Work in the Daily area (18 symbols) | `.claude/skills/generated/daily/SKILL.md` |
| Work in the Ai area (15 symbols) | `.claude/skills/generated/ai/SKILL.md` |
| Work in the Security area (14 symbols) | `.claude/skills/generated/security/SKILL.md` |
| Work in the Layout area (11 symbols) | `.claude/skills/generated/layout/SKILL.md` |
| Work in the Report area (10 symbols) | `.claude/skills/generated/report/SKILL.md` |
| Work in the Auth area (7 symbols) | `.claude/skills/generated/auth/SKILL.md` |
| Work in the User area (7 symbols) | `.claude/skills/generated/user/SKILL.md` |
| Work in the Workflow area (7 symbols) | `.claude/skills/generated/workflow/SKILL.md` |
| Work in the Entity area (6 symbols) | `.claude/skills/generated/entity/SKILL.md` |
| Work in the Dto area (5 symbols) | `.claude/skills/generated/dto/SKILL.md` |
| Work in the Notification area (4 symbols) | `.claude/skills/generated/notification/SKILL.md` |
| Work in the Instances area (4 symbols) | `.claude/skills/generated/instances/SKILL.md` |
| Work in the Permissions area (4 symbols) | `.claude/skills/generated/permissions/SKILL.md` |

<!-- gitnexus:end -->
