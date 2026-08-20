import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react'
import { Icon, isIconName, type IconName } from './Icon'
import { Spinner } from './Spinner'

export type ControlSize = 'sm' | 'md' | 'lg'

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  size?: ControlSize
  error?: boolean
  loading?: boolean
  leadingIcon?: IconName | ReactNode
  trailingIcon?: IconName | ReactNode
  clearable?: boolean
  onClear?: () => void
}

function adornment(value?: IconName | ReactNode, size: ControlSize = 'md') {
  if (!value) return null
  if (isIconName(value)) return <Icon name={value} size={size} />
  return value
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    size = 'md',
    error = false,
    loading = false,
    disabled,
    leadingIcon,
    trailingIcon,
    clearable,
    onClear,
    className,
    ...props
  },
  ref,
) {
  return (
    <div
      className={[
        'cwgsyw-control',
        `cwgsyw-control--${size}`,
        error ? 'cwgsyw-control--error' : '',
        disabled ? 'cwgsyw-control--disabled' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {adornment(leadingIcon, size)}
      <input {...props} ref={ref} disabled={disabled || loading} />
      {clearable && props.value ? (
        <button type="button" aria-label="清除" onClick={onClear}>
          <Icon name="close" size="sm" />
        </button>
      ) : null}
      {adornment(trailingIcon, size)}
      {loading ? <Spinner size="sm" showLabel={false} label="加载中" /> : null}
    </div>
  )
})
