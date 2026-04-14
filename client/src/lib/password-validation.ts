export interface PasswordStrength {
  hasLength: boolean;
  hasUppercase: boolean;
  hasNumber: boolean;
}

export function validatePassword(password: string): PasswordStrength {
  return {
    hasLength: password.length >= 8,
    hasUppercase: /[A-Z]/.test(password),
    hasNumber: /[0-9]/.test(password),
  };
}

export function isPasswordValid(v: PasswordStrength): boolean {
  return v.hasLength && v.hasUppercase && v.hasNumber;
}
