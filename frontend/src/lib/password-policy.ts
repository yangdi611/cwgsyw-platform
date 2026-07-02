/**
 * 密码复杂度规则（与后端 PasswordPolicyService 保持一致，见 SPEC 9.2）。
 * 仅用于前端即时提示，最终准入以后端校验为准。
 */

export const PASSWORD_MIN_LENGTH = 10
export const PASSWORD_ALLOWED_SPECIALS = '!@#%*?_-'

export type PasswordPolicyViolation =
  | 'TOO_SHORT'
  | 'INVALID_CHARACTER'
  | 'MISSING_UPPER'
  | 'MISSING_LOWER'
  | 'MISSING_DIGIT'
  | 'MISSING_SPECIAL'
  | 'CONTAINS_USERNAME'

function escapeForCharClass(chars: string): string {
  return chars.replace(/[-[\]/{}()*+?.\\^$|]/g, '\\$&')
}

const ALLOWED_PATTERN = new RegExp(`^[A-Za-z0-9${escapeForCharClass(PASSWORD_ALLOWED_SPECIALS)}]+$`)
const SPECIAL_PATTERN = new RegExp(`[${escapeForCharClass(PASSWORD_ALLOWED_SPECIALS)}]`)

/** 返回所有未通过的规则项；用户名为空时不做包含校验。 */
export function inspectPassword(username: string | undefined, password: string): PasswordPolicyViolation[] {
  const violations: PasswordPolicyViolation[] = []

  if (!password || password.length < PASSWORD_MIN_LENGTH) {
    violations.push('TOO_SHORT')
  }
  if (!password) return violations

  if (!ALLOWED_PATTERN.test(password)) violations.push('INVALID_CHARACTER')
  if (!/[A-Z]/.test(password)) violations.push('MISSING_UPPER')
  if (!/[a-z]/.test(password)) violations.push('MISSING_LOWER')
  if (!/[0-9]/.test(password)) violations.push('MISSING_DIGIT')
  if (!SPECIAL_PATTERN.test(password)) violations.push('MISSING_SPECIAL')
  if (username && username.length > 0 && password.toLowerCase().includes(username.toLowerCase())) {
    violations.push('CONTAINS_USERNAME')
  }

  return violations
}

export function isPasswordValid(username: string | undefined, password: string): boolean {
  return inspectPassword(username, password).length === 0
}

const VIOLATION_MESSAGES: Record<PasswordPolicyViolation, string> = {
  TOO_SHORT: `密码至少 ${PASSWORD_MIN_LENGTH} 位`,
  INVALID_CHARACTER: `密码只能包含字母、数字和 ${PASSWORD_ALLOWED_SPECIALS} 中的特殊字符`,
  MISSING_UPPER: '密码需包含至少 1 个大写字母',
  MISSING_LOWER: '密码需包含至少 1 个小写字母',
  MISSING_DIGIT: '密码需包含至少 1 个数字',
  MISSING_SPECIAL: `密码需包含至少 1 个特殊字符（${PASSWORD_ALLOWED_SPECIALS}）`,
  CONTAINS_USERNAME: '密码不能包含用户名',
}

export function describeViolation(violation: PasswordPolicyViolation): string {
  return VIOLATION_MESSAGES[violation]
}
