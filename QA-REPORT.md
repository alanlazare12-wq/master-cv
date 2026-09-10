# QA Report · Hoja Personal CV Studio v48

## Resultado del gate
- JavaScript: **747 / 747 PASS** (66 smoke/UI + 681 dominio).
- Python: la suite actual descubre **113 casos**. En LocalForge se ejecutaron **111**: **110 PASS + 1 skip** de plataforma; 2 pruebas que crean procesos hijo se excluyeron por confinamiento del runtime.
- ChatGPT Web / MCP: **3 / 3 pruebas de servidor PASS** + **2 / 2 pruebas JS de snapshot/comandos PASS**.
- Sintaxis: `npm run check` PASS, incluyendo `sw.js`, todos los módulos JS y `py_compile` de `server.py`, parser y `mcp_bridge.py`.
- Fuzzing incluido: **120 escenarios** de resolución de conflicto `fork`/`replace`.

## Integración ChatGPT Web · Secure MCP Tunnel
- Bridge **opt-in**: apagado por defecto.
- Endpoint MCP local: `/mcp` sobre el mismo servidor `127.0.0.1:4173`.
- Snapshot sanitizado: excluye foto, historiales, Workbench, evidence vault y blobs auxiliares.
- Modo **Solo lectura** anuncia únicamente `cv_get_current` y `cv_get_bridge_status`.
- Modo **Proponer cambios** añade propuestas de perfil/bullet, pero nunca escribe directamente en IndexedDB.
- Toda propuesta vuelve a pasar por `auditLocalAiSuggestion()` y `applyLocalAiSuggestion()` con revisión humana cuando corresponde.
- `CONTROL_PLANE_API_KEY` no se solicita ni se persiste en Hoja Personal.
- **Túnel compartido LocalForge:** el perfil `localforge` publica ahora `hoja_personal.*`; no se requiere segundo `tunnel-client` ni Tunnel ID.
- E2E verificado: snapshot de prueba leído correctamente por `LocalForge MCP → hoja_personal.cv_get_current → Hoja Personal`; tras desactivar el bridge, la misma llamada fue rechazada.
- LocalForge MCP/policy regression: **21 / 21 PASS**.
- Edición remota ampliada: `cv_get_edit_schema` + `cv_propose_edit` con allowlist, operaciones `set/upsert/delete`, validación de diseño y bloqueo de propuestas obsoletas.
- E2E de edición genérica: propuesta no-op enviada por LocalForge, rechazada y verificada sin cambios en el CV y con **0 pendientes**.
- Preview/PDF parity: nueva superficie **Editor / Exportación**. La vista Exportación reutiliza el perfil `print-one-page`, oculta edición/guías y refleja la compactación final del PDF.
- Regresión de paginación: el CV de 323 palabras se valida en una sola página y las secciones largas pueden continuar en la hoja sin generar huecos artificiales.
- **Resume Intelligence:** CV Score compuesto, checklist de envío, Impact Lab, Interview Coach, fit dinámico y nombre profesional de archivo.
- **ATS 2.0:** cobertura requerida/preferida y evidencia por requisito.
- **Variantes inteligentes:** priorizan únicamente skills/bullets existentes según vacante y permanecen enlazadas al CV Maestro.
- **Banco de logros:** respuestas del Impact Lab se guardan como hechos privados confirmados por el usuario sin modificar automáticamente el CV.
- **QA visual automático:** Exportar PDF mide el render real y advierte si una salida prevista para una hoja ocupa más páginas o corta entradas.
- **Import Merge:** fusiona contenido importado sin sobrescribir campos completos y deduplica colecciones.
- **Template Compare:** hasta 3 plantillas lado a lado sobre el mismo contenido.
- **Preview ergonomics:** Ajustar hoja / Ajustar ancho y perfiles de impresión light/medium/strong.

## Bugs encontrados y corregidos

### 1. Crítico · dos pestañas podían pisar CV diferentes
**Problema:** el guardado persistía la biblioteca completa, pero la detección histórica se centraba principalmente en el CV activo. Dos pestañas editando CV A y CV B podían partir del mismo estado y el último escritor podía borrar el cambio del primero.

**Corrección:** CAS en IndexedDB con `expectedRevision`, reserva explícita de revisión y drenado serial de commits. Si la revisión durable cambió, el escritor obsoleto se rechaza y conserva su journal.

### 2. Crítico · journal compartido entre pestañas
**Problema:** todas las pestañas utilizaban la misma clave temporal; un commit/cleanup podía eliminar la recuperación preparada por otra pestaña.

**Corrección:** journal aislado por `TAB_INSTANCE`; el cleanup sólo elimina de forma segura el journal propio o journals claramente superados.

### 3. Alto · rollback podía retroceder el índice compartido
**Problema:** determinadas transacciones UI capturaban/restauraban `SYNC_INDEX`. Un fallo local podía restaurar una revisión antigua después de que otra pestaña hubiera publicado una nueva.

**Corrección:** `SYNC_INDEX` queda fuera de snapshots de rollback locales. Ante error se relee/repara desde la autoridad durable.

### 4. Alto · journal pendiente podía perderse al migrar
**Problema:** un journal de la versión anterior podía tener cambios más recientes que IndexedDB pero revisión desconocida; comparar primero por revisión podía favorecer incorrectamente la copia durable vieja.

**Corrección:** para journals de recovery con timestamp más nuevo se eleva la base de comparación a la revisión durable actual y se intenta un CAS de migración. Prueba v47 → v48 incluida.

### 5. Alto · fallback localStorage sólo protegía el CV activo
**Problema:** sin IndexedDB, editar CV A podía sobrescribir un cambio remoto reciente en CV B.

**Corrección:** firma de la biblioteca persistida y detección de cambios externos antes de cualquier escritura completa. La prueba de regresión confirma que B permanece intacto.

### 6. Medio · falsos conflictos por BroadcastChannel
**Problema:** se anunciaba un guardado a otras pestañas antes de que IndexedDB lo confirmara. Si el commit fallaba, las demás pestañas veían un conflicto inexistente.

**Corrección:** la notificación se emite sólo después de un commit durable confirmado; las reservas reales siguen siendo visibles mediante el índice de concurrencia.

### 7. Medio · conexión IndexedDB tardía podía quedar abierta
**Problema:** `onblocked` podía resolver el open como no disponible y un `onsuccess` tardío dejar la conexión sin cerrar.

**Corrección:** `openDb()` usa estado `settled`; cualquier conexión recibida después de resolver se cierra inmediatamente.

### 8. Medio · servidor local confiaba demasiado en headers
**Problema:** si alguien exponía el servidor en una interfaz no-loopback, un cliente remoto podía falsificar `Host: localhost`.

**Corrección:** además de headers, se valida `client_address` con `ipaddress` y se exige loopback.

### 9. Bajo · rechazos no manejados del Service Worker
**Problema:** stale-while-revalidate podía producir rechazos sin manejar al fallar red o escritura de Cache Storage.

**Corrección:** la respuesta cacheada se entrega normalmente y las tareas de revalidación/cacheo en segundo plano absorben su fallo sin contaminar la ejecución.

## Regresiones cubiertas
- 528 plantillas y render interactivo/limpio.
- Drag directo, grip, touch, teclado, autoscroll y Undo/Redo.
- Foto, ATS, Job Match, Workbench, Release Gate y Test Lab.
- CV Maestro/variantes y evidencia trazable.
- Ollama local, creación IA, visión y embeddings.
- Importación/exportación PDF/DOCX/TXT/JSON y round-trip DOCX.
- Compactación por cuota, rollback transaccional, IDs únicos y normalización de estados corruptos.
- IndexedDB autoritativo, digest, migraciones y recuperación por journal.

## Limitación del entorno QA
Se intentó automatización E2E con Chromium/Playwright, pero la política administrativa del contenedor bloquea navegación del navegador a `127.0.0.1` (`ERR_BLOCKED_BY_ADMINISTRATOR`). El servidor sí responde por HTTP desde el entorno y se mantuvieron smoke tests DOM/integración, pruebas de servidor y contratos. No se reporta una prueba visual Chromium como ejecutada cuando el entorno no la permitió.


## QA final mcp10
- Edge real/headless: **11/11 vistas renderizadas**, **0 excepciones JavaScript**, **0 warnings/errors de consola**.
- Backend/frontend sincronizados en runtime; `direct_pdf_export=true` y cache bust final `48-mcp10`.
- Corregido arranque de Windows para preferir `py -3.14` / `py -3` antes de un alias `python` no válido.
- Corregidas Releases fantasma: PDF directo sólo registra Release después de una descarga válida; el diálogo PDF sólo registra después de pasar QA visual.
- Corregida validación de PDF directo: MIME incorrecto **o** archivo demasiado pequeño se rechazan.
- Corregido nombre sugerido `*_CV_CV.pdf` cuando no existe titular/vacante.
- Import Merge ahora combina bullets nuevos en experiencias coincidentes y deduplica evidencia.
- Corregido falso positivo del checklist de impacto para CVs pequeños sin métricas.
- Eliminado 404 de `/favicon.ico` mediante favicon `data:` local.


## QA visual y print mcp12
- Corregida la **segunda hoja en blanco** del diálogo de impresión: `export-preview-stage` reaplicaba padding de pantalla después de `@media print` y hacía que el contenedor superara la altura A4. En print se neutralizan padding, background, min-height, overflow y shadow de preview.
- Validación con el CV actual **Alan Lazare | Desarrollador Full Stack**, plantilla `portrait-modern-terracotta`, 323 palabras: **1 página física** en Edge/Chromium.
- El diálogo clásico ahora sincroniza `@page` con el tamaño configurado del CV: **A4 o Letter**.
- Corregido clipping de **Humano / ATS** y **Editor / Exportación** mediante container queries. Validado a 650 px, 520 px y 420 px: **0 overflow / 0 clipping**.
- Corregida gramática de `1 pág. planificada` / `N págs. planificadas`.
- Preflight reforzado: detecta y bloquea contradicciones de rol como encabezado **Desarrollador Full Stack** + perfil **Product Designer**, sin modificar automáticamente los hechos del CV.
- Cache bust final: **48-mcp12**.
- Edge real/headless sobre mcp12: **11/11 vistas**, **0 excepciones JS**, **0 warnings/errors de consola**.


## Export Preview exacto mcp13
- La superficie **Exportación exacta** ya no reutiliza ni remaqueta el DOM editable. Renderiza un documento HTML aislado en `#exportPreviewFrame` mediante `src/export-document.js`.
- Preview y diálogo clásico de **Exportar PDF** comparten el mismo documento: el botón imprime `frame.contentWindow.print()` y no `window.print()` del editor.
- El zoom de Exportación escala el iframe completo; no modifica tipografía, márgenes, interlineado ni paginación interna.
- El mismo `exportDocumentSpec()` alimenta la vista exacta y el payload de PDF directo.
- Edge real mcp13: **11/11 vistas**, **0 excepciones JS**, **0 warnings/errors**, iframe con **0 controles editables**, 2 hojas de estilo cargadas y tamaño A4 físico 793.69 × 1122.52 px.
- CV actual `Alan Lazare | Desarrollador Full Stack`, `portrait-modern-terracotta`, 323 palabras: documento exacto generado e impreso en **1 página física**.
- Gate: **747/747 JS PASS**; Python: **110 PASS + 1 skip** de plataforma (2 tests de procesos hijo excluidos por confinamiento LocalForge).
- Cache bust: **48-mcp13**.


## Export Preview editable exacto mcp14
- La superficie **Exportación exacta** mantiene el documento físico del PDF dentro del iframe y ahora permite edición directa sobre ese mismo documento.
- `Editar` funciona también en Exportación: texto editable, mover, duplicar, eliminar, añadir y drag & drop usan la misma capa de edición del preview.
- Los controles son absolutos/superpuestos y no participan en el flujo del CV.
- Edge real: limpio vs editable dio **0 px de diferencia** en X/Y/ancho/alto para hoja, nombre, resumen, experiencia, educación, habilidades e idiomas. La hoja se mantuvo en **793.688 × 1122.516 px (A4)**.
- Prueba funcional Edge: edición de nombre persistió; duplicar experiencia cambió 1 → 2; consola sin errores.
- Prueba de impresión Edge: editable **29 campos / 16 controles** → limpio **0 / 0** → `print()` sobre limpio → restauración automática a editable **29 / 16**.
- Gate final: **747/747 JS PASS**; Python **110 PASS + 1 skip** de plataforma.
- Cache bust: **48-mcp14**.


## Auto Fill de exportación mcp16
- La Exportación exacta mide el espacio realmente usado dentro de A4/Letter y aumenta automáticamente el contenido sólo cuando sigue cabiendo físicamente en una página.
- El factor se calcula con búsqueda binaria y límite profesional equivalente a ~12.25 pt de cuerpo; no aumenta indefinidamente.
- El mismo factor se comparte con iframe exacto, diálogo clásico y PDF directo.
- CV actual `Alan Lazare | Desarrollador Full Stack`, `portrait-modern-terracotta`: ocupación útil ~56.7% → ~92.7%, factor ~144%, ~66.6 px de aire inferior restante.
- Validación real: PDF clásico **1 página**; PDF directo **1 página**.
- Gate mcp16: **748/748 JS PASS**; Python **112 PASS + 1 skip** de plataforma.
