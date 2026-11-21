import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const raw = path.join(root, 'data', 'raw')
const out = path.join(root, 'data')

function parseCSV(text) {
  const rows = []
  let row = [], field = '', quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++ } else quoted = false
      } else field += c
    } else {
      if (c === '"') quoted = true
      else if (c === ',') { row.push(field); field = '' }
      else if (c === '\n') { row.push(field); rows.push(row); row = []; field = '' }
      else if (c !== '\r') field += c
    }
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row) }
  return rows
}

function vendorOf(model) {
  if (model.startsWith('claude')) return 'Anthropic'
  if (model.startsWith('gpt')) return 'OpenAI'
  if (model.startsWith('gemini')) return 'Google'
  if (model.startsWith('qwen')) return 'Alibaba'
  if (model.startsWith('glm')) return 'Zhipu'
  if (model.startsWith('kimi')) return 'Moonshot'
  return 'Other'
}

const wordCount = (t) => t.split(/\s+/).filter(Boolean).length

const trainRows = parseCSV(fs.readFileSync(path.join(raw, 'train.csv'), 'utf8'))
const trainHeader = trainRows[0]
if (trainHeader.join(',') !== 'id,prompt_id,text,model') throw new Error(`unexpected train header: ${trainHeader}`)
const responses = trainRows.slice(1).filter((r) => r.length >= 4 && r[0]).map((r) => ({
  id: r[0],
  prompt_id: r[1],
  text: r[2],
  model: r[3],
}))

const reconRows = parseCSV(fs.readFileSync(path.join(raw, 'train_prompts_reconstructed.csv'), 'utf8'))
const reconHeader = reconRows[0]
if (reconHeader[0] !== 'prompt_id' || reconHeader[1] !== 'inferred_prompt') throw new Error(`unexpected recon header: ${reconHeader}`)
const prompts = new Map()
for (const r of reconRows.slice(1)) {
  if (!r[0]) continue
  prompts.set(r[0], {
    prompt_id: r[0],
    inferred_prompt: r[1],
    topic: r[2],
    domain: r[3],
    task_type: r[4],
    style: r[5],
  })
}

const promptIds = [...prompts.keys()].sort()
const modelsMap = new Map()
for (const res of responses) {
  if (!modelsMap.has(res.model)) modelsMap.set(res.model, [])
  modelsMap.get(res.model).push(res)
}
const models = [...modelsMap.keys()].sort().map((name) => {
  const list = modelsMap.get(name)
  const words = list.map((r) => wordCount(r.text))
  return {
    name,
    vendor: vendorOf(name),
    count: list.length,
    avgWords: Math.round(words.reduce((a, b) => a + b, 0) / words.length),
    minWords: Math.min(...words),
    maxWords: Math.max(...words),
  }
})

fs.mkdirSync(path.join(out, 'model'), { recursive: true })
fs.mkdirSync(path.join(out, 'prompt'), { recursive: true })

fs.writeFileSync(path.join(out, 'index.json'), JSON.stringify({
  built: new Date().toISOString(),
  source: 'Kaggle competition "Name That LLM" (train.csv) + community-reconstructed prompt metadata',
  models,
  prompts: promptIds.map((id) => prompts.get(id)),
  promptIds,
}))

for (const model of models) {
  const list = modelsMap.get(model.name)
  const byPrompt = new Map(list.map((r) => [r.prompt_id, r]))
  fs.writeFileSync(
    path.join(out, 'model', `${model.name}.json`),
    JSON.stringify({
      model: model.name,
      vendor: model.vendor,
      responses: promptIds.map((pid) => {
        const r = byPrompt.get(pid)
        return r ? { id: r.id, prompt_id: pid, words: wordCount(r.text), text: r.text } : null
      }),
    })
  )
}

for (const pid of promptIds) {
  const meta = prompts.get(pid)
  const entries = []
  for (const model of models) {
    const r = modelsMap.get(model.name).find((x) => x.prompt_id === pid)
    entries.push(r ? { model: model.name, vendor: model.vendor, id: r.id, words: wordCount(r.text), text: r.text } : null)
  }
  fs.writeFileSync(
    path.join(out, 'prompt', `${pid}.json`),
    JSON.stringify({ ...meta, responses: entries })
  )
}

console.log(`built: ${models.length} models, ${promptIds.length} prompts, ${responses.length} responses`)
const missing = models.filter((m) => m.count !== promptIds.length).map((m) => `${m.name}=${m.count}`)
console.log(`uneven models: ${missing.join(', ') || 'none'}`)
