const fs = require('fs');
const { execSync } = require('child_process');

// Read payload sent by agent
const payload = JSON.parse(
  fs.readFileSync('payload.json', 'utf8')
);

console.log(`Running regression suite for ${payload.appname}`);

// Execute Playwright regression suite
execSync(
  'npx playwright test --reporter=json > results.json',
  {
    stdio: 'inherit',
    shell: true
  }
);

// Read Playwright results
let results = {};

try {
  results = JSON.parse(
    fs.readFileSync('results.json', 'utf8')
  );
} catch (err) {
  console.log('Unable to parse results.json');
}

// Build regression report
const regressionReport = {
  appname: payload.appname,
  reporttype: 'regression-report',
  repository: payload.repository,
  pr_id: payload.pr_id,
  generated_at: new Date().toISOString(),
  original_payload: payload,
  playwright_results: results
};

// Create file required by YAML
fs.writeFileSync(
  'regression-report.json',
  JSON.stringify(regressionReport, null, 2)
);

console.log('regression-report.json created successfully');
