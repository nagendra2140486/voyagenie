const fs = require('fs');
const { execSync } = require('child_process');

const payload = JSON.parse(
  fs.readFileSync('payload.json', 'utf8')
);

console.log(`Running regression suite for ${payload.appname}`);

let executionStatus = 'PASSED';
let playwrightResults = {};

try {

  execSync(
    'npx playwright test --reporter=json > results.json',
    {
      stdio: 'inherit',
      shell: true
    }
  );

} catch (err) {

  executionStatus = 'FAILED';

  console.error('Playwright execution failed');
  console.error(err.message);

}

try {

  if (fs.existsSync('results.json')) {

    playwrightResults = JSON.parse(
      fs.readFileSync('results.json', 'utf8')
    );

  }

} catch (err) {

  console.log('Unable to parse results.json');

}

const regressionReport = {
  id:
    payload.id ||
    `${payload.appname}_${payload.reporttype}_${payload.pr_id}`,

  appname: payload.appname,

  reporttype: payload.reporttype,

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

console.log('regression-report.json generated successfully');
