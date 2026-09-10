# Personal Resume Workbench · v29

## Objetivo

Workbench trata el CV como un artefacto que se **prueba y libera**, no sólo como un documento que se edita. Todo funciona localmente.

## Release Profiles

Un Release Profile guarda sólo contexto de entrega:

- nombre y propósito;
- vacante objetivo;
- plantilla y tokens de diseño;
- variante ATS/presentación;
- orden y visibilidad de secciones;
- Layout Composer y saltos de página.

No guarda una copia nueva de experiencia, educación, skills, proyectos o certificaciones. `applyReleaseProfile()` verifica el fingerprint factual antes y después de aplicar el perfil.

Ejemplos:

- `Backend ATS`
- `Backend Recruiter`
- `Executive General`
- `Portfolio Networking`

## Resume Test Lab

Un test case congela una vacante y umbrales:

- ATS mínimo;
- Job Match mínimo;
- páginas máximas;
- política de riesgo visual.

Los tests se ejecutan sobre una copia temporal del CV. El target activo del documento no cambia.

Esto permite saber si una mejora para una vacante rompió otra variante de entrega.

## Release Gate

Etapas:

1. Completitud.
2. ATS.
3. Job Match (si hay vacante; si no, queda `info/N/A` y se excluye del promedio).
4. Integridad ATS ↔ presentación.
5. Writing Coach.
6. Composición/páginas.
7. Riesgo visual.

Estados:

- `READY`: no hay bloqueos ni advertencias.
- `REVIEW`: no hay bloqueos, pero sí señales a revisar.
- `BLOCKED`: una o más etapas incumplen la política local.

El estado no pretende predecir contratación ni “pasar todos los ATS”. Es un gate de calidad interno y explicable.

## Política configurable

Por CV:

- ATS mínimo: 75 por defecto.
- Job Match mínimo: 55.
- Máximo: 2 páginas.
- Writing Coach mínimo: 60.

## Release History

Cada release registra:

- fecha;
- etiqueta;
- Release Profile activo;
- rol objetivo;
- plantilla;
- estado y score del gate;
- ATS, Job Match, páginas, writing e integridad;
- fingerprint factual.

No sube el historial a ningún servicio.

## Seguridad de exportación

Si el gate está `BLOCKED`, Hoja pide confirmación explícita antes de exportar. El usuario conserva siempre el control y puede exportar sus propios datos.
