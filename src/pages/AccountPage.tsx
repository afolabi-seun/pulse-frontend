import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { useAuth } from '../hooks/useAuth';
import { useChangePassword } from '../api/auth';
import { useMyAuditLog } from '../api/auditLog';
import { applyServerErrors } from '../lib/formErrors';
import PageHeader from '../components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Button from '../components/ui/Button';
import PasswordStrengthIndicator from '../components/ui/PasswordStrengthIndicator';
import { formatDateTime } from '../lib/dates';

interface ChangePasswordForm {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

function actionDotClass(action: string): string {
  const verb = action.split('.')[1] ?? '';
  if (/created|added|granted|imported|activated/.test(verb)) return 'bg-emerald-500';
  if (/updated|edited|changed|calibrated/.test(verb))        return 'bg-blue-500';
  if (/deleted|removed|revoked/.test(verb))                  return 'bg-red-500';
  if (/login|logout|password|locked/.test(action))           return 'bg-violet-500';
  if (/completed|done/.test(verb))                           return 'bg-gray-400';
  return 'bg-muted-foreground/30';
}

function formatAction(action: string): string {
  return action
    .split('.')
    .map((s) => s.replace(/_/g, ' '))
    .join(' · ');
}

export default function AccountPage() {
  const { currentUser } = useAuth();
  const changePassword = useChangePassword();
  const { data: activity, isLoading: activityLoading } = useMyAuditLog(20);

  const { register, handleSubmit, watch, reset, setError, formState: { errors } } = useForm<ChangePasswordForm>();
  const newPasswordValue = watch('newPassword', '');

  const onSubmit = handleSubmit((values) => {
    if (values.newPassword !== values.confirmPassword) {
      setError('confirmPassword', { message: 'Passwords do not match.' });
      return;
    }
    changePassword.mutate(
      { currentPassword: values.currentPassword, newPassword: values.newPassword },
      {
        onSuccess: () => { toast.success('Password changed successfully.'); reset(); },
        onError: (e) => applyServerErrors(e, setError),
      },
    );
  });

  return (
    <div className="max-w-2xl">
      <PageHeader title="My Account" />

      {/* Profile */}
      <Card className="mb-5">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Name</p>
              <p className="mt-1 font-medium text-foreground">{currentUser?.name}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Email</p>
              <p className="mt-1 font-medium text-foreground">{currentUser?.email}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Role</p>
              <p className="mt-1 font-medium text-foreground capitalize">{currentUser?.role.replace(/_/g, ' ')}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Change password */}
      <Card className="mb-5">
        <CardHeader className="pb-4"><CardTitle className="text-sm">Change Password</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="currentPassword">Current password</Label>
              <Input
                id="currentPassword"
                type="password"
                autoComplete="current-password"
                {...register('currentPassword', { required: 'Current password is required.' })}
              />
              {errors.currentPassword && <p className="text-xs text-destructive">{errors.currentPassword.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="newPassword">New password</Label>
              <Input
                id="newPassword"
                type="password"
                autoComplete="new-password"
                {...register('newPassword', {
                  required: 'New password is required.',
                  minLength: { value: 12, message: 'Must be at least 12 characters.' },
                })}
              />
              {newPasswordValue && <PasswordStrengthIndicator value={newPasswordValue} />}
              {errors.newPassword && <p className="text-xs text-destructive">{errors.newPassword.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirmPassword">Confirm new password</Label>
              <Input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                {...register('confirmPassword', { required: 'Please confirm your new password.' })}
              />
              {errors.confirmPassword && <p className="text-xs text-destructive">{errors.confirmPassword.message}</p>}
            </div>

            <Button type="submit" size="sm" loading={changePassword.isPending}>Change password</Button>
          </form>
        </CardContent>
      </Card>

      {/* My activity */}
      <Card className="overflow-hidden">
        <CardHeader className="pb-3 pt-4">
          <CardTitle className="text-sm">My Activity</CardTitle>
          <p className="text-xs text-muted-foreground">Your 20 most recent actions in Pulse.</p>
        </CardHeader>
        <CardContent className="p-0">
          {activityLoading && (
            <div className="space-y-3 p-5">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="h-2 w-2 shrink-0 rounded-full bg-muted" />
                  <div className="h-3 flex-1 rounded bg-muted" />
                  <div className="h-3 w-28 rounded bg-muted" />
                </div>
              ))}
            </div>
          )}

          {!activityLoading && (!activity?.items.length) && (
            <p className="px-5 py-6 text-center text-xs text-muted-foreground">No activity recorded yet.</p>
          )}

          {!activityLoading && !!activity?.items.length && (
            <ul className="divide-y divide-border">
              {activity.items.map((entry) => (
                <li key={entry.id} className="flex items-start gap-3 px-4 py-2.5">
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${actionDotClass(entry.action)}`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm capitalize text-foreground">{formatAction(entry.action)}</p>
                    {entry.detail && (
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">{entry.detail}</p>
                    )}
                  </div>
                  <time className="shrink-0 text-[11px] text-muted-foreground tabular-nums">
                    {formatDateTime(entry.ts)}
                  </time>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
