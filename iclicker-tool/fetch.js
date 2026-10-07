// fetch.js — Use the token saved by login.js to call the iClicker API and
// print your profile + courses. Writes raw JSON to out/.
//
//   node fetch.js
//
// Re-run login.js first if the token has expired (tokens last ~24h).

const fs = require('fs');
const path = require('path');

const AUTH = path.join(__dirname, 'auth.json');
const OUTDIR = path.join(__dirname, 'out');
const BASE = 'https://api.iclicker.com';

async function api(url, token) {
  const res = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'Origin': 'https://student.iclicker.com',
      'Referer': 'https://student.iclicker.com/',
      'Reef-Auth-Type': 'oauth',
    },
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = text; }
  return { status: res.status, json };
}

(async () => {
  if (!fs.existsSync(AUTH)) {
    console.error('✗ auth.json not found. Run `node login.js` first.');
    process.exit(1);
  }
  const { token, userId, expiresAt } = JSON.parse(fs.readFileSync(AUTH, 'utf8'));
  if (expiresAt && new Date(expiresAt) < new Date()) {
    console.error(`✗ Token expired at ${expiresAt}. Run \`node login.js\` again.`);
    process.exit(1);
  }
  fs.mkdirSync(OUTDIR, { recursive: true });

  // 1) profile
  const profile = await api(`${BASE}/trogon/v4/profile`, token);
  if (profile.status !== 200) {
    console.error(`✗ profile failed: HTTP ${profile.status}`, profile.json);
    process.exit(1);
  }
  const uid = userId || profile.json.userid;
  fs.writeFileSync(path.join(OUTDIR, 'profile.json'), JSON.stringify(profile.json, null, 2));
  const p = profile.json;
  console.log(`\n=== Profile ===`);
  console.log(`  Name:        ${p.firstName} ${p.lastName}`);
  console.log(`  Email:       ${p.email}`);
  console.log(`  Institution: ${p.institutionName}`);
  console.log(`  Status:      ${p.status}  (courses: ${p.courseCount})`);

  // 2) courses
  const courses = await api(`${BASE}/v1/users/${uid}/views/student-courses`, token);
  if (courses.status === 200) {
    fs.writeFileSync(path.join(OUTDIR, 'student-courses.json'), JSON.stringify(courses.json, null, 2));
    const enr = courses.json.enrollments || [];
    console.log(`\n=== Courses (${enr.length}) ===`);
    for (const c of enr) {
      console.log(`  • ${c.name}`);
      console.log(`      instructors: ${(c.instructors || []).join(', ')}`);
      console.log(`      term:        ${(c.start || '').slice(0,10)} → ${(c.end || '').slice(0,10)}`);
      console.log(`      courseId:    ${c.courseId}`);
    }
  } else {
    console.error(`\n✗ courses failed: HTTP ${courses.status}`, courses.json);
  }

  console.log(`\n✓ Raw JSON written to ${OUTDIR}/`);
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
