const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const fs = require('fs');

// Windows/Plesk/iisnode exposes PORT as a named pipe, not necessarily a number.
// Resolve the physical application path before Next resolves modules.
const canonicalRoot = fs.realpathSync(__dirname);
process.chdir(canonicalRoot);

const dev = false;
const hostname = '0.0.0.0';

// Next needs a numeric port for its internal configuration, while IISNode
// needs the actual Plesk PORT target (often a named pipe) for the HTTP server.
const nextPort = 3000;
const listenTarget = process.env.PORT || nextPort;

const app = next({ dev, hostname, port: nextPort, dir: canonicalRoot });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  }).listen(listenTarget, hostname, () => {
    console.log(`> Ready; listening on ${listenTarget}`);
  });
}).catch((error) => {
  console.error(error);
  process.exit(1);
});
