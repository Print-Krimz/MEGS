import type { ReactNode } from 'react';
import { AlertTriangle, Info, X } from 'lucide-react';
import { cn } from '../../lib/utils';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  description: ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'primary' | 'warning';
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  isOpen,
  title,
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'primary',
  isLoading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!isOpen) return null;

  const variantStyles = {
    danger: {
      button: 'bg-rose-600 hover:bg-rose-700 text-white focus:ring-rose-500',
      iconBg: 'bg-rose-100 text-rose-600',
      Icon: AlertTriangle,
    },
    warning: {
      button: 'bg-amber-600 hover:bg-amber-700 text-white focus:ring-amber-500',
      iconBg: 'bg-amber-100 text-amber-600',
      Icon: AlertTriangle,
    },
    primary: {
      button: 'bg-teal-700 hover:bg-teal-800 text-white focus:ring-teal-500',
      iconBg: 'bg-teal-100 text-teal-700',
      Icon: Info,
    },
  };

  const currentVariant = variantStyles[variant];
  const { Icon } = currentVariant;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs transition-opacity duration-200"
    >
      <div
        data-testid="confirm-dialog"
        className="w-full max-w-lg rounded-2xl p-6 sm:p-8 bg-card border border-border shadow-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      >
        <div>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className={cn('p-3 rounded-full flex-shrink-0', currentVariant.iconBg)}>
                <Icon className="w-5 h-5 stroke-[2]" />
              </div>
              <div className="space-y-1">
                <h3 id="confirm-dialog-title" className="text-lg font-bold text-foreground tracking-tight">
                  {title}
                </h3>
                <div className="text-sm text-muted-foreground leading-relaxed mt-2">
                  {description}
                </div>
              </div>
            </div>
            <button
              onClick={onCancel}
              disabled={isLoading}
              className="text-slate-400 hover:text-slate-600 transition-colors p-1.5 rounded-lg hover:bg-slate-100 focus:outline-none"
              aria-label="Close dialog"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="mt-8 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onCancel}
              disabled={isLoading}
              className="h-10 px-5 text-sm font-semibold text-slate-700 hover:bg-slate-100 rounded-lg border border-slate-300 transition duration-150 focus:outline-none focus:ring-2 focus:ring-slate-400"
            >
              {cancelText}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={isLoading}
              className={cn(
                'h-10 px-5 text-sm font-semibold rounded-lg shadow-sm transition duration-150 focus:outline-none focus:ring-2 disabled:opacity-50 inline-flex items-center justify-center gap-2',
                currentVariant.button
              )}
            >
              {isLoading && (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              )}
              <span>{confirmText}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
