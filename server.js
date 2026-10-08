import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 12000;

const MIME_TYPES = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'text/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
    let filePath;
    try {
        filePath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    } catch {
        // Malformed percent-encoding (e.g. /%ZZ) — reject instead of crashing.
        res.writeHead(400);
        res.end('Bad Request');
        return;
    }

    // Default to index.html for root path
    if (filePath === '/') {
        filePath = '/index.html';
    }

    // Prevent directory traversal outside the project root. Compare
    // against `__dirname + sep` so sibling dirs like `airport-clicker-x`
    // don't pass a bare startsWith check.
    const resolved = path.normalize(path.join(__dirname, filePath));
    const insideRoot = resolved === __dirname || resolved.startsWith(__dirname + path.sep);

    // Never serve dot-segments (.git, .env, ...) or node_modules contents.
    const hasPrivateSegment = path.relative(__dirname, resolved)
        .split(path.sep)
        .some(seg => seg.startsWith('.') || seg === 'node_modules');

    if (!insideRoot || hasPrivateSegment) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
    }
    filePath = resolved;

    const extname = path.extname(filePath);
    const contentType = MIME_TYPES[extname] || 'application/octet-stream';

    fs.readFile(filePath, (err, content) => {
        if (err) {
            if (err.code === 'ENOENT') {
                fs.readFile(path.join(__dirname, '404.html'), (err404, content404) => {
                    res.writeHead(404, { 'Content-Type': 'text/html' });
                    res.end(content404 || '404 Not Found', 'utf-8');
                });
            } else {
                res.writeHead(500);
                res.end(`Server Error: ${err.code}`);
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://localhost:${PORT}/`);
});
