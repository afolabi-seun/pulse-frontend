import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Lock, Mail } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useLogin } from '../api/auth';
import { ApiError } from '../lib/errors';
import AuthShell from '../components/layout/AuthShell';
import Button from '../components/ui/Button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface FormValues { email: string; password: string; }

export default function LoginPage() {
  const { currentUser, login } = useAuth();
  const navigate = useNavigate();
  const { mutate, isPending } = useLogin();
  const [showPassword, setShowPassword] = useState(false);

  const { register, handleSubmit, setError, formState: { errors } } = useForm<FormValues>();

  if (currentUser) return <Navigate to="/dashboard" replace />;

  const onSubmit = (values: FormValues) => {
    mutate(values, {
      onSuccess: (dto) => { login(dto); navigate('/dashboard', { replace: true }); },
      onError: (err) => {
        const msg =
          err instanceof ApiError && err.code === 'ACCOUNT_LOCKED'
            ? 'Account is locked. Try again in 15 minutes or contact your administrator.'
            : 'Invalid email or password.';
        setError('root', { message: msg });
      },
    });
  };

  return (
    <AuthShell>
      <Card className="page-transition rounded-2xl border-border/60 shadow-xl shadow-black/[0.03] dark:shadow-black/20">
        <CardContent className="px-6 pb-6 pt-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Sign in</h1>
            <p className="mt-1 text-sm text-muted-foreground">Welcome back to Pulse.</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
            {errors.root && (
              <div role="alert" className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {errors.root.message}
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute inset-y-0 left-3 my-auto h-4 w-4 text-muted-foreground" />
                <Input id="email" type="email" autoComplete="email" autoFocus
                  className="pl-9"
                  {...register('email', { required: 'Email is required' })} />
              </div>
              {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link to="/forgot-password" className="text-xs text-muted-foreground hover:text-primary">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Lock className="pointer-events-none absolute inset-y-0 left-3 my-auto h-4 w-4 text-muted-foreground" />
                <Input id="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password"
                  className="pl-9 pr-9"
                  {...register('password', { required: 'Password is required' })} />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
            </div>

            <Button type="submit" className="w-full" loading={isPending}>
              {isPending ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>

        </CardContent>
      </Card>
    </AuthShell>
  );
}
