import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const seed = {
  id: "mi-primer-flujo", title: "Mi primer flujo", updatedAt: new Date().toISOString(),
  nodes: [
    { id: "inicio", label: "Inicio", type: "start", x: 340, y: 55 },
    { id: "idea", label: "¿La idea está clara?", type: "decision", x: 300, y: 180 },
    { id: "accion", label: "Preparar siguiente paso", type: "process", x: 320, y: 325 },
    { id: "fin", label: "Hecho", type: "end", x: 355, y: 470 },
  ],
  edges: [{ from: "inicio", to: "idea" }, { from: "idea", to: "accion", label: "Sí" }, { from: "accion", to: "fin" }],
};
const shapes = { start: "Inicio", process: "Proceso", decision: "Decisión", end: "Final" };
const icon = { start: "▶", process: "□", decision: "◇", end: "●" };
const slug = (text) => text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "diagrama";

function App() {
  const [diagram, setDiagram] = useState(seed);
  const [saved, setSaved] = useState([]);
  const [selected, setSelected] = useState("idea");
  const [connecting, setConnecting] = useState(null);
  const [notice, setNotice] = useState("Listo para dibujar");
  const drag = useRef(null); const canvas = useRef(null);
  useEffect(() => { fetch("/api/diagrams").then(r => r.ok ? r.json() : []).then(setSaved).catch(() => {}); }, []);
  const selectedNode = diagram.nodes.find(n => n.id === selected);
  const updateNode = (id, patch) => setDiagram(d => ({ ...d, nodes: d.nodes.map(n => n.id === id ? { ...n, ...patch } : n) }));
  const addNode = (type) => {
    const id = `${type}-${Date.now()}`;
    const n = { id, type, label: type === "decision" ? "Nueva decisión" : "Nuevo paso", x: 300 + (diagram.nodes.length % 3) * 45, y: 130 + (diagram.nodes.length % 4) * 75 };
    setDiagram(d => ({ ...d, nodes: [...d.nodes, n] })); setSelected(id); setNotice("Nodo añadido");
  };
  const erase = () => { if (!selected) return; setDiagram(d => ({ ...d, nodes: d.nodes.filter(n => n.id !== selected), edges: d.edges.filter(e => e.from !== selected && e.to !== selected) })); setSelected(null); };
  const save = async () => {
    const id = slug(diagram.title); const payload = { ...diagram, id, updatedAt: new Date().toISOString() };
    setNotice("Guardando en GitHub…");
    try { const r = await fetch(`/api/diagrams?id=${encodeURIComponent(id)}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }); if (!r.ok) throw new Error((await r.json()).error); setDiagram(payload); setSaved(list => [{ id, title: payload.title, updatedAt: payload.updatedAt }, ...list.filter(x => x.id !== id)]); setNotice("Guardado en GitHub ✓"); } catch (e) { setNotice(e.message || "No se pudo guardar"); }
  };
  const load = async (id) => { try { const r = await fetch(`/api/diagrams?id=${encodeURIComponent(id)}`); if (!r.ok) throw Error(); const data = await r.json(); setDiagram(data); setSelected(data.nodes[0]?.id); setNotice("Diagrama cargado"); } catch { setNotice("No se pudo cargar ese diagrama"); } };
  const onMove = (e) => { if (!drag.current) return; const rect = canvas.current.getBoundingClientRect(); updateNode(drag.current, { x: Math.max(15, e.clientX - rect.left - 75), y: Math.max(15, e.clientY - rect.top - 28) }); };
  const getNode = (id) => diagram.nodes.find(n => n.id === id);
  const paths = useMemo(() => diagram.edges.map((edge, i) => { const a = getNode(edge.from), b = getNode(edge.to); if (!a || !b) return null; const x1=a.x+75,y1=a.y+55,x2=b.x+75,y2=b.y; return <g key={`${edge.from}-${edge.to}-${i}`}><path d={`M ${x1} ${y1} C ${x1} ${y1+48}, ${x2} ${y2-48}, ${x2} ${y2}`} markerEnd="url(#arrow)"/><text x={(x1+x2)/2+9} y={(y1+y2)/2}>{edge.label}</text></g>; }), [diagram]);
  return <div className="app" onMouseMove={onMove} onMouseUp={() => drag.current = null}>
    <header><div className="brand"><span>✦</span> flowly</div><div className="title"><input value={diagram.title} onChange={e => setDiagram(d => ({...d, title:e.target.value}))}/><small>{notice}</small></div><button className="save" onClick={save}>↥ Guardar</button></header>
    <aside className="left"><p className="eyebrow">BLOQUES</p>{Object.entries(shapes).map(([type,name]) => <button className="tool" key={type} onClick={() => addNode(type)}><b>{icon[type]}</b>{name}<i>+</i></button>)}<div className="hint">Arrastra los bloques para organizarlos. Pulsa un bloque y después otro para unirlos.</div><p className="eyebrow saved-title">GUARDADOS</p>{saved.length ? saved.map(d => <button className="file" key={d.id} onClick={() => load(d.id)}>{d.title}<small>{d.updatedAt ? new Date(d.updatedAt).toLocaleDateString("es-ES") : "en GitHub"}</small></button>) : <p className="empty">Aún no hay diagramas en GitHub.</p>}</aside>
    <main ref={canvas} className="canvas" onClick={() => { setSelected(null); setConnecting(null); }}><svg className="edges" width="100%" height="100%"><defs><marker id="arrow" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto"><path d="M0,0 L0,9 L8,4.5 z"/></marker></defs>{paths}</svg>{diagram.nodes.map(n => <button key={n.id} className={`node ${n.type} ${selected===n.id?"selected":""} ${connecting===n.id?"connecting":""}`} style={{left:n.x,top:n.y}} onMouseDown={e => { e.stopPropagation(); drag.current=n.id; }} onClick={e => { e.stopPropagation(); if (connecting && connecting!==n.id) { setDiagram(d=>({...d,edges:[...d.edges,{from:connecting,to:n.id}]}));setConnecting(null);setNotice("Conexión creada"); } else { setSelected(n.id); setConnecting(n.id); } }}><span className="grip">⠿</span><strong>{n.label}</strong><small>{shapes[n.type]}</small></button>)}</main>
    <aside className="right"><p className="eyebrow">PROPIEDADES</p>{selectedNode ? <><label>Texto<input value={selectedNode.label} onChange={e => updateNode(selectedNode.id,{label:e.target.value})}/></label><label>Tipo<select value={selectedNode.type} onChange={e => updateNode(selectedNode.id,{type:e.target.value})}>{Object.entries(shapes).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label><button className="delete" onClick={erase}>Eliminar bloque</button><div className="tip"><b>Consejo</b>Para conectar: selecciona un bloque y haz clic en otro.</div></> : <div className="tip"><b>Selecciona un bloque</b>y edita su texto, tipo o posición.</div>}</aside>
  </div>;
}
createRoot(document.getElementById("root")).render(<App/>);
