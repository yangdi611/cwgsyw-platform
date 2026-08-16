type CmdbAdminActionIconName = 'edit' | 'trash'

interface CmdbAdminActionIconProps {
  name: CmdbAdminActionIconName
}

export function CmdbAdminActionIcon({ name }: CmdbAdminActionIconProps) {
  return (
    <span
      aria-hidden="true"
      data-icon={`cmdb-admin-${name}`}
      className={`cwgsyw-icon cwgsyw-icon--sm cwgsyw-cmdb-admin__figma-action-icon cwgsyw-cmdb-admin__figma-action-icon--${name}`}
    />
  )
}
