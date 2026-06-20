package com.cwgsyw.platform.module.cmdb.service;

/**
 * @deprecated Split into focused services (Issue #64 AC9):
 *             <ul>
 *               <li>{@link CiInstanceQueryService} — list / detail / search / history</li>
 *               <li>{@link CiInstanceCommandService} — create / update / delete + audit &amp; change-record dual-write</li>
 *               <li>{@link CiRelatedResourceService} — device / change-doc / daily-report lookups</li>
 *               <li>{@link CiFieldSchemaValidator} — attribute &amp; association-metadata schema validation</li>
 *               <li>{@link CiInstanceUniquenessValidator} — unique-field validation</li>
 *             </ul>
 *             Kept as an empty placeholder so any remaining compile-time reference
 *             still resolves during the migration window; no longer a Spring bean
 *             (nothing injects it). Safe to delete once all call sites are confirmed migrated.
 */
@Deprecated
public class CiInstanceService {
}
