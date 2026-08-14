import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Eye, EyeOff, Lock, Loader2, AlertCircle, KeyRound, ShieldAlert, LogOut, ArrowLeft } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { authApi } from '../../lib/api/auth';

const changePasswordSchema = z
  .object({
    currentPassword: z
      .string()
      .min(1, 'Current password is required'),
    newPassword: z
      .string()
      .min(1, 'New password is required')
      .min(8, 'New password must be at least 8 characters'),
    confirmPassword: z
      .string()
      .min(1, 'Please confirm your new password'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: 'New password must be different from your current password',
    path: ['newPassword'],
  });

type ChangePasswordFormValues = z.infer<typeof changePasswordSchema>;

export default function ChangePasswordPage() {
  const { user, session, mustChangePassword, setSession, logout } = useAuth();
  const navigate = useNavigate();

  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
    mode: 'onTouched',
  });

  const onSubmit = async (data: ChangePasswordFormValues) => {
    setErrorMessage(null);
    try {
      await authApi.changePassword({
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      });

      // Update AuthContext state: set mustChangePassword to false
      if (user) {
        const updatedUser = {
          ...user,
          mustChangePassword: false,
        };
        const currentToken = session?.access_token || localStorage.getItem('megs_access_token') || '';
        setSession({
          access_token: currentToken,
          refresh_token: session?.refresh_token || '',
          expires_in: session?.expires_in || 3600,
          user: updatedUser,
        });
      }

      toast.success('Password updated successfully!');
      navigate('/', { replace: true });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to change password. Please verify your current password.';
      setErrorMessage(message);
      toast.error(message);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login', { replace: true });
    } catch {
      navigate('/login', { replace: true });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-1.5">
        <div className="inline-flex p-3 rounded-full bg-teal-50 text-teal-700 mx-auto mb-1">
          <KeyRound className="w-5 h-5" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground font-sans">
          {mustChangePassword ? 'Password Update Required' : 'Change Password'}
        </h1>
        <p className="text-sm text-muted-foreground max-w-sm mx-auto mt-1 leading-relaxed">
          {mustChangePassword
            ? 'You are using a temporary or initial password and must set a new secure password before continuing.'
            : 'Update your account password. Choose a strong password of at least 8 characters.'}
        </p>
      </div>

      {/* Mandatory Change Notice */}
      {mustChangePassword && (
        <div
          data-testid="must-change-password-notice"
          className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start space-x-3 text-sm text-amber-800"
        >
          <ShieldAlert className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1 font-medium leading-relaxed">
            Security policy: System requires all temporary credentials to be updated upon initial sign-in.
          </div>
        </div>
      )}

      {/* Global Error Alert */}
      {errorMessage && (
        <div
          data-testid="change-password-error-alert"
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
        data-testid="change-password-form"
        noValidate
        className="space-y-4"
      >
        {/* Current Password Field */}
        <div className="space-y-1.5">
          <label
            htmlFor="currentPassword"
            className="block text-sm font-medium text-slate-700 mb-1.5"
          >
            Current Password
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Lock className="w-4 h-4" />
            </div>
            <input
              id="currentPassword"
              type={showCurrentPassword ? 'text' : 'password'}
              autoComplete="current-password"
              disabled={isSubmitting}
              placeholder="Enter current password"
              {...register('currentPassword')}
              className={`w-full h-11 pl-10 pr-10 text-sm bg-background border rounded-lg shadow-xs placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-600 transition ${
                errors.currentPassword
                  ? 'border-red-400 focus:border-red-500 focus:ring-red-200 bg-red-50/20'
                  : 'border-border focus:border-teal-600 focus:ring-teal-100'
              } disabled:opacity-50 disabled:bg-slate-50`}
            />
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShowCurrentPassword((prev) => !prev)}
              aria-label={showCurrentPassword ? 'Hide current password visibility' : 'Show current password visibility'}
              className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none"
            >
              {showCurrentPassword ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          </div>
          {errors.currentPassword && (
            <p
              id="currentPassword-error"
              role="alert"
              className="text-xs text-red-600 font-medium mt-1"
            >
              {errors.currentPassword.message}
            </p>
          )}
        </div>

        {/* New Password Field */}
        <div className="space-y-1.5">
          <label
            htmlFor="newPassword"
            className="block text-sm font-medium text-slate-700 mb-1.5"
          >
            New Password
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Lock className="w-4 h-4" />
            </div>
            <input
              id="newPassword"
              type={showNewPassword ? 'text' : 'password'}
              autoComplete="new-password"
              disabled={isSubmitting}
              placeholder="At least 8 characters"
              {...register('newPassword')}
              className={`w-full h-11 pl-10 pr-10 text-sm bg-background border rounded-lg shadow-xs placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-600 transition ${
                errors.newPassword
                  ? 'border-red-400 focus:border-red-500 focus:ring-red-200 bg-red-50/20'
                  : 'border-border focus:border-teal-600 focus:ring-teal-100'
              } disabled:opacity-50 disabled:bg-slate-50`}
            />
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShowNewPassword((prev) => !prev)}
              aria-label={showNewPassword ? 'Hide new password visibility' : 'Show new password visibility'}
              className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none"
            >
              {showNewPassword ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          </div>
          {errors.newPassword && (
            <p
              id="newPassword-error"
              role="alert"
              className="text-xs text-red-600 font-medium mt-1"
            >
              {errors.newPassword.message}
            </p>
          )}
        </div>

        {/* Confirm New Password Field */}
        <div className="space-y-1.5">
          <label
            htmlFor="confirmPassword"
            className="block text-sm font-medium text-slate-700 mb-1.5"
          >
            Confirm New Password
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
              placeholder="Repeat your new password"
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
              <span>Updating Password...</span>
            </>
          ) : (
            <span>Update Password</span>
          )}
        </button>
      </form>

      {/* Footer Navigation */}
      <div className="pt-2 text-center">
        {mustChangePassword ? (
          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex items-center space-x-1.5 text-sm text-slate-500 hover:text-red-600 font-medium transition"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign out and use another account</span>
          </button>
        ) : (
          <Link
            to="/"
            className="inline-flex items-center space-x-1.5 text-sm text-slate-600 hover:text-teal-700 font-medium transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Dashboard</span>
          </Link>
        )}
      </div>
    </div>
  );
}
