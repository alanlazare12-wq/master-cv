# Release Notes · v48

## Concurrencia durable sin sobrescrituras silenciosas
- IndexedDB incorpora **compare-and-swap (CAS)** mediante `expectedRevision`: una pestaña que partió de una revisión antigua no puede sobrescribir el commit de otra.
- Los commits se serializan y coalescen; si el usuario continúa editando durante una escritura, se conserva el snapshot más nuevo para el siguiente commit.
- El conflicto ahora es de **biblioteca completa**, no sólo del CV activo. Editar CV A ya no puede pisar un cambio realizado en CV B desde otra pestaña.
- El rollback dejó de restaurar `sync-index`, evitando retroceder el estado compartido de concurrencia.

## Recovery por pestaña
- El journal pasa de una clave compartida a `hoja-personal-v48-journal-<tab-id>`.
- Una pestaña ya no elimina el journal pendiente de otra.
- Al iniciar, se localiza el journal recuperable más reciente y se comparan revisión + timestamp con IndexedDB.
- Un journal legacy de v47 más reciente que la copia durable se promueve antes de limpiar datos heredados.
- Los journals claramente anteriores a un commit confirmado se limpian de forma conservadora para evitar acumulación indefinida.

## Fallback sin IndexedDB
- La protección de concurrencia ya no se limita al CV activo: se mantiene una firma de la biblioteca persistida y se bloquea el guardado si otro contexto modificó CV, documentos o la vacante global.
- La resolución `Conservar ambos` / `Usar mi versión` sigue funcionando en fallback localStorage.

## Seguridad del servidor local
- `_request_is_local()` valida ahora la **IP real del peer** además de `Host`, `Origin` y `Sec-Fetch-Site`.
- Un cliente remoto no puede hacerse pasar por una petición local enviando `Host: localhost`.

## PWA / Service Worker
- Un recurso ya cacheado no deja una Promise de red rechazada sin manejar cuando la conexión cae.
- Los fallos al escribir el caché se absorben de forma segura sin afectar la respuesta que recibe la UI.
- `sw.js` se incluye explícitamente en el chequeo de sintaxis del release.

## QA adicional
- CAS probado con dos escritores partiendo de la misma revisión y editando CV diferentes.
- Recovery real de journal v47 más nuevo que IndexedDB.
- Prueba de fallback que confirma que editar CV A no borra un cambio remoto en CV B.
- Prueba de conexión IndexedDB bloqueada seguida de `onsuccess` tardío para verificar cierre de la conexión y evitar fugas.
- Fuzzing determinista de 120 escenarios `fork` / `replace`, verificando preservación de documentos remotos e IDs únicos.
- **724/724 JavaScript + 99/99 Python = 823/823 PASS**.

## Identidad del release
- Aplicación: `48.0.0-personal`.
- Servidor: `HojaPersonal/48`.
- Durable key: `hoja-personal-v48` dentro de IndexedDB.
- Journal: `hoja-personal-v48-journal-<tab-id>`.
- Índice de concurrencia: `hoja-personal-v48-sync-index`.
- Legacy inmediato: `hoja-personal-v47`.
- PWA/cache/imports: v48.


## v48 · Resume Intelligence / Export QA
- CV Score global separado del ATS.
- Impact Lab + banco privado de logros/hechos confirmados.
- Interview Coach basado en experiencia/vacante.
- ATS 2.0 con cobertura requerida/preferida y evidencia por requisito.
- Variantes inteligentes enlazadas al CV Maestro sin inventar skills.
- Fit-to-page progresivo y perfiles de impresión light/medium/strong.
- Checklist de envío y QA visual real antes de PDF.
- Nombre profesional de archivo sugerido.
- Preview con Ajustar hoja/Ancho y paridad Exportación/PDF.
- Merge seguro de CV importado.
- Comparador de hasta 3 plantillas.

### QA final mcp10
- Hardening de arranque Windows/Python launcher.
- Correcciones de exportación/release, PDF directo, Import Merge, Impact checklist y nombre profesional.
- Cache bust `mcp10` y favicon local sin 404.
- Gate final: 744/744 JS; 107 PASS + 1 skip Python; Edge real 11/11 vistas, consola limpia.

### QA visual / impresión mcp12
- Fix de segunda página vacía en impresión clásica.
- Preview toolbar responsive sin controles recortados.
- `@page` dinámico A4/Letter.
- Singular/plural correcto en páginas planificadas.
- Preflight detecta contradicción de familia profesional entre titular y resumen.
- Gate histórico mcp12: 747/747 JS; 110 PASS + 1 skip Python; Edge 11/11 vistas y consola limpia. El gate vigente está documentado en `QA-REPORT.md`.

### Export Preview exacto mcp13
- Nuevo `src/export-document.js`: especificación única del documento final.
- Exportación se renderiza en iframe aislado y de sólo lectura.
- El diálogo clásico imprime exactamente ese iframe.
- Zoom externo sin reflow interno.
- QA real Edge: 11/11 vistas, consola limpia; CV actual validado en 1 página física.


### Export Preview editable exacto mcp14
- Exportación conserva el layout final y vuelve a habilitar las herramientas de edición directamente dentro del iframe.
- Los controles se superponen sin alterar dimensiones o paginación.
- Drag & drop fue adaptado para trabajar con el `ownerDocument` del iframe.
- Al exportar PDF, la app reconstruye temporalmente el iframe limpio, imprime esa versión y restaura el modo editable.
- Validación Edge: 0 px de diferencia geométrica entre modo limpio y editable en los bloques principales.


### Auto Fill de exportación mcp16
- Ajuste automático del tamaño visual del contenido para aprovechar mejor una hoja de exportación sin crear páginas extra.
- Máximo profesional ~12.25 pt equivalentes y medición física real antes de aplicar el factor.
- Paridad entre preview exacta, impresión clásica y PDF directo.

### Aplicación de escritorio Windows
- Nuevo shell `desktop.py` con ventana propia WebView2; el uso normal ya no abre Edge/Chrome ni muestra consola.
- El servidor localhost continúa siendo interno y se inicia/detiene junto con la ventana.
- Perfil WebView persistente en LocalAppData para conservar IndexedDB/localStorage entre ejecuciones.
- PyInstaller usa subsistema Windows GUI (`--windowed`) y el setup instala el runtime Python/WebView requerido por la aplicación.
- Smoke del setup instalado: ventana mostrada y WebView cargada, `/api/health` OK, cierre limpio del puerto y del PID file.
