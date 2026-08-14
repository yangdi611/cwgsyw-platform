# Impact

- Symbol: `InstanceDetailPage`
- Upstream callers: none beyond `/cmdb/instances/by-model/[modelCode]/[id]`.
- In-page tabs Neutralized: `InstanceBasicInfoTab`, `InstanceChangeHistoryTab`, `InstanceAlertsTab`, `InstanceResourcesTab`.
- Left unchanged: `InstanceAssociationsTab`, `InstanceTopologyTab`, `RackElevationView`, `RackAssignmentCard`, `EndpointLinksCard`, `ResourcePoolCapacityCard`.
- GitNexus MCP unavailable this session. These tab symbols are only imported by this route.
- Risk: LOW. Visual shell + in-page tab chrome only. Query key `['cmdb-instance', modelCode, id]` and GET `/cmdb/instances/:id` unchanged. Save invalidation now matches that key.
