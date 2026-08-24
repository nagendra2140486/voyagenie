const fs = require('fs');
const { execSync } = require('child_process');

const payload = JSON.parse(
  fs.readFileSync('payload.json', 'utf8')
);

console.log(`Running impacted suite for ${payload.appname}`);

const testCases = payload.test_cases || [];

if (!testCases.length) {
  throw new Error('No test_cases found in payload');
}

/*
 * Impacted specs
 */
const specs = [
  ...new Set(
    testCases.map(tc =>
      tc.spec
        .replace(/^tests\/e2e\//, '')
        .replace(/^e2e\//, '')
    )
  )
];

console.log('Selected specs:');
console.log(specs);

/*
 * Extract only the actual Playwright test title.
 *
 * Payload:
 *   "Voyagenie commercial journeys > route / renders"
 *
 * Test title:
 *   "route / renders"
 */
const impactedTitles = testCases.map(tc => {
  const parts = tc.title.split('>');
  return parts[parts.length - 1].trim();
});

console.log('Selected impacted tests:');
console.log(impactedTitles);

/*
 * Escape regex characters for Playwright grep
 */
const grepPattern = impactedTitles
  .map(title =>
    title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  )
  .join('|');

console.log('Grep pattern:');
console.log(grepPattern);

/*
 * Run only impacted tests
 */
const command =
  `npx playwright test ${specs.join(' ')} --grep "${grepPattern}" --reporter=json > results.json`;

console.log('Executing command:');
console.log(command);

try {
  execSync(command, {
    stdio: 'inherit',
    shell: true,
    env: process.env
  });
} catch (err) {
  console.error('Playwright execution completed with failures');
  console.error(err.message);
}

/*
 * Read Playwright results
 */
let results = {};

try {
  if (fs.existsSync('results.json')) {
    results = JSON.parse(
      fs.readFileSync('results.json', 'utf8')
    );
  }
} catch (err) {
  console.error('Unable to parse results.json');
  console.error(err.message);
}

const stats = results.stats || {
  expected: 0,
  unexpected: 0,
  skipped: 0,
  flaky: 0
};

const actualExecuted =
  (stats.expected || 0) +
  (stats.unexpected || 0) +
  (stats.skipped || 0) +
  (stats.flaky || 0);

/*
 * Analysis JSON
 */
const analysisJson = {
  stage: 'functional',

  pr_id: payload.pr_id,

  runner: 'playwright',

  selection_mode: payload.selection_mode,

  selection_reason: payload.selection_reason,

  impacted_tests_selected:
    payload.total_impacted ||
    testCases.length,

  total_suite_size:
    payload.total_in_suite,

  selected_specs: specs,

  selected_tests: testCases.map(tc => ({
    title: tc.title,
    spec: tc.spec
  })),

  execution: {
    actual_tests_executed: actualExecuted,
    passed: stats.expected || 0,
    failed: stats.unexpected || 0,
    skipped: stats.skipped || 0,
    flaky: stats.flaky || 0
  }
};

/*
 * Analysis Markdown
 */
const analysisMarkdown = `
# Functional Execution

Application: ${payload.appname}

PR: ${payload.pr_id}

## Impact Analysis

- Selection Mode: ${payload.selection_mode}
- Selection Reason: ${payload.selection_reason}
- Impacted Tests Selected: ${payload.total_impacted || testCases.length}
- Suite Size: ${payload.total_in_suite || 'N/A'}

## Execution Summary

| Metric | Count |
|----------|----------:|
| Actual Tests Executed | ${actualExecuted} |
| Passed | ${stats.expected || 0} |
| Failed | ${stats.unexpected || 0} |
| Skipped | ${stats.skipped || 0} |
| Flaky | ${stats.flaky || 0} |

## Impacted Specs

${specs.map(spec => `- ${spec}`).join('\n')}

## Executed Impacted Tests

${testCases.map(tc => `- ${tc.title}`).join('\n')}
`;

const regressionReport = {
  id:
    payload.id ||
    `${payload.appname}_regression-report_${payload.pr_id}`,

  appname: payload.appname,

  reporttype: 'regression-report',

  repository: payload.repository,

  pr_id: payload.pr_id,

  analysis_markdown: analysisMarkdown,

  analysis
