const repo = process.env.GITHUB_REPO;
const branch = process.env.GITHUB_BRANCH || "main";
const root = "data/flow-diagrams";
const headers = () => ({ Authorization: `Bearer ${process.env.GITHUB_TOKEN}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "Content-Type": "application/json", "User-Agent": "flow-studio" });
const url = (path) => `https://api.github.com/repos/${repo}/contents/${path}`;
const decode = (content) => JSON.parse(Buffer.from(content, "base64").toString("utf8"));

export default async function handler(req, res) {
  if (!repo || !process.env.GITHUB_TOKEN) return res.status(500).json({ error: "Configura GITHUB_REPO y GITHUB_TOKEN en Vercel." });
  const id = String(req.query.id || "").replace(/[^a-z0-9-]/gi, "");
  try {
    if (req.method === "GET" && !id) { const r = await fetch(`${url(root)}?ref=${branch}`, { headers: headers() }); if (r.status === 404) return res.status(200).json([]); if (!r.ok) throw Error(`GitHub respondió ${r.status}`); const files = await r.json(); return res.status(200).json(files.filter(f => f.name.endsWith(".json")).map(f => ({ id: f.name.slice(0,-5), title: f.name.slice(0,-5) }))); }
    if (req.method === "GET" && id) { const r = await fetch(`${url(`${root}/${id}.json`)}?ref=${branch}`, { headers: headers() }); if (!r.ok) throw Error(`GitHub respondió ${r.status}`); return res.status(200).json(decode((await r.json()).content)); }
    if (req.method === "PUT" && id) { const target = `${root}/${id}.json`; const existing = await fetch(`${url(target)}?ref=${branch}`, { headers: headers() }); const current = existing.ok ? await existing.json() : null; if (!existing.ok && existing.status !== 404) throw Error(`GitHub respondió ${existing.status}`); const body = { message: `Guardar diagrama: ${req.body.title || id}`, content: Buffer.from(JSON.stringify({ ...req.body, id }, null, 2)).toString("base64"), branch }; if (current) body.sha = current.sha; const r = await fetch(url(target), { method: "PUT", headers: headers(), body: JSON.stringify(body) }); if (!r.ok) throw Error((await r.json()).message || `GitHub respondió ${r.status}`); return res.status(200).json({ ok:true }); }
    return res.status(405).json({ error:"Método no permitido" });
  } catch (error) { console.error(error); return res.status(500).json({ error: error.message || "No se pudo acceder a GitHub" }); }
}
