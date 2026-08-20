import { Input, type InputProps } from './Input'

export function DateInput(props: InputProps) {
  return <Input trailingIcon="calendar" inputMode="numeric" placeholder={props.placeholder ?? 'YYYY-MM-DD'} {...props} />
}
