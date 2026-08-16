interface CmdbAdminDisclosureIconProps {
  expanded: boolean
}

export function CmdbAdminDisclosureIcon({ expanded }: CmdbAdminDisclosureIconProps) {
  return (
    <span
      aria-hidden="true"
      data-icon="cmdb-admin-chevron-down"
      data-expanded={expanded}
      className="cwgsyw-icon cwgsyw-icon--sm cwgsyw-cmdb-admin__disclosure-icon"
    />
  )
}
