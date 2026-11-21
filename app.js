/* Name That LLM — response explorer. Vanilla JS, hash routing, no deps. */

const app = document.getElementById('app')
const cache = new Map()

const VENDOR_COLORS = {
  Anthropic: '#d97757',
  OpenAI: '#10a37f',
  Google: '#4285f4',
  Alibaba: '#ff6a00',
  Zhipu: '#4d6bfe',
  Moonshot: '#8b5cf6',
  Other: '#9b978e',
}

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
const words = (t) => t.split(/\s+/).filter(Boolean).length

async function getJSON(url) {
  if (!cache.has(url)) cache.set(url, fetch(url).then((r) => { if (!r.ok) throw new Error(`${r.status} ${url}`); return r.json() }))
  return cache.get(url)
}

function vendorDot(vendor) {
  return `<span class="vendor-dot" style="background:${VENDOR_COLORS[vendor] || VENDOR_COLORS.Other}"></span>`
}

function setNav(name) {
  document.querySelectorAll('[data-nav]').forEach((a) => a.classList.toggle('active', a.dataset.nav === name))
}

/* ---------- home: model grid ---------- */
async function renderHome() {
  setNav('home')
  app.innerHTML = '<div class="loading">Loading…</div>'
  const idx = await getJSON('data/index.json')
  const cards = idx.models.map((m) => `
    <a class="model-card" href="#/model/${encodeURIComponent(m.name)}">
      <div class="name">${vendorDot(m.vendor)}${esc(m.name)}</div>
      <div class="stats">${m.count} responses · avg ${m.avgWords} words<br>${m.minWords}–${m.maxWords} words range</div>
    </a>`).join('')
  app.innerHTML = `
    <h1>Models</h1>
    <p class="page-sub">Pick a model to read its responses prompt by prompt. ${idx.models.length} models × ${idx.prompts.length} prompts in the competition train set.</p>
    <div class="grid">${cards}</div>`
}

/* ---------- prompts table ---------- */
async function renderPrompts() {
  setNav('prompts')
  app.innerHTML = '<div class="loading">Loading…</div>'
  const idx = await getJSON('data/index.json')
  const rows = idx.prompts.map((p) => `
    <tr class="rowlink" data-pid="${p.prompt_id}">
      <td class="monospec"><code>${p.prompt_id}</code></td>
      <td class="topic">${esc(p.topic)}</td>
      <td>${esc(p.domain)}</td>
      <td>${esc(p.task_type)}</td>
      <td><a href="#/prompt/${p.prompt_id}">compare 18 responses →</a></td>
    </tr>`).join('')
  app.innerHTML = `
    <h1>Prompts</h1>
    <p class="page-sub">Each prompt was answered by every model. Open one to compare all models side by side. Prompt texts are community-reconstructed from response patterns.</p>
    <input class="search" id="promptSearch" placeholder="Filter by topic, domain, task type…">
    <table class="prompt-table">
      <thead><tr><th>ID</th><th>Topic</th><th>Domain</th><th>Task</th><th></th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`
  const search = document.getElementById('promptSearch')
  search.addEventListener('input', () => {
    const q = search.value.trim().toLowerCase()
    document.querySelectorAll('[data-pid]').forEach((tr) => {
      tr.style.display = !q || tr.textContent.toLowerCase().includes(q) ? '' : 'none'
    })
  })
  app.querySelectorAll('tr[data-pid]').forEach((tr) => {
    tr.addEventListener('click', (e) => {
      if (e.target.closest('a')) return
      location.hash = `#/prompt/${tr.dataset.pid}`
    })
  })
}

/* ---------- model view ---------- */
async function renderModel(name, selPid) {
  setNav('home')
  app.innerHTML = '<div class="loading">Loading…</div>'
  const [idx, data] = await Promise.all([getJSON('data/index.json'), getJSON(`data/model/${encodeURIComponent(name)}.json`)])
  const meta = idx.models.find((m) => m.name === name)
  const promptById = new Map(idx.prompts.map((p) => [p.prompt_id, p]))
  if (!selPid) selPid = data.responses.find(Boolean).prompt_id
  let continuous = false

  const draw = () => {
    const q = (document.getElementById('idxSearch')?.value || '').trim().toLowerCase()
    const items = idx.promptIds.map((pid, i) => {
      const r = data.responses[i]
      const p = promptById.get(pid)
      const haystack = `${pid} ${p.topic} ${p.domain} ${p.task_type} ${r ? r.text : ''}`.toLowerCase()
      const visible = !q || haystack.includes(q)
      return { pid, r, p, visible }
    })

    const listHtml = items.map(({ pid, r, p, visible }) => `
      <li data-pid="${pid}" class="${pid === selPid ? 'sel' : ''}" style="${visible ? '' : 'display:none'}">
        <span>${esc(p.topic)}</span>
        <span class="wid">${r ? r.words + 'w' : '—'}</span>
      </li>`).join('')

    const selIdx = idx.promptIds.indexOf(selPid)
    const selResp = data.responses[selIdx]
    const selPrompt = promptById.get(selPid)

    const focusHtml = `
      <div class="pane-head">
        <h1>${vendorDot(meta.vendor)}${esc(name)}</h1>
        <div class="pager">
          <button id="modeBtn" class="btn">Scroll all</button>
          <button id="prevBtn" ${selIdx === 0 ? 'disabled' : ''}>← Prev</button>
          <button id="nextBtn" ${selIdx === idx.promptIds.length - 1 ? 'disabled' : ''}>Next →</button>
        </div>
      </div>
      <p class="page-sub"><code>${esc(selPid)}</code> · ${esc(selPrompt.domain)} · ${esc(selPrompt.task_type)} · response ${selIdx + 1} of ${idx.promptIds.length}</p>
      <div class="chips-row"><span class="chip">${esc(selPrompt.topic)}</span></div>
      <div class="prompt-box"><span class="label">Reconstructed prompt</span>${esc(selPrompt.inferred_prompt)}</div>
      ${selResp
        ? `<div class="response-meta">${esc(selResp.id)} · ${selResp.words} words</div>
           <div class="response-text">${esc(selResp.text)}</div>`
        : '<p class="empty-note">No response for this prompt in the train set.</p>'}
      <p class="kbd-note"><kbd>←</kbd>/<kbd>→</kbd> to move between prompts · <a href="#/prompt/${selPid}">compare all models on this prompt →</a></p>`

    const continuousHtml = `
      <div class="pane-head">
        <h1>${vendorDot(meta.vendor)}${esc(name)}</h1>
        <div class="pager">
          <button id="modeBtn" class="btn">Focus one</button>
        </div>
      </div>
      <p class="page-sub">All ${meta.count} responses, in prompt order. ${esc(name)} · avg ${meta.avgWords} words · ${meta.minWords}–${meta.maxWords} range</p>
      <div class="continuous">
        ${items.map(({ pid, r, p }) => `
          <div class="resp-block" data-pid="${pid}">
            <div class="blk-head">
              <span class="blk-topic">${esc(p.topic)}</span>
              <span class="chip">${esc(p.domain)}</span>
              <span class="chip monospec">${pid}</span>
              ${r ? `<span class="words-chip">${r.words}w</span>` : '<span class="words-chip">no response</span>'}
              <a href="#/prompt/${pid}" style="margin-left:auto;font-size:12.5px">compare →</a>
            </div>
            ${r ? `<div class="response-text">${esc(r.text)}</div>` : '<p class="empty-note">No response for this prompt in the train set.</p>'}
          </div>`).join('')}
      </div>`

    const main = document.querySelector('.reading-pane')
    main.innerHTML = continuous ? continuousHtml : focusHtml
    document.getElementById('modeBtn').addEventListener('click', () => { continuous = !continuous; draw() })
    if (!continuous) {
      document.getElementById('prevBtn').addEventListener('click', () => go(selIdx - 1))
      document.getElementById('nextBtn').addEventListener('click', () => go(selIdx + 1))
    }
  }

  const go = (i) => {
    selPid = idx.promptIds[i]
    history.replaceState(null, '', `#/model/${encodeURIComponent(name)}/${selPid}`)
    if (continuous) {
      document.querySelectorAll('#idxList li').forEach((li) => li.classList.toggle('sel', li.dataset.pid === selPid))
      const block = document.querySelector(`.resp-block[data-pid="${CSS.escape(selPid)}"]`)
      if (block) block.scrollIntoView({ block: 'start' })
    } else {
      draw()
    }
  }

  app.innerHTML = `
    <div class="model-layout">
      <aside class="prompt-index">
        <input class="search" id="idxSearch" placeholder="Search topics &amp; responses…">
        <ul id="idxList"></ul>
      </aside>
      <section class="reading-pane"></section>
    </div>`

  draw()

  document.getElementById('idxList').addEventListener('click', (e) => {
    const li = e.target.closest('li[data-pid]')
    if (li) go(idx.promptIds.indexOf(li.dataset.pid))
  })
  document.getElementById('idxSearch').addEventListener('input', () => {
    // re-render only the sidebar list to preserve focus in the input
    const q = document.getElementById('idxSearch').value.trim().toLowerCase()
    const items = idx.promptIds.map((pid, i) => {
      const r = data.responses[i]
      const p = promptById.get(pid)
      const hay = `${pid} ${p.topic} ${p.domain} ${p.task_type} ${r ? r.text : ''}`.toLowerCase()
      return { pid, p, r, visible: !q || hay.includes(q) }
    })
    document.getElementById('idxList').innerHTML = items.map(({ pid, r, p, visible }) => `
      <li data-pid="${pid}" class="${pid === selPid ? 'sel' : ''}" style="${visible ? '' : 'display:none'}">
        <span>${esc(p.topic)}</span><span class="wid">${r ? r.words + 'w' : '—'}</span>
      </li>`).join('')
  })

  document.onkeydown = (e) => {
    if (continuous || e.target.tagName === 'INPUT') return
    const i = idx.promptIds.indexOf(selPid)
    if (e.key === 'ArrowRight' && i < idx.promptIds.length - 1) go(i + 1)
    if (e.key === 'ArrowLeft' && i > 0) go(i - 1)
  }
}

/* ---------- compare view ---------- */
async function renderPrompt(pid) {
  app.innerHTML = '<div class="loading">Loading…</div>'
  const [idx, data] = await Promise.all([getJSON('data/index.json'), getJSON(`data/prompt/${encodeURIComponent(pid)}.json`)])
  const i = idx.promptIds.indexOf(pid)
  const prev = idx.promptIds[i - 1]
  const next = idx.promptIds[i + 1]
  const active = new Set(idx.models.map((m) => m.name))

  const draw = () => {
    const cards = data.responses.map((r) => {
      if (!r) return ''
      const on = active.has(r.model)
      return `
        <div class="resp-card" data-model="${esc(r.model)}" style="${on ? '' : 'display:none'}">
          <div class="card-head">
            <span class="card-model">${vendorDot(r.vendor)}<a href="#/model/${encodeURIComponent(r.model)}/${pid}">${esc(r.model)}</a></span>
            <span class="words-chip">${r.words}w · ${esc(r.id)}</span>
          </div>
          <div class="response-text">${esc(r.text)}</div>
        </div>`
    }).join('')
    const missing = idx.models.length - data.responses.filter(Boolean).length

    document.querySelector('.reading-pane').innerHTML = `
      <div class="pane-head">
        <h1><code>${esc(pid)}</code> ${esc(data.topic)}</h1>
        <div class="pager">
          ${prev ? `<button id="pPrev">← ${esc(prev)}</button>` : '<button disabled>←</button>'}
          ${next ? `<button id="pNext">${esc(next)} →</button>` : '<button disabled>→</button>'}
        </div>
      </div>
      <div class="chips-row">
        <span class="chip">${esc(data.domain)}</span>
        <span class="chip">${esc(data.task_type)}</span>
        <span class="chip">${esc(data.style)}</span>
      </div>
      <div class="prompt-box"><span class="label">Reconstructed prompt</span>${esc(data.inferred_prompt)}</div>
      <h2>Compare across models <span class="page-sub" style="display:inline">— click a model chip to filter</span></h2>
      <div class="chips-row" id="modelChips">
        ${idx.models.map((m) => `<span class="chip model-chip ${active.has(m.name) ? '' : 'off'}" data-model="${esc(m.name)}">${vendorDot(m.vendor)}${esc(m.name)}</span>`).join('')}
      </div>
      <div class="compare-grid">${cards}</div>
      ${missing ? `<p class="empty-note">${missing} model(s) have no response for this prompt.</p>` : ''}`

    document.getElementById('modelChips').addEventListener('click', (e) => {
      const chip = e.target.closest('.model-chip')
      if (!chip) return
      const m = chip.dataset.model
      if (active.has(m)) active.delete(m); else active.add(m)
      chip.classList.toggle('off')
      document.querySelectorAll('.resp-card').forEach((c) => { c.style.display = active.has(c.dataset.model) ? '' : 'none' })
    })
    if (document.getElementById('pPrev')) document.getElementById('pPrev').addEventListener('click', () => { location.hash = `#/prompt/${prev}` })
    if (document.getElementById('pNext')) document.getElementById('pNext').addEventListener('click', () => { location.hash = `#/prompt/${next}` })
  }

  app.innerHTML = '<section class="reading-pane"></section>'
  draw()
  document.onkeydown = (e) => {
    if (e.target.tagName === 'INPUT') return
    if (e.key === 'ArrowRight' && next) location.hash = `#/prompt/${next}`
    if (e.key === 'ArrowLeft' && prev) location.hash = `#/prompt/${prev}`
  }
}

/* ---------- router ---------- */
async function route() {
  document.onkeydown = null
  const h = location.hash.replace(/^#/, '') || '/'
  const parts = h.split('/').filter(Boolean)
  try {
    if (parts[0] === 'prompts') await renderPrompts()
    else if (parts[0] === 'model' && parts[1]) await renderModel(decodeURIComponent(parts[1]), parts[2])
    else if (parts[0] === 'prompt' && parts[1]) await renderPrompt(parts[1])
    else await renderHome()
  } catch (err) {
    app.innerHTML = `<h1>Something broke</h1><p class="page-sub">${esc(err.message)}</p>`
  }
  window.scrollTo(0, 0)
}

/* theme */
const themeKey = 'ntl-theme'
document.documentElement.dataset.theme = localStorage.getItem(themeKey) || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
document.getElementById('themeToggle').addEventListener('click', () => {
  const cur = document.documentElement.dataset.theme
  const next = cur === 'dark' ? 'light' : 'dark'
  document.documentElement.dataset.theme = next
  localStorage.setItem(themeKey, next)
})

window.addEventListener('hashchange', route)
route()
