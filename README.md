# Flowly

Editor visual de diagramas de flujo, creado como un subproyecto independiente del tracker principal.

## Despliegue en Vercel

1. Importa este repositorio en Vercel y configura **Root Directory** como `flow-studio`.
2. Añade estas variables de entorno en Vercel (Production, Preview y Development):
   - `GITHUB_REPO`: `Iscorod/Portfolio-Tracker` (o tu repositorio destino).
   - `GITHUB_TOKEN`: un fine-grained token de GitHub con permiso **Contents: Read and write** para ese repositorio.
   - `GITHUB_BRANCH`: `main` (opcional).
3. Despliega. Cada diagrama se guardará en `data/flow-diagrams/<nombre>.json` y GitHub conservará el historial de cambios.

Para desarrollo local, usa `npm install` y `npm run dev` desde esta carpeta. Para probar la función API también necesitas las variables en `.env.local` y `vercel dev`.

> El token nunca llega al navegador: solo lo utiliza la función `/api/diagrams` desplegada en Vercel.
