export type SeparatorOrientation = 'horizontal' | 'vertical'

export interface SeparatorProps {
  orientation?: SeparatorOrientation
  className?: string
}

export function Separator({ orientation = 'horizontal', className }: SeparatorProps) {
  return (
    <div
      role="separator"
      aria-orientation={orientation}
      className={['cwgsyw-separator', `cwgsyw-separator--${orientation}`, className].filter(Boolean).join(' ')}
    />
  )
}
