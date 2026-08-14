import { useState, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  FileCheck2,
  Plus,
  Trash2,
  ExternalLink,
  CheckCircle2,
  Clock,
  XCircle,
  AlertTriangle,
  Upload,
  Loader2,
  X,
  ShieldCheck,
} from 'lucide-react';
import { applicantApi } from '../../../lib/api/applicant';
import { ConfirmDialog } from '../../../components/common/ConfirmDialog';
import { AssetVerificationState } from '../../../lib/types/enums';
import type { Asset } from '../../../lib/types/api';

const DOCUMENT_CATEGORIES = [
  'NBI Clearance',
  'Police Clearance',
  'Barangay Clearance',
  'PSA Birth Certificate',
  'SSS E-1 / UMID / SSS ID',
  'PhilHealth Member Data Record (MDR)',
  'Pag-IBIG Member Identification (MID)',
  'BIR Form 1902 / 2316 / TIN ID',
  'Transcript of Records (TOR) / Diploma',
  'Medical / Fit to Work Certificate',
  'TESDA / Professional License (PRC)',
  'Driver License',
  'Other Statutory / Compliance Document',
];

interface AssetsSectionProps {
  assets?: Asset[];
}

export function AssetsSection({ assets = [] }: AssetsSectionProps) {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const [label, setLabel] = useState(DOCUMENT_CATEGORIES[0]);
  const [customLabel, setCustomLabel] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addAssetMutation = useMutation({
    mutationFn: (formData: FormData) => applicantApi.addAsset(formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applicant', 'profile'] });
      toast.success('Document uploaded successfully');
      setIsModalOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to upload document');
    },
  });

  const deleteAssetMutation = useMutation({
    mutationFn: (id: number) => applicantApi.deleteAsset(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applicant', 'profile'] });
      toast.success('Document removed');
      setDeletingId(null);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete document');
    },
  });

  const resetForm = () => {
    setLabel(DOCUMENT_CATEGORIES[0]);
    setCustomLabel('');
    setNotes('');
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      toast.error('Please select a file to upload');
      return;
    }

    const effectiveLabel = label === 'Other Statutory / Compliance Document' && customLabel.trim()
      ? customLabel.trim()
      : label;

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('label', effectiveLabel);
    if (notes) formData.append('notes', notes);

    addAssetMutation.mutate(formData);
  };

  const renderVerificationBadge = (state: AssetVerificationState) => {
    switch (state) {
      case AssetVerificationState.VERIFIED:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3" />
            Verified
          </span>
        );
      case AssetVerificationState.REJECTED:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <XCircle className="w-3 h-3" />
            Rejected
          </span>
        );
      case AssetVerificationState.EXPIRED:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <AlertTriangle className="w-3 h-3" />
            Expired
          </span>
        );
      case AssetVerificationState.UNVERIFIED:
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            <Clock className="w-3 h-3 text-slate-500" />
            Pending Review
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200" data-testid="assets-section">
      <div className="bg-card border border-border rounded-xl p-6 shadow-subtle space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-teal-700" />
            <div>
              <h4 className="text-sm font-bold text-foreground">Compliance Documents &amp; Certificates</h4>
              <p className="text-xs text-muted-foreground">
                Upload clear scanned copies or photos of your government clearances, IDs, and academic records.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              resetForm();
              setIsModalOpen(true);
            }}
            data-testid="add-asset-btn"
            className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 transition duration-150 inline-flex items-center gap-1.5 shadow-xs self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Upload Document</span>
          </button>
        </div>

        {/* List */}
        {assets.length === 0 ? (
          <div className="p-8 text-center bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <FileCheck2 className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">No documents uploaded</p>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                Upload pre-employment clearances (NBI, Police, Medical) to become fast-track deployable.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                resetForm();
                setIsModalOpen(true);
              }}
              className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-teal-700 bg-teal-50 border border-teal-200 hover:bg-teal-100 transition duration-150 inline-flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Upload First Document</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {assets.map((asset) => (
              <div
                key={asset.id}
                data-testid={`asset-item-${asset.id}`}
                className="p-4 rounded-xl border border-border bg-card hover:border-slate-300 transition duration-150 flex items-start justify-between gap-4"
              >
                <div className="space-y-2 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h5 className="text-sm font-bold text-foreground">{asset.label}</h5>
                    {renderVerificationBadge(asset.verificationState)}
                  </div>

                  {asset.notes && (
                    <p className="text-xs text-slate-600 leading-relaxed">
                      {asset.notes}
                    </p>
                  )}

                  <div className="pt-1 flex items-center gap-3">
                    <a
                      href={asset.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-semibold text-teal-700 hover:text-teal-900 inline-flex items-center gap-1 underline underline-offset-2"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>View File</span>
                    </a>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setDeletingId(asset.id)}
                    title="Delete document"
                    data-testid={`delete-asset-${asset.id}`}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition duration-150"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Upload Modal */}
      {isModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="asset-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs transition-opacity duration-200"
        >
          <div className="w-full max-w-lg bg-card rounded-xl border border-border shadow-modal overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h3 id="asset-modal-title" className="text-base font-bold text-foreground">
                Upload Compliance Document
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4" data-testid="asset-form">
              <div>
                <label htmlFor="docCategory" className="block text-xs font-semibold text-foreground mb-1">
                  Document Category <span className="text-rose-500">*</span>
                </label>
                <select
                  id="docCategory"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                >
                  {DOCUMENT_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              {label === 'Other Statutory / Compliance Document' && (
                <div>
                  <label htmlFor="customLabel" className="block text-xs font-semibold text-foreground mb-1">
                    Specify Document Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="customLabel"
                    type="text"
                    value={customLabel}
                    onChange={(e) => setCustomLabel(e.target.value)}
                    required
                    className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                    placeholder="e.g. Barangay Clearance / Health Certificate"
                  />
                </div>
              )}

              <div>
                <label htmlFor="assetFileInput" className="block text-xs font-semibold text-foreground mb-1">
                  Select File (PDF, PNG, JPG - max 10MB) <span className="text-rose-500">*</span>
                </label>
                <input
                  id="assetFileInput"
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf,image/png,image/jpeg,image/webp"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  required
                  data-testid="asset-file-input"
                  className="w-full px-3 py-2 text-xs bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
              </div>

              <div>
                <label htmlFor="assetNotes" className="block text-xs font-semibold text-foreground mb-1">
                  Notes / Expiration Date / Certificate Details
                </label>
                <textarea
                  id="assetNotes"
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                  placeholder="e.g. Issued on Jan 2026, valid for 1 year..."
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg border border-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addAssetMutation.isPending || !selectedFile}
                  className="px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg shadow-sm disabled:opacity-50 inline-flex items-center gap-1.5"
                >
                  {addAssetMutation.isPending ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Upload className="w-3.5 h-3.5" />
                  )}
                  <span>Upload Document</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={deletingId !== null}
        title="Delete Document"
        description="Are you sure you want to remove this uploaded document?"
        confirmText="Delete"
        variant="danger"
        isLoading={deleteAssetMutation.isPending}
        onConfirm={() => {
          if (deletingId) deleteAssetMutation.mutate(deletingId);
        }}
        onCancel={() => setDeletingId(null)}
      />
    </div>
  );
}
