import { useState, useMemo } from 'react';
import { Link, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Eye, EyeOff, Lock, Loader2, AlertCircle, ShieldCheck, ArrowLeft, ShieldAlert } from 'lucide-react';
import { authApi } from '../../lib/api/auth';

const setupAccountSchema = z
  .object({
    password: z
      .string()
      .min(1, 'Password is required')
      .min(8, 'Password must be at least 8 characters'),
    confirmPassword: z
      .string()
      .min(1, 'Please confirm your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type SetupAccountFormValues = z.infer<typeof setupAccountSchema>;

export default function SetupAccountPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const location = useLocation();

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Extract token from either query params or hash fragments
  const token = useMemo(() => {
    const queryToken = searchParams.get('token') || searchParams.get('access_token');
    if (queryToken) return queryToken;

    if (location.hash) {
      const hashParams = new URLSearchParams(location.hash.replace(/^#/, ''));
      return hashParams.get('access_token') || hashParams.get('token');
    }
    return null;
  }, [searchParams, location.hash]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SetupAccountFormValues>({
    resolver: zodResolver(setupAccountSchema),
    defaultValues: {
      password: '',
      confirmPassword: '',
    },
    mode: 'onTouched',
  });

  const onSubmit = async (data: SetupAccountFormValues) => {
    if (!token) {
      setErrorMessage('Missing invitation token. Please check your activation email.');
      return;
    }

    setErrorMessage(null);
    try {
      await authApi.setupAccount({
        token,
        password: data.password,
      });

      toast.success('Account setup completed successfully! Please sign in with your credentials.');
      navigate('/login', { replace: true });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to activate account. The invitation link may have expired or already been used.';
      setErrorMessage(message);
      toast.error(message);
    }
  };

  // Missing / Invalid Token State
  if (!token) {
    return (
      <div
        className="p-6 rounded-xl bg-amber-50 border border-amber-200 text-center space-y-5"
        data-testid="setup-account-missing-token"
      >
        <div className="inline-flex p-3 rounded-full bg-amber-100 text-amber-700 mx-auto">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <div className="space-y-2">
          <h1 className="text-xl font-bold tracking-tight text-foreground font-sans">
            Invalid or Missing Invitation Link
          </h1>
          <p className="text-sm font-medium text-amber-900/80 max-w-sm mx-auto leading-relaxed">
            This account activation link is invalid, incomplete, or has already been used. Please contact your system administrator for a new invitation.
          </p>
        </div>

        <div className="pt-2">
          <Link
            to="/login"
            className="w-full h-11 inline-flex items-center justify-center py-2.5 px-4 bg-teal-700 hover:bg-teal-800 text-white font-semibold text-sm rounded-lg shadow-sm transition"
          >
            Go to Sign In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-1.5">
        <div className="inline-flex p-3 rounded-full bg-teal-50 text-teal-700 mx-auto mb-1">
          <ShieldCheck className="w-5 h-5" />
        </div>
        <div>
          <span className="inline-block px-2.5 py-0.5 rounded-full bg-teal-100 text-teal-800 text-xs font-mono font-semibold uppercase tracking-wider mb-1">
            Staff Invitation
          </span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground font-sans">
          Setup Your Account
        </h1>
        <p className="text-sm text-muted-foreground max-w-sm mx-auto mt-1 leading-relaxed">
          Welcome to MEGS. Set a secure password to activate your staff account and access recruitment operations.
        </p>
      </div>

      {/* Global Error Alert */}
      {errorMessage && (
        <div
          data-testid="setup-account-error-alert"
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
        data-testid="setup-account-form"
        noValidate
        className="space-y-4"
      >
        {/* Create Password Field */}
        <div className="space-y-1.5">
          <label
            htmlFor="password"
            className="block text-sm font-medium text-slate-700 mb-1.5"
          >
            Create Password
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Lock className="w-4 h-4" />
            </div>
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              disabled={isSubmitting}
              placeholder="At least 8 characters"
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

        {/* Confirm Password Field */}
        <div className="space-y-1.5">
          <label
            htmlFor="confirmPassword"
            className="block text-sm font-medium text-slate-700 mb-1.5"
          >
            Confirm Password
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Lock className="w-4 h-4" />
            </div>
            <input
              id="confirmPassword"
              type={showConfirmPassword ? 'text' : 'password'}
              autoComplete="new-password"
              disabled={isSubmitting}
              placeholder="Repeat your password"
              {...register('confirmPassword')}
              className={`w-full h-11 pl-10 pr-10 text-sm bg-background border rounded-lg shadow-xs placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-600 transition ${
                errors.confirmPassword
                  ? 'border-red-400 focus:border-red-500 focus:ring-red-200 bg-red-50/20'
                  : 'border-border focus:border-teal-600 focus:ring-teal-100'
              } disabled:opacity-50 disabled:bg-slate-50`}
            />
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShowConfirmPassword((prev) => !prev)}
              aria-label={showConfirmPassword ? 'Hide confirm password visibility' : 'Show confirm password visibility'}
              className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none"
            >
              {showConfirmPassword ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          </div>
          {errors.confirmPassword && (
            <p
              id="confirmPassword-error"
              role="alert"
              className="text-xs text-red-600 font-medium mt-1"
            >
              {errors.confirmPassword.message}
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
              <span>Activating Account...</span>
            </>
          ) : (
            <span>Activate Account</span>
          )}
        </button>
      </form>

      {/* Back to Login Link */}
      <div className="pt-2 text-center">
        <Link
          to="/login"
          className="inline-flex items-center space-x-1.5 text-sm text-slate-600 hover:text-teal-700 font-medium transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Sign In</span>
        </Link>
      </div>
    </div>
  );
}
