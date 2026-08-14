import { useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Camera, Loader2, Save, UserCheck, Shield, Phone, MapPin, User as UserIcon } from 'lucide-react';
import { applicantApi } from '../../../lib/api/applicant';
import type { ApplicantProfile, UpsertApplicantProfileInput } from '../../../lib/types/api';

const personalInfoSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  middleName: z.string().optional(),
  lastName: z.string().min(1, 'Last name is required'),
  mobileNumber: z.string().min(1, 'Mobile number is required'),
  gender: z.string().min(1, 'Gender is required'),
  dateOfBirth: z.string().min(1, 'Date of birth is required'),
  birthPlace: z.string().min(1, 'Birth place is required'),
  nationality: z.string().min(1, 'Nationality is required'),
  civilStatus: z.string().min(1, 'Civil status is required'),
  province: z.string().min(1, 'Province is required'),
  city: z.string().min(1, 'City is required'),
  address: z.string().min(1, 'Complete residential address is required'),
  preferredWorkLocations: z.string().optional(),
  height: z.coerce.number().optional(),
  weight: z.coerce.number().optional(),
  religion: z.string().optional(),
  professionalSummary: z.string().min(1, 'Professional summary is required'),
  pagibig: z.string().optional(),
  philhealth: z.string().optional(),
  sss: z.string().optional(),
  tin: z.string().optional(),
  emergencyContactName: z.string().optional(),
  emergencyContactRelationship: z.string().optional(),
  emergencyContactPhone: z.string().optional(),
  emergencyContactAddress: z.string().optional(),
  additionalNotes: z.string().optional(),
});

type PersonalInfoFormData = z.infer<typeof personalInfoSchema>;

interface PersonalInfoSectionProps {
  profile?: ApplicantProfile | null;
}

export function PersonalInfoSection({ profile }: PersonalInfoSectionProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(profile?.photoUrl ?? null);

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<PersonalInfoFormData>({
    resolver: zodResolver(personalInfoSchema),
    defaultValues: {
      firstName: profile?.firstName || '',
      middleName: profile?.middleName || '',
      lastName: profile?.lastName || '',
      mobileNumber: profile?.mobileNumber || '',
      gender: profile?.gender || 'Prefer not to say',
      dateOfBirth: profile?.dateOfBirth ? profile.dateOfBirth.split('T')[0] : '',
      birthPlace: profile?.birthPlace || '',
      nationality: profile?.nationality || 'Filipino',
      civilStatus: profile?.civilStatus || 'Single',
      province: profile?.province || '',
      city: profile?.city || '',
      address: profile?.address || '',
      preferredWorkLocations: profile?.preferredWorkLocations || '',
      height: profile?.height ?? undefined,
      weight: profile?.weight ?? undefined,
      religion: profile?.religion || '',
      professionalSummary: profile?.professionalSummary || '',
      pagibig: profile?.pagibig || '',
      philhealth: profile?.philhealth || '',
      sss: profile?.sss || '',
      tin: profile?.tin || '',
      emergencyContactName: profile?.emergencyContactName || '',
      emergencyContactRelationship: profile?.emergencyContactRelationship || '',
      emergencyContactPhone: profile?.emergencyContactPhone || '',
      emergencyContactAddress: profile?.emergencyContactAddress || '',
      additionalNotes: profile?.additionalNotes || '',
    },
  });

  const saveProfileMutation = useMutation({
    mutationFn: (data: UpsertApplicantProfileInput) => applicantApi.upsertProfile(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applicant', 'profile'] });
      toast.success('Personal profile saved successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to save profile');
    },
  });

  const photoMutation = useMutation({
    mutationFn: (file: File) => applicantApi.uploadPhoto(file),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['applicant', 'profile'] });
      if (res.data?.photoUrl) {
        setPhotoPreview(res.data.photoUrl);
      }
      toast.success('Profile photo updated');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to upload photo');
    },
  });

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Photo size must be less than 5MB');
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setPhotoPreview(objectUrl);
    photoMutation.mutate(file);
  };

  const onSubmit = (data: PersonalInfoFormData) => {
    saveProfileMutation.mutate(data as UpsertApplicantProfileInput);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Profile Photo Upload Header */}
      <div className="bg-card border border-border rounded-xl p-6 shadow-subtle flex flex-col sm:flex-row items-center sm:items-start gap-6">
        <div className="relative group flex-shrink-0">
          <div className="w-28 h-28 rounded-full bg-slate-100 border-2 border-slate-200 overflow-hidden flex items-center justify-center shadow-inner">
            {photoPreview ? (
              <img
                src={photoPreview}
                alt="Profile Preview"
                className="w-full h-full object-cover"
              />
            ) : (
              <UserIcon className="w-12 h-12 text-slate-400" />
            )}
          </div>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={photoMutation.isPending}
            className="absolute bottom-0 right-0 p-2 rounded-full bg-teal-700 hover:bg-teal-800 text-white shadow-md transition duration-150 focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:opacity-50"
            title="Upload new avatar"
            aria-label="Upload photo"
          >
            {photoMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Camera className="w-4 h-4" />
            )}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={handlePhotoSelect}
            data-testid="profile-photo-input"
          />
        </div>

        <div className="flex-1 text-center sm:text-left space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-xl font-bold text-foreground">
                {profile?.firstName ? `${profile.firstName} ${profile.lastName}` : 'Applicant Profile'}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Upload a clear 2x2 or passport-style headshot (JPG, PNG, max 5MB).
              </p>
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={photoMutation.isPending}
              className="h-9 px-4 text-xs font-medium rounded-lg bg-teal-700 text-white hover:bg-teal-800 transition duration-150 inline-flex items-center justify-center gap-1.5 self-center sm:self-start shadow-xs disabled:opacity-50"
            >
              {photoMutation.isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Camera className="w-3.5 h-3.5" />
              )}
              <span>Change Photo</span>
            </button>
          </div>
          <div className="pt-1 flex flex-wrap items-center justify-center sm:justify-start gap-2">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-teal-50 text-teal-700 border border-teal-200">
              <UserCheck className="w-3.5 h-3.5" />
              {profile?.isActive ? 'Active Candidate' : 'Registered'}
            </span>
            {profile?.city && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                <MapPin className="w-3.5 h-3.5 text-slate-500" />
                {profile.city}, {profile.province}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Main Profile Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" data-testid="personal-info-form">
        {/* Section 1: Basic Identity */}
        <div className="bg-card border border-border rounded-xl p-6 shadow-subtle space-y-4">
          <div className="flex items-center gap-2 border-b border-border pb-3">
            <UserIcon className="w-5 h-5 text-teal-700" />
            <h4 className="text-sm font-bold text-foreground tracking-tight">Basic Identification</h4>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label htmlFor="firstName" className="block text-sm font-medium text-slate-700 mb-1.5">
                First Name <span className="text-rose-500">*</span>
              </label>
              <input
                id="firstName"
                type="text"
                {...register('firstName')}
                className="w-full h-10 px-3.5 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                placeholder="e.g. Juan"
              />
              {errors.firstName && (
                <p className="mt-1 text-xs text-rose-500">{errors.firstName.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="middleName" className="block text-sm font-medium text-slate-700 mb-1.5">
                Middle Name
              </label>
              <input
                id="middleName"
                type="text"
                {...register('middleName')}
                className="w-full h-10 px-3.5 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                placeholder="e.g. Santos"
              />
            </div>

            <div>
              <label htmlFor="lastName" className="block text-sm font-medium text-slate-700 mb-1.5">
                Last Name <span className="text-rose-500">*</span>
              </label>
              <input
                id="lastName"
                type="text"
                {...register('lastName')}
                className="w-full h-10 px-3.5 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                placeholder="e.g. Dela Cruz"
              />
              {errors.lastName && (
                <p className="mt-1 text-xs text-rose-500">{errors.lastName.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-2">
            <div>
              <label htmlFor="gender" className="block text-sm font-medium text-slate-700 mb-1.5">
                Gender <span className="text-rose-500">*</span>
              </label>
              <select
                id="gender"
                {...register('gender')}
                className="w-full h-10 px-3.5 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
              >
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
                <option value="Prefer not to say">Prefer not to say</option>
              </select>
              {errors.gender && (
                <p className="mt-1 text-xs text-rose-500">{errors.gender.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="dateOfBirth" className="block text-sm font-medium text-slate-700 mb-1.5">
                Date of Birth <span className="text-rose-500">*</span>
              </label>
              <input
                id="dateOfBirth"
                type="date"
                {...register('dateOfBirth')}
                className="w-full h-10 px-3.5 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
              {errors.dateOfBirth && (
                <p className="mt-1 text-xs text-rose-500">{errors.dateOfBirth.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="birthPlace" className="block text-sm font-medium text-slate-700 mb-1.5">
                Birth Place <span className="text-rose-500">*</span>
              </label>
              <input
                id="birthPlace"
                type="text"
                {...register('birthPlace')}
                className="w-full h-10 px-3.5 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                placeholder="City / Municipality"
              />
              {errors.birthPlace && (
                <p className="mt-1 text-xs text-rose-500">{errors.birthPlace.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="civilStatus" className="block text-sm font-medium text-slate-700 mb-1.5">
                Civil Status <span className="text-rose-500">*</span>
              </label>
              <select
                id="civilStatus"
                {...register('civilStatus')}
                className="w-full h-10 px-3.5 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
              >
                <option value="Single">Single</option>
                <option value="Married">Married</option>
                <option value="Widowed">Widowed</option>
                <option value="Separated">Separated</option>
                <option value="Divorced">Divorced</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            <div>
              <label htmlFor="nationality" className="block text-sm font-medium text-slate-700 mb-1.5">
                Nationality <span className="text-rose-500">*</span>
              </label>
              <input
                id="nationality"
                type="text"
                {...register('nationality')}
                className="w-full h-10 px-3.5 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                placeholder="e.g. Filipino"
              />
              {errors.nationality && (
                <p className="mt-1 text-xs text-rose-500">{errors.nationality.message}</p>
              )}
            </div>
            <div>
              <label htmlFor="height" className="block text-sm font-medium text-slate-700 mb-1.5">
                Height (cm)
              </label>
              <input
                id="height"
                type="number"
                step="any"
                {...register('height')}
                className="w-full h-10 px-3.5 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                placeholder="e.g. 170"
              />
            </div>
            <div>
              <label htmlFor="weight" className="block text-sm font-medium text-slate-700 mb-1.5">
                Weight (kg)
              </label>
              <input
                id="weight"
                type="number"
                step="any"
                {...register('weight')}
                className="w-full h-10 px-3.5 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                placeholder="e.g. 65"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Contact & Address */}
        <div className="bg-card border border-border rounded-xl p-6 shadow-subtle space-y-4">
          <div className="flex items-center gap-2 border-b border-border pb-3">
            <Phone className="w-5 h-5 text-teal-700" />
            <h4 className="text-sm font-bold text-foreground tracking-tight">Contact &amp; Location</h4>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label htmlFor="mobileNumber" className="block text-sm font-medium text-slate-700 mb-1.5">
                Mobile Number <span className="text-rose-500">*</span>
              </label>
              <input
                id="mobileNumber"
                type="text"
                {...register('mobileNumber')}
                className="w-full h-10 px-3.5 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                placeholder="e.g. 09171234567"
              />
              {errors.mobileNumber && (
                <p className="mt-1 text-xs text-rose-500">{errors.mobileNumber.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="province" className="block text-sm font-medium text-slate-700 mb-1.5">
                Province <span className="text-rose-500">*</span>
              </label>
              <input
                id="province"
                type="text"
                {...register('province')}
                className="w-full h-10 px-3.5 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                placeholder="e.g. Metro Manila / Cavite"
              />
              {errors.province && (
                <p className="mt-1 text-xs text-rose-500">{errors.province.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="city" className="block text-sm font-medium text-slate-700 mb-1.5">
                City / Municipality <span className="text-rose-500">*</span>
              </label>
              <input
                id="city"
                type="text"
                {...register('city')}
                className="w-full h-10 px-3.5 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                placeholder="e.g. Quezon City"
              />
              {errors.city && (
                <p className="mt-1 text-xs text-rose-500">{errors.city.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div>
              <label htmlFor="address" className="block text-sm font-medium text-slate-700 mb-1.5">
                Complete Residential Address <span className="text-rose-500">*</span>
              </label>
              <input
                id="address"
                type="text"
                {...register('address')}
                className="w-full h-10 px-3.5 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                placeholder="House No., Street, Barangay"
              />
              {errors.address && (
                <p className="mt-1 text-xs text-rose-500">{errors.address.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="preferredWorkLocations" className="block text-sm font-medium text-slate-700 mb-1.5">
                Preferred Work Locations
              </label>
              <input
                id="preferredWorkLocations"
                type="text"
                {...register('preferredWorkLocations')}
                className="w-full h-10 px-3.5 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                placeholder="e.g. Makati, BGC Taguig, Pasig (comma-separated)"
              />
            </div>
          </div>
        </div>

        {/* Section 3: Professional Summary */}
        <div className="bg-card border border-border rounded-xl p-6 shadow-subtle space-y-4">
          <div className="flex items-center gap-2 border-b border-border pb-3">
            <UserCheck className="w-5 h-5 text-teal-700" />
            <h4 className="text-sm font-bold text-foreground tracking-tight">Professional Summary</h4>
          </div>

          <div>
            <label htmlFor="professionalSummary" className="block text-sm font-medium text-slate-700 mb-1.5">
              Headline Summary / Objective <span className="text-rose-500">*</span>
            </label>
            <textarea
              id="professionalSummary"
              rows={4}
              {...register('professionalSummary')}
              className="w-full p-3.5 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
              placeholder="Highlight your background, key strengths, years of experience, and career aspirations..."
            />
            {errors.professionalSummary && (
              <p className="mt-1 text-xs text-rose-500">{errors.professionalSummary.message}</p>
            )}
          </div>
        </div>

        {/* Section 4: Philippine Government Mandatory Numbers */}
        <div className="bg-card border border-border rounded-xl p-6 shadow-subtle space-y-4">
          <div className="flex items-center gap-2 border-b border-border pb-3">
            <Shield className="w-5 h-5 text-teal-700" />
            <h4 className="text-sm font-bold text-foreground tracking-tight">
              Philippine Government Statutory IDs
            </h4>
          </div>
          <p className="text-xs text-muted-foreground">
            Providing your statutory IDs speeds up employment compliance and pre-employment onboarding.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label htmlFor="sss" className="block text-sm font-medium text-slate-700 mb-1.5">
                SSS Number
              </label>
              <input
                id="sss"
                type="text"
                {...register('sss')}
                className="w-full h-10 px-3.5 text-sm font-mono bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                placeholder="XX-XXXXXXX-X"
              />
            </div>

            <div>
              <label htmlFor="philhealth" className="block text-sm font-medium text-slate-700 mb-1.5">
                PhilHealth Number
              </label>
              <input
                id="philhealth"
                type="text"
                {...register('philhealth')}
                className="w-full h-10 px-3.5 text-sm font-mono bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                placeholder="XX-XXXXXXXXX-X"
              />
            </div>

            <div>
              <label htmlFor="pagibig" className="block text-sm font-medium text-slate-700 mb-1.5">
                Pag-IBIG (HDMF) MID
              </label>
              <input
                id="pagibig"
                type="text"
                {...register('pagibig')}
                className="w-full h-10 px-3.5 text-sm font-mono bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                placeholder="XXXX-XXXX-XXXX"
              />
            </div>

            <div>
              <label htmlFor="tin" className="block text-sm font-medium text-slate-700 mb-1.5">
                TIN Number
              </label>
              <input
                id="tin"
                type="text"
                {...register('tin')}
                className="w-full h-10 px-3.5 text-sm font-mono bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                placeholder="XXX-XXX-XXX-000"
              />
            </div>
          </div>
        </div>

        {/* Section 5: Emergency Contact */}
        <div className="bg-card border border-border rounded-xl p-6 shadow-subtle space-y-4">
          <div className="flex items-center gap-2 border-b border-border pb-3">
            <Phone className="w-5 h-5 text-teal-700" />
            <h4 className="text-sm font-bold text-foreground tracking-tight">Emergency Contact</h4>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label htmlFor="emergencyContactName" className="block text-sm font-medium text-slate-700 mb-1.5">
                Contact Person Name
              </label>
              <input
                id="emergencyContactName"
                type="text"
                {...register('emergencyContactName')}
                className="w-full h-10 px-3.5 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                placeholder="e.g. Maria Dela Cruz"
              />
            </div>

            <div>
              <label htmlFor="emergencyContactRelationship" className="block text-sm font-medium text-slate-700 mb-1.5">
                Relationship
              </label>
              <input
                id="emergencyContactRelationship"
                type="text"
                {...register('emergencyContactRelationship')}
                className="w-full h-10 px-3.5 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                placeholder="e.g. Spouse / Parent / Sibling"
              />
            </div>

            <div>
              <label htmlFor="emergencyContactPhone" className="block text-sm font-medium text-slate-700 mb-1.5">
                Contact Mobile Number
              </label>
              <input
                id="emergencyContactPhone"
                type="text"
                {...register('emergencyContactPhone')}
                className="w-full h-10 px-3.5 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                placeholder="e.g. 09187654321"
              />
            </div>
          </div>

          <div>
            <label htmlFor="emergencyContactAddress" className="block text-sm font-medium text-slate-700 mb-1.5">
              Emergency Contact Address
            </label>
            <input
              id="emergencyContactAddress"
              type="text"
              {...register('emergencyContactAddress')}
              className="w-full h-10 px-3.5 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
              placeholder="City, Province or full address"
            />
          </div>
        </div>

        {/* Submit Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="submit"
            disabled={saveProfileMutation.isPending}
            className="h-11 px-6 text-sm font-semibold rounded-xl bg-teal-700 text-white hover:bg-teal-800 transition duration-150 focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:opacity-50 inline-flex items-center gap-2 shadow-xs"
          >
            {saveProfileMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span>{isDirty ? 'Save Profile Changes' : 'Save Profile'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
