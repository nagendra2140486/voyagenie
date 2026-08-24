const fs = require('fs');
const { execSync } = require('child_process');

const payload = JSON.parse(
  fs.readFileSync('payload.json', 'utf8')
);

const titles = payload.test_cases.map(tc => tc.title);

const specs = [
  ...new Set(
    payload.test_cases.map(tc => tc.spec)
  )
];

const grep = titles
  .map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  .join('|');

const command =
  `npx playwright test ${specs.join(' ')} --grep "${grep}" --reporter=json > results.json`;

console.log(command);

execSync(command, {
  stdio: 'inherit'
});
`
