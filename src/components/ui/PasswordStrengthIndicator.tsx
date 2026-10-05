import { passwordStrength } from '../../lib/passwordValidation';

const CONFIG = {
  weak:   { bars: 1, color: 'bg-red-500',    label: 'Weak',   text: 'text-red-600'    },
  good:   { bars: 2, color: 'bg-yellow-400', label: 'Good',   text: 'text-yellow-600' },
  strong: { bars: 3, color: 'bg-green-500',  label: 'Strong', text: 'text-green-600'  },
};

export default function PasswordStrengthIndicator({ value }: { value: string }) {
  if (!value) return null;
  const level = passwordStrength(value);
  const { bars, color, label, text } = CONFIG[level];

  return (
    <div className="mt-2" aria-live="polite" aria-label={`Password strength: ${label}`}>
      <div className="flex gap-1">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full transition-colors duration-200 ${i <= bars ? color : 'bg-gray-200'}`}
          />
        ))}
      </div>
      <p className={`mt-1 text-xs font-medium ${text}`}>{label}</p>
    </div>
  );
}
