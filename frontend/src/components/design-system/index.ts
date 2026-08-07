/**
 * Stable public entry point for reusable UI primitives.
 *
 * Implementations remain in ui/v2 during the migration. Consumers should
 * import from this module so the internal primitive can change later without
 * requiring another page-wide import migration.
 */
export { Button, buttonVariants } from './Button'
export type { ButtonProps, ButtonSize, ButtonVariant } from './Button'
export { Card, CardHeader, CardTitle, CardDescription, CardContent } from './Card'
export type { CardProps } from './Card'
export { StatusBadge } from './StatusBadge'
export type { StatusBadgeProps } from './StatusBadge'
export { Chip } from './Chip'
export type { ChipProps, ChipVariant } from './Chip'

export { Input } from './Input'
export { Textarea } from './Textarea'
export { Label } from './Label'
export { Checkbox } from './Checkbox'
export { Switch } from './Switch'
export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectValue,
  SelectTrigger,
} from './Select'
export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
} from './Dialog'
export {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogOverlay,
  AlertDialogPortal,
  AlertDialogTitle,
  AlertDialogTrigger,
} from './AlertDialog'

export { Badge, badgeVariants } from './Badge'
export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
} from './Table'
export { Tooltip, TooltipTrigger, TooltipContent } from './Tooltip'
export {
  DropdownMenu,
  DropdownMenuPortal,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from './DropdownMenu'
export { Skeleton } from './Skeleton'
export {
  Avatar,
  AvatarImage,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarBadge,
} from './Avatar'
export { Separator } from './Separator'
export { Toaster } from './Toast'
