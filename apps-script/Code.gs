/**
 * AI Strategy & Implementation Diagnostic — Google Sheets back end
 * ---------------------------------------------------------------
 * 1. Create a new Google Sheet. Extensions → Apps Script. Paste this file in as Code.gs.
 * 2. Run setup() once (authorise when asked). It creates the "Responses" and "Dashboard" tabs.
 * 3. Deploy → New deployment → Web app. Execute as: Me. Who has access: Anyone.
 * 4. Copy the Web app URL (ends in /exec) into CONFIG.ENDPOINT_URL in index.html.
 * See SETUP.md for full instructions.
 */

const SETTINGS = {
  RESPONSES_SHEET: 'Responses',
  DASHBOARD_SHEET: 'Dashboard',
  NOTIFY_EMAIL: '',   // e.g. 'you@aimava.com' — leave '' to switch off email alerts
};

const P_KEYS = ['purpose', 'process', 'people', 'partners', 'performance'];
const P_NAMES = ['Purpose', 'Process', 'People', 'Partners', 'Performance'];
const STAGES = [[15, 30, 'Exploring'], [31, 45, 'Developing'], [46, 60, 'Implementing'], [61, 75, 'Scaling']];

const HEADERS = [
  'Received', 'Submitted (client)', 'Name', 'Email', 'Organisation', 'Role',
  'Frustration (pain)', 'Desired outcome (prize)', 'Obstacle',
  'Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6', 'Q7', 'Q8', 'Q9', 'Q10', 'Q11', 'Q12', 'Q13', 'Q14', 'Q15',
  'Purpose', 'Process', 'People', 'Partners', 'Performance', 'Total', 'Stage', 'Strongest', 'Weakest',
  'Consent', 'Marketing opt-in', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'ref',
  'Page', 'Version', 'Follow-up status', 'Notes'
];

/* ---------------- Web app endpoints ---------------- */

function doGet() {
  return json_({ ok: true, message: 'Diagnostic endpoint is running.' });
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const d = JSON.parse((e && e.postData && e.postData.contents) || '{}');

    // Spam honeypot: real visitors never fill this hidden field.
    if (d.website) return json_({ ok: true });
    if (!d.answers || !d.consent) return json_({ ok: false, error: 'invalid' });

    // Recalculate scores server-side so stored figures can't be tampered with.
    const q = [];
    for (let i = 1; i <= 15; i++) {
      const v = Number(d.answers['q' + i]);
      q.push(v >= 1 && v <= 5 ? Math.round(v) : '');
    }
    if (q.some(v => v === '')) return json_({ ok: false, error: 'incomplete' });
    const pScores = P_KEYS.map((_, pi) => q[pi * 3] + q[pi * 3 + 1] + q[pi * 3 + 2]);
    const total = pScores.reduce((a, b) => a + b, 0);
    const stage = (STAGES.find(s => total >= s[0] && total <= s[1]) || STAGES[0])[2];
    const max = Math.max.apply(null, pScores), min = Math.min.apply(null, pScores);
    const strongest = P_NAMES.filter((_, i) => pScores[i] === max).join(', ');
    const weakest = P_NAMES.filter((_, i) => pScores[i] === min).join(', ');

    const row = [
      new Date(), clean_(d.submittedAt), clean_(d.name), clean_(d.email), clean_(d.organisation), clean_(d.role),
      clean_(d.pain), clean_(d.prize), clean_(d.obstacle),
      ...q, ...pScores, total, stage, strongest, weakest,
      d.consent ? 'Yes' : 'No', d.marketing ? 'Yes' : 'No',
      clean_(d.utm_source), clean_(d.utm_medium), clean_(d.utm_campaign), clean_(d.utm_content), clean_(d.ref),
      clean_(d.page), clean_(d.version), 'New', ''
    ];
    sheet_(SETTINGS.RESPONSES_SHEET).appendRow(row);

    if (SETTINGS.NOTIFY_EMAIL) {
      MailApp.sendEmail({
        to: SETTINGS.NOTIFY_EMAIL,
        subject: `New AI diagnostic: ${d.organisation || 'Unknown org'} — ${total}/75 (${stage})`,
        body:
          `Name: ${d.name}\nEmail: ${d.email}\nOrganisation: ${d.organisation}\nRole: ${d.role}\n\n` +
          `Total: ${total}/75 — ${stage}\n` +
          P_NAMES.map((n, i) => `${n}: ${pScores[i]}/15`).join('\n') +
          `\n\nStrongest: ${strongest}\nWeakest: ${weakest}\n\n` +
          `Frustration: ${d.pain}\nPrize: ${d.prize}\nObstacle: ${d.obstacle}\n\n` +
          `Marketing opt-in: ${d.marketing ? 'Yes' : 'No'}\nSource: ${d.utm_source || ''} ${d.utm_campaign || ''}`
      });
    }
    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    try { lock.releaseLock(); } catch (e2) {}
  }
}

/* ---------------- One-off setup: sheets + dashboard ---------------- */

function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // Responses tab
  const rs = sheet_(SETTINGS.RESPONSES_SHEET);
  rs.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS])
    .setFontWeight('bold').setBackground('#1F497D').setFontColor('#FFFFFF');
  rs.setFrozenRows(1);
  rs.setFrozenColumns(5);
  const statusCol = col_('Follow-up status');
  rs.getRange(2, statusCol, rs.getMaxRows() - 1, 1).setDataValidation(
    SpreadsheetApp.newDataValidation()
      .requireValueInList(['New', 'Contacted', 'Meeting booked', 'Proposal', 'Won', 'Not now'], true).build());

  // Dashboard tab (rebuilt from scratch each time setup() runs)
  const old = ss.getSheetByName(SETTINGS.DASHBOARD_SHEET);
  if (old) ss.deleteSheet(old);
  const db = ss.insertSheet(SETTINGS.DASHBOARD_SHEET, 0);
  const R = SETTINGS.RESPONSES_SHEET;
  const L = name => letter_(col_(name));
  const rng = name => `'${R}'!${L(name)}2:${L(name)}`;

  db.getRange('A1').setValue('AI Strategy & Implementation Diagnostic — Dashboard')
    .setFontSize(16).setFontWeight('bold').setFontColor('#1F497D');

  db.getRange('A3:B6').setValues([
    ['Responses', `=COUNTA(${rng('Email')})`],
    ['Average total (/75)', `=IFERROR(ROUND(AVERAGE(${rng('Total')}),1),"–")`],
    ['Marketing opt-ins', `=COUNTIF(${rng('Marketing opt-in')},"Yes")`],
    ['Last 30 days', `=COUNTIF(${rng('Received')},">="&(TODAY()-30))`],
  ]);

  // Average by P
  db.getRange('A8:B8').setValues([['Average by P (/15)', '']]);
  db.getRange('A9:B13').setValues(P_NAMES.map(n => [n, `=IFERROR(ROUND(AVERAGE(${rng(n)}),1),0)`]));

  // Stage distribution
  db.getRange('D8').setValue('Stage');
  db.getRange('E8').setValue('Count');
  db.getRange('D9:E12').setValues(STAGES.map(s => [s[2], `=COUNTIF(${rng('Stage')},"${s[2]}")`]));

  // Weakest-P frequency (ties counted for each P)
  db.getRange('G8').setValue('Weakest P');
  db.getRange('H8').setValue('Times weakest');
  db.getRange('G9:H13').setValues(P_NAMES.map(n => [n, `=COUNTIF(${rng('Weakest')},"*${n}*")`]));

  // Pain / prize / obstacle tallies
  const tally = (cell, header, name) => {
    const c = L(name);
    db.getRange(cell).setValue(header);
    db.getRange(cell).offset(1, 0).setFormula(
      `=IFERROR(QUERY('${R}'!${c}2:${c},"select ${c}, count(${c}) where ${c} is not null group by ${c} order by count(${c}) desc label count(${c}) ''",0),"No data yet")`);
  };
  tally('A16', 'Top frustrations (pain)', 'Frustration (pain)');
  tally('D16', 'Desired outcomes (prize)', 'Desired outcome (prize)');
  tally('G16', 'Biggest obstacles', 'Obstacle');

  // Campaign / post attribution
  tally('A28', 'Responses by campaign (utm_campaign)', 'utm_campaign');

  [3, 8, 16, 28].forEach(r => db.getRange(r, 1, 1, 8).setFontWeight('bold'));
  db.getRange('A8:H8').setFontColor('#1F497D');
  db.setColumnWidths(1, 8, 170);

  // Charts
  db.insertChart(db.newChart().setChartType(Charts.ChartType.BAR)
    .addRange(db.getRange('A9:B13')).setPosition(3, 10, 0, 0)
    .setOption('title', 'Average score by P (/15)').setOption('legend', { position: 'none' })
    .setOption('colors', ['#1F497D']).setOption('hAxis', { minValue: 0, maxValue: 15 }).build());
  db.insertChart(db.newChart().setChartType(Charts.ChartType.COLUMN)
    .addRange(db.getRange('D9:E12')).setPosition(22, 10, 0, 0)
    .setOption('title', 'Responses by stage').setOption('legend', { position: 'none' })
    .setOption('colors', ['#707DBD']).build());

  SpreadsheetApp.flush();
}

/* ---------------- Helpers ---------------- */

function sheet_(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheetByName(name) || ss.insertSheet(name);
}
function col_(header) {
  const i = HEADERS.indexOf(header);
  if (i < 0) throw new Error('Unknown header: ' + header);
  return i + 1;
}
function letter_(n) {
  let s = '';
  while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
  return s;
}
// Trim, cap length, and stop spreadsheet formula injection (=, +, -, @).
function clean_(v) {
  if (v === undefined || v === null) return '';
  let s = String(v).slice(0, 500).trim();
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  return s;
}
function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
