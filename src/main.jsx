import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import { exportPdf } from "./exportPdf.js";

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
  const [selectedEdge, setSelectedEdge] = useState(null);
  const [connecting, setConnecting] = useState(null);
  const [notice, setNotice] = useState("Listo para dibujar");
  const drag = useRef(null); const canvas = useRef(null);
  const [nodeHeights, setNodeHeights] = useState({});
  useLayoutEffect(() => {
    const elements = [...canvas.current.querySelectorAll(".node")];
    const measure = () => {
      const sizes = Object.fromEntries(elements.map((element, i) => [diagram.nodes[i].id, element.offsetHeight]));
      setNodeHeights(previous => JSON.stringify(previous) === JSON.stringify(sizes) ? previous : sizes);
    };
    measure();
    const observer = new ResizeObserver(measure);
    elements.forEach(element => observer.observe(element));
    return () => observer.disconnect();
  }, [diagram.nodes]);
  useEffect(() => { fetch("/api/diagrams").then(r => r.ok ? r.json() : []).then(setSaved).catch(() => {}); }, []);
  const selectedNode = diagram.nodes.find(n => n.id === selected);
  const edge = selectedEdge === null ? null : diagram.edges[selectedEdge];
  const selectEdge = (index) => {
    setSelectedEdge(index); setSelected(null); setConnecting(null);
  };
  const updateEdge = (patch) => {
    setDiagram(d => ({ ...d, edges: d.edges.map((e, i) => i === selectedEdge ? { ...e, ...patch } : e) }));
    setNotice("Relación modificada · pulsa Guardar");
  };
  const deleteEdge = () => {
    setDiagram(d => ({ ...d, edges: d.edges.filter((_, i) => i !== selectedEdge) }));
    setSelectedEdge(null); setNotice("Relación eliminada · pulsa Guardar");
  };
  useEffect(() => { if (selected !== null) setSelectedEdge(null); }, [selected]);
  useEffect(() => { setSelectedEdge(null); }, [diagram.id]);
  const updateNode = (id, patch) => setDiagram(d => ({ ...d, nodes: d.nodes.map(n => n.id === id ? { ...n, ...patch } : n) }));
  const addNode = (type) => {
    const id = `${type}-${Date.now()}`;
    const n = { id, type, label: type === "decision" ? "Nueva decisión" : "Nuevo paso", x: 300 + (diagram.nodes.length % 3) * 45, y: 130 + (diagram.nodes.length % 4) * 75 };
    setDiagram(d => ({ ...d, nodes: [...d.nodes, n] })); setSelected(id); setNotice("Nodo añadido");
  };
  const erase = useCallback(() => {
    if (!selected) return;
    setDiagram(d => ({
      ...d,
      nodes: d.nodes.filter(n => n.id !== selected),
      edges: d.edges.filter(e => e.from !== selected && e.to !== selected),
    }));
    setSelected(null);
    setSelectedEdge(null);
    setConnecting(null);
    drag.current = null;
    setNotice("Bloque eliminado · pulsa Guardar");
  }, [selected]);
  useEffect(() => {
    const handleDelete = event => {
      const target = event.target;
      if (event.key !== "Delete" || event.defaultPrevented || event.isComposing ||
          event.repeat || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey ||
          target?.closest?.("input, textarea, select, [role='textbox']") ||
          target?.isContentEditable || !selected) return;
      event.preventDefault();
      erase();
    };
    window.addEventListener("keydown", handleDelete);
    return () => window.removeEventListener("keydown", handleDelete);
  }, [selected, erase]);
  const save = async () => {
    const id = slug(diagram.title); const payload = { ...diagram, id, updatedAt: new Date().toISOString() };
    setNotice("Guardando en GitHub…");
    try { const r = await fetch(`/api/diagrams?id=${encodeURIComponent(id)}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }); if (!r.ok) throw new Error((await r.json()).error); setDiagram(payload); setSaved(list => [{ id, title: payload.title, updatedAt: payload.updatedAt }, ...list.filter(x => x.id !== id)]); setNotice("Guardado en GitHub ✓"); } catch (e) { setNotice(e.message || "No se pudo guardar"); }
  };
  const load = async (id) => { try { const r = await fetch(`/api/diagrams?id=${encodeURIComponent(id)}`); if (!r.ok) throw Error(); const data = await r.json(); setDiagram(data); setSelected(data.nodes[0]?.id); setNotice("Diagrama cargado"); } catch { setNotice("No se pudo cargar ese diagrama"); } };
  const onMove = (e) => { if (!drag.current) return; const rect = canvas.current.getBoundingClientRect(); updateNode(drag.current, { x: Math.max(15, e.clientX - rect.left - 75), y: Math.max(15, e.clientY - rect.top - 28) }); };
  const getNode = (id) => diagram.nodes.find(n => n.id === id);
  const paths = diagram.edges.map((edge, i) => {
    const a = getNode(edge.from), b = getNode(edge.to);
    if (!a || !b) return null;
    const x1=a.x+75,y1=a.y+(nodeHeights[a.id] || 55),x2=b.x+75,y2=b.y;
    const path = `M ${x1} ${y1} C ${x1} ${y1+48}, ${x2} ${y2-48}, ${x2} ${y2}`;
    return <g key={i} className={selectedEdge === i ? "edge-active" : ""}
      role="button" tabIndex={0} aria-label={`Editar relación: ${a.label} → ${b.label}`}
      onClick={e => { e.stopPropagation(); selectEdge(i); }}
      onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); selectEdge(i); } }}>
      <path className="edge-hit" d={path}/>
      <path className="edge-line" d={path} markerEnd="url(#arrow)"/>
      <text x={(x1+x2)/2+9} y={(y1+y2)/2}>{edge.label}</text>
    </g>;
  });
  return <div className="app" onMouseMove={onMove} onMouseUp={() => drag.current = null}>
    <header><div className="brand"><span>✦</span> flowly</div><div className="title"><input value={diagram.title} onChange={e => setDiagram(d => ({...d, title:e.target.value}))}/><small role="status">{notice}</small></div><button className="save export" onClick={() => { try { exportPdf(diagram, canvas.current); } catch (error) { setNotice(error.message); } }}>Exportar PDF</button><button className="save" onClick={save}>↥ Guardar</button></header>
    <aside className="left"><p className="eyebrow">BLOQUES</p>{Object.entries(shapes).map(([type,name]) => <button className="tool" key={type} onClick={() => addNode(type)}><b>{icon[type]}</b>{name}<i>+</i></button>)}<div className="hint">Arrastra los bloques para organizarlos. Pulsa un bloque y después otro para unirlos.</div><p className="eyebrow saved-title">GUARDADOS</p>{saved.length ? saved.map(d => <button className="file" key={d.id} onClick={() => load(d.id)}>{d.title}<small>{d.updatedAt ? new Date(d.updatedAt).toLocaleDateString("es-ES") : "en GitHub"}</small></button>) : <p className="empty">Aún no hay diagramas en GitHub.</p>}</aside>
    <main ref={canvas} className="canvas" onClick={() => { setSelected(null); setConnecting(null); }}><svg className="edges" width="100%" height="100%"><defs><marker id="arrow" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto"><path d="M0,0 L0,9 L8,4.5 z"/></marker></defs>{paths}</svg>{diagram.nodes.map(n => <button key={n.id} className={`node ${n.type} ${selected===n.id?"selected":""} ${connecting===n.id?"connecting":""}`} style={{left:n.x,top:n.y}} onMouseDown={e => { e.stopPropagation(); drag.current=n.id; }} onClick={e => { e.stopPropagation(); if (connecting && connecting!==n.id) { setDiagram(d=>({...d,edges:[...d.edges,{from:connecting,to:n.id}]}));setConnecting(null);setNotice("Conexión creada"); } else { setSelected(n.id); setConnecting(n.id); } }}><span className="grip">⠿</span><strong>{n.label}</strong><small>{shapes[n.type]}</small>{n.description && <span className="node-description">{n.description}</span>}</button>)}</main>
    <aside className="right"><p className="eyebrow">PROPIEDADES</p>{selectedNode ? <><label>Texto<input value={selectedNode.label} onChange={e => updateNode(selectedNode.id,{label:e.target.value})}/></label>
      <label>Descripción (opcional)<textarea rows={5} value={selectedNode.description || ""} placeholder="Explica qué ocurre en este paso…" onChange={e => { updateNode(selectedNode.id,{description:e.target.value}); setNotice("Descripción modificada · pulsa Guardar"); }}/></label>
      <label>Tipo<select value={selectedNode.type} onChange={e => updateNode(selectedNode.id,{type:e.target.value})}>{Object.entries(shapes).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label><button className="delete" onClick={erase}>Eliminar bloque</button><div className="tip"><b>Consejo</b>Para conectar: selecciona un bloque y haz clic en otro.</div></> : edge ? <>
      <label>Origen<select value={edge.from} onChange={e => updateEdge({from:e.target.value})}>{diagram.nodes.map(n => <option key={n.id} value={n.id} disabled={n.id===edge.to}>{n.label}</option>)}</select></label>
      <label>Destino<select value={edge.to} onChange={e => updateEdge({to:e.target.value})}>{diagram.nodes.map(n => <option key={n.id} value={n.id} disabled={n.id===edge.from}>{n.label}</option>)}</select></label>
      <label>Texto de la relación<input value={edge.label || ""} placeholder="Ej.: Sí, No, Aprobado…" onChange={e => updateEdge({label:e.target.value})}/></label>
      <button className="tool" onClick={() => updateEdge({from:edge.to,to:edge.from})}>Invertir dirección</button>
      <button className="delete" onClick={deleteEdge}>Eliminar relación</button>
      <button className="tool" onClick={() => setSelectedEdge(null)}>Cerrar selección</button>
    </> : <div className="tip"><b>Selecciona un bloque o una flecha</b>Edita los bloques o cambia y elimina sus relaciones.</div>}
    <p className="eyebrow saved-title">RELACIONES</p>
    {diagram.edges.map((relation, i) => <button className="file" key={i} aria-pressed={selectedEdge === i} onClick={() => selectEdge(i)}>{getNode(relation.from)?.label || "Bloque"} → {getNode(relation.to)?.label || "Bloque"}{relation.label && <small>{relation.label}</small>}</button>)}
    {!diagram.edges.length && <p className="empty">Sin relaciones.</p>}
    </aside>
  </div>;
}
createRoot(document.getElementById("root")).render(<App/>);
