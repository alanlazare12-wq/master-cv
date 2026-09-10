# Local AI Studio · v29

Local AI Studio es opcional y sólo usa Ollama en `127.0.0.1:11434` a través de `server.py`.

## Guardrails de auto-apply

Una propuesta sólo puede aplicarse automáticamente si pasa todas las comprobaciones locales:

- `before` sigue coincidiendo exactamente con el texto actual;
- no introduce cifras nuevas;
- cada cifra/fecha permanece ligada a la misma unidad factual y anchors semánticos;
- conserva polaridad y negaciones (`no`, `sin`, `ni`, `nunca`, `not`, `without`, `never`, `n't`, etc.);
- no introduce tecnologías, siglas, credenciales o certificaciones sin evidencia;
- no transforma una skill existente en una certificación inexistente;
- no incorpora requisitos faltantes de una vacante como si fueran experiencia;
- el vocabulario factual nuevo requiere evidencia positiva;
- los términos relacionados de una afirmación deben existir dentro de una misma unidad factual del texto editado;
- `needsUserFact=true` obliga a revisión;
- cualquier warning del servidor bloquea auto-apply.

La política es deliberadamente conservadora: una propuesta dudosa puede requerir revisión manual; una alucinación conocida no debe auto-aplicarse.

## Tareas

- mejorar perfil;
- mejorar un bullet;
- hacer el perfil más conciso.

El Writing Coach determinista continúa disponible sin Ollama.
