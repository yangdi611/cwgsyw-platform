import { Children, cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react'

export type FieldState = 'default' | 'error' | 'disabled'

export interface FieldProps {
  label: string
  htmlFor?: string
  required?: boolean
  helperText?: string
  errorText?: string
  showHelper?: boolean
  showError?: boolean
  state?: FieldState
  children: ReactNode
}

let fieldCount = 0

export function Field({
  label,
  htmlFor,
  required = false,
  helperText,
  errorText,
  showHelper = Boolean(helperText),
  showError,
  state = 'default',
  children,
}: FieldProps) {
  fieldCount += 1
  const controlId = htmlFor || `cwgsyw-field-${fieldCount}`
  const helperId = `${controlId}-helper`
  const errorId = `${controlId}-error`
  const isError = state === 'error' || showError === true
  const showErrorText = Boolean(errorText) && (state === 'error' || showError === true)
  const describedBy = [showHelper && helperText ? helperId : null, showErrorText ? errorId : null]
    .filter(Boolean)
    .join(' ') || undefined

  const control = Children.map(children, (child) => {
    if (!isValidElement(child)) return child
    return cloneElement(child as ReactElement<Record<string, unknown>>, {
      id: (child.props as { id?: string }).id || controlId,
      disabled: state === 'disabled' || (child.props as { disabled?: boolean }).disabled,
      error: isError || (child.props as { error?: boolean }).error,
      'aria-describedby': describedBy,
      'aria-invalid': showErrorText || undefined,
      'aria-required': required || undefined,
    })
  })

  return (
    <div className={['cwgsyw-field', state === 'disabled' ? 'cwgsyw-field--disabled' : ''].filter(Boolean).join(' ')}>
      <div className="cwgsyw-field__label-row">
        <label className="cwgsyw-type-label-sm" htmlFor={controlId}>
          {label}
        </label>
        {required ? (
          <span className="cwgsyw-field__required" aria-hidden="true">
            *
          </span>
        ) : null}
      </div>
      {control}
      {showHelper && helperText ? (
        <div id={helperId} className="cwgsyw-field__helper cwgsyw-type-label-xs">
          {helperText}
        </div>
      ) : null}
      {showErrorText ? (
        <div id={errorId} className="cwgsyw-field__error cwgsyw-type-label-xs" role="alert">
          {errorText}
        </div>
      ) : null}
    </div>
  )
}
