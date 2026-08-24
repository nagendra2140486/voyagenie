const fs = require('fs');
const { execSync } = require('child_process');

const payload = JSON.parse(
  fs.readFileSync('payload.json', 'utf8')
);

console.log(
  `Executing regression suite for ${payload.appname}`
);

execSync(
  'npx playwright test --reporter=json > results.json',
  {
    stdio: 'inherit',
    shell: true
  }
);

// Generate regression-report.json here
