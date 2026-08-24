const { execSync } = require('child_process');

console.log('Starting regression execution...');

execSync(
  'npx playwright test --reporter=json > results.json',
  { stdio: 'inherit', shell: true }
);

console.log('Regression execution completed.');
