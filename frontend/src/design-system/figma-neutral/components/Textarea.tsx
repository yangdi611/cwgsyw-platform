import type { TextareaHTMLAttributes } from 'react'
import type { ControlSize } from './Input'

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  size?: ControlSize
  error?: boolean
  loading?: boolean
}

export function Textarea({ size = 'md', error = false, loading = false, disabled, className, ...props }: TextareaProps) {
  return (
    <div
      className={[
        'cwgsyw-control',
        'cwgsyw-textarea',
        `cwgsyw-control--${size}`,
        `cwgsyw-textarea--${size}`,
        error ? 'cwgsyw-control--error' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <textarea {...props} disabled={disabled || loading} />
    </div>
  )
}
