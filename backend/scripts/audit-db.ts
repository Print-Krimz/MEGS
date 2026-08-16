import "dotenv/config";
import prisma from "../src/utils/prisma.js";
import supabase from "../src/utils/supabase.js";

async function audit() {
  console.log("=== SUPABASE AUTH USERS ===");
  const { data: authUsers, error: authErr } = await supabase.auth.admin.listUsers();
  if (authErr) {
    console.error("Auth error:", authErr);
  } else {
    console.log(`Total Auth Users: ${authUsers?.users.length}`);
    authUsers?.users.forEach((u) => {
      console.log(`- ${u.email} | ID: ${u.id} | Metadata: ${JSON.stringify(u.user_metadata)}`);
    });
  }

  console.log("\n=== POSTGRES DATABASE TABLE COUNTS ===");
  const tables = {
    users: await prisma.user.count(),
    applicantProfiles: await prisma.applicantProfile.count(),
    workExperiences: await prisma.workExperience.count(),
    educations: await prisma.education.count(),
    skills: await prisma.skill.count(),
    applicantSkills: await prisma.applicantSkill.count(),
    trainingCertifications: await prisma.trainingCertification.count(),
    assets: await prisma.asset.count(),
    characterReferences: await prisma.characterReference.count(),
    clients: await prisma.client.count(),
    manpowerRequests: await prisma.manpowerRequest.count(),
    mrfComplianceTemplates: await prisma.mRFComplianceTemplate.count(),
    jobPostings: await prisma.jobPosting.count(),
    applications: await prisma.application.count(),
    interviews: await prisma.interview.count(),
    clientEndorsements: await prisma.clientEndorsement.count(),
    postHireDocuments: await prisma.postHireDocument.count(),
    recruiterDecisions: await prisma.recruiterDecision.count(),
    complianceRequirements: await prisma.complianceRequirement.count(),
    employees: await prisma.employee.count(),
    employmentEvents: await prisma.employmentEvent.count(),
    deployments: await prisma.deployment.count(),
    deploymentStatusHistory: await prisma.deploymentStatusHistory.count(),
    storedDocuments: await prisma.storedDocument.count(),
    candidateScoringConfigurations: await prisma.candidateScoringConfiguration.count(),
    candidateScoringWeights: await prisma.candidateScoringWeight.count(),
    candidateScores: await prisma.candidateScore.count(),
    candidateFeatureProfiles: await prisma.candidateFeatureProfile.count(),
    scoringRevalidationTasks: await prisma.scoringRevalidationTask.count(),
    talentPoolMemberships: await prisma.talentPoolMembership.count(),
    talentPoolContacts: await prisma.talentPoolContact.count(),
    notifications: await prisma.notification.count(),
    notificationOutbox: await prisma.notificationOutbox.count(),
    auditLogs: await prisma.auditLog.count(),
  };

  console.table(tables);

  const extraUsers = await prisma.user.findMany({
    where: { email: { notIn: ["admin@megs-recruitment.com", "ta@megs-recruitment.com"] } }
  });
  if (extraUsers.length > 0) {
    console.log("\n⚠️ Extra Users:", extraUsers.map(u => ({ id: u.id, email: u.email, role: u.role })));
  }

  const clients = await prisma.client.findMany();
  if (clients.length > 0) {
    console.log("\n⚠️ Clients:", clients.map(c => ({ id: c.id, name: c.name })));
  }

  const jobPostings = await prisma.jobPosting.findMany();
  if (jobPostings.length > 0) {
    console.log("\n⚠️ Job Postings:", jobPostings.map(j => ({ id: j.id, title: j.title, postedById: j.postedById })));
  }
}

audit()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
  });
