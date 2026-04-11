const http = require('http');
const fs = require('fs');
const path = require('path');
const sqlite3 = require('better-sqlite3');

const PORT = 3001;
const DB_PATH = path.join(process.env.HOME, 'Repos', 'stevewesthoek', 'brain', 'data', 'google-ads', 'google_ads.sqlite3');

const server = http.createServer((req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Parse URL
  const urlObj = new URL(req.url, `http://${req.headers.host}`);
  const pathname = urlObj.pathname;

  // GET /api/mutations
  if (pathname === '/api/mutations' && req.method === 'GET') {
    try {
      const db = new sqlite3(DB_PATH, { readonly: true });
      let query = 'SELECT * FROM pending_mutations';
      const status = urlObj.searchParams.get('status');
      if (status) {
        query += ` WHERE status = '${status}'`;
      }
      const mutations = db.prepare(query).all() || [];
      db.close();
      
      res.writeHead(200);
      res.end(JSON.stringify({ mutations, count: mutations.length }));
    } catch (err) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // 404 for unknown routes
  res.writeHead(404);
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, 'localhost', () => {
  console.log(`Express API server running on http://localhost:${PORT}`);
  console.log('Endpoints:');
  console.log('  GET  /api/mutations?status=pending');
  console.log('  POST /api/mutations/:id/approve');
  console.log('  POST /api/mutations/:id/reject');
  console.log('  WebSocket /ws');
});
