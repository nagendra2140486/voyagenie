const fs = require('fs');
const { execSync } = require('child_process');

const payload = JSON.parse(
  fs.readFileSync('payload.json', 'utf8')
);

console.log(`Running impacted suite for ${payload.appname}`);

const testCases = payload.test_cases || [];

const specs = [
  ...new Set(
    testCases.map(tc => tc.spec)
  )
];

const grep = testCases
  .map(tc =>
    tc.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  )
  .join('|');

const command = `
npx playwright test
${specs.join(' ')}
--grep "${grep}"
--reporter=json > results.json
`;

console.log(command);

try {

  execSync(command, {
    stdio: 'inherit',
    shell: true
  });

} catch (err) {

  console.error(err.message);

}

const regressionReport = {
  id:
    payload.id ||
    `${payload.appname}_${payload.reporttype}_${payload.pr_id}`,

  appname: payload.appname,

  reporttype:
    payload.reporttype || 'regression-report',

  repository: payload.repository,

  pr_id: payload.pr_id,

  analysis_markdown:
    payload.analysis_markdown || '',

  analysis_json:
    payload.analysis_json || {},

  created_at:
    payload.created_at ||
    new Date().toISOString()
};

fs.writeFileSync(
  'regression-report.json',
  JSON.stringify(regressionReport, null, 2)
);
