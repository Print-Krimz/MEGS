import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Eye, EyeOff, Lock, Mail, User, Loader2, AlertCircle, CheckCircle2, Shield } from 'lucide-react';
import { authApi } from '../../lib/api/auth';

const registerSchema = z
  .object({
    firstName: z
      .string()
      .trim()
      .min(1, 'First name is required')
      .max(50, 'First name is too long'),
    lastName: z
      .string()
      .trim()
      .min(1, 'Last name is required')
      .max(50, 'Last name is too long'),
    email: z
      .string()
      .trim()
      .min(1, 'Email is required')
      .email('Please enter a valid email address'),
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

type RegisterFormValues = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
    mode: 'onTouched',
  });

  const currentPassword = watch('password') || '';

  const onSubmit = async (data: RegisterFormValues) => {
    setErrorMessage(null);
    try {
      await authApi.register({
        email: data.email.trim().toLowerCase(),
        password: data.password,
      });

      toast.success('Account created successfully! Please sign in with your new credentials.');
      navigate('/login', { replace: true });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to create account. Please try again.';
      setErrorMessage(message);
      toast.error(message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-1.5">
        <h1 className="text-2xl font-bold tracking-tight text-foreground font-sans">
          Create an Account
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Register as an applicant to apply for roles and track your recruitment status
        </p>
      </div>

      {/* Global Error Alert */}
      {errorMessage && (
        <div
          data-testid="register-error-alert"
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
        data-testid="register-form"
        noValidate
        className="space-y-4"
      >
        {/* Name Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* First Name */}
          <div className="space-y-1.5">
            <label
              htmlFor="firstName"
              className="block text-sm font-medium text-slate-700 mb-1.5"
            >
              First Name
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <User className="w-4 h-4" />
              </div>
              <input
                id="firstName"
                type="text"
                disabled={isSubmitting}
                placeholder="Juan"
                {...register('firstName')}
                className={`w-full h-11 pl-10 pr-3.5 text-sm bg-background border rounded-lg shadow-xs placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-600 transition ${
                  errors.firstName
                    ? 'border-red-400 focus:border-red-500 focus:ring-red-200 bg-red-50/20'
                    : 'border-border focus:border-teal-600 focus:ring-teal-100'
                } disabled:opacity-50 disabled:bg-slate-50`}
              />
            </div>
            {errors.firstName && (
              <p
                id="firstName-error"
                role="alert"
                className="text-xs text-red-600 font-medium mt-1"
              >
                {errors.firstName.message}
              </p>
            )}
          </div>

          {/* Last Name */}
          <div className="space-y-1.5">
            <label
              htmlFor="lastName"
              className="block text-sm font-medium text-slate-700 mb-1.5"
            >
              Last Name
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <User className="w-4 h-4" />
              </div>
              <input
                id="lastName"
                type="text"
                disabled={isSubmitting}
                placeholder="Dela Cruz"
                {...register('lastName')}
                className={`w-full h-11 pl-10 pr-3.5 text-sm bg-background border rounded-lg shadow-xs placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-600 transition ${
                  errors.lastName
                    ? 'border-red-400 focus:border-red-500 focus:ring-red-200 bg-red-50/20'
                    : 'border-border focus:border-teal-600 focus:ring-teal-100'
                } disabled:opacity-50 disabled:bg-slate-50`}
              />
            </div>
            {errors.lastName && (
              <p
                id="lastName-error"
                role="alert"
                className="text-xs text-red-600 font-medium mt-1"
              >
                {errors.lastName.message}
              </p>
            )}
          </div>
        </div>

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
              placeholder="juan.delacruz@example.com"
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
          <label
            htmlFor="password"
            className="block text-sm font-medium text-slate-700 mb-1.5"
          >
            Password
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
          {/* Password requirement hint */}
          <div className="flex items-center gap-1.5 text-xs text-slate-600 font-medium pt-0.5">
            <CheckCircle2
              className={`w-4 h-4 flex-shrink-0 transition-colors ${
                currentPassword.length >= 8 ? 'text-teal-600' : 'text-slate-400'
              }`}
            />
            <span>Password must be at least 8 characters</span>
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
              <span>Creating Account...</span>
            </>
          ) : (
            <span>Create Account</span>
          )}
        </button>
      </form>

      {/* Footer Navigation */}
      <div className="pt-2 border-t border-slate-100 text-center text-sm">
        <span className="text-muted-foreground">Already have an account? </span>
        <Link
          to="/login"
          className="text-teal-700 hover:text-teal-800 hover:underline font-semibold transition"
        >
          Sign In
        </Link>
      </div>
    </div>
  );
}
