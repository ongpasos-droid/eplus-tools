/* ═══════════════════════════════════════════════════════════════
   Parse Form Part B (DOCX) — Deterministic extraction by tags
   Uses mammoth for DOCX → HTML, then parses tags + tables
   ═══════════════════════════════════════════════════════════════ */

const mammoth = require('mammoth');

// Section tags in the official EACEA template
const SECTION_TAGS = [
  { tag: 'PRJ-SUM-PS',     key: 'project_summary',   title: 'Project Summary' },
  { tag: 'REL-EVA-RE',     key: 'sec_1',              title: '1. Relevance' },
  { tag: 'PRJ-OBJ-PO',     key: 'sec_1_sub',          title: '1. Relevance (sub)' },
  { tag: 'COM-PLE-CP',     key: 'sec_1_3',            title: '1.3 Complementarity' },
  { tag: 'CON-MET-CM',     key: 'sec_2_1_1',          title: '2.1.1 Concept and methodology' },
  { tag: 'PRJ-MGT-PM',     key: 'sec_2_1_2',          title: '2.1.2 Project management' },
  { tag: 'CON-SOR-CS',     key: 'sec_2_consortium',   title: '2.2 Consortium' },
  { tag: 'FIN-MGT-FM',     key: 'sec_2_1_4',          title: '2.1.4 Cost effectiveness' },
  { tag: 'RSK-MGT-RM',     key: 'sec_2_1_5',          title: '2.1.5 Risk management' },
  { tag: 'IMP-ACT-IA',     key: 'sec_3_1',            title: '3.1 Impact and ambition' },
  { tag: 'COM-DIS-VIS-CDV',key: 'sec_3_2',            title: '3.2 Communication and dissemination' },
  { tag: 'SUS-CON-SC',     key: 'sec_3_3',            title: '3.3 Sustainability' },
  { tag: 'WRK-PLA-WP',     key: 'sec_4',              title: '4. Work Plan' },
  { tag: 'ETH-ICS-EI',     key: 'sec_5_1',            title: '5.1 Ethics' },
  { tag: 'SEC-URI-SU',     key: 'sec_5_2',            title: '5.2 Security' },
  { tag: 'DEC-LAR-DL',     key: 'sec_6',              title: '6. Declarations' },
];

/**
 * Parse a DOCX Form Part B buffer into structured data
 * @param {Buffer} buffer - DOCX file buffer
 * @returns {Object} { cover, sections, tables, raw }
 */
async function parseFormB(buffer) {
  // Extract both raw text (for tags) and HTML (for tables)
  const [textResult, htmlResult] = await Promise.all([
    mammoth.extractRawText({ buffer }),
    mammoth.convertToHtml({ buffer }),
  ]);

  const text = textResult.value;
  const html = htmlResult.value;

  const result = {
    cover: extractCover(html),
    sections: {},
    tables: extractAllTables(html),
    work_packages: [],
  };

  // Extract sections by tags
  for (const { tag, key } of SECTION_TAGS) {
    const open = `#@${tag}@#`;
    const close = `#§${tag}§#`;
    const start = text.indexOf(open);
    const end = text.indexOf(close);
    if (start >= 0 && end >= 0 && end > start) {
      let content = text.substring(start + open.length, end).trim();
      // Remove nested tags
      content = content.replace(/#[@§][A-Z-]+[@§]#/g, '').trim();
      // Remove template instructions (lines starting with guidance text)
      content = cleanContent(content);
      result.sections[key] = content;
    }
  }

  // Extract work packages from HTML
  result.work_packages = extractWorkPackages(html);

  // Extract risk table
  result.risk_table = extractRiskTable(html);

  // Extract staff table
  result.staff_table = extractStaffTable(html);

  // Extract events table
  result.events_table = extractEventsTable(html);

  return result;
}

function extractCover(html) {
  const cover = {};
  // Find cover table (first table in document)
  const tableHtml = getTableByIndex(html, 0);
  if (!tableHtml) return cover;

  const rows = parseTableRows(tableHtml);
  for (const row of rows) {
    if (row.length >= 2) {
      const label = row[0].toLowerCase();
      if (label.includes('project name')) cover.project_name = row[1];
      if (label.includes('acronym')) cover.acronym = row[1];
      if (label.includes('coordinator')) cover.coordinator = row[1];
    }
  }
  return cover;
}

function extractWorkPackages(html) {
  const wps = [];
  // Find WP tables by looking for "Work Package N:" pattern
  const wpRegex = /Work Package\s*(\d+)\s*:\s*([^<]+)/gi;
  let match;
  while ((match = wpRegex.exec(html)) !== null) {
    const wpNum = parseInt(match[1]);
    const wpName = match[2].replace(/<[^>]+>/g, '').trim();

    // Find the table context around this match
    const pos = match.index;

    // Look for duration and lead beneficiary nearby
    const nearby = html.substring(pos, Math.min(pos + 2000, html.length));
    const durMatch = nearby.match(/Duration:\s*(M\d+\s*[–-]\s*M\d+)/i);
    const leadMatch = nearby.match(/Lead Beneficiary:\s*([^<]+)/i);

    const wp = {
      number: wpNum,
      name: wpName,
      duration: durMatch ? durMatch[1].trim() : null,
      lead: leadMatch ? leadMatch[1].trim() : null,
      objectives: '',
      tasks: [],
      milestones: [],
      deliverables: [],
    };

    // Extract tasks table (look for T{n}.{m} pattern in nearby tables)
    const tasksData = extractTasksNearPosition(html, pos, wpNum);
    wp.tasks = tasksData.tasks;
    wp.objectives = tasksData.objectives;
    wp.milestones = tasksData.milestones;
    wp.deliverables = tasksData.deliverables;

    wps.push(wp);
  }
  return wps;
}

function extractTasksNearPosition(html, startPos, wpNum) {
  const result = { objectives: '', tasks: [], milestones: [], deliverables: [] };
  const searchArea = html.substring(startPos, Math.min(startPos + 30000, html.length));

  // Find all tables in this area
  let tPos = 0;
  while (true) {
    const tStart = searchArea.indexOf('<table', tPos);
    if (tStart < 0) break;
    const tEnd = searchArea.indexOf('</table>', tStart);
    if (tEnd < 0) break;
    const tableHtml = searchArea.substring(tStart, tEnd + 8);
    const rows = parseTableRows(tableHtml);

    if (rows.length === 0) { tPos = tEnd + 8; continue; }

    // Check if it's a tasks table (has T{n}.{m} entries)
    const taskPattern = new RegExp(`T${wpNum}\\.\\d`);
    const hasTaskIds = rows.some(r => r.some(c => taskPattern.test(c)));
    if (hasTaskIds) {
      for (const row of rows) {
        if (taskPattern.test(row[0])) {
          result.tasks.push({
            id: row[0]?.trim(),
            name: row[1]?.trim() || '',
            description: row[2]?.trim() || '',
            participants: row[3]?.trim() || '',
            role: row[4]?.trim() || '',
            subcontracting: row[5]?.trim() || '',
          });
        }
      }
    }

    // Check if it's milestones (has MS{n} entries)
    const msPattern = /^MS\d+/;
    const hasMsIds = rows.some(r => r.some(c => msPattern.test(c?.trim())));
    if (hasMsIds) {
      for (const row of rows) {
        if (msPattern.test(row[0]?.trim())) {
          result.milestones.push({
            id: row[0]?.trim(),
            name: row[1]?.trim() || '',
            wp: row[2]?.trim() || '',
            lead: row[3]?.trim() || '',
            description: row[4]?.trim() || '',
            due_date: row[5]?.trim() || '',
            verification: row[6]?.trim() || '',
          });
        }
      }
    }

    // Check if it's deliverables (has D{n}.{m} entries)
    const delPattern = new RegExp(`D${wpNum}\\.\\d`);
    const hasDelIds = rows.some(r => r.some(c => delPattern.test(c?.trim())));
    if (hasDelIds) {
      for (const row of rows) {
        if (delPattern.test(row[0]?.trim())) {
          result.deliverables.push({
            id: row[0]?.trim(),
            name: row[1]?.trim() || '',
            wp: row[2]?.trim() || '',
            lead: row[3]?.trim() || '',
            type: row[4]?.trim() || '',
            dissemination: row[5]?.trim() || '',
            due_date: row[6]?.trim() || '',
            description: row[7]?.trim() || '',
          });
        }
      }
    }

    // Check for objectives (first table after WP header with single-cell content)
    if (rows.length <= 3 && !hasTaskIds && !hasMsIds && !hasDelIds) {
      const objText = rows.map(r => r.join(' ')).join(' ').trim();
      if (objText.length > 20 && !objText.includes('Duration:')) {
        result.objectives = objText;
      }
    }

    tPos = tEnd + 8;
  }

  return result;
}

function extractRiskTable(html) {
  const risks = [];
  // Find risk table by looking for RSK-MGT tag context
  const rskPos = html.indexOf('RSK-MGT-RM');
  if (rskPos < 0) return risks;

  const searchArea = html.substring(rskPos, Math.min(rskPos + 10000, html.length));
  const tStart = searchArea.indexOf('<table');
  if (tStart < 0) return risks;
  const tEnd = searchArea.indexOf('</table>', tStart);
  const tableHtml = searchArea.substring(tStart, tEnd + 8);
  const rows = parseTableRows(tableHtml);

  for (const row of rows) {
    if (row[0] && /^\d+/.test(row[0].trim())) {
      risks.push({
        number: row[0].trim(),
        description: row[1]?.trim() || '',
        wp: row[2]?.trim() || '',
        mitigation: row[3]?.trim() || '',
      });
    }
  }
  return risks;
}

function extractStaffTable(html) {
  const staff = [];
  const consorPos = html.indexOf('CON-SOR-CS');
  if (consorPos < 0) return staff;

  const searchArea = html.substring(consorPos, Math.min(consorPos + 15000, html.length));
  const tables = getAllTablesInArea(searchArea);

  for (const tableHtml of tables) {
    const rows = parseTableRows(tableHtml);
    // Staff table has Name, Organisation, Role, Profile columns
    const hasStaffData = rows.some(r => r.length >= 3 && r.some(c => /COO|BEN|AE|coordinator/i.test(c)));
    if (hasStaffData) {
      for (const row of rows) {
        if (row.length >= 3 && row[0] && row[0].length > 2 && !/^Name/i.test(row[0])) {
          staff.push({
            name: row[0].trim(),
            organisation: row[1]?.trim() || '',
            role: row[2]?.trim() || '',
            profile: row[3]?.trim() || '',
          });
        }
      }
    }
  }
  return staff;
}

function extractEventsTable(html) {
  const events = [];
  const evtMatch = html.match(/Events meetings and mobility/i);
  if (!evtMatch) return events;

  const evtPos = html.indexOf(evtMatch[0]);
  const searchArea = html.substring(evtPos, Math.min(evtPos + 15000, html.length));
  const tables = getAllTablesInArea(searchArea);

  for (const tableHtml of tables) {
    const rows = parseTableRows(tableHtml);
    for (const row of rows) {
      if (row[0] && /^E[\.\d]+/.test(row[0].trim())) {
        events.push({
          id: row[0].trim(),
          participant: row[1]?.trim() || '',
          type: row[2]?.trim() || '',
          area: row[3]?.trim() || '',
          location: row[4]?.trim() || '',
          duration: row[5]?.trim() || '',
          attendees: row[6]?.trim() || '',
        });
      }
    }
  }
  return events;
}

// ── Helpers ──

function getTableByIndex(html, idx) {
  let pos = 0;
  for (let i = 0; i <= idx; i++) {
    const start = html.indexOf('<table', pos);
    if (start < 0) return null;
    const end = html.indexOf('</table>', start) + 8;
    if (i === idx) return html.substring(start, end);
    pos = end;
  }
  return null;
}

function getAllTablesInArea(area) {
  const tables = [];
  let pos = 0;
  while (true) {
    const start = area.indexOf('<table', pos);
    if (start < 0) break;
    const end = area.indexOf('</table>', start);
    if (end < 0) break;
    tables.push(area.substring(start, end + 8));
    pos = end + 8;
  }
  return tables;
}

function parseTableRows(tableHtml) {
  const rows = [];
  const rowMatches = tableHtml.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || [];
  for (const rowHtml of rowMatches) {
    const cells = [];
    const cellMatches = rowHtml.match(/<t[dh][^>]*>[\s\S]*?<\/t[dh]>/gi) || [];
    for (const cellHtml of cellMatches) {
      cells.push(cellHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
    }
    rows.push(cells);
  }
  return rows;
}

function extractAllTables(html) {
  const tables = [];
  let pos = 0;
  let idx = 0;
  while (true) {
    const start = html.indexOf('<table', pos);
    if (start < 0) break;
    const end = html.indexOf('</table>', start) + 8;
    const tableHtml = html.substring(start, end);
    const rows = parseTableRows(tableHtml);
    tables.push({ index: idx, rows });
    idx++;
    pos = end;
  }
  return tables;
}

function cleanContent(text) {
  // Remove common template instructions
  const removePatterns = [
    /^Please address .+$/gm,
    /^Describe the .+$/gm,
    /^Explain how .+$/gm,
    /^Outline the .+$/gm,
    /^Define the .+$/gm,
    /^Indicate .+$/gm,
    /^Note: .+$/gm,
    /^\[This document is tagged.+\]$/gm,
    /^See Abstract .+$/gm,
    /^Project summary .+$/gm,
  ];
  for (const pat of removePatterns) {
    text = text.replace(pat, '');
  }
  // Remove multiple blank lines
  text = text.replace(/\n{3,}/g, '\n\n').trim();
  return text;
}

module.exports = { parseFormB };
