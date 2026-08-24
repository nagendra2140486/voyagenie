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
  appname: payload.appname,
  reporttype: 'regression-report',
  repository: payload.repository || '',
  pr_id: payload.pr_id || '',
  generated_at: new Date().toISOString(),
  status: executionStatus
