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
    @page { size: auto; margin: 12mm; }
    body { margin: 0; font-family: Arial, sans-serif; color: #35304c; }
    h1 { font-size: 18px; margin: 0 0 12px; overflow-wrap: anywhere; }
    .page { break-after: page; page-break-after: always; }
    .page:last-child { break-after: auto; page-break-after: auto; }
    .page h1 { height: 12mm; margin: 0; font-size: 16px; overflow: hidden; }
    .sheet { position: relative; overflow: hidden; }
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
    .actions { margin: 16px 0; display: flex; gap: 16px; flex-wrap: wrap; align-items: center; }
    select { padding: 8px; margin-left: 6px; }
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
  const orientation = doc.createElement("select");
  orientation.setAttribute("aria-label", "Orientación del PDF");
  [["portrait","Vertical"],["landscape","Horizontal"]].forEach(([value,text]) => orientation.add(new popup.Option(text,value)));
  const mode = doc.createElement("select");
  mode.setAttribute("aria-label","Distribución del PDF");
  [["pages","Varias páginas · texto más grande"],["single","Todo en una página"]].forEach(([value,text]) => mode.add(new popup.Option(text,value)));
  const orientationLabel = doc.createElement("label");
  orientationLabel.textContent = "Orientación";
  orientationLabel.append(orientation);
  const modeLabel = doc.createElement("label");
  modeLabel.textContent = "Distribución";
  modeLabel.append(mode);
  actions.prepend(orientationLabel,modeLabel);
  const help = doc.createElement("p");
  help.className = "actions";
  help.textContent = "Elige la orientación aquí antes de imprimir. Usa papel A4 y escala 100 %. En varias páginas se repite una pequeña franja para seguir las conexiones.";
  const pages = doc.createElement("div");
  const pageStyle = doc.createElement("style");
  doc.head.append(pageStyle);
  const drawing = canvas.cloneNode(true);
  drawing.removeAttribute("class");
  drawing.className = "drawing";
  drawing.querySelectorAll(".edge-hit").forEach(node => node.remove());
  drawing.querySelectorAll(".annotation-hit").forEach(node => node.remove());
  drawing.querySelectorAll(".annotation-resize").forEach(node => node.remove());
  drawing.querySelectorAll(".annotation-selected").forEach(node => node.classList.remove("annotation-selected"));
  drawing.querySelectorAll(".node").forEach(node => {
    node.classList.remove("selected", "connecting");
    node.removeAttribute("tabindex");
  });
  // Include off-screen nodes and the control points of the Bézier connections.
  const nodes = [...canvas.querySelectorAll(".node")];
  const annotationElements = [...canvas.querySelectorAll(".annotation")];
  const items = [...diagram.nodes.map((n,i) => ({...n,width:150,height:nodes[i]?.offsetHeight || 55})),
    ...(diagram.annotations || []).map((a,i) => ({...a,height:Math.max(a.height,annotationElements[i]?.scrollHeight || 0)}))];
  const left = items.length ? Math.min(...items.map(n => n.x)) - 50 : 0;
  const top = items.length ? Math.min(...items.map(n => n.y)) - 70 : 0;
  const width = Math.max(180, ...items.map(n => n.x + n.width + 50 - left));
  const height = Math.max(100, ...items.map(n => n.y + n.height + 70 - top));
  drawing.style.width = `${width}px`;
  drawing.style.height = `${height}px`;
  drawing.querySelector("svg.edges")?.setAttribute("height", String(height));
  doc.body.append(actions, help, pages);
  orientation.value = height >= width ? "portrait" : "landscape";
  const render = () => {
    const portrait = orientation.value === "portrait";
    const pageWidth = portrait ? 186 : 273;
    const pageHeight = portrait ? 258 : 171;
    pageStyle.textContent = `@page { size: A4 ${orientation.value}; margin: 12mm; }`;
    pages.replaceChildren();
    const pxPerMm = 96/25.4;
    const w = pageWidth*pxPerMm, h = pageHeight*pxPerMm;
    const scale = mode.value === "single" ? Math.min(w/width,h/height) : Math.min(1.5,w/width);
    const overlap = 30;
    const step = h-overlap;
    const count = mode.value === "single" ? 1 : Math.max(1,Math.ceil((height*scale-overlap)/step));
    for(let i=0;i<count;i++) {
      const page = doc.createElement("section");
      page.className = "page";
      page.style.width = `${pageWidth}mm`;
      const heading = title.cloneNode(true);
      if(count>1) heading.textContent += ` · ${i+1}/${count}`;
      const sheet = doc.createElement("div");
      sheet.className = "sheet";
      sheet.style.width = `${pageWidth}mm`;
      sheet.style.height = `${pageHeight}mm`;
      const copy = drawing.cloneNode(true);
      const offsetX = (w-width*scale)/2;
      copy.style.transform = `translate(${offsetX}px, ${-i*step}px) scale(${scale}) translate(${-left}px, ${-top}px)`;
      sheet.append(copy);
      page.append(heading,sheet);
      pages.append(page);
    }
  };
  orientation.onchange = render;
  mode.onchange = render;
  render();
  popup.focus();
}
