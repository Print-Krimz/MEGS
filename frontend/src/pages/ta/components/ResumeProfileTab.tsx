import { useState } from 'react';
import { 
  Download, 
  Briefcase, 
  GraduationCap, 
  Wrench, 
  Award, 
  Users, 
  FileText, 
  ExternalLink,
  Calendar,
  MapPin
} from 'lucide-react';
import { StatusBadge } from '../../../components/common/StatusBadge';
import { toast } from 'sonner';
import type { ApplicationDetail } from '../../../lib/types/api';

interface ResumeProfileTabProps {
  application: ApplicationDetail;
}

export function ResumeProfileTab({ application }: ResumeProfileTabProps) {
  const profile = application.user.applicantProfile;
  const [isDownloading, setIsDownloading] = useState(false);

  const workExperiences = profile?.workExperiences || [];
  const educations = profile?.educations || [];
  const skills = profile?.skills || [];
  const trainings = profile?.trainings || [];
  const references = profile?.characterReferences || [];
  const assets = profile?.assets || [];

  const handleDownloadResume = async () => {
    if (application.resumeUrl) {
      window.open(application.resumeUrl, '_blank');
      return;
    }

    // Attempt to download via documentApi if resume document ID is available
    try {
      setIsDownloading(true);
      toast.info('Initiating resume download...');
      // If assets has a resume or profile has one
      const resumeAsset = assets.find((a) => a.documentType === 'RESUME' || a.label?.toLowerCase().includes('resume'));
      if (resumeAsset?.fileUrl) {
        window.open(resumeAsset.fileUrl, '_blank');
      } else {
        toast.info('Downloading latest candidate profile resume...');
        // Generic download trigger
        window.open(`/api/documents/${application.id}/download`, '_blank');
      }
    } catch (err: any) {
      toast.error('Could not download resume file.');
    } finally {
      setIsDownloading(false);
    }
  };

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return 'Present';
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-6" data-testid="resume-profile-tab">
      {/* Resume File Header Banner */}
      <div className="bg-card border border-border rounded-xl p-5 shadow-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-teal-50 text-teal-700 rounded-lg">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">
              Candidate Dossier & Attached Resume
            </h3>
            <p className="text-xs text-muted-foreground">
              Source resume document submitted with application.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleDownloadResume}
          disabled={isDownloading}
          data-testid="download-resume-btn"
          className="h-10 px-4 text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-50 transition duration-150 inline-flex items-center gap-2 self-start sm:self-auto rounded-lg shadow-xs cursor-pointer"
        >
          <Download className="w-4 h-4" />
          <span>{isDownloading ? 'Downloading...' : 'Download Resume File'}</span>
        </button>
      </div>

      {/* 1. Work Experience Section */}
      <div className="bg-card border border-border rounded-xl p-6 shadow-subtle space-y-4">
        <h3 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
          <Briefcase className="w-4 h-4 text-teal-700" />
          <span>Work Experience</span>
          <span className="text-xs font-mono text-muted-foreground font-normal">
            ({workExperiences.length})
          </span>
        </h3>

        {workExperiences.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">No work experiences recorded.</p>
        ) : (
          <div className="space-y-4">
            {workExperiences.map((exp) => (
              <div key={exp.id} className="p-5 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <div className="text-base font-bold text-slate-900">
                    {exp.roleTitle}{' '}
                    <span className="text-sm font-semibold text-teal-800">
                      @ {exp.company}
                    </span>
                  </div>
                  <div className="text-xs font-mono text-slate-500 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>
                      {formatDate(exp.startDate)} &ndash; {exp.isCurrent ? 'Present' : formatDate(exp.endDate)}
                    </span>
                  </div>
                </div>

                {exp.location && (
                  <div className="text-slate-500 flex items-center gap-1 text-xs">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    <span>{exp.location}</span>
                  </div>
                )}

                {exp.summary && (
                  <p className="text-sm text-slate-600 leading-relaxed pt-1">
                    {exp.summary}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 2. Education Section */}
      <div className="bg-card border border-border rounded-xl p-6 shadow-subtle space-y-4">
        <h3 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
          <GraduationCap className="w-4 h-4 text-teal-700" />
          <span>Educational Background</span>
          <span className="text-xs font-mono text-muted-foreground font-normal">
            ({educations.length})
          </span>
        </h3>

        {educations.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">No education history recorded.</p>
        ) : (
          <div className="space-y-4">
            {educations.map((edu) => (
              <div key={edu.id} className="p-5 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-1.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <div className="text-base font-bold text-slate-900">
                    {edu.school}
                  </div>
                  <div className="text-xs font-mono text-slate-500">
                    {edu.startDate && formatDate(edu.startDate)}
                    {edu.startDate && edu.endDate && ' - '}
                    {edu.endDate && formatDate(edu.endDate)}
                  </div>
                </div>

                {(edu.degree || edu.fieldOfStudy) && (
                  <div className="text-sm font-semibold text-teal-800">
                    {edu.degree}
                    {edu.degree && edu.fieldOfStudy && ' in '}
                    {edu.fieldOfStudy}
                  </div>
                )}

                {edu.notes && (
                  <p className="text-sm text-slate-600 leading-relaxed pt-0.5">
                    {edu.notes}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 3. Skills Section */}
      <div className="bg-card border border-border rounded-xl p-6 shadow-subtle space-y-4">
        <h3 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
          <Wrench className="w-4 h-4 text-teal-700" />
          <span>Competencies & Skills</span>
          <span className="text-xs font-mono text-muted-foreground font-normal">
            ({skills.length})
          </span>
        </h3>

        {skills.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">No skills tagged.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {skills.map((skill, index) => {
              const skillName = typeof skill === 'string' ? skill : skill.skill?.name || `Skill #${index}`;
              return (
                <span
                  key={index}
                  className="text-xs font-medium px-3 py-1 bg-slate-100 text-slate-700 rounded-md border border-slate-200/60"
                >
                  {skillName}
                </span>
              );
            })}
          </div>
        )}
      </div>

      {/* 4. Trainings & Certifications */}
      <div className="bg-card border border-border rounded-xl p-6 shadow-subtle space-y-4">
        <h3 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
          <Award className="w-4 h-4 text-teal-700" />
          <span>Trainings & Certifications</span>
          <span className="text-xs font-mono text-muted-foreground font-normal">
            ({trainings.length})
          </span>
        </h3>

        {trainings.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">No certifications registered.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {trainings.map((cert) => (
              <div
                key={cert.id}
                className="p-5 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-1.5"
              >
                <div className="text-base font-bold text-slate-900">{cert.title}</div>
                {cert.provider && (
                  <div className="text-xs text-slate-600">
                    Provider: <strong className="text-slate-900">{cert.provider}</strong>
                  </div>
                )}
                {cert.certificateNo && (
                  <div className="text-xs font-mono text-slate-600">
                    Cert #: {cert.certificateNo}
                  </div>
                )}
                {cert.completionDate && (
                  <div className="text-xs text-slate-500">
                    Completed: {formatDate(cert.completionDate)}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 5. Character References */}
      <div className="bg-card border border-border rounded-xl p-6 shadow-subtle space-y-4">
        <h3 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
          <Users className="w-4 h-4 text-teal-700" />
          <span>Character References</span>
          <span className="text-xs font-mono text-muted-foreground font-normal">
            ({references.length})
          </span>
        </h3>

        {references.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">No references supplied.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {references.map((ref) => (
              <div
                key={ref.id}
                className="p-5 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-1.5"
              >
                <div className="text-base font-bold text-slate-900">{ref.name}</div>
                {ref.relationship && (
                  <div className="text-xs text-slate-600">
                    Relationship: <span className="text-slate-900 font-medium">{ref.relationship}</span>
                  </div>
                )}
                {ref.phone && (
                  <div className="text-xs text-slate-600 font-mono">
                    Phone: {ref.phone}
                  </div>
                )}
                {ref.email && (
                  <div className="text-xs text-slate-600">
                    Email: {ref.email}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 6. Candidate Assets & Documents */}
      <div className="bg-card border border-border rounded-xl p-6 shadow-subtle space-y-4">
        <h3 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
          <FileText className="w-4 h-4 text-teal-700" />
          <span>Uploaded Credentials & Assets</span>
          <span className="text-xs font-mono text-muted-foreground font-normal">
            ({assets.length})
          </span>
        </h3>

        {assets.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">No additional uploaded assets.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {assets.map((asset) => (
              <div
                key={asset.id}
                className="p-5 rounded-xl border border-slate-200 bg-white shadow-2xs flex items-center justify-between gap-3"
              >
                <div className="space-y-1 min-w-0">
                  <div className="text-base font-bold text-slate-900 truncate">{asset.label}</div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={asset.verificationState} size="sm" />
                    {asset.documentType && (
                      <span className="text-xs text-muted-foreground font-mono">
                        {asset.documentType}
                      </span>
                    )}
                  </div>
                </div>

                {asset.fileUrl && (
                  <a
                    href={asset.fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="p-2 rounded-lg bg-slate-50 border border-border text-teal-800 hover:bg-teal-50 transition-colors shrink-0"
                    title="View Document"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
