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
 * Build unique spec list
 */
const specs = [
  ...new Set(
    testCases.map(tc => tc.spec)
  )
];

/*
 * Build grep expression from test titles
 */
const grep = testCases
  .map(tc =>
    tc.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  )
  .join('|');

/*
 * Execute only impacted tests
 */
const command = `npx playwright test ${specs.join(' ')} --grep "${grep}" --reporter=json > results.json`;

console.log('Executing command:');
console.log(command);

try {

  execSync(command, {
    stdio: 'inherit',
    shell: true
  });

} catch (err) {

  console.error('Playwright execution finished with failures');
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

/*
 * Extract execution stats
 */
const stats = results.stats || {};

const analysisJson = {
  stage: 'functional',
  pr_id: payload.pr_id,
  runner: 'playwright',
  selection_mode: payload.selection_mode,
  selection_reason: payload.selection_reason,
  total_impacted: payload.total_impacted,
  total_in_suite: payload.total_in_suite,
  executed_tests: testCases.length,
  stats
};

/*
 * Generate markdown summary
 */
const analysisMarkdown = `
# Impacted Regression Execution

Application: ${payload.appname}

PR: ${payload.pr_id}

Selection Mode: ${payload.selection_mode}

Selection Reason:
${payload.selection_reason}

## Execution Summary

- Total Impacted Tests: ${payload.total_impacted}
- Total Suite Size: ${payload.total_in_suite}
- Executed Test Cases: ${testCases.length}
- Passed: ${stats.expected || 0}
- Failed: ${stats.unexpected || 0}
- Skipped: ${stats.skipped || 0}

## Executed Specs

${specs.map(spec => `- ${spec}`).join('\n')}

## Executed Tests

${testCases.map(tc => `- ${tc.title}`).join('\n')}
`;

/*
 * Final report matching publish API schema
 */
const regressionReport = {
  id:
    payload.id ||
    `${payload.appname}_regression-report_${payload.pr_id}`,

  appname: payload.appname,

  reporttype: 'regression-report',

  repository: payload.repository,

  pr_id: payload.pr_id,

  analysis_markdown: analysisMarkdown,

  analysis_json: analysisJson,

  created_at:
    payload.generated_at ||
    new Date().toISOString()
};

fs.writeFileSync(
  'regression-report.json',
  JSON.stringify(regressionReport, null, 2)
);

console.log('regression-report.json generated successfully');
