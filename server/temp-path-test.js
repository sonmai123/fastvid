const { parse } = require('path-to-regexp');
console.log(require('path-to-regexp/package.json').version);
const tests = ['/*', '*', '/:path(*)', '/:path(.*)'];
for (const pattern of tests) {
  try {
    parse(pattern);
    console.log(`parse ${pattern} ok`);
  } catch (e) {
    console.error(`parse ${pattern} err`, e.message);
  }
}
