const fs = require('fs');
const { execSync } = require('child_process');

const payload = JSON.parse(
  fs.readFileSync('payload.json', 'utf8')
);

console.log(`Running regression suite for ${payload.appname}`);

try {

  execSync(
    'npx playwright test --reporter=json > results.json',
    {
      stdio: 'inherit',
      shell: true
    }
  );

} catch (err) {

  console.error('Playwright execution failed');
  console.error(err.message);

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
