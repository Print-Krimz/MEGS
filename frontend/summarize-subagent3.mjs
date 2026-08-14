import fs from 'fs';

const raw = fs.readFileSync('audit-subagent3-results.json', 'utf8');
const data = JSON.parse(raw);

const sections = {
  MRF: ['TAMRFsPage - List', 'TAMRFsPage - Create MRF Modal', 'TAMRFDetailPage - Jobs Tab', 'TAMRFDetailPage - Compliance Tab', 'TAMRFDetailPage - Add Template Modal', 'TAMRFDetailPage - Deployments Tab', 'TAMRFDetailPage - Specs Tab'],
  Jobs: ['TAJobsPage - List', 'TAJobsPage - Create Job Modal', 'TAJobDetailPage - Pipeline', 'TAJobDetailPage - Overview'],
  Clients: ['TAClientsPage - List', 'TAClientsPage - Add Client Modal', 'TAClientDetailPage - MRFs Tab', 'TAClientDetailPage - Deployments Tab', 'TAClientDetailPage - Info Tab'],
  Interviews: ['TAInterviewsPage - List & SLA', 'TAInterviewsPage - Outcome Modal'],
  ComplianceDeployments: ['TACompliancePage', 'TADeploymentsPage - List', 'TADeploymentsPage - Status Modal', 'ComplianceTab (Application Detail)', 'DeploymentTab (Application Detail)'],
  Employees: ['TAEmployeesPage - Directory', 'TAEmployeeDetailPage - Personal Info', 'TAEmployeeDetailPage - Deployments', 'TAEmployeeDetailPage - Compliance Docs', 'TAEmployeeDetailPage - Career Timeline'],
};

for (const [sectionName, pageNames] of Object.entries(sections)) {
  console.log(`\n======================================================`);
  console.log(`SECTION: ${sectionName}`);
  console.log(`======================================================`);

  pageNames.forEach((pName) => {
    const records = data.filter((d) => d.pageName === pName);
    if (records.length === 0) {
      console.log(`[!] No records for ${pName}`);
      return;
    }
    console.log(`\n--- PAGE/VIEW: ${pName} ---`);
    records.forEach((rec) => {
      console.log(`  Res: ${rec.resolutionName} | Screenshot: ${rec.screenshotFile} | H-Overflow: ${rec.hasHorizontalScrollbar}`);
      console.log(`    Small text count (<13px): ${rec.elementsWithSmallFont.length}`);
      const text10_11 = rec.elementsWithSmallFont.filter(t => parseFloat(t.fontSize) <= 11);
      if (text10_11.length > 0) {
        console.log(`      * Sub-12px text (${text10_11.length}): ${text10_11.map(t => `"${t.text}" (${t.fontSize})`).join(', ')}`);
      }
      if (rec.smallButtons.length > 0) {
        console.log(`      * Small buttons (${rec.smallButtons.length}): ${rec.smallButtons.map(b => `"${b.text}" (${b.height}h)`).join(', ')}`);
      }
      if (rec.badgeMetrics.length > 0) {
        console.log(`      * Badges (${rec.badgeMetrics.length}): ${rec.badgeMetrics.slice(0, 3).map(b => `"${b.text}" (font: ${b.fontSize}, h: ${b.height})`).join(', ')}`);
      }
      if (rec.tables.length > 0) {
        rec.tables.forEach((t) => {
          console.log(`      * Table: ${t.headers.map(h => `${h.header} [w:${h.width}]`).join(', ')} | Cramped Cells: ${t.crampedCellCount}`);
        });
      }
      if (rec.modals.length > 0) {
        rec.modals.forEach((m) => {
          console.log(`      * Modal: ${m.width} x ${m.height} (Exceeds screen: ${m.exceedsScreenHeight})`);
        });
      }
    });
  });
}
