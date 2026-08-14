import fs from 'fs';

const raw = fs.readFileSync('audit-subagent3-results.json', 'utf8');
const data = JSON.parse(raw);

console.log('=== TOTAL VIEWS AUDITED ===', data.length);

const pageGroups = {};
data.forEach((item) => {
  if (!pageGroups[item.pageName]) pageGroups[item.pageName] = [];
  pageGroups[item.pageName].push(item);
});

for (const [name, list] of Object.entries(pageGroups)) {
  console.log('\n========================================');
  console.log('PAGE:', name);
  list.forEach((item) => {
    console.log(`\n  --- Resolution: ${item.resolutionName} (URL: ${item.url}) ---`);
    console.log(`  Horizontal Overflow: ${item.hasHorizontalScrollbar} (Body: ${item.bodyScrollWidth}px vs VP: ${item.viewport.width}px)`);
    
    if (item.elementsWithSmallFont?.length > 0) {
      console.log(`  Small text elements (<13px): ${item.elementsWithSmallFont.length}`);
      item.elementsWithSmallFont.forEach((t) => {
        console.log(`    * [${t.fontSize}, w:${t.fontWeight}, col:${t.color}] "${t.text}" (class: ${t.className})`);
      });
    }

    if (item.smallButtons?.length > 0) {
      console.log(`  Small buttons (<36px or <12px font): ${item.smallButtons.length}`);
      item.smallButtons.forEach((b) => {
        console.log(`    * [${b.height} x ${b.width}, font:${b.fontSize}, pad:${b.padding}] "${b.text}" (class: ${b.className})`);
      });
    }

    if (item.badgeMetrics?.length > 0) {
      console.log(`  Badges (${item.badgeMetrics.length}):`);
      item.badgeMetrics.forEach((b) => {
        console.log(`    * [font:${b.fontSize}, ${b.color} on ${b.backgroundColor}, h:${b.height}] "${b.text}"`);
      });
    }

    if (item.tables?.length > 0) {
      console.log(`  Tables: ${item.tables.length}`);
      item.tables.forEach((t) => {
        console.log(`    * Table ${t.tableWidth} (Container ${t.containerWidth}, Overflow:${t.isOverflowing}), Rows: ${t.rowCount}, Cramped Cells: ${t.crampedCellCount}`);
        console.log(`      Headers: ${t.headers.map((h) => `${h.header} (${h.width}, font:${h.fontSize}, pad:${h.padding})`).join(' | ')}`);
      });
    }

    if (item.modals?.length > 0) {
      console.log(`  Modals: ${item.modals.length}`);
      item.modals.forEach((m) => {
        console.log(`    * Modal ${m.width} x ${m.height} (VP H: ${m.viewportHeight}, Exceeds: ${m.exceedsScreenHeight})`);
      });
    }

    if (item.formControls?.length > 0) {
      console.log(`  Cramped Form Controls: ${item.formControls.length}`);
      item.formControls.forEach((f) => {
        console.log(`    * [${f.tag}, h:${f.height}, font:${f.fontSize}, pad:${f.padding}] "${f.placeholder}"`);
      });
    }
  });
}
