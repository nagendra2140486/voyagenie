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
 * Convert paths for execution from tests folder
 */
const specs = [
  ...new Set(
    testCases.map(tc =>
      tc.spec.replace(/^tests\//, '')
    )
  )
];

/*
 * Build grep from titles
 */
const grep = testCases
  .map(tc =>
    tc.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  )
  .join('|');

console.log('Specs to execute:');
console.log(specs);

console.log('Grep:');
console.log(grep);

const command =
  `npx playwright test ${specs.join(' ')} --grep "${grep}" --reporter=json > results.json`;

console.log(command);

try {

  execSync(command, {
    stdio: 'inherit',
    shell: true
  });

} catch (err) {

  console.error('Playwright execution completed with failures');
  console.error(err.message);

}

/*
 * Read results.json
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

const stats = results.stats || {};

/*
 * Build analysis_json
 */
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
 * Build analysis_markdown
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
