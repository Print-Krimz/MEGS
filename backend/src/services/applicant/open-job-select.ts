/** What an applicant sees about an open job. Shared by the job list and recommendations. Kept free of heavy imports so workers can use it. */
export const OPEN_JOB_SELECT = {
  id: true,
  title: true,
  description: true,
  requirements: true,
  location: true,
  imageUrl: true,
  status: true,
  createdAt: true,
  mrf: {
    select: {
      location: true,
      client: {
        select: {
          id: true,
          name: true,
          tradeName: true,
          industry: true,
          city: true,
          province: true,
        },
      },
      employmentType: true,
      workArrangement: true,
      salaryRangeMin: true,
      salaryRangeMax: true,
      department: true,
      workShift: true,
      workDays: true,
      workHoursPerDay: true,
      workTime: true,
    },
  },
} as const;
