import { Input, type InputProps } from './Input'

export function SearchInput(props: InputProps) {
  return <Input leadingIcon="search" clearable {...props} />
}
