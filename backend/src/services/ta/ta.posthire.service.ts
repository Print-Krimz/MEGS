import prisma from '../../utils/prisma.js';
import { uploadFileToSupabase } from '../../middleware/upload.middleware.js';

export const savePostHireDocument = async (applicationId: number, label: string, file: any, notes?: string) => {
  if (!file) throw new Error("No file provided");
  if (!label) throw new Error("Label is required (e.g., 'Medical Certificate')");

  const application = await prisma.application.findUnique({
    where: { id: applicationId },
  });

  if (!application) throw new Error("Application not found");

  const folderPath = `post-hire/${applicationId}`;
  const fileUrl = await uploadFileToSupabase("applicant-assets", folderPath, file);

  return await prisma.postHireDocument.create({
    data: {
      applicationId,
      label,
      fileUrl,
      notes,
    },
  });
};


