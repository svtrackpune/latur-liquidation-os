const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const fs = require('fs');
const path = require('path');

// Normalize the working directory to the canonical filesystem casing before
// Next/webpack resolves any modules. This prevents Windows/Plesk from exposing
// the same project as both C:\\Inetpub and C:\\inetpub.
const canonicalRoot = fs.realpathSync(__dirname);
process.chdir(canonicalRoot);

const dev = false;
const hostname = process.env.HOSTNAME || '0.0.0.0';
const port = parseInt(process.env.PORT || '3000', 10);
const app = next({ dev, hostname, port, dir: canonicalRoot });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  }).listen(port, hostname, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});
