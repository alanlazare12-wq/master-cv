# Layout Composer

El Layout Composer controla **presentación**, no hechos del CV.

## Controles

- `pageStrategy`: `auto`, `one`, `two`.
- `sectionColumns`: asignación `auto`, `main` o `side` por sección.
- `pageBreakHints`: secciones que deben comenzar en nueva página al imprimir.

En layouts de dos columnas, las asignaciones explícitas sustituyen la regla automática de colocar Skills/Certificaciones/Idiomas en la columna lateral.

Los saltos manuales se renderizan como marcadores en preview y como `break-before: page` al imprimir.
