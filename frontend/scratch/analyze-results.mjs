import * as fs from 'fs';

const data = JSON.parse(fs.readFileSync('c:/Users/cnico/OneDrive/Desktop/MEGS/frontend/audit-subagent1-results.json', 'utf8'));

// Group by page name (removing viewport suffix for unified page report)
const grouped = {};

data.forEach(item => {
  const baseName = item.page.replace(/\s*\(\d+x\d+\)/, '');
  if (!grouped[baseName]) {
    grouped[baseName] = {
      page: baseName,
      title: item.title,
      viewports: [],
      findings: []
    };
  }
  const vpMatch = item.page.match(/\((\d+x\d+)\)/);
  if (vpMatch) grouped[baseName].viewports.push(vpMatch[1]);
  (item.findings || []).forEach(f => {
    grouped[baseName].findings.push(f);
  });
});

Object.values(grouped).forEach(g => {
  console.log('\n======================================================');
  console.log(`PAGE: ${g.page} | TITLE: ${g.title}`);
  console.log('======================================================');

  const seen = new Set();
  const deduped = [];
  g.findings.forEach(f => {
    const key = `${f.category}|${f.element}|${f.metric}|${f.text || ''}`;
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(f);
    }
  });

  console.log(`Unique issues: ${deduped.length}`);
  deduped.forEach(f => {
    console.log(`  * [${f.severity.toUpperCase()}] [${f.category}] <${f.element}> (${f.className})`);
    console.log(`    Metric: ${f.metric}`);
    if (f.text) console.log(`    Content: "${f.text}"`);
    console.log(`    Detail: ${f.description}`);
  });
});
