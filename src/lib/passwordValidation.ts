export const PASSWORD_RULES = {
  required: 'Password is required',
  minLength: { value: 12, message: 'At least 12 characters' },
  validate: {
    uppercase: (v: string) => /[A-Z]/.test(v) || 'At least one uppercase letter',
    lowercase: (v: string) => /[a-z]/.test(v) || 'At least one lowercase letter',
    digit:     (v: string) => /[0-9]/.test(v) || 'At least one number',
  },
};

export function passwordStrength(value: string): 'weak' | 'good' | 'strong' {
  if (!value || value.length < 12) return 'weak';
  const passed = [/[A-Z]/.test(value), /[a-z]/.test(value), /[0-9]/.test(value)].filter(Boolean).length;
  if (passed === 3) return 'strong';
  if (passed >= 2) return 'good';
  return 'weak';
}
