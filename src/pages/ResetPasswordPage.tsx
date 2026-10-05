import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useSearchParams } from 'react-router-dom';
import { useConfirmPasswordReset } from '../api/auth';
import { ApiError } from '../lib/errors';
import { PASSWORD_RULES } from '../lib/passwordValidation';
import AuthShell from '../components/layout/AuthShell';
import Button from '../components/ui/Button';
import PasswordStrengthIndicator from '../components/ui/PasswordStrengthIndicator';
import { KeyRound, Lock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface FormValues { newPassword: string; confirmPassword: string; }

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const { mutate, isPending } = useConfirmPasswordReset();
  const [done, setDone] = useState(false);

  const { register, handleSubmit, watch, setError, formState: { errors } } = useForm<FormValues>();
  const passwordValue = watch('newPassword') ?? '';

  const onSubmit = (values: FormValues) => {
    mutate({ token, newPassword: values.newPassword }, {
      onSuccess: () => setDone(true),
      onError: (err) => {
        const msg =
          err instanceof ApiError && err.code === 'BREACHED_PASSWORD'
            ? 'This password has been found in a data breach. Please choose a different one.'
            : err instanceof ApiError && err.code === 'INVALID_TOKEN'
            ? 'This reset link is invalid or has expired. Please request a new one.'
            : 'Something went wrong. Please try again.';
        setError('root', { message: msg });
      },
    });
  };

  if (!token) {
    return (
      <AuthShell>
        <Card className="page-transition rounded-2xl border-border/60 shadow-xl shadow-black/[0.03] dark:shadow-black/20">
          <CardContent className="px-6 pb-6 pt-6 text-center">
            <p className="text-sm text-destructive">Invalid reset link. Please request a new one.</p>
            <p className="mt-4 text-sm">
              <Link to="/forgot-password" className="font-medium text-primary hover:underline">Request new link</Link>
            </p>
          </CardContent>
        </Card>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <Card className="page-transition rounded-2xl border-border/60 shadow-xl shadow-black/[0.03] dark:shadow-black/20">
        {done ? (
          <CardContent className="px-6 pb-6 pt-6">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500 shadow-sm">
              <KeyRound className="h-5 w-5 text-white" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Password updated</h1>
            <p className="mt-2 text-sm text-muted-foreground">Your password has been set. You can now sign in.</p>
            <p className="mt-6 text-center text-sm">
              <Link to="/login" className="font-medium text-primary hover:underline">Sign in</Link>
            </p>
          </CardContent>
        ) : (
          <CardContent className="px-6 pb-6 pt-6">
            <div className="mb-6">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">Set your password</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                At least 12 characters with uppercase, lowercase, and a number.
              </p>
            </div>
            <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
              {errors.root && (
                <div role="alert" className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  {errors.root.message}
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="newPassword">New password</Label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute inset-y-0 left-3 my-auto h-4 w-4 text-muted-foreground" />
                  <Input id="newPassword" type="password" autoComplete="new-password" autoFocus
                    className="pl-9"
                    {...register('newPassword', PASSWORD_RULES)} />
                </div>
                <PasswordStrengthIndicator value={passwordValue} />
                {errors.newPassword && <p className="text-xs text-destructive">{errors.newPassword.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirmPassword">Confirm password</Label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute inset-y-0 left-3 my-auto h-4 w-4 text-muted-foreground" />
                  <Input
                    id="confirmPassword" type="password" autoComplete="new-password"
                    className="pl-9"
                    {...register('confirmPassword', {
                      required: 'Please confirm your password',
                      validate: (v) => v === watch('newPassword') || 'Passwords do not match',
                    })}
                  />
                </div>
                {errors.confirmPassword && <p className="text-xs text-destructive">{errors.confirmPassword.message}</p>}
              </div>
              <Button type="submit" className="w-full" loading={isPending}>
                {isPending ? 'Setting password…' : 'Set password'}
              </Button>
            </form>
          </CardContent>
        )}
      </Card>
    </AuthShell>
  );
}
