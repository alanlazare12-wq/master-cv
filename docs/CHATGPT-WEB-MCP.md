# ChatGPT Web Bridge · túnel compartido de LocalForge

Hoja Personal reutiliza el mismo Secure MCP Tunnel que ya mantiene LocalForge. No necesita un segundo `tunnel-client`, otro Tunnel ID ni otra API key.

## Ruta

`ChatGPT Web → Secure MCP Tunnel (profile: localforge) → LocalForge MCP → Hoja Personal MCP (127.0.0.1:4173/mcp)`

LocalForge publica cuatro herramientas adicionales en su catálogo:

- `hoja_personal.cv_get_current`
- `hoja_personal.cv_get_bridge_status`
- `hoja_personal.cv_propose_summary_update`
- `hoja_personal.cv_propose_bullet_update`
- `hoja_personal.cv_get_edit_schema`
- `hoja_personal.cv_propose_edit`

## Seguridad

- El bridge de Hoja Personal está apagado por defecto.
- Al activarlo se comparte sólo un snapshot sanitizado del CV abierto.
- Se excluyen foto, historiales, Workbench, evidence vault y blobs auxiliares.
- Al desactivar el bridge, el snapshot se borra del servidor y las lecturas remotas son rechazadas.
- Las herramientas `propose_*` nunca escriben directamente en IndexedDB: crean propuestas que vuelven a pasar por auditoría factual y aprobación local.
- No se expone shell ni filesystem de Hoja Personal.
- La API key/control plane sigue perteneciendo a LocalForge; Hoja Personal no la solicita ni la persiste.

## Uso

1. Inicia LocalForge y conecta su OpenAI Tunnel habitual (`profile: localforge`).
2. Inicia Hoja Personal.
3. Abre **ChatGPT Web** dentro de Hoja Personal y pulsa **Activar bridge**.
4. Elige `Solo lectura` o `Proponer cambios · aprobación local`.
5. ChatGPT podrá usar las herramientas `hoja_personal.*` desde el mismo conector LocalForge.

Si desactivas el bridge, `hoja_personal.cv_get_current` vuelve a fallar aunque LocalForge y su túnel continúen conectados.

## Edición ampliada

`hoja_personal.cv_get_edit_schema` publica la allowlist exacta de edición. `hoja_personal.cv_propose_edit` admite:

- `set`: datos personales, título, perfil, locale, vacante objetivo y ajustes de diseño permitidos.
- `upsert`: crear o actualizar experiencia, educación, grupos de habilidades, proyectos, certificaciones, idiomas, logros y bullets de experiencia/proyecto.
- `delete`: eliminar elementos de esas colecciones por ID.

La foto binaria sigue excluida del bridge. Puede cambiarse `settings.showPhoto`, pero la imagen no se comparte con ChatGPT. Las ediciones estructurales requieren aprobación humana local; si el CV cambia después de generar una propuesta, Hoja Personal la bloquea como obsoleta para evitar sobrescrituras.
