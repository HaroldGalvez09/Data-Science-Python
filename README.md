# Data-Science-Python

Aplicación web estática para práctica iterativa de **TOEFL Reading 2026** con routing adaptativo entre módulos, autosave por pregunta y reporte inmediato al finalizar.

## Qué incluye

- **Module 1 (12 min)** con 20 ítems:
  - 1 x Complete the Words (10 blanks)
  - 1 x Reading in Daily Life short (2 preguntas)
  - 1 x Reading in Daily Life long (3 preguntas)
  - 1 x Academic Reading (5 preguntas)
- **Module 2 adaptativo (10 min)**:
  - **Hard Module** si el accuracy de Module 1 es mayor o igual al umbral configurado.
  - **Easy Module** si queda por debajo.
- Navegación libre dentro de cada módulo.
- Bloqueo para regresar a Module 1 una vez activado Module 2.
- Autosave por pregunta con `localStorage`.
- Auto-submit al agotar el tiempo.
- Resultados inmediatos con:
  - raw score
  - accuracy por task type
  - accuracy por skill type
  - tiempo por pregunta
  - revisión de errores
  - historial de intentos
- Panel **admin** para parametrizar timers y umbral de routing.

## Archivos

- `index.html`: shell principal de la app.
- `styles.css`: interfaz responsive del simulador.
- `app.js`: lógica del examen, banco original de preguntas, timers, routing y reportes.

## Uso

Como es una app estática, puedes abrir `index.html` directamente en el navegador o servirla localmente:

```bash
python -m http.server 8000
```

Luego abre: `http://localhost:8000`

## Notas de diseño

- El banco de preguntas es **original** y está inspirado en el formato TOEFL Reading, sin copiar ítems literales de ETS ni de terceros.
- La configuración admin reinicia el intento activo para regenerar módulos con la nueva parametrización.
- El historial conserva los 10 intentos más recientes en `localStorage`.
