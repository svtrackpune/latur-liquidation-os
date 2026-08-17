const { spawn } = require('child_process');
const next = require('next');

const port = parseInt(process.env.PORT || '3000', 10);
const hostname = process.env.HOSTNAME || '0.0.0.0';
const dev = false;

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const http = require('http');
  http.createServer((req, res) => handle(req, res)).listen(port, hostname, () => {
    console.log(`Latur Liquidation OS running on ${hostname}:${port}`);
  });
});
