import { z } from "zod";

export const applicantSchema = {
  upsertProfile: z.object({
    body: z.object({
      firstName: z.string().min(1, "First name is required").optional(),
      lastName: z.string().min(1, "Last name is required").optional(),
      phone: z.string().optional(),
      address: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      zip: z.string().optional(),
      country: z.string().optional(),
      summary: z.string().optional(),
      linkedin: z.string().url("Invalid LinkedIn URL").optional().or(z.literal("")),
      github: z.string().url("Invalid GitHub URL").optional().or(z.literal("")),
      portfolio: z.string().url("Invalid Portfolio URL").optional().or(z.literal("")),
    }),
  }),
  addWorkExperience: z.object({
    body: z.object({
      company: z.string().min(1, "Company is required"),
      title: z.string().min(1, "Title is required"),
      startDate: z.string().min(1, "Start date is required"), // Can be refined to .date()
      endDate: z.string().optional().nullable(),
      description: z.string().optional(),
    }),
  }),
  addEducation: z.object({
    body: z.object({
      school: z.string().min(1, "School is required").or(z.string()), // sometimes mapped from institution
      institution: z.string().optional(),
      degree: z.string().min(1, "Degree is required"),
      field: z.string().min(1, "Field of study is required"),
      startDate: z.string().min(1, "Start date is required"),
      endDate: z.string().optional().nullable(),
    }),
  }),
  updateSkills: z.object({
    body: z.object({
      skills: z.array(z.string(), { message: "Skills array is required" }),
    }),
  }),
  addTraining: z.object({
    body: z.object({
      title: z.string().min(1, "Title is required"),
      provider: z.string().min(1, "Provider is required"),
      completionDate: z.string().optional().nullable(),
      certificateNo: z.string().optional(),
      notes: z.string().optional(),
    }),
  }),
  addReference: z.object({
    body: z.object({
      name: z.string().min(1, "Name is required"),
      relationship: z.string().min(1, "Relationship is required"),
      phone: z.string().optional(),
      email: z.string().email("Invalid email format").optional().or(z.literal("")),
      notes: z.string().optional(),
    }),
  }),
  addAsset: z.object({
    body: z.object({
      label: z.string().min(1, "Label is required"),
      notes: z.string().optional(),
    }),
  }),
};
