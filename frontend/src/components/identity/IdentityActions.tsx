'use client'

import { NeutralTooltip, IconButton } from '@/design-system/figma-neutral/components'

export function IdentityIconAction({
  label,
  icon,
  onClick,
  danger = false,
  disabled = false,
  testId,
}: {
  label: string
  icon: 'edit' | 'trash' | 'archive' | 'play'
  onClick: () => void
  danger?: boolean
  disabled?: boolean
  testId?: string
}) {
  return (
    <NeutralTooltip content={label} className="cwgsyw-tooltip--pill" followCursor>
      <IconButton
        type="button"
        size="sm"
        variant="ghost"
        aria-label={label}
        data-testid={testId}
        disabled={disabled}
        className={['cwgsyw-tasks-icon-action', danger ? 'cwgsyw-tasks-icon-action--danger' : ''].filter(Boolean).join(' ')}
        icon={<span aria-hidden="true" className={['cwgsyw-tasks-figma-icon', `cwgsyw-tasks-figma-icon--${icon}`].join(' ')} />}
        onClick={onClick}
      />
    </NeutralTooltip>
  )
}
