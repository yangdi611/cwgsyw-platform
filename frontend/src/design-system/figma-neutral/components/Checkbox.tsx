import type { InputHTMLAttributes } from 'react'

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> {
  label?: string
  showLabel?: boolean
  error?: boolean
  indeterminate?: boolean
}

export function Checkbox({ label, showLabel = true, error = false, indeterminate = false, className, ...props }: CheckboxProps) {
  return (
    <label className={['cwgsyw-choice', error ? 'cwgsyw-choice--error' : '', className].filter(Boolean).join(' ')}>
      <input
        {...props}
        type="checkbox"
        ref={(node) => {
          if (node) node.indeterminate = indeterminate
        }}
        aria-invalid={error || undefined}
      />
      {showLabel ? <span className="cwgsyw-type-label-sm">{label}</span> : <span className="sr-only">{label}</span>}
    </label>
  )
}

export interface RadioProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> {
  label?: string
  showLabel?: boolean
  error?: boolean
}

export function Radio({ label, showLabel = true, error = false, className, ...props }: RadioProps) {
  return (
    <label className={['cwgsyw-choice', error ? 'cwgsyw-choice--error' : '', className].filter(Boolean).join(' ')}>
      <input {...props} type="radio" aria-invalid={error || undefined} />
      {showLabel ? <span className="cwgsyw-type-label-sm">{label}</span> : <span className="sr-only">{label}</span>}
    </label>
  )
}

export interface SwitchProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> {
  label?: string
  showLabel?: boolean
  size?: 'sm' | 'md'
}

export function Switch({ label = '启用', showLabel = true, size = 'sm', className, ...props }: SwitchProps) {
  return (
    <label className={['cwgsyw-switch', `cwgsyw-switch--${size}`, className].filter(Boolean).join(' ')}>
      <input {...props} type="checkbox" role="switch" />
      <span className="cwgsyw-switch__track">
        <span className="cwgsyw-switch__thumb" />
      </span>
      {showLabel ? <span className="cwgsyw-type-label-sm">{label}</span> : <span className="sr-only">{label}</span>}
    </label>
  )
}
