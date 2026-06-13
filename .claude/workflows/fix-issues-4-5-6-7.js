export const meta = {
  name: 'fix-issues-4-5-6-7',
  description: 'Fix GitHub issues #4 (user delete), #5-7 (group leader/members/description) with low-cost agents + high-cost verify',
  phases: [
    { title: 'DB Migration + Backend' },
    { title: 'Frontend' },
    { title: 'Verify', model: 'opus' },
  ],
}

// ===== Phase 1: DB migration + Backend fixes =====
phase('DB Migration + Backend')

// 1a: DB Migration V18 (prerequisite for #5-7)
await agent(
  "Create Flyway migration V18 for cwgsyw-platform.\n\n" +
  "Task 1: Create the SQL migration file at:\n" +
  "  backend/src/main/resources/db/migration/V18__add_group_leader_id.sql\n\n" +
  "Content:\n" +
  "  ALTER TABLE sys_group ADD COLUMN leader_id BIGINT;\n\n" +
  "Task 2: Update the Group entity at:\n" +
  "  backend/src/main/java/com/cwgsyw/platform/module/org/entity/Group.java\n\n" +
  "Add this field after 'description':\n" +
  "  private Long leaderId;\n\n" +
  "Use Lombok @Data so getter/setter are auto-generated. Follow existing code style exactly.\n" +
  "Return the paths of files created/modified.",
  { label: 'v18-migration', model: 'haiku' }
)

// 1b: Fix #4 - UserService.delete()
const fix4 = await agent(
  "Fix GitHub issue #4 in cwgsyw-platform: user delete does not work — is_deleted stays false.\n\n" +
  "File: backend/src/main/java/com/cwgsyw/platform/module/user/UserService.java\n\n" +
  "Root cause: userMapper.updateById(user) in delete() strips @TableLogic fields (isDeleted) from UPDATE SQL. " +
  "deletedAt and deletedBy are written, but is_deleted stays false, so the user still appears in queries.\n\n" +
  "Fix: Replace the updateById call with LambdaUpdateWrapper that explicitly sets isDeleted.\n\n" +
  "Current delete() method (lines 63-71):\n" +
  "  @Transactional\n" +
  "  public void delete(Long id, Long operatorId) {\n" +
  "      User user = userMapper.selectById(id);\n" +
  "      if (user == null) throw new IllegalArgumentException(\"用户不存在\");\n" +
  "      user.setIsDeleted(true);\n" +
  "      user.setDeletedBy(operatorId);\n" +
  "      user.setDeletedAt(LocalDateTime.now());\n" +
  "      userMapper.updateById(user);\n" +
  "  }\n\n" +
  "Replace with LambdaUpdateWrapper approach:\n" +
  "  userMapper.update(null,\n" +
  "      new LambdaUpdateWrapper<User>()\n" +
  "          .eq(User::getId, id)\n" +
  "          .set(User::getIsDeleted, true)\n" +
  "          .set(User::getDeletedBy, operatorId)\n" +
  "          .set(User::getDeletedAt, LocalDateTime.now()));\n\n" +
  "Remove the user.setIsDeleted/setDeletedBy/setDeletedAt lines (LambdaUpdateWrapper handles all three).\n" +
  "Add import: com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper\n" +
  "Return: the file path and summary of changes.",
  { label: 'fix-4-delete', model: 'haiku' }
)

// 1c: Backend #5-7 - GroupController + DTOs
const fix567backend = await agent(
  "Fix GitHub issues #5, #6, #7 backend changes for cwgsyw-platform group management.\n\n" +
  "Prerequisite: sys_group has leader_id column (V18 migration), Group.java has leaderId field.\n\n" +
  "Files to modify: backend/src/main/java/com/cwgsyw/platform/module/org/GroupController.java\n" +
  "New DTOs in: backend/src/main/java/com/cwgsyw/platform/module/org/dto/\n\n" +
  "=== Issue #5: Group list returns leader + member info ===\n\n" +
  "Create GroupListVO.java in dto package with fields:\n" +
  "  private Long id;\n" +
  "  private String name;\n" +
  "  private String description;\n" +
  "  private Long leaderId;\n" +
  "  private String leaderRealName;\n" +
  "  private int memberCount;\n" +
  "  private List<String> memberPreview;\n\n" +
  "Modify GET /api/groups to return R<List<GroupListVO>>. For each group:\n" +
  "  - If leaderId != null, query user by leaderId to get realName\n" +
  "  - Count members: userMapper.selectCount with LambdaQueryWrapper eq groupId\n" +
  "  - Get top 3 member preview: userMapper.selectList with groupId + last(\"limit 3\"), exclude leader\n" +
  "  - Build GroupListVO and return\n\n" +
  "=== Issue #6: Create group with leader + members ===\n\n" +
  "Create CreateGroupRequest.java in dto package:\n" +
  "  private String name;\n" +
  "  private String description;\n" +
  "  private Long leaderId;\n" +
  "  private List<Long> memberIds;\n\n" +
  "Modify POST /api/groups to accept CreateGroupRequest body (not raw Group).\n" +
  "In @Transactional method:\n" +
  "  1. Create Group entity, set name/description/leaderId/tenantId\n" +
  "  2. groupMapper.insert(group)\n" +
  "  3. If leaderId != null: userMapper.update(null, LambdaUpdateWrapper set groupId)\n" +
  "  4. For each memberId: userMapper.update(null, LambdaUpdateWrapper set groupId)\n" +
  "  5. Write audit_log for each user group assignment\n" +
  "Return the created group.\n\n" +
  "=== Issue #7: Update group with leader + description ===\n\n" +
  "Create UpdateGroupRequest.java in dto package:\n" +
  "  private String name;\n" +
  "  private String description;\n" +
  "  private Long leaderId;\n\n" +
  "Modify PUT /api/groups/{id} to accept UpdateGroupRequest.\n" +
  "Load existing group, update name/description/leaderId from request (only if non-null).\n" +
  "Use groupMapper.updateById(group).\n\n" +
  "IMPORTANT CONVENTIONS:\n" +
  "- JSON fields will be snake_case (Jackson global SNAKE_CASE)\n" +
  "- User entity: com.cwgsyw.platform.module.user.entity.User\n" +
  "- GroupMapper: com.cwgsyw.platform.module.org.GroupMapper\n" +
  "- AuditLog builder: AuditLog.builder().tenantId(...).module(\"group\").action(...).targetId(...).targetType(\"user\").operatorId(...).beforeJson(...).afterJson(...).remark(...).build()\n" +
  "- Existing imports in GroupController: LambdaQueryWrapper, LambdaUpdateWrapper, AuditLog, AuditLogMapper, User, UserMapper, GroupMemberVO, SecurityUser, Map, Collectors\n" +
  "- Use @Transactional on create method\n\n" +
  "Return: list of all files created/modified and summary.",
  { label: 'fix-567-backend', model: 'haiku' }
)

// ===== Phase 2: Frontend =====
phase('Frontend')

const frontendResult = await agent(
  "Fix GitHub issues #5, #6, #7 frontend changes for cwgsyw-platform group management.\n\n" +
  "Files to modify:\n" +
  "- frontend/src/app/(dashboard)/groups/page.tsx\n" +
  "- frontend/src/components/group/GroupDialog.tsx\n\n" +
  "=== Issue #5: Group list columns ===\n\n" +
  "In groups/page.tsx, update the Group interface:\n" +
  "  interface Group {\n" +
  "    id: number\n" +
  "    name: string\n" +
  "    description: string\n" +
  "    leader_id: number | null\n" +
  "    leader_real_name: string | null\n" +
  "    member_count: number\n" +
  "    member_preview: string[]\n" +
  "  }\n\n" +
  "The GET /api/groups now returns GroupListVO objects (snake_case). Update queryFn:\n" +
  "  queryFn: () => api.get('/groups').then((r) => r.data.data as Group[])\n\n" +
  "Add two header columns after the description column:\n" +
  "  <th className=\"text-left p-3 text-sm font-medium\">组长</th>\n" +
  "  <th className=\"text-left p-3 text-sm font-medium\">组员</th>\n\n" +
  "Add two data cells in each row:\n" +
  "  <td className=\"p-3 text-sm\">{group.leader_real_name || '-'}</td>\n" +
  "  <td className=\"p-3 text-sm text-muted-foreground\">\n" +
  "    {group.member_preview && group.member_preview.length > 0\n" +
  "      ? <>{group.member_preview.join(', ')}{group.member_count > 3 ? ', ...' : ''}</>\n" +
  "      : '-'}\n" +
  "  </td>\n\n" +
  "=== Issues #6 & #7: GroupDialog enhance ===\n\n" +
  "In GroupDialog.tsx, first add imports:\n" +
  "  import { useEffect, useMemo } from 'react'\n" +
  "  import { useQuery } from '@tanstack/react-query'\n" +
  "  (add useMemo to existing import, add useQuery if not present)\n\n" +
  "Update GroupFormData:\n" +
  "  interface GroupFormData {\n" +
  "    name: string\n" +
  "    description: string\n" +
  "    leader_id: number | null\n" +
  "    member_ids: number[]\n" +
  "  }\n\n" +
  "Add UserOption interface:\n" +
  "  interface UserOption {\n" +
  "    id: number\n" +
  "    username: string\n" +
  "    real_name: string\n" +
  "    group_id: number | null\n" +
  "    group_name?: string\n" +
  "  }\n\n" +
  "Load users on dialog open:\n" +
  "  const { data: usersData } = useQuery({\n" +
  "    queryKey: ['all-users-for-group'],\n" +
  "    queryFn: () => api.get('/users', { params: { page: 1, size: 200 } }).then(r => {\n" +
  "      const records = r.data.data?.records ?? []\n" +
  "      return records as UserOption[]\n" +
  "    }),\n" +
  "    enabled: open,\n" +
  "  })\n\n" +
  "Load groups for group name display:\n" +
  "  const { data: groupsData } = useQuery({\n" +
  "    queryKey: ['all-groups-for-dialog'],\n" +
  "    queryFn: () => api.get('/groups').then(r => r.data.data as any[]),\n" +
  "    enabled: open,\n" +
  "  })\n\n" +
  "Sort users: no-group first, then localeCompare('zh-CN'):\n" +
  "  const sortedUsers = useMemo(() => {\n" +
  "    if (!usersData) return []\n" +
  "    const groupMap = new Map((groupsData || []).map((g: any) => [g.id, g.name]))\n" +
  "    return [...usersData].sort((a, b) => {\n" +
  "      const aHasGroup = a.group_id != null ? 1 : 0\n" +
  "      const bHasGroup = b.group_id != null ? 1 : 0\n" +
  "      if (aHasGroup !== bHasGroup) return aHasGroup - bHasGroup\n" +
  "      return (a.real_name || a.username).localeCompare(b.real_name || b.username, 'zh-CN')\n" +
  "    }).map(u => ({ ...u, group_name: u.group_id ? groupMap.get(u.group_id) : undefined }))\n" +
  "  }, [usersData, groupsData])\n\n" +
  "Update defaultValues in useForm:\n" +
  "  defaultValues: { name: '', description: '', leader_id: null, member_ids: [] }\n\n" +
  "Update useEffect reset:\n" +
  "  if (mode === 'edit' && group) {\n" +
  "    reset({ name: group.name, description: group.description || '', leader_id: (group as any).leader_id ?? null, member_ids: [] })\n" +
  "  } else {\n" +
  "    reset({ name: '', description: '', leader_id: null, member_ids: [] })\n" +
  "  }\n\n" +
  "Add watcher:  const selectedMemberIds = watch('member_ids')\n\n" +
  "Add form fields after the 组名称 input:\n\n" +
  "1. Description textarea:\n" +
  "  <div className=\"space-y-2\">\n" +
  "    <Label htmlFor=\"description\">描述</Label>\n" +
  "    <textarea id=\"description\" {...register('description')}\n" +
  "      className=\"w-full rounded-md border border-input bg-background px-3 py-2 text-sm\"\n" +
  "      rows={2} placeholder=\"请输入组描述\" />\n" +
  "  </div>\n\n" +
  "2. Leader selector (native select):\n" +
  "  <div className=\"space-y-2\">\n" +
  "    <Label htmlFor=\"leader_id\">组长</Label>\n" +
  "    <select id=\"leader_id\" {...register('leader_id')}\n" +
  "      className=\"w-full rounded-md border border-input bg-background px-3 py-2 text-sm\">\n" +
  "      <option value=\"\">-- 不指定组长 --</option>\n" +
  "      {sortedUsers.map(u => (\n" +
  "        <option key={u.id} value={u.id}>\n" +
  "          {u.real_name || u.username}{u.group_name ? ' (' + u.group_name + ')' : ''}\n" +
  "        </option>\n" +
  "      ))}\n" +
  "    </select>\n" +
  "  </div>\n\n" +
  "3. Member multi-select (create mode only):\n" +
  "  {mode === 'create' && (\n" +
  "    <div className=\"space-y-2\">\n" +
  "      <Label>组员</Label>\n" +
  "      <div className=\"max-h-40 overflow-y-auto space-y-1 border rounded p-2\">\n" +
  "        {sortedUsers.map(u => (\n" +
  "          <label key={u.id} className=\"flex items-center gap-2 text-sm cursor-pointer\">\n" +
  "            <Checkbox checked={selectedMemberIds.includes(u.id)}\n" +
  "              onCheckedChange={(c) => { if (c) { setValue('member_ids', [...selectedMemberIds, u.id]) } else { setValue('member_ids', selectedMemberIds.filter(id => id !== u.id)) } }} />\n" +
  "            {u.real_name || u.username}\n" +
  "            {u.group_name && <span className=\"text-muted-foreground\">（{u.group_name}）</span>}\n" +
  "          </label>\n" +
  "        ))}\n" +
  "      </div>\n" +
  "    </div>\n" +
  "  )}\n\n" +
  "onSubmit create mode — POST with snake_case:\n" +
  "  await api.post('/groups', {\n" +
  "    name: data.name,\n" +
  "    description: data.description || undefined,\n" +
  "    leader_id: data.leader_id || undefined,\n" +
  "    member_ids: data.member_ids.length > 0 ? data.member_ids : undefined,\n" +
  "  })\n\n" +
  "onSubmit edit mode — PUT with snake_case:\n" +
  "  await api.put('/groups/' + group!.id, {\n" +
  "    name: data.name,\n" +
  "    description: data.description || undefined,\n" +
  "    leader_id: data.leader_id,\n" +
  "  })\n\n" +
  "IMPORTANT:\n" +
  "- All API body keys use snake_case (backend SNAKE_CASE config)\n" +
  "- Keep existing Dialog/footer structure unchanged\n" +
  "- The Checkbox import is already present\n" +
  "- Native select and textarea elements with Tailwind classes matching Input styling\n" +
  "- Member checkbox list pattern from UserDialog.tsx lines 156-172\n" +
  "- Dialog max width should be sm:max-w-md (or sm:max-w-lg if needed for content)\n\n" +
  "Return: paths of modified files and summary.",
  { label: 'fix-567-frontend', model: 'haiku' }
)

// ===== Phase 3: Verify with high-cost model =====
phase('Verify')
const verify = await agent(
  "Verify all changes from issues #4, #5, #6, #7 are correct and consistent in cwgsyw-platform.\n\n" +
  "Read and check these files:\n" +
  "1. backend/src/main/resources/db/migration/V18__add_group_leader_id.sql\n" +
  "2. backend/src/main/java/com/cwgsyw/platform/module/org/entity/Group.java\n" +
  "3. backend/src/main/java/com/cwgsyw/platform/module/user/UserService.java\n" +
  "4. backend/src/main/java/com/cwgsyw/platform/module/org/GroupController.java\n" +
  "5. backend/src/main/java/com/cwgsyw/platform/module/org/dto/GroupListVO.java (new)\n" +
  "6. backend/src/main/java/com/cwgsyw/platform/module/org/dto/CreateGroupRequest.java (new)\n" +
  "7. backend/src/main/java/com/cwgsyw/platform/module/org/dto/UpdateGroupRequest.java (new)\n" +
  "8. frontend/src/app/(dashboard)/groups/page.tsx\n" +
  "9. frontend/src/components/group/GroupDialog.tsx\n\n" +
  "For each file verify:\n" +
  "- All imports are correct and needed\n" +
  "- No syntax errors or typos\n" +
  "- Snake_case field names match between frontend API calls and backend DTOs\n" +
  "- Coding style matches surrounding code\n" +
  "- No missing null checks that could cause NPE\n\n" +
  "Specifically verify these cross-file contracts:\n" +
  "- GroupListVO fields match what GET /api/groups returns AND what frontend Group interface expects\n" +
  "- CreateGroupRequest fields match what POST /api/groups expects AND what frontend sends\n" +
  "- UpdateGroupRequest fields match what PUT /api/groups expects AND what frontend sends\n" +
  "- UserService.delete() uses LambdaUpdateWrapper (not updateById) for @TableLogic field\n\n" +
  "Report ALL issues found. If everything is clean, say 'ALL CLEAN'.",
  { label: 'verify-all', model: 'opus' }
)

return {
  fix4: fix4,
  fix567backend: fix567backend,
  frontend: frontendResult,
  verify: verify,
}
