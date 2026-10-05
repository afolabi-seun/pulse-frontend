import { useForm } from 'react-hook-form';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Lock, Mail, User } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useBootstrap } from '../api/auth';
import { ApiError } from '../lib/errors';
import { PASSWORD_RULES } from '../lib/passwordValidation';
import AuthShell from '../components/layout/AuthShell';
import Button from '../components/ui/Button';
import PasswordStrengthIndicator from '../components/ui/PasswordStrengthIndicator';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface FormValues { name: string; email: string; password: string; confirmPassword: string; }

export default function SetupPage() {
  const { currentUser, login } = useAuth();
  const navigate = useNavigate();
  const { mutate, isPending } = useBootstrap();

  const { register, handleSubmit, watch, setError, formState: { errors } } = useForm<FormValues>();

  if (currentUser) return <Navigate to="/dashboard" replace />;

  const passwordValue = watch('password') ?? '';

  const onSubmit = (values: FormValues) => {
    mutate({ name: values.name, email: values.email, password: values.password }, {
      onSuccess: (dto) => { login(dto); navigate('/dashboard', { replace: true }); },
      onError: (err) => {
        const msg = err instanceof ApiError && err.code === 'CONFLICT'
          ? 'This instance is already set up. Sign in instead.'
          : 'Something went wrong. Please try again.';
        setError('root', { message: msg });
      },
    });
  };

  return (
    <AuthShell>
      <Card className="page-transition rounded-2xl border-border/60 shadow-xl shadow-black/[0.03] dark:shadow-black/20">
        <CardContent className="px-6 pb-6 pt-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Set up your account</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Create the Head of R&amp;D account. You can invite your team after signing in.
            </p>
          </div>
          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
            {errors.root && (
              <div role="alert" className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {errors.root.message}
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="name">Full name</Label>
              <div className="relative">
                <User className="pointer-events-none absolute inset-y-0 left-3 my-auto h-4 w-4 text-muted-foreground" />
                <Input id="name" autoComplete="name" autoFocus
                  className="pl-9"
                  {...register('name', { required: 'Name is required' })} />
              </div>
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute inset-y-0 left-3 my-auto h-4 w-4 text-muted-foreground" />
                <Input id="email" type="email" autoComplete="email"
                  className="pl-9"
                  {...register('email', { required: 'Email is required' })} />
              </div>
              {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute inset-y-0 left-3 my-auto h-4 w-4 text-muted-foreground" />
                <Input id="password" type="password" autoComplete="new-password"
                  className="pl-9"
                  {...register('password', PASSWORD_RULES)} />
              </div>
              <PasswordStrengthIndicator value={passwordValue} />
              {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
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
                    validate: (v) => v === watch('password') || 'Passwords do not match',
                  })}
                />
              </div>
              {errors.confirmPassword && <p className="text-xs text-destructive">{errors.confirmPassword.message}</p>}
            </div>
            <Button type="submit" className="w-full" loading={isPending}>
              {isPending ? 'Creating account…' : 'Create account'}
            </Button>
          </form>
          <p className="mt-6 text-center text-sm text-muted-foreground">
            Already set up?{' '}
            <Link to="/login" className="font-medium text-primary hover:underline">Sign in</Link>
          </p>
        </CardContent>
      </Card>
    </AuthShell>
  );
}
