type CmdbAdminModelMenuItemIconName = 'settings' | 'move'

export function CmdbAdminModelMenuItemIcon({ name }: { name: CmdbAdminModelMenuItemIconName }) {
  return (
    <span
      aria-hidden="true"
      data-icon={`cmdb-admin-${name}`}
      className={`cwgsyw-icon cwgsyw-icon--sm cwgsyw-cmdb-admin__model-menu-item-icon cwgsyw-cmdb-admin__model-menu-item-icon--${name}`}
    >
      {name === 'move' ? (
        <>
          <span className="cwgsyw-cmdb-admin__model-menu-item-icon-layer cwgsyw-cmdb-admin__model-menu-item-icon-layer--move" />
          <span className="cwgsyw-cmdb-admin__model-menu-item-icon-layer cwgsyw-cmdb-admin__model-menu-item-icon-layer--move-overlay" />
        </>
      ) : null}
    </span>
  )
}
