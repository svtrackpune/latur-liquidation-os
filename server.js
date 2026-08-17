const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const fs = require('fs');

// Normalize the working directory to the canonical filesystem casing before
// Next resolves modules. This avoids Windows/Plesk path-casing duplication.
const canonicalRoot = fs.realpathSync(__dirname);
process.chdir(canonicalRoot);

const dev = false;
const hostname = '0.0.0.0';

// Plesk normally supplies PORT. Some Plesk/Windows configurations expose an
// empty/non-numeric PORT value, which must not be passed to Node's listen().
const parsedPort = Number(process.env.PORT);
const port = Number.isInteger(parsedPort) && parsedPort > 0 && parsedPort < 65536
  ? parsedPort
  : 3000;

const app = next({ dev, hostname, port, dir: canonicalRoot });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  }).listen(port, hostname, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
}).catch((error) => {
  console.error(error);
  process.exit(1);
});
