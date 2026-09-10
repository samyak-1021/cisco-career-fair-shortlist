/*
 * tests.js — test suite for the Career Fair Eligibility Shortlist
 * Run with:  node tests.js
 *
 * Written test-first (TDD): logic.js does not exist yet, so this will FAIL
 * until the implementation lands. That red state is expected and correct.
 *
 * Contract assumed of logic.js (CommonJS export for node; also global in browser):
 *   BUILTIN_PROFILE = { branch, cgpa, gradYear, backlogs, skills:[] }   (already normalized)
 *   ROLES           = [ { id, title, branches:[], minCgpa, gradYears:[], maxBacklogs, requiredSkills:[] } ]
 *   parseAndValidateProfile(raw) -> { ok:true, profile } | { ok:false, error:'INVALID_*' }
 *       raw = { branch, cgpa, gradYear, backlogs, skills }  (all strings, as typed in the form;
 *                                                            skills is a single comma-separated string)
 *   evaluateRole(profile, role)  -> { id, title, status:'ELIGIBLE'|'INELIGIBLE', reasons:[] }
 *   evaluateAll(profile, roles)  -> [ result ]
 *   sortResults(results)         -> [ result ]  (eligible first; then title asc, case-insensitive; then id asc)
 *   countResults(results)        -> { eligible, ineligible }
 *   runEvaluation(raw, roles)    -> { ok:true, results, counts } | { ok:false, error }
 */

const L = require('./logic.js');

// ---------- tiny zero-dependency assertion harness ----------
let passed = 0, failed = 0;
const failures = [];

function deepEqual(a, b) {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((x, i) => deepEqual(x, b[i]));
  }
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const ka = Object.keys(a), kb = Object.keys(b);
    return ka.length === kb.length && ka.every(k => deepEqual(a[k], b[k]));
  }
  return false;
}
function check(name, cond) {
  if (cond) { passed++; }
  else { failed++; failures.push(name); console.log('  ✗ ' + name); }
}
function eq(name, actual, expected) {
  const ok = deepEqual(actual, expected);
  if (!ok) console.log('    expected: ' + JSON.stringify(expected) + '\n    actual:   ' + JSON.stringify(actual));
  check(name, ok);
}
function group(t) { console.log('\n' + t); }

// ---------- shared fixtures ----------
const builtinRaw = { branch: 'CSE', cgpa: '8.1', gradYear: '2027', backlogs: '1', skills: 'Git, Python, SQL' };
const base = { branch: 'CSE', cgpa: '8.1', gradYear: '2027', backlogs: '1', skills: 'Git' };
const byId   = (results, id) => results.find(r => r.id === id);
const byRole = (id) => L.ROLES.find(r => r.id === id);
const err    = (raw) => { const r = L.parseAndValidateProfile(raw); return r.ok ? null : r.error; };

// ============================================================
group('Group 1 — Acceptance criteria (from the spec)');

// AC1: built-in profile -> CF01,CF02 eligible; CF03,CF04,CF05 ineligible; counts 2/3
{
  const out = L.runEvaluation(builtinRaw, L.ROLES);
  check('AC1: runEvaluation succeeds on built-in', out.ok === true);
  eq('AC1: counts are 2 eligible / 3 ineligible', out.counts, { eligible: 2, ineligible: 3 });
  eq('AC1: CF01 ELIGIBLE', byId(out.results, 'CF01').status, 'ELIGIBLE');
  eq('AC1: CF02 ELIGIBLE', byId(out.results, 'CF02').status, 'ELIGIBLE');
  eq('AC1: CF03 INELIGIBLE', byId(out.results, 'CF03').status, 'INELIGIBLE');
  eq('AC1: CF04 INELIGIBLE', byId(out.results, 'CF04').status, 'INELIGIBLE');
  eq('AC1: CF05 INELIGIBLE', byId(out.results, 'CF05').status, 'INELIGIBLE');
}

// AC2: exact failure reasons per ineligible role
{
  const out = L.runEvaluation(builtinRaw, L.ROLES);
  eq('AC2: CF03 = [BRANCH_NOT_ALLOWED]', byId(out.results, 'CF03').reasons, ['BRANCH_NOT_ALLOWED']);
  eq('AC2: CF04 = [CGPA_BELOW_MINIMUM]', byId(out.results, 'CF04').reasons, ['CGPA_BELOW_MINIMUM']);
  eq('AC2: CF05 reasons in exact order',
     byId(out.results, 'CF05').reasons,
     ['GRADUATION_YEAR_NOT_ALLOWED', 'TOO_MANY_ACTIVE_BACKLOGS', 'MISSING_SKILL: Docker']);
}

// AC3: change only CGPA to 8.5 -> CF04 flips eligible; eligible order CF01, CF04, CF02; counts 3/2
{
  const out = L.runEvaluation({ ...builtinRaw, cgpa: '8.5' }, L.ROLES);
  eq('AC3: counts 3 eligible / 2 ineligible', out.counts, { eligible: 3, ineligible: 2 });
  eq('AC3: CF04 now ELIGIBLE', byId(out.results, 'CF04').status, 'ELIGIBLE');
  const eligibleIds = out.results.filter(r => r.status === 'ELIGIBLE').map(r => r.id);
  eq('AC3: eligible order by title = CF01, CF04, CF02', eligibleIds, ['CF01', 'CF04', 'CF02']);
}

// AC4: CGPA 10.5 -> INVALID_CGPA, no results/counts
{
  const out = L.runEvaluation({ ...builtinRaw, cgpa: '10.5' }, L.ROLES);
  check('AC4: ok is false', out.ok === false);
  eq('AC4: error is INVALID_CGPA', out.error, 'INVALID_CGPA');
  check('AC4: no results returned', out.results === undefined || (Array.isArray(out.results) && out.results.length === 0));
  check('AC4: no counts returned', out.counts === undefined);
}

// ============================================================
group('Group 2 — Field validation (every input)');

// branch
eq('branch blank -> INVALID_BRANCH',        err({ ...base, branch: '' }),   'INVALID_BRANCH');
eq('branch whitespace -> INVALID_BRANCH',   err({ ...base, branch: '   ' }),'INVALID_BRANCH');

// cgpa (finite number 0..10 inclusive)
eq('cgpa non-numeric -> INVALID_CGPA',      err({ ...base, cgpa: 'abc' }), 'INVALID_CGPA');
eq('cgpa empty -> INVALID_CGPA',            err({ ...base, cgpa: '' }),    'INVALID_CGPA');
eq('cgpa negative -> INVALID_CGPA',         err({ ...base, cgpa: '-1' }),  'INVALID_CGPA');
eq('cgpa above 10 -> INVALID_CGPA',         err({ ...base, cgpa: '10.5' }),'INVALID_CGPA');
check('cgpa 0 is valid',                    err({ ...base, cgpa: '0' })  === null);
check('cgpa 10 is valid',                   err({ ...base, cgpa: '10' }) === null);

// gradYear (whole number 2000..2100)
eq('gradYear below 2000 -> INVALID_GRADUATION_YEAR', err({ ...base, gradYear: '1999' }), 'INVALID_GRADUATION_YEAR');
eq('gradYear above 2100 -> INVALID_GRADUATION_YEAR', err({ ...base, gradYear: '2101' }), 'INVALID_GRADUATION_YEAR');
eq('gradYear non-integer -> INVALID_GRADUATION_YEAR',err({ ...base, gradYear: '2027.5' }), 'INVALID_GRADUATION_YEAR');
eq('gradYear empty -> INVALID_GRADUATION_YEAR',      err({ ...base, gradYear: '' }), 'INVALID_GRADUATION_YEAR');
check('gradYear 2000 is valid',             err({ ...base, gradYear: '2000' }) === null);
check('gradYear 2100 is valid',             err({ ...base, gradYear: '2100' }) === null);

// backlogs (whole number >= 0)
eq('backlogs negative -> INVALID_BACKLOG_COUNT',    err({ ...base, backlogs: '-1' }),  'INVALID_BACKLOG_COUNT');
eq('backlogs non-integer -> INVALID_BACKLOG_COUNT', err({ ...base, backlogs: '1.5' }), 'INVALID_BACKLOG_COUNT');
eq('backlogs non-numeric -> INVALID_BACKLOG_COUNT', err({ ...base, backlogs: 'abc' }), 'INVALID_BACKLOG_COUNT');
eq('backlogs empty -> INVALID_BACKLOG_COUNT',       err({ ...base, backlogs: '' }),    'INVALID_BACKLOG_COUNT');
check('backlogs 0 is valid',                        err({ ...base, backlogs: '0' }) === null);

// stricter-than-spec hardening: reject non-decimal notation (hex / scientific) that Number() would accept
eq('cgpa scientific notation rejected',     err({ ...base, cgpa: '1e1' }),       'INVALID_CGPA');
eq('gradYear scientific notation rejected',  err({ ...base, gradYear: '2e3' }),   'INVALID_GRADUATION_YEAR');
eq('gradYear hex rejected',                  err({ ...base, gradYear: '0x7EB' }), 'INVALID_GRADUATION_YEAR');
eq('backlogs scientific notation rejected',  err({ ...base, backlogs: '2e1' }),   'INVALID_BACKLOG_COUNT');
eq('backlogs hex rejected',                  err({ ...base, backlogs: '0x2' }),   'INVALID_BACKLOG_COUNT');

// documented validation order: branch -> cgpa -> gradYear -> backlogs (first invalid wins)
eq('multiple invalid -> branch reported first',
   err({ branch: '', cgpa: 'abc', gradYear: '1999', backlogs: '-1' }), 'INVALID_BRANCH');
eq('multiple invalid (branch ok) -> cgpa reported next',
   err({ branch: 'CSE', cgpa: 'abc', gradYear: '1999', backlogs: '-1' }), 'INVALID_CGPA');

// ============================================================
group('Group 3 — Input normalization');

// skills: split on commas, trim, drop empty pieces
{
  const r = L.parseAndValidateProfile({ ...base, skills: 'Git, , Python,' });
  eq('skills split/trim/drop-empty', r.profile.skills.map(s => s.toLowerCase()).sort(), ['git', 'python']);
}
// duplicate skills collapsed (case-insensitive)
{
  const r = L.parseAndValidateProfile({ ...base, skills: 'Python, python, PYTHON' });
  eq('duplicate skills collapse to one', r.profile.skills.length, 1);
}
// empty skills -> VALID profile with no skills (skills has no validity rule in the spec)
{
  const r = L.parseAndValidateProfile({ ...base, skills: '' });
  check('empty skills is a valid profile', r.ok === true);
  eq('empty skills -> skills = []', r.profile.skills, []);
}
{
  const r = L.parseAndValidateProfile({ ...base, skills: '  , , ' });
  eq('comma/whitespace-only skills -> skills = []', r.profile.skills, []);
}
// a no-skills profile is still evaluated (ineligible for skill-requiring roles, not an error)
{
  const profile = { branch: 'CSE', cgpa: 8, gradYear: 2027, backlogs: 0, skills: [] };
  eq('no-skills profile misses a required skill', L.evaluateRole(profile, byRole('CF02')).reasons, ['MISSING_SKILL: Git']);
}
// branch trimmed + compared case-insensitively
{
  const r = L.parseAndValidateProfile({ ...base, branch: '  cse  ' });
  const res = L.evaluateRole(r.profile, byRole('CF01')); // CF01 allows CSE, IT
  check('branch "  cse  " matches CSE role (trim + case-insensitive)',
        !res.reasons.includes('BRANCH_NOT_ALLOWED'));
}
// skills matched case-insensitively
{
  const profile = { branch: 'CSE', cgpa: 8.0, gradYear: 2027, backlogs: 0, skills: ['docker', 'git'] };
  const res = L.evaluateRole(profile, byRole('CF05')); // needs Docker, Git
  check('skills matched case-insensitively (docker satisfies Docker)',
        !res.reasons.some(x => x.startsWith('MISSING_SKILL')));
}
// no alias inference
{
  const role = { id: 'X', title: 'X', branches: ['CSE'], minCgpa: 0, gradYears: [2027], maxBacklogs: 9, requiredSkills: ['JavaScript'] };
  const profile = { branch: 'CSE', cgpa: 8, gradYear: 2027, backlogs: 0, skills: ['JS'] };
  eq('no alias inference: "JS" does not satisfy "JavaScript"',
     L.evaluateRole(profile, role).reasons, ['MISSING_SKILL: JavaScript']);
}

// ============================================================
group('Group 4 — Reason ordering & no short-circuit');

// fails ALL non-skill rules + misses two skills -> every reason, fixed order, skills alpha (case-insensitive)
{
  const role = { id: 'Z', title: 'Z', branches: ['ECE'], minCgpa: 9.0, gradYears: [2026], maxBacklogs: 0, requiredSkills: ['Docker', 'Ansible'] };
  const profile = { branch: 'CSE', cgpa: 7.0, gradYear: 2027, backlogs: 2, skills: [] };
  const res = L.evaluateRole(profile, role);
  eq('every failed rule listed, fixed order, missing skills alphabetical',
     res.reasons,
     ['BRANCH_NOT_ALLOWED', 'CGPA_BELOW_MINIMUM', 'GRADUATION_YEAR_NOT_ALLOWED', 'TOO_MANY_ACTIVE_BACKLOGS', 'MISSING_SKILL: Ansible', 'MISSING_SKILL: Docker']);
  eq('status INELIGIBLE', res.status, 'INELIGIBLE');
}
// missing-skill sort is case-insensitive but original casing preserved in the message
{
  const role = { id: 'Z', title: 'Z', branches: ['CSE'], minCgpa: 0, gradYears: [2027], maxBacklogs: 9, requiredSkills: ['zebra', 'Apple'] };
  const profile = { branch: 'CSE', cgpa: 8, gradYear: 2027, backlogs: 0, skills: [] };
  eq('missing skills sorted case-insensitive: Apple before zebra',
     L.evaluateRole(profile, role).reasons, ['MISSING_SKILL: Apple', 'MISSING_SKILL: zebra']);
}
// fully eligible -> no reasons
{
  const profile = { branch: 'CSE', cgpa: 8, gradYear: 2027, backlogs: 0, skills: ['Git'] };
  const res = L.evaluateRole(profile, byRole('CF02'));
  eq('eligible role has empty reasons', res.reasons, []);
  eq('eligible status', res.status, 'ELIGIBLE');
}

// ============================================================
group('Group 5 — Result ordering (eligible first, title asc, id asc)');
{
  const results = [
    { id: 'B2', title: 'Beta',  status: 'INELIGIBLE', reasons: ['X'] },
    { id: 'A1', title: 'Alpha', status: 'ELIGIBLE',   reasons: [] },
    { id: 'A2', title: 'Alpha', status: 'ELIGIBLE',   reasons: [] },
    { id: 'C1', title: 'alpha', status: 'ELIGIBLE',   reasons: [] }, // case-insensitive tie with Alpha
  ];
  eq('sorted: eligible first, title asc (case-insensitive), id asc',
     L.sortResults(results).map(r => r.id), ['A1', 'A2', 'C1', 'B2']);
}

// ============================================================
group('Group 6 — Counts');
{
  const results = [
    { id: '1', title: 'a', status: 'ELIGIBLE',   reasons: [] },
    { id: '2', title: 'b', status: 'INELIGIBLE', reasons: ['X'] },
    { id: '3', title: 'c', status: 'ELIGIBLE',   reasons: [] },
  ];
  eq('countResults tallies eligible/ineligible', L.countResults(results), { eligible: 2, ineligible: 1 });
}

// ============================================================
group('Group 7 — Boundary conditions (inclusive comparisons)');
{
  const role = byRole('CF04'); // min CGPA 8.5
  check('cgpa == min is eligible (>=)',
        L.evaluateRole({ branch: 'CSE', cgpa: 8.5, gradYear: 2027, backlogs: 0, skills: ['Python'] }, role).status === 'ELIGIBLE');
  check('cgpa just below min fails',
        L.evaluateRole({ branch: 'CSE', cgpa: 8.49, gradYear: 2027, backlogs: 0, skills: ['Python'] }, role).reasons.includes('CGPA_BELOW_MINIMUM'));
}
{
  const role = byRole('CF01'); // max backlogs 1
  check('backlogs == max is eligible (<=)',
        L.evaluateRole({ branch: 'CSE', cgpa: 8, gradYear: 2027, backlogs: 1, skills: ['Python', 'SQL'] }, role).status === 'ELIGIBLE');
  check('backlogs over max fails',
        L.evaluateRole({ branch: 'CSE', cgpa: 8, gradYear: 2027, backlogs: 2, skills: ['Python', 'SQL'] }, role).reasons.includes('TOO_MANY_ACTIVE_BACKLOGS'));
}

// ============================================================
group('Group 8 — Data-driven roles config sanity');
check('ROLES is an array of 5 roles', Array.isArray(L.ROLES) && L.ROLES.length === 5);
check('every role has the required fields with correct types', L.ROLES.every(r =>
  typeof r.id === 'string' && typeof r.title === 'string' &&
  Array.isArray(r.branches) && typeof r.minCgpa === 'number' &&
  Array.isArray(r.gradYears) && typeof r.maxBacklogs === 'number' &&
  Array.isArray(r.requiredSkills)));

// ---------- summary ----------
console.log('\n' + '─'.repeat(44));
console.log('Passed: ' + passed + '   Failed: ' + failed);
if (failed) { console.log('Failing:\n  - ' + failures.join('\n  - ')); process.exit(1); }
console.log('All tests passed ✅');
process.exit(0);
