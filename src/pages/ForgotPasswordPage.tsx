import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { Mail } from 'lucide-react';
import { useRequestPasswordReset } from '../api/auth';
import AuthShell from '../components/layout/AuthShell';
import Button from '../components/ui/Button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface FormValues { email: string; }

export default function ForgotPasswordPage() {
  const { mutate, isPending } = useRequestPasswordReset();
  const [submitted, setSubmitted] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>();

  const onSubmit = (values: FormValues) => {
    mutate(values.email, { onSettled: () => setSubmitted(true) });
  };

  return (
    <AuthShell>
      <Card className="page-transition rounded-2xl border-border/60 shadow-xl shadow-black/[0.03] dark:shadow-black/20">
        {submitted ? (
          <CardContent className="px-6 pb-6 pt-6">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500 shadow-sm">
              <Mail className="h-5 w-5 text-white" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Check your email</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              If that address is registered, you'll receive a reset link shortly. The link expires in 1 hour.
            </p>
            <p className="mt-6 text-center text-sm">
              <Link to="/login" className="font-medium text-primary hover:underline">Back to sign in</Link>
            </p>
          </CardContent>
        ) : (
          <CardContent className="px-6 pb-6 pt-6">
            <div className="mb-6">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">Forgot your password?</h1>
              <p className="mt-1 text-sm text-muted-foreground">Enter your email and we'll send you a reset link.</p>
            </div>
            <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
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
              <Button type="submit" className="w-full" loading={isPending}>
                {isPending ? 'Sending…' : 'Send reset link'}
              </Button>
            </form>
            <p className="mt-6 text-center text-sm">
              <Link to="/login" className="font-medium text-primary hover:underline">Back to sign in</Link>
            </p>
          </CardContent>
        )}
      </Card>
    </AuthShell>
  );
}
