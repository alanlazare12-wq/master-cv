# Arquitectura local v29

```text
PC del usuario
|
+-- Browser / PWA
|   +-- Resume Schema v8
|   +-- 528 presets
|   +-- Template Forge
|   +-- Studio Pro ATS/Presentación
|   +-- Layout Composer
|   +-- ATS + Job Match
|   +-- Writing Coach
|   +-- Local AI Studio (opcional)
|   +-- exportadores
|   +-- storage.js (cuota, compactación, migración)
|   `-- localStorage
|
+-- server.py (127.0.0.1)
|   +-- archivos estáticos
|   +-- parser de importación
|   `-- proxy fijo a Ollama localhost (opcional)
|
`-- Ollama 127.0.0.1:11434 (opcional, no incluido)
```

No hay backend SaaS ni cuenta remota. El Resume Schema continúa en v8 porque v29 cambia capacidades del editor, no el modelo factual del CV.


En v29 el Service Worker excluye `/api/*` del caché. La persistencia compacta sólo copias candidatas antes de escribir; el estado vivo se sincroniza únicamente después de un guardado compactado exitoso.
