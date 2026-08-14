import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Mail, Loader2, AlertCircle, CheckCircle2, ArrowLeft, KeyRound } from 'lucide-react';
import { authApi } from '../../lib/api/auth';

const forgotPasswordSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Email is required')
    .email('Please enter a valid email address'),
});

type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPasswordPage() {
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState('');
  const [debugLink, setDebugLink] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: '',
    },
    mode: 'onTouched',
  });

  const onSubmit = async (data: ForgotPasswordFormValues) => {
    setErrorMessage(null);
    setDebugLink(null);

    try {
      const response = await authApi.forgotPassword({
        email: data.email.trim().toLowerCase(),
      });

      setSubmittedEmail(data.email.trim());
      setIsSubmitted(true);

      if (response?.data?.debugResetLink) {
        setDebugLink(response.data.debugResetLink);
      }

      toast.success('Password reset instructions dispatched');
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unable to process password reset request. Please try again.';
      setErrorMessage(message);
      toast.error(message);
    }
  };

  const handleResetAnother = () => {
    setIsSubmitted(false);
    setSubmittedEmail('');
    setDebugLink(null);
    reset();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-1.5">
        <div className="inline-flex p-3 rounded-full bg-teal-50 text-teal-700 mx-auto mb-1">
          <KeyRound className="w-5 h-5" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground font-sans">
          Reset Password
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {isSubmitted
            ? 'Check your inbox for recovery instructions'
            : 'Enter your registered email and we’ll send a password recovery link'}
        </p>
      </div>

      {/* Global Error Alert */}
      {errorMessage && (
        <div
          data-testid="forgot-password-error-alert"
          role="alert"
          className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start space-x-3 text-sm text-red-700 animate-in fade-in duration-200"
        >
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1 font-medium leading-relaxed">{errorMessage}</div>
        </div>
      )}

      {/* Confirmation State */}
      {isSubmitted ? (
        <div
          data-testid="forgot-password-success-state"
          className="space-y-5 animate-in fade-in zoom-in-95 duration-200"
        >
          <div className="p-6 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2">
            <div className="flex items-center space-x-2 text-emerald-800 font-semibold text-sm">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
              <span>Reset link dispatched</span>
            </div>
            <p className="text-sm text-emerald-900/80 leading-relaxed">
              If an active account exists for <span className="font-semibold">{submittedEmail}</span>, a secure password reset link has been dispatched.
            </p>
          </div>

          {/* Dev Mode Action Link (if returned in dev) */}
          {debugLink && (
            <div className="p-3 bg-slate-900 text-slate-100 rounded-lg text-xs space-y-1.5 font-mono">
              <div className="text-xs uppercase tracking-wider text-teal-400 font-bold">
                Development Quick Access
              </div>
              <a
                href={debugLink}
                className="block text-teal-300 hover:text-teal-200 underline break-all"
              >
                Open Reset Link
              </a>
            </div>
          )}

          <div className="space-y-2.5 pt-2">
            <Link
              to="/login"
              className="w-full h-11 text-base font-semibold rounded-lg bg-teal-700 text-white hover:bg-teal-800 shadow-xs flex items-center justify-center space-x-2 transition"
            >
              <span>Return to Sign In</span>
            </Link>

            <button
              type="button"
              onClick={handleResetAnother}
              className="w-full h-10 py-2 px-4 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-medium text-sm rounded-lg transition flex items-center justify-center"
            >
              Send to another email
            </button>
          </div>
        </div>
      ) : (
        /* Form State */
        <form
          onSubmit={handleSubmit(onSubmit)}
          data-testid="forgot-password-form"
          noValidate
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <label
              htmlFor="email"
              className="block text-sm font-medium text-slate-700 mb-1.5"
            >
              Registered Email Address
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

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full h-11 text-base font-semibold rounded-lg bg-teal-700 text-white hover:bg-teal-800 shadow-xs flex items-center justify-center space-x-2 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:ring-offset-1 disabled:opacity-60 disabled:cursor-not-allowed transition duration-150 mt-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Sending Recovery Link...</span>
              </>
            ) : (
              <span>Send Recovery Link</span>
            )}
          </button>

          <div className="pt-2 text-center">
            <Link
              to="/login"
              className="inline-flex items-center space-x-1.5 text-sm text-slate-600 hover:text-teal-700 font-medium transition"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Sign In</span>
            </Link>
          </div>
        </form>
      )}
    </div>
  );
}
