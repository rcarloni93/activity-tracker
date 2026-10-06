#!/usr/bin/env node
/**
 * Activity Tracker — local API server
 * Runs on http://localhost:3747
 *
 * Endpoints:
 *   GET  /health            → { ok: true }
 *   GET  /data              → full data store
 *   PUT  /data              → replace full data store (used by the app)
 *   GET  /events            → SSE stream (notifies app of updates)
 *   POST /tasks             → add one or more tasks from a transcript (MCP endpoint)
 *
 * MCP tool definition: see mcp-tools.json
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3747;
const DB_FILE = path.join(__dirname, 'db.json');

function loadDB() {
  try { return JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); }
  catch { return { activities: [], tasks: [] }; }
}

function saveDB(d) { fs.writeFileSync(DB_FILE, JSON.stringify(d, null, 2)); }

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

const sseClients = new Set();
function broadcast(msg) {
  const data = `data: ${JSON.stringify(msg)}\n\n`;
  sseClients.forEach(res => { try { res.write(data); } catch { sseClients.delete(res); } });
}

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => { try { resolve(JSON.parse(body || '{}')); } catch { reject(new Error('Invalid JSON')); } });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
  const url = req.url.split('?')[0];

  try {
    if (req.method === 'GET' && url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, ts: new Date().toISOString() }));
      return;
    }

    if (req.method === 'GET' && url === '/data') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(loadDB()));
      return;
    }

    if (req.method === 'PUT' && url === '/data') {
      saveDB(await readBody(req));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    if (req.method === 'GET' && url === '/events') {
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive', 'X-Accel-Buffering': 'no' });
      res.write('data: {"type":"connected"}\n\n');
      sseClients.add(res);
      req.on('close', () => sseClients.delete(res));
      return;
    }

    if (req.method === 'POST' && url === '/tasks') {
      const body = await readBody(req);
      const db = loadDB();
      const items = body.tasks || (body.title ? [body] : []);
      if (!items.length) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'No tasks provided.' }));
        return;
      }
      let added = 0;
      const results = [];
      for (const item of items) {
        const isActivity = (item.type || 'task') === 'activity';
        const now = new Date().toISOString();
        if (isActivity) {
          const a = { id: uid(), title: item.title, dueDate: item.dueDate || null, priority: item.priority || 'medium', notes: item.notes || null, done: false, fromTranscript: item.fromTranscript !== false, source: body.source || null, createdAt: now };
          db.activities.push(a);
          results.push({ id: a.id, type: 'activity', title: a.title });
        } else {
          let parentId = null;
          if (item.parentActivity) {
            const parent = db.activities.find(a => a.id === item.parentActivity || a.title.toLowerCase().includes(item.parentActivity.toLowerCase()));
            parentId = parent ? parent.id : null;
          }
          const t = { id: uid(), title: item.title, parentId, dueDate: item.dueDate || null, priority: item.priority || 'medium', notes: item.notes || null, done: false, fromTranscript: item.fromTranscript !== false, source: body.source || null, createdAt: now };
          db.tasks.push(t);
          results.push({ id: t.id, type: 'task', title: t.title, parentId });
        }
        added++;
      }
      saveDB(db);
      broadcast({ type: 'update', count: added, source: body.source });
      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, added, items: results }));
      return;
    }

    if (req.method === 'DELETE' && url.startsWith('/tasks/')) {
      const id = url.split('/')[2];
      const db = loadDB();
      const taskIdx = db.tasks.findIndex(t => t.id === id);
      const actIdx = db.activities.findIndex(a => a.id === id);
      if (taskIdx >= 0) { db.tasks.splice(taskIdx, 1); }
      else if (actIdx >= 0) { db.activities.splice(actIdx, 1); db.tasks = db.tasks.filter(t => t.parentId !== id); }
      else { res.writeHead(404, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'Not found' })); return; }
      saveDB(db);
      broadcast({ type: 'update', count: 0 });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    if (req.method === 'GET' && url === '/tasks') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(loadDB()));
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  } catch (err) {
    console.error('Server error:', err.message);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message }));
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`\n🟢 Activity Tracker API running at http://localhost:${PORT}`);
  console.log(`   POST /tasks  — Claude sends tasks here`);
  console.log(`   GET  /data   — full data store`);
  console.log(`   GET  /health — health check\n`);
});

process.on('SIGINT', () => { server.close(); process.exit(0); });