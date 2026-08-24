const fs = require('fs');

const payload = JSON.parse(
  fs.readFileSync('payload.json', 'utf8')
);

fs.writeFileSync(
  'regression-report.json',
  JSON.stringify(payload, null, 2)
);

console.log('regression-report.json generated');
