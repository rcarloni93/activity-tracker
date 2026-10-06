#!/usr/bin/env node
/**
 * Activity Tracker — MCP Server
 *
 * This is the MCP server that Claude Desktop loads.
 * It bridges Claude's tool calls → HTTP requests to the local API (server.js).
 *
 * Add this to your Claude Desktop config (claude_desktop_config.json):
 * {
 *   "mcpServers": {
 *     "activity-tracker": {
 *       "command": "node",
 *       "args": ["/absolute/path/to/activity-tracker/mcp-server.js"]
 *     }
 *   }
 * }
 *
 * Make sure server.js is running first: node server.js
 */

const readline = require('readline');
const http = require('http');

const API_HOST = '127.0.0.1';
const API_PORT = 3747;

function send(obj) { process.stdout.write(JSON.stringify(obj) + '\n'); }
function mcpError(id, code, message) { send({ jsonrpc: '2.0', id, error: { code, message } }); }

function apiRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const options = {
      hostname: API_HOST, port: API_PORT, path, method,
      headers: { 'Content-Type': 'application/json', ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}) }
    };
    const req = http.request(options, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => { try { resolve({ status: res.statusCode, body: JSON.parse(data) }); } catch { resolve({ status: res.statusCode, body: data }); } });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function toolAddTasks(args) {
  try {
    const r = await apiRequest('POST', '/tasks', args);
    if (r.status >= 400) return { isError: true, content: [{ type: 'text', text: `API error ${r.status}: ${JSON.stringify(r.body)}` }] };
    const result = r.body;
    const lines = [`✅ Added ${result.added} item(s) to Activity Tracker`, result.items.map(i => `  • [${i.type}] ${i.title}${i.parentId ? ' (under activity)' : ''}`).join('\n')].join('\n');
    return { content: [{ type: 'text', text: lines }] };
  } catch (e) {
    return { isError: true, content: [{ type: 'text', text: `Cannot reach Activity Tracker server. Is "node server.js" running?\nError: ${e.message}` }] };
  }
}

async function toolListTasks(args) {
  try {
    const r = await apiRequest('GET', '/tasks', null);
    if (r.status >= 400) return { isError: true, content: [{ type: 'text', text: `API error: ${JSON.stringify(r.body)}` }] };
    const db = r.body;
    const filter = args.filter || 'all';
    const today = new Date(new Date().toDateString());
    let activities = db.activities || [];
    let tasks = db.tasks || [];
    if (filter === 'open') { activities = activities.filter(a => !a.done); tasks = tasks.filter(t => !t.done); }
    else if (filter === 'done') { activities = activities.filter(a => a.done); tasks = tasks.filter(t => t.done); }
    else if (filter === 'overdue') { const isOv = x => x.dueDate && !x.done && new Date(x.dueDate) < today; activities = activities.filter(isOv); tasks = tasks.filter(isOv); }
    const lines = [];
    if (activities.length) {
      lines.push('## Activities');
      activities.forEach(a => {
        const childTasks = (db.tasks || []).filter(t => t.parentId === a.id);
        lines.push(`- [${a.done ? 'x' : ' '}] ${a.title} (id: ${a.id})${a.dueDate ? ` due: ${a.dueDate}` : ''} [${a.priority}]`);
        childTasks.forEach(t => { lines.push(`    - [${t.done ? 'x' : ' '}] ${t.title} (id: ${t.id})${t.dueDate ? ` due: ${t.dueDate}` : ''}`); });
      });
    }
    const standalone = tasks.filter(t => !t.parentId);
    if (standalone.length) { lines.push('\n## Quick tasks'); standalone.forEach(t => { lines.push(`- [${t.done ? 'x' : ' '}] ${t.title} (id: ${t.id})${t.dueDate ? ` due: ${t.dueDate}` : ''} [${t.priority}]`); }); }
    if (!lines.length) lines.push('No items found.');
    return { content: [{ type: 'text', text: lines.join('\n') }] };
  } catch (e) {
    return { isError: true, content: [{ type: 'text', text: `Cannot reach server: ${e.message}` }] };
  }
}

async function toolDeleteTask(args) {
  try {
    const r = await apiRequest('DELETE', `/tasks/${args.id}`, null);
    if (r.status === 404) return { isError: true, content: [{ type: 'text', text: `Item with id "${args.id}" not found.` }] };
    return { content: [{ type: 'text', text: `Deleted item ${args.id}` }] };
  } catch (e) {
    return { isError: true, content: [{ type: 'text', text: `Cannot reach server: ${e.message}` }] };
  }
}

const rl = readline.createInterface({ input: process.stdin, terminal: false });

rl.on('line', async line => {
  let msg;
  try { msg = JSON.parse(line.trim()); } catch { return; }
  if (!msg || !msg.method) return;
  const { id, method, params } = msg;

  if (method === 'initialize') {
    send({ jsonrpc: '2.0', id, result: { protocolVersion: '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: 'activity-tracker', version: '1.0.0' } } });
    return;
  }

  if (method === 'notifications/initialized') return;

  if (method === 'tools/list') {
    send({
      jsonrpc: '2.0', id,
      result: {
        tools: [
          {
            name: 'add_tasks_from_transcript',
            description: 'Add tasks and activities to the Activity Tracker after analysing a meeting transcript. Creates activities (main workstreams) and tasks (quick action items) with due dates and priorities.',
            inputSchema: {
              type: 'object', required: ['tasks'],
              properties: {
                source: { type: 'string', description: 'Short label, e.g. "Call with Vishal 2026-10-06"' },
                tasks: { type: 'array', items: { type: 'object', required: ['title'], properties: { title: { type: 'string' }, type: { type: 'string', enum: ['task', 'activity'], default: 'task' }, parentActivity: { type: 'string' }, dueDate: { type: 'string' }, priority: { type: 'string', enum: ['high', 'medium', 'low'], default: 'medium' }, notes: { type: 'string' }, fromTranscript: { type: 'boolean', default: true } } } }
              }
            }
          },
          {
            name: 'list_tasks',
            description: 'List current tasks and activities from the Activity Tracker.',
            inputSchema: { type: 'object', properties: { filter: { type: 'string', enum: ['all', 'open', 'done', 'overdue'], default: 'all' } } }
          },
          {
            name: 'delete_task',
            description: 'Delete a task or activity by ID.',
            inputSchema: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } }
          }
        ]
      }
    });
    return;
  }

  if (method === 'tools/call') {
    const toolName = params?.name;
    const toolArgs = params?.arguments || {};
    let result;
    if (toolName === 'add_tasks_from_transcript') result = await toolAddTasks(toolArgs);
    else if (toolName === 'list_tasks') result = await toolListTasks(toolArgs);
    else if (toolName === 'delete_task') result = await toolDeleteTask(toolArgs);
    else result = { isError: true, content: [{ type: 'text', text: `Unknown tool: ${toolName}` }] };
    send({ jsonrpc: '2.0', id, result });
    return;
  }

  mcpError(id, -32601, `Method not found: ${method}`);
});

process.stdin.resume();