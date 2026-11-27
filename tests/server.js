// Piccolo server come quello di GitHub Pages: il sito sta in /Damamondo/. Le prove nel browser aprono il gioco da qui
// (come il sito vero): aperto come file, il browser di prova a volte perde la memoria del telefono quando ricarica.
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.txt': 'text/plain', '.xml': 'application/xml', '.json': 'application/json' };

function serve() {
  const srv = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]).replace(/^\/Damamondo\//, '/');
    if (p.endsWith('/')) p += 'index.html';
    const f = path.join(ROOT, p);
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('404'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(res);
  });
  return new Promise(r => srv.listen(0, '127.0.0.1', () => { srv.url = 'http://127.0.0.1:' + srv.address().port + '/Damamondo/'; r(srv); }));
}
module.exports = { serve, ROOT };
