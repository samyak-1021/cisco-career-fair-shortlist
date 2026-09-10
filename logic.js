/*
 * logic.js — Career Fair Eligibility Shortlist (pure logic layer)
 *
 * Pure logic layer — no DOM access. Imported by both index.html (as browser globals)
 * and tests.js (via node require). Single entry point: runEvaluation().
 */

// ---------- Data layer (real, so the suite can run without crashing) ----------
const BUILTIN_PROFILE = {
  branch: 'CSE', cgpa: 8.1, gradYear: 2027, backlogs: 1, skills: ['Git', 'Python', 'SQL'],
};

const ROLES = [
  { id: 'CF01', title: 'Data Operations Intern',     branches: ['CSE', 'IT'],        minCgpa: 7.5, gradYears: [2027],       maxBacklogs: 1, requiredSkills: ['Python', 'SQL'] },
  { id: 'CF02', title: 'QA Automation Intern',        branches: ['CSE', 'ECE', 'IT'], minCgpa: 7.0, gradYears: [2027, 2028], maxBacklogs: 1, requiredSkills: ['Git'] },
  { id: 'CF03', title: 'Embedded Systems Intern',     branches: ['ECE', 'EEE'],       minCgpa: 7.5, gradYears: [2027],       maxBacklogs: 1, requiredSkills: ['Git'] },
  { id: 'CF04', title: 'Machine Learning Intern',     branches: ['CSE', 'IT'],        minCgpa: 8.5, gradYears: [2027],       maxBacklogs: 1, requiredSkills: ['Python'] },
  { id: 'CF05', title: 'Platform Engineering Intern', branches: ['CSE', 'ECE'],       minCgpa: 7.0, gradYears: [2026],       maxBacklogs: 0, requiredSkills: ['Docker', 'Git'] },
];

// ---------- Core logic ----------
function parseAndValidateProfile(raw) {
  // Fields are validated in a fixed order; the first invalid field wins (single message).

  // branch: trim; blank -> INVALID_BRANCH
  const branch = String(raw.branch ?? '').trim();
  if (branch === '') return { ok: false, error: 'INVALID_BRANCH' };

  // NOTE (documented assumption): numeric fields accept ONLY plain decimal notation. This is
  // stricter than the literal spec ("finite number") — it rejects hex/scientific forms such as
  // 0x7EB or 2e3 that Number() would otherwise treat as valid, because a human filling the form
  // never types those. The regex guards enforce this before Number() range checks.

  // cgpa: a plain decimal from 0 to 10 inclusive
  const cgpaStr = String(raw.cgpa ?? '').trim();
  if (!/^\d+(\.\d+)?$/.test(cgpaStr)) return { ok: false, error: 'INVALID_CGPA' };
  const cgpa = Number(cgpaStr);
  if (cgpa < 0 || cgpa > 10) return { ok: false, error: 'INVALID_CGPA' };

  // gradYear: a plain whole number from 2000 to 2100
  const yearStr = String(raw.gradYear ?? '').trim();
  if (!/^\d+$/.test(yearStr)) return { ok: false, error: 'INVALID_GRADUATION_YEAR' };
  const gradYear = Number(yearStr);
  if (gradYear < 2000 || gradYear > 2100) return { ok: false, error: 'INVALID_GRADUATION_YEAR' };

  // backlogs: a plain whole number >= 0
  const backStr = String(raw.backlogs ?? '').trim();
  if (!/^\d+$/.test(backStr)) return { ok: false, error: 'INVALID_BACKLOG_COUNT' };
  const backlogs = Number(backStr);

  // skills: split on commas, trim each, drop empty pieces, collapse duplicates (case-insensitive)
  const skills = [];
  const seen = new Set();
  for (const piece of String(raw.skills ?? '').split(',')) {
    const s = piece.trim();
    if (s === '') continue;
    const key = s.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    skills.push(s);
  }

  return { ok: true, profile: { branch, cgpa, gradYear, backlogs, skills } };
}
function evaluateRole(profile, role) {
  // All five rules are evaluated independently (no short-circuit); failures are
  // collected into `reasons` in the fixed required order.
  const reasons = [];

  // 1. branch (compared case-insensitively)
  const branchLower = profile.branch.toLowerCase();
  if (!role.branches.some((b) => b.toLowerCase() === branchLower)) {
    reasons.push('BRANCH_NOT_ALLOWED');
  }

  // 2. CGPA at or above the minimum (inclusive)
  if (profile.cgpa < role.minCgpa) {
    reasons.push('CGPA_BELOW_MINIMUM');
  }

  // 3. graduation year in the allowed set
  if (!role.gradYears.includes(profile.gradYear)) {
    reasons.push('GRADUATION_YEAR_NOT_ALLOWED');
  }

  // 4. backlogs at or below the maximum (inclusive)
  if (profile.backlogs > role.maxBacklogs) {
    reasons.push('TOO_MANY_ACTIVE_BACKLOGS');
  }

  // 5. missing required skills — build the profile's lowercased skill set once, then
  //    match case-insensitively. Missing skills are sorted case-insensitively but the
  //    role's original skill casing is preserved in the message.
  const skillSet = new Set(profile.skills.map((s) => s.toLowerCase()));
  const missing = role.requiredSkills
    .filter((s) => !skillSet.has(s.toLowerCase()))
    .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
  for (const s of missing) reasons.push('MISSING_SKILL: ' + s);

  return {
    id: role.id,
    title: role.title,
    status: reasons.length === 0 ? 'ELIGIBLE' : 'INELIGIBLE',
    reasons,
  };
}
function evaluateAll(profile, roles) {
  return roles.map((r) => evaluateRole(profile, r));
}
function sortResults(results) {
  // ELIGIBLE before INELIGIBLE; then by title (case-insensitive) ascending; then by id ascending.
  const rank = (r) => (r.status === 'ELIGIBLE' ? 0 : 1);
  return results.slice().sort((a, b) => {
    if (rank(a) !== rank(b)) return rank(a) - rank(b);
    const ta = a.title.toLowerCase();
    const tb = b.title.toLowerCase();
    if (ta < tb) return -1;
    if (ta > tb) return 1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}
function countResults(results) {
  let eligible = 0;
  let ineligible = 0;
  for (const r of results) {
    if (r.status === 'ELIGIBLE') eligible++;
    else ineligible++;
  }
  return { eligible, ineligible };
}
function runEvaluation(raw, roles) {
  const parsed = parseAndValidateProfile(raw);
  if (!parsed.ok) return { ok: false, error: parsed.error };
  const results = sortResults(evaluateAll(parsed.profile, roles));
  return { ok: true, results, counts: countResults(results) };
}

// Export for node (tests) + attach nothing special for the browser (functions are global there).
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { BUILTIN_PROFILE, ROLES, parseAndValidateProfile, evaluateRole, evaluateAll, sortResults, countResults, runEvaluation };
}
