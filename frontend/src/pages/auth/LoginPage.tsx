import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Eye, EyeOff, Lock, Mail, Loader2, AlertCircle, KeyRound } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Please enter a valid email address'),
  password: z
    .string()
    .min(1, 'Password is required')
    .min(8, 'Password must be at least 8 characters'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
    mode: 'onTouched',
  });

  const onSubmit = async (data: LoginFormValues) => {
    setErrorMessage(null);
    try {
      const session = await login({
        email: data.email.trim(),
        password: data.password,
      });

      toast.success('Signed in successfully');

      if (session?.user?.mustChangePassword) {
        navigate('/change-password', { replace: true });
        return;
      }

      const searchRedirect = new URLSearchParams(location.search).get('redirect');
      const stateFrom = (location.state as { from?: { pathname?: string } })?.from?.pathname;
      const target = stateFrom || searchRedirect;
      navigate(target || '/', { replace: true });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Invalid credentials. Please check your email and password.';
      setErrorMessage(message);
      toast.error(message);
    }
  };

  const handleDemoFill = (email: string, pass: string) => {
    setValue('email', email, { shouldValidate: true });
    setValue('password', pass, { shouldValidate: true });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-1.5">
        <h1 className="text-2xl font-bold tracking-tight text-foreground font-sans">
          Sign In
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Enter your credentials to access your MEGS workspace
        </p>
      </div>

      {/* Global Banner Error Alert */}
      {errorMessage && (
        <div
          data-testid="login-error-alert"
          role="alert"
          className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start space-x-3 text-sm text-red-700 animate-in fade-in duration-200"
        >
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1 font-medium leading-relaxed">{errorMessage}</div>
        </div>
      )}

      {/* Form */}
      <form
        onSubmit={handleSubmit(onSubmit)}
        data-testid="login-form"
        noValidate
        className="space-y-4"
      >
        {/* Email Field */}
        <div className="space-y-1.5">
          <label
            htmlFor="email"
            className="block text-sm font-medium text-slate-700 mb-1.5"
          >
            Email Address
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Mail className="w-4 h-4" />
            </div>
            <input
              id="email"
              type="email"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              disabled={isSubmitting}
              placeholder="name@company.com"
              {...register('email')}
              className={`w-full h-11 pl-10 pr-3.5 text-sm bg-background border rounded-lg shadow-xs placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-600 transition ${
                errors.email
                  ? 'border-red-400 focus:border-red-500 focus:ring-red-200 bg-red-50/20'
                  : 'border-border focus:border-teal-600 focus:ring-teal-100'
              } disabled:opacity-50 disabled:bg-slate-50`}
            />
          </div>
          {errors.email && (
            <p
              id="email-error"
              role="alert"
              className="text-xs text-red-600 font-medium mt-1"
            >
              {errors.email.message}
            </p>
          )}
        </div>

        {/* Password Field */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between mb-1.5">
            <label
              htmlFor="password"
              className="block text-sm font-medium text-slate-700"
            >
              Password
            </label>
            <Link
              to="/forgot-password"
              className="text-sm font-medium text-teal-700 hover:text-teal-800 hover:underline transition"
            >
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Lock className="w-4 h-4" />
            </div>
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              disabled={isSubmitting}
              placeholder="••••••••"
              {...register('password')}
              className={`w-full h-11 pl-10 pr-10 text-sm bg-background border rounded-lg shadow-xs placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-600 transition ${
                errors.password
                  ? 'border-red-400 focus:border-red-500 focus:ring-red-200 bg-red-50/20'
                  : 'border-border focus:border-teal-600 focus:ring-teal-100'
              } disabled:opacity-50 disabled:bg-slate-50`}
            />
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? 'Hide password visibility' : 'Show password visibility'}
              className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none"
            >
              {showPassword ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          </div>
          {errors.password && (
            <p
              id="password-error"
              role="alert"
              className="text-xs text-red-600 font-medium mt-1"
            >
              {errors.password.message}
            </p>
          )}
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full h-11 text-base font-semibold rounded-lg bg-teal-700 text-white hover:bg-teal-800 shadow-xs flex items-center justify-center space-x-2 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:ring-offset-1 disabled:opacity-60 disabled:cursor-not-allowed transition duration-150 mt-2"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Signing In...</span>
            </>
          ) : (
            <span>Sign In</span>
          )}
        </button>
      </form>

      {/* Demo Quick Logins */}
      <div className="pt-3 border-t border-slate-100">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 text-center">
          Demo Quick Credentials
        </p>
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => handleDemoFill('admin@megs-recruitment.com', 'AdminPassword123!')}
            className="text-xs py-1.5 px-3 font-medium rounded-lg border border-border bg-slate-50 hover:bg-slate-100 text-slate-700 transition text-center truncate"
          >
            Admin
          </button>
          <button
            type="button"
            onClick={() => handleDemoFill('ta@megs.io', 'Password123!')}
            className="text-xs py-1.5 px-3 font-medium rounded-lg border border-border bg-slate-50 hover:bg-slate-100 text-slate-700 transition text-center truncate"
          >
            TA Officer
          </button>
          <button
            type="button"
            onClick={() => handleDemoFill('applicant@megs.io', 'Password123!')}
            className="text-xs py-1.5 px-3 font-medium rounded-lg border border-border bg-slate-50 hover:bg-slate-100 text-slate-700 transition text-center truncate"
          >
            Applicant
          </button>
        </div>
      </div>

      {/* Footer Navigation */}
      <div className="pt-2 border-t border-slate-100 text-center text-sm">
        <span className="text-muted-foreground">Don&apos;t have an account? </span>
        <Link
          to="/register"
          className="text-teal-700 hover:text-teal-800 hover:underline font-semibold transition"
        >
          Create an Account
        </Link>
      </div>
    </div>
  );
}
