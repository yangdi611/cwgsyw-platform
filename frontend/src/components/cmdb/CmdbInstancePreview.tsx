'use client'

import type { ReactNode } from 'react'

export function CmdbInstancePreview({
  description,
  fields,
  extraTitle = '关键属性',
  extraFields = [],
  actions,
}: {
  description?: string | null
  fields: Array<{ label: string; value: ReactNode }>
  extraTitle?: string
  extraFields?: Array<{ label: string; value: ReactNode }>
  actions?: ReactNode
}) {
  return (
    <div className="cwgsyw-cmdb-preview">
      {description ? <p className="cwgsyw-cmdb-preview__desc">{description}</p> : null}
      <dl className="cwgsyw-cmdb-preview__list">
        {fields.map((field) => (
          <div key={field.label} className="cwgsyw-cmdb-preview__row">
            <dt>{field.label}</dt>
            <dd>{field.value}</dd>
          </div>
        ))}
      </dl>
      {extraFields.length > 0 ? (
        <>
          <div className="cwgsyw-cmdb-preview__section">{extraTitle}</div>
          <dl className="cwgsyw-cmdb-preview__list">
            {extraFields.map((field) => (
              <div key={field.label} className="cwgsyw-cmdb-preview__row">
                <dt>{field.label}</dt>
                <dd>{field.value}</dd>
              </div>
            ))}
          </dl>
        </>
      ) : null}
      {actions ? <div className="cwgsyw-cmdb-preview__actions">{actions}</div> : null}
    </div>
  )
}
