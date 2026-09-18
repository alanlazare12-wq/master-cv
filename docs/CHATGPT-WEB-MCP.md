# ChatGPT Web Bridge · PraxisNode · MCP

Hoja Personal / Master CV Studio expone un bridge MCP local en `http://127.0.0.1:4173/mcp`. PraxisNode se conecta a ese endpoint mediante su **External MCP client** dentro del run activo. Master CV no crea un segundo túnel, no necesita otro Tunnel ID y no guarda credenciales del control plane.

## Ruta

`ChatGPT Web → PraxisNode OpenAI Secure MCP Tunnel → PraxisNode Tool Broker / External MCP client → Master CV MCP (127.0.0.1:4173/mcp)`

Para la instancia `default`, PraxisNode usa normalmente su MCP local en `127.0.0.1:47321` y el perfil de túnel `praxisnode`. Las instancias secundarias tienen su propio puerto MCP y perfil. Por eso Master CV sólo usa el puerto 47321 como una señal opcional de que la **instancia default** está disponible; nunca interpreta ese socket como prueba de que el túnel OpenAI esté conectado.

## Herramientas

En modo lectura:

- `cv_get_current`
- `cv_get_bridge_status`
- `cv_get_edit_schema`

En modo de propuestas se añaden:

- `cv_propose_summary_update`
- `cv_propose_bullet_update`
- `cv_propose_edit`

El contrato MCP actual usa nombres sin prefijos heredados; las integraciones antiguas ya no forman parte del contrato de Master CV.

## Protocolo

El servidor anuncia MCP `2026-07-28` stateless y soporta `server/discover`, `tools/list` y `tools/call`. Mantiene compatibilidad de handshake con clientes MCP `2025-11-25`, `2025-06-18` y `2025-03-26`.

En el protocolo actual, las solicitudes incluyen metadatos MCP por request y los headers de transporte `MCP-Protocol-Version`, `Mcp-Method` y, para `tools/call`, `Mcp-Name`.

## Seguridad

- El bridge está apagado por defecto.
- Al activarlo se comparte sólo un snapshot sanitizado del CV abierto.
- Se excluyen foto, historiales, Workbench, evidence vault y blobs auxiliares.
- Al desactivar el bridge se borra el snapshot **y también las propuestas pendientes**, para evitar que una propuesta vieja reaparezca al reconectar.
- Las herramientas `cv_propose_*` nunca escriben directamente en IndexedDB: crean propuestas que requieren revisión/aprobación local.
- No se expone shell ni filesystem de Master CV.
- Las credenciales del OpenAI Secure MCP Tunnel pertenecen a PraxisNode; Master CV no las solicita ni las persiste.
- Una comprobación de socket local sólo indica disponibilidad del endpoint MCP local; el estado real del túnel OpenAI se consulta dentro de PraxisNode.

## Uso con PraxisNode

1. Inicia Master CV Studio.
2. Abre **ChatGPT Web** dentro de Master CV y pulsa **Activar bridge**.
3. Elige `Solo lectura` o `Proponer cambios · aprobación local`.
4. En el run activo de PraxisNode abre **External MCP client** y conecta `http://127.0.0.1:4173/mcp`.
5. Verifica que PraxisNode descubra `cv_get_current`, `cv_get_bridge_status` y `cv_get_edit_schema`.
6. Si necesitas propuestas, cambia el bridge a modo de aprobación y vuelve a descubrir las herramientas.
7. Para ChatGPT Web, inicia/usa el **OpenAI Secure MCP Tunnel** desde PraxisNode. Master CV no ejecuta un segundo cliente de túnel.

Desactivar el bridge hace que `cv_get_current` vuelva a rechazar lecturas y limpia las propuestas pendientes, aunque la conexión External MCP siga existiendo en PraxisNode.

## Edición ampliada

`cv_get_edit_schema` publica la allowlist exacta. `cv_propose_edit` admite:

- `set`: datos personales, título, perfil, locale, vacante objetivo y ajustes de diseño permitidos.
- `upsert`: crear o actualizar experiencia, educación, grupos de habilidades, proyectos, certificaciones, idiomas, logros y bullets de experiencia o proyecto.
- `delete`: eliminar elementos de esas colecciones por ID.

La foto binaria sigue excluida. Puede cambiarse `settings.showPhoto`, pero la imagen no se comparte con ChatGPT. Las ediciones estructurales requieren aprobación local; si el CV cambió después de generar una propuesta, Master CV la bloquea como obsoleta para evitar sobrescrituras.

## Validación de esta migración

La integración actual se validó contra el **External MCP client real de PraxisNode**:

- conexión HTTP MCP exitosa;
- protocolo detectado por PraxisNode: `modern`;
- servidor detectado: `hoja-personal-cv-studio` v48;
- listado real de herramientas correcto;
- llamada real `cv_get_bridge_status` correcta;
- reporte de protocolo `2026-07-28`;
- detección de la instancia default de PraxisNode separada explícitamente del estado del túnel OpenAI.
