# Simulador de línea de tiempo financiera

Aplicación web para la tarea de Ingeniería Económica. Implementa las 4 actividades en un solo proyecto con un menú principal:

1. Interés simple
2. Interés compuesto
3. Anualidad con gradiente aritmético
4. Anualidad con gradiente geométrico

## Cómo ejecutarla

No requiere instalación ni servidor. Basta con abrir `index.html` en cualquier navegador moderno (Chrome, Edge, Firefox).

## Estructura

```
index.html        estructura de la página y menú de actividades
css/styles.css     estilos y diseño responsive
js/app.js          validación de datos, motores de cálculo, dibujo de la línea de tiempo
```

## Qué hace cada parte

- **Menú superior**: permite elegir la actividad a calcular; la navegación entre actividades reinicia el formulario y los resultados.
- **Formulario**: pide únicamente los datos que la actividad necesita (capital, tasa, número de periodos, gradiente, tipo de operación, etc.) y valida que sean números válidos dentro de rangos razonables antes de calcular.
- **Resultados**: muestra el valor futuro, el valor presente y demás cifras clave según el modelo.
- **Línea de tiempo (SVG)**: dibuja el eje de periodos y una flecha por cada flujo de efectivo (verde = entrada, ámbar = salida), con el valor de cada flujo. En las anualidades, una flecha punteada representa el valor presente equivalente traído a hoy.
- **Tabla de flujos**: detalla periodo a periodo el cálculo (interés, saldo o valor presente según corresponda) y se puede descargar como CSV.

## Integrantes

--------
