# Project Contracts and Non-obvious Pitfalls

Read the section relevant to the change. These constraints consolidate the former
local `CLAUDE.md`; current code, schemas, tests, and approved requirements resolve
historical implementation details. This is not authorization to alter security or
production data. Versions belong in manifests/CI, not agent instructions.

## Backend, API, and data

- Preserve resource/action permissions, backend `@PreAuthorize`, role assignments,
  frontend permission guards, and tenant/group/ownership checks as one contract.
  Add resource/action seeds when adding a permission surface, not for every feature.
- Business writes preserve `audit_log` in the transaction. System operations use
  the established operator identity (`0L` where applicable). Credential reveal is
  a deliberate exception: commit its audit before decrypting, independently of the
  business transaction. Do not log plaintext credentials or cryptographic keys.
- Preserve MyBatis-Plus logical deletion and tenant filtering; do not replace
  business soft deletes with physical SQL deletes. Backup file retention is a
  separate, explicitly scoped operational behavior.
- Existing LocalDateTime columns use `TIMESTAMP`. Do not casually change timestamp
  types, tenant defaults, or applied Flyway migrations. Migration history and
  validation settings are not permission to edit checksums or disable validation.
- API JSON fields, query parameters, and multipart part names are camelCase. Do not
  add a global snake_case naming strategy or DTO-level `@JsonNaming`. Preserve
  existing `@JsonAlias` compatibility. User-defined keys inside `attrs`/`fieldsData`
  JSONB are data, not API fields: do not rename them.
- For single-letter-prefix fields such as `uStart`, preserve the getter-level
  `@JsonProperty` mapping; field-only annotations can create duplicate JSON keys.
- Stable requests use DTOs. Dynamic CMDB attributes, metadata, and workflow maps
  require validation at the service boundary.
- Preserve JSONB type handlers: updating a Map/List through an untyped wrapper
  `.set()` can bypass `JacksonTypeHandler`; use the entity update path. Custom
  mapper SQL needs explicit result mapping or the equivalent BaseMapper query so
  JSONB values are not silently lost.
- Preserve the established explicit count pagination workaround where used with
  Boolean `@TableLogic`; do not replace it without verifying totals.
- CMDB model identity uses the stable code, not the display name. Preserve relation
  cardinality and dynamic-attribute validation.

## Frontend

- Reuse `frontend/src/design-system/figma-neutral/components/` and the actual props
  it exports. `src/components/ui/` was removed during the Figma Neutral migration;
  stale shadcn aliases and generic UI skills are not authority to recreate it or
  replace the design system. The current Button uses `variant`, not `intent`;
  inspect current component APIs rather than copying old `asChild`/buttonVariants
  examples. See `docs/migration/figma-neutral-frontend/STATUS.md` for migration
  history, not current-task authorization.
- Preserve auth hydration behavior (`getToken()` in dashboard guards),
  `usePermission().hasPermission`, group scopes, and the shared `@/lib/api` client.
- Select controls must display the label when stored values differ from labels;
  a plain value is sufficient when it already is the display text. Check affected
  controls rather than scanning every Select on every frontend task.
- Preserve query keys, route/tab state, error/empty/loading states, and relevant
  Suspense boundaries. Keep column-config defaults stable when reference identity
  matters to `useColumnConfig`.

## Device credentials

- New devices associate with a CMDB CI. Name/IP/type are derived from CI; existing
  snapshot fields remain fallback for deleted/missing CI. Device edits do not
  silently change CI identity; preserve category/description/group edit boundaries.
- Reveal requires `device:view_password` plus tenant and group checks. Preserve
  audit-before-decrypt, encryption at rest, client-key envelope encryption, and
  short-lived frontend plaintext. Existing HTTP fallback is a compatibility risk,
  not a recommendation to extend plaintext transport.
- Secrets come from configured secret inputs, not copied example keys/passwords.

## Shared files and Wiki ACL

- Shared-folder ACL uses the nearest custom ancestor; an entirely inherited chain
  retains the existing RBAC-only behavior. Admin bypass remains subject to tenant
  boundaries. Listing also applies group visibility; ACL updates require
  `shared_file:manage_acl`. Only empty folders may be deleted.
- Change-document archives preserve approval-group visibility and source linkage.
- Wiki read inheritance and explicit write permission are different policies: do
  not reuse default-readable fallback to authorize writes. Preserve the reviewed
  space/page permission combination and endpoint-specific checks.
- System manual/release-note spaces and read-only template pages remain locked,
  including for admins through ordinary UI write paths. Feedback-space deletion
  remains admin-only; page ACL grants must not bypass that boundary. Preserve
  startup seeder ACL reconciliation.

## Backup and deployment

- Backup/restore affects PostgreSQL and MinIO and is admin-only. Restore can replace
  data; require explicit authorization and an identified target/rollback boundary.
- Preserve aligned proxy, client, and multipart limits for long-running backup
  operations; inspect current configuration instead of copying historical values.
- Development and production use separate Compose/nginx configurations. Never
  substitute the production file into a local command by analogy or infer that
  localhost means disposable data. Check test fixtures and connections before
  data-mutating validation. Do not default to no-cache rebuilds.
