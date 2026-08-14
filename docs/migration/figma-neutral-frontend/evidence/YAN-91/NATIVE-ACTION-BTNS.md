# Native action button remint

2026-08-14. GitNexus upstream impact on `TaskList` / `WorkItemList` / `BatchEditDialog` / `EndpointLinksCard` / `CiLinkSelector` was LOW.

Changed action leftovers:

- `TaskList` / `WorkItemList` retry already used Neutral `Button variant="secondary"`
- `BatchEditDialog` footer already used Neutral `Button`
- `EndpointLinksCard` delete: native danger text button -> `Button size="sm" variant="destructive"`
- `CiLinkSelector` remove: native label button -> `Button size="sm" variant="ghost"`
- `RackAssignmentCard` delete: native danger text button -> `Button size="sm" variant="destructive"`

Kept as Neutral CSS composition, not reminted to form Button:

- calendar cells / ops-calendar items
- nav group rows / collapsed sidebar entries
- folder/wiki tree disclosure
- dashboard tiles / KPI / attachment tiles
- password visibility toggle
- picker / designer type options

Gate: `frontend/test/figma-neutral-m8-leftover-native-btns.test.cjs`
