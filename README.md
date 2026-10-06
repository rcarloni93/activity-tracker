# Activity Tracker

A personal task and project tracker with a Gantt timeline, installable as a desktop PWA. Claude populates it automatically from meeting transcripts via a local MCP server.

## What it does

- **Main activities** — workstreams like "Complete the FDD", with child tasks, priority, and due date
- **Quick tasks** — standalone action items like "Call Vishal to check specs"
- **Timeline view** — Gantt chart, bars auto-sized from today → due date
- **Claude integration** — paste a transcript into Claude Desktop, Claude extracts action items and POSTs them directly into the app via MCP
- **Installable** — runs as a standalone desktop app (no browser chrome) via PWA

---

## Setup

### 1. Requirements

- [Node.js](https://nodejs.org) v18+ (no npm packages needed — all standard library)
- Chrome or Edge (for PWA install)
- [Claude Desktop](https://claude.ai/download)

### 2. Clone

```bash
git clone https://github.com/rcarloni93/activity-tracker.git
cd activity-tracker
```

### 3. Start the local server

```bash
node server.js
```

You should see:
```
🟢 Activity Tracker API running at http://localhost:3747
```

Keep this terminal open — the server must be running for the app and Claude to sync.

### 4. Open the app

Serve it locally (recommended for PWA install):

```bash
npx serve .
# then open http://localhost:3000
```

### 5. Install as a desktop app

In Chrome/Edge, click the install icon in the address bar, or:
```
Settings → More tools → Create shortcut → ✅ Open as window
```

### 6. Configure Claude Desktop (MCP)

Open your Claude Desktop config:
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

Add this (replace the path with your actual path):

```json
{
  "mcpServers": {
    "activity-tracker": {
      "command": "node",
      "args": ["/absolute/path/to/activity-tracker/mcp-server.js"]
    }
  }
}
```

Restart Claude Desktop.

---

## Using with transcripts

Paste a meeting transcript into Claude Desktop and say:

> "Extract all action items from this transcript and add them to my activity tracker."

Claude will identify activities and tasks, infer due dates, assign priorities, and POST them directly into the app. The status dot in the bottom-left turns green when the server is online, and a toast appears when new tasks arrive.

### Recommended prompt

```
Here's the transcript from my call:

[paste transcript]

Extract all action items. For multi-step workstreams create an activity;
for single actions create a task under the relevant activity.
Infer due dates from any time references. Mark urgent items high priority.
Then add them all to my activity tracker.
```

---

## App shortcuts

| Action | How |
|--------|-----|
| New activity | Button or Ctrl+N |
| New quick task | Button or Ctrl+K |
| Add task to activity | Expand activity → type in field |
| Mark done | Click checkbox |
| Edit / Delete | Right-click any item |
| Timeline | Click Timeline in sidebar |

---

## API reference

```bash
# Health check
curl http://localhost:3747/health

# Add tasks manually
curl -X POST http://localhost:3747/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "source": "Manual",
    "tasks": [
      { "title": "Complete FDD review", "type": "activity", "dueDate": "2026-10-20", "priority": "high" },
      { "title": "Call Vishal", "type": "task", "parentActivity": "FDD", "dueDate": "2026-10-08" }
    ]
  }'

# List all
curl http://localhost:3747/tasks

# Delete
curl -X DELETE http://localhost:3747/tasks/TASK_ID
```

---

## Architecture

```
index.html      ← PWA app (vanilla JS, no build step)
server.js       ← Local API server (Node.js, port 3747)
mcp-server.js   ← MCP server (Claude Desktop loads this)
db.json         ← Flat-file data store
manifest.json   ← PWA manifest
sw.js           ← Service worker (offline support)
```

Data flow:
```
Claude Desktop
  ↓ transcript → MCP tool call → mcp-server.js
                                    ↓ HTTP POST /tasks
                                    ↓ server.js (port 3747)
                                        ↓ writes db.json
                                        ↓ SSE broadcast
                                        ↓ index.html (live update)
```
