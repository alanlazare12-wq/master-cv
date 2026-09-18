# Hoja Personal CV Studio v48

Aplicación local para crear, adaptar, revisar y exportar currículums desde Windows o cualquier navegador moderno. No requiere cuenta ni servicios cloud. Ollama es opcional y se usa únicamente en `127.0.0.1:11434`.

## Inicio rápido en Windows

1. Descomprime el ZIP.
2. Ejecuta `run.bat`.
3. Abre la URL local que muestra la consola.
4. Para detener sólo esta instancia, ejecuta `stop.bat`.

`setup.bat` instala dependencias opcionales para importación PDF. Para PDF escaneado con IA visual, Poppler/`pdftoppm` es opcional; también puedes adjuntar las páginas como PNG/JPG.

## Novedad principal v48 · concurrencia y recuperación reforzadas

v48 endurece el almacenamiento frente a carreras, cierres inesperados y varias pestañas abiertas a la vez:

- Cada pestaña usa un **journal aislado** en `localStorage`; una pestaña ya no puede borrar la copia temporal de recuperación de otra.
- Los commits a IndexedDB usan **compare-and-swap (CAS)** con revisión esperada. Un escritor obsoleto no puede reemplazar una biblioteca más nueva, incluso si estaba editando otro CV.
- Los commits durables se drenan en serie y conservan el último snapshot pendiente cuando el usuario sigue escribiendo durante un guardado.
- El rollback local ya no restaura el índice compartido de concurrencia, evitando retroceder una revisión publicada por otra pestaña.
- Los journals pendientes de v47 se comparan también por timestamp durante la migración; si contienen cambios más nuevos que IndexedDB, se recuperan antes de limpiar legacy.
- En fallback sin IndexedDB se detectan cambios externos de toda la biblioteca, no sólo del CV activo.
- Las notificaciones entre pestañas se emiten después de confirmar el commit durable, reduciendo falsos conflictos.

Cuando existe un conflicto real siguen disponibles **Recargar guardado**, **Conservar ambos** y **Usar mi versión**. La resolución parte de la biblioteca durable más reciente y conserva el journal mientras no exista confirmación segura.

## Almacenamiento durable

Flujo principal:

`estado en memoria → journal por pestaña → reserva de revisión → CAS IndexedDB → limpieza segura`

- **IndexedDB** es la copia durable autoritativa cuando está disponible.
- `localStorage` conserva preferencias pequeñas, índice de concurrencia y journals temporales.
- Un commit con revisión esperada obsoleta se rechaza sin sobrescribir datos.
- Los journals anteriores al commit confirmado se limpian de forma conservadora; uno más nuevo permanece para recovery.
- v48 migra automáticamente desde v47 y versiones anteriores.

## Funciones principales

### CV Maestro + variantes enlazadas
Un CV puede convertirse en **CV Maestro**. Las variantes sincronizan hechos compartidos sin destruir titular/resumen específico, vacante, diseño, Workbench ni historial.

### Evidencia trazable para IA
Borradores desde PDF/DOCX/TXT/imagen pueden conservar citas, página, archivo, modelo, confianza y estado de verificación. La UI muestra **Ver evidencia**.

### Ollama local
La app detecta capacidades con `/api/show`, puede usar visión, structured outputs y embeddings locales. El ATS semántico es complementario y nunca copia requisitos al CV.

### ChatGPT Web · PraxisNode · MCP
Hoja Personal incluye un bridge MCP opcional en `http://127.0.0.1:4173/mcp`. **PraxisNode** lo conecta como External MCP dentro del run activo y, si usas ChatGPT Web, PraxisNode mantiene su propio OpenAI Secure MCP Tunnel. Master CV no ejecuta un segundo `tunnel-client`, no necesita otro Tunnel ID y no guarda la API key del túnel. El bridge expone las herramientas reales `cv_*`, usa MCP `2026-07-28` stateless con compatibilidad para clientes 2025 y permite leer un snapshot sanitizado o proponer cambios estructurados mediante una allowlist estricta. Las propuestas **nunca escriben directamente**: vuelven a pasar por auditoría y aprobación local. Consulta `docs/CHATGPT-WEB-MCP.md`.

### Preview avanzada
- Edición WYSIWYG directa.
- Drag-and-drop desde el cuerpo completo de bloques.
- Secciones entre columnas.
- Touch, teclado y Undo/Redo.
- Guías P1/P2/... y ajuste no destructivo a una página.
- PDF limpio sin controles de edición.

### Diseño y foto
528 presets locales, incluidos 48 orientados a foto. La foto permite forma, posición, tamaño, zoom y desplazamiento X/Y. El perfil ATS la oculta automáticamente.

### Calidad y release
ATS, Job Match, Copiloto IA, Workbench, Release Gate, Test Lab, round-trip DOCX, importación PDF/DOCX/TXT/JSON y exportación PDF/DOCX/TXT/JSON.

## Privacidad

Por defecto, los CV permanecen en el equipo. El servidor sólo usa localhost, Ollama sólo se consulta en localhost y los endpoints verifican además la IP real del cliente: un cliente remoto no puede autorizarse falsificando `Host: localhost`. Si activas voluntariamente ChatGPT Web Bridge, el snapshot sanitizado del CV abierto puede viajar a ChatGPT a través de Secure MCP Tunnel; foto, historiales y blobs internos se excluyen del bridge.

## QA v48

El release se valida con sintaxis, **724 pruebas JavaScript + 99 Python**, pruebas de concurrencia/CAS, migración de journals, fallback, resolución no destructiva, drag-and-drop, IA local, servidor y PWA. Consulta `QA-REPORT.md`.

## Resume Intelligence v48

La capa **Resume Intelligence** añade análisis local y explicable sin modificar hechos automáticamente:

- **CV Score** compuesto por ATS, contenido, impacto, redacción, layout, evidencia, preflight y Job Match cuando existe vacante.
- **Impact Lab** detecta responsabilidades sin resultado medible y formula preguntas concretas; las respuestas se guardan como evidencia privada antes de convertirse en texto del CV.
- **Interview Coach** genera preguntas desde la experiencia real y la vacante objetivo.
- **ATS 2.0** muestra cobertura requerida/preferida y evidencia por requisito.
- **Variante inteligente** desde CV Maestro prioriza skills y bullets ya existentes según una vacante; no añade experiencia nueva.
- **Fit dinámico** usa niveles light/medium/strong y planificación progresiva antes de reducir tipografía.
- **Preflight + QA visual** revisa datos, placeholders, enlaces, páginas y cortes reales antes del PDF.
- **Preview** incorpora Ajustar hoja / Ajustar ancho además de Editor / Exportación.
- **Import Merge** fusiona contenido nuevo sin sobrescribir campos ya completos y deduplica colecciones.
- **Comparador de plantillas** permite revisar hasta tres diseños lado a lado con el mismo contenido.

Todas estas funciones trabajan sobre el contenido local. Las métricas son diagnósticos internos explicables, no puntuaciones emitidas por un ATS o reclutador externo.
