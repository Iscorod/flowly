import blockStyles from "./blocks.css?raw";

// A separate document keeps editor controls out of the PDF and preserves SVG
// connections as vectors. Text is inserted through DOM APIs, never as markup.
export function exportPdf(diagram, canvas) {
  const popup = window.open("", "_blank");
  if (!popup) throw new Error("Permite las ventanas emergentes para exportar el PDF.");
  const doc = popup.document;
  doc.title = diagram.title || "Diagrama";
  const style = doc.createElement("style");
  style.textContent = `
    @page { size: A4 landscape; margin: 12mm; }
    body { margin: 0; font-family: Arial, sans-serif; color: #35304c; }
    h1 { font-size: 18px; margin: 0 0 12px; overflow-wrap: anywhere; }
    .sheet { width: 273mm; height: 164mm; position: relative; overflow: hidden; }
    .drawing { position: absolute; transform-origin: top left; }
    .node { box-sizing: border-box; position: absolute; width: 150px; min-height: 55px;
      padding: 9px 12px 8px; border: 1.5px solid #b8b0d2; background: white;
      border-radius: 12px; text-align: left; color: #35304c; }
    .node strong { display: block; padding-right: 12px; font: bold 11px/1.3 Arial; }
    .node small { display: block; margin-top: 4px; color: #696078; font: 9px monospace; }
    .node .node-description { display: block; margin-top: 8px; white-space: pre-wrap;
      overflow-wrap: anywhere; color: #696078; font: 11px/1.45 Arial, sans-serif; }
    .start, .end { border-radius: 28px; }
    .decision { transform: skewX(-8deg); }
    .decision > * { transform: skewX(8deg); }
    .grip { display: none; }
    .edges { position: absolute; inset: 0; overflow: visible; }
    .edges path { fill: none; stroke: #8479bb; stroke-width: 2; }
    .edges marker path { fill: #8479bb; }
    .edges text { fill: #716b89; font: 11px monospace; }
    .actions { margin: 16px 0; }
    button { padding: 10px 16px; cursor: pointer; }
    @media print { .actions { display: none; } body { print-color-adjust: exact; } }
  `;
  style.textContent += blockStyles;
  doc.head.append(style);
  const title = doc.createElement("h1");
  title.textContent = diagram.title || "Diagrama";
  const actions = doc.createElement("div");
  actions.className = "actions";
  const button = doc.createElement("button");
  button.textContent = "Imprimir / Guardar como PDF";
  button.onclick = () => popup.print();
  actions.append(button);
  const sheet = doc.createElement("div");
  sheet.className = "sheet";
  const drawing = canvas.cloneNode(true);
  drawing.removeAttribute("class");
  drawing.className = "drawing";
  drawing.querySelectorAll(".edge-hit").forEach(node => node.remove());
  drawing.querySelectorAll(".node").forEach(node => {
    node.classList.remove("selected", "connecting");
    node.removeAttribute("tabindex");
  });
  // Include off-screen nodes and the control points of the Bézier connections.
  const nodes = [...canvas.querySelectorAll(".node")];
  const left = diagram.nodes.length ? Math.min(...diagram.nodes.map(n => n.x)) - 50 : 0;
  const top = diagram.nodes.length ? Math.min(...diagram.nodes.map(n => n.y)) - 70 : 0;
  const width = Math.max(180, ...diagram.nodes.map(n => n.x + 200 - left));
  const height = Math.max(100, ...diagram.nodes.map((n, i) =>
    n.y + Math.max(110, nodes[i]?.offsetHeight || 55) + 70 - top));
  drawing.style.width = `${width}px`;
  drawing.style.height = `${height}px`;
  drawing.querySelector("svg")?.setAttribute("height", String(height));
  sheet.append(drawing);
  doc.body.append(actions, title, sheet);
  const scale = Math.min(sheet.clientWidth / width, sheet.clientHeight / height, 1);
  drawing.style.transform = `scale(${scale}) translate(${-left}px, ${-top}px)`;
  popup.requestAnimationFrame(() => {
    popup.requestAnimationFrame(() => { popup.focus(); popup.print(); });
  });
}
