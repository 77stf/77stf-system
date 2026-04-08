// ─── 77STF n8n Workflow Sync ──────────────────────────────────────────────────
// Usage: node n8n-workflows/sync.mjs
import { readFileSync, readdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const N8N_URL     = process.env.N8N_URL || 'https://n8n.socmid.cloud'
const N8N_API_KEY = process.env.N8N_API_KEY
if (!N8N_API_KEY) { console.error('ERROR: N8N_API_KEY missing in .env.local'); process.exit(1) }

const DIR = dirname(fileURLToPath(import.meta.url))
const headers = { 'X-N8N-API-KEY': N8N_API_KEY, 'Content-Type': 'application/json' }

async function api(method, path, body) {
  const res = await fetch(`${N8N_URL}/api/v1${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  try { return JSON.parse(text) } catch { return text }
}

// n8n API only accepts these fields on create/update
function stripWorkflow(w) {
  return {
    name: w.name,
    nodes: w.nodes,
    connections: w.connections,
    settings: w.settings || {},
  }
}

console.log(`Syncing workflows to ${N8N_URL}\n`)

// Get existing workflows
const existing = await api('GET', '/workflows?limit=100')
const existingMap = {}
for (const w of (existing.data || [])) existingMap[w.name] = w.id

// Process each JSON file
const files = readdirSync(DIR).filter(f => f.endsWith('.json'))

for (const file of files) {
  const filePath = join(DIR, file)
  const workflow = JSON.parse(readFileSync(filePath, 'utf8'))
  const payload = stripWorkflow(workflow)

  process.stdout.write(`${workflow.name}... `)

  let id = existingMap[workflow.name]

  if (id) {
    await api('PUT', `/workflows/${id}`, payload)
    process.stdout.write(`updated (${id})`)
  } else {
    const created = await api('POST', '/workflows', payload)
    id = created.id
    if (!id) { console.log(`ERROR: ${JSON.stringify(created)}`); continue }
    process.stdout.write(`created (${id})`)
  }

  // Activate
  await api('PATCH', `/workflows/${id}`, { active: true })
  console.log(` → active`)
}

console.log('\nDone.')
