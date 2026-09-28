# Verificación actual V0.3 CLOUD

17/09/2026: **66/66 pruebas automatizadas aprobadas**, despliegue Pages/Worker y pruebas reales D1/R2 completadas. [Informe completo](V03-REPORT.md) con evidencia, fallos corregidos y límites.

El registro inferior conserva las verificaciones históricas V0.2/V0.1; no describe el estado actual de persistencia CLOUD.

---

# Verificación V0.2 · 17/09/2026

## Pruebas automáticas

Antes de cambios: 10/10 originales aprobadas. Después: 48/48 aprobadas, cero fallos. Ejecutar npm test. Incluye persistencia, relaciones V0.1 y transacciones de stock/caja; normalización de placas; IDs inmutables; migración idempotente; catálogo y limpieza dependiente; registro prellenado/manual; fallbacks de red; consentimiento; cámara denegada y streams tardíos; QR generado y decodificado realmente; proxies, credenciales y archivos privados.

Las llamadas externas se validaron con respuestas controladas, no con cuentas de pago. El servidor en ejecución respondió 200 a integraciones y QR público, 404 a /.env, /backend/providers.js y /package.json.

## Navegador V0.2

- Se conservó la base local existente sin restablecerla. ABC 123 devuelve ABC123, Carlos Rodríguez, 48.320 km y última visita entregada 02/09/2026.
- Catálogo Mazda → 2022 → Mazda 3 → Touring; cambiar a Toyota vacía descendientes y conserva placa individual. Alternativa manual accesible.
- Archivo PNG de prueba cargado, preview visible, análisis DEMO existente y desconocido. ZZZ999 abre registro prellenado Toyota/Corolla/Blanco.
- Registro de prueba QAT246 guardado y recuperado al recargar, con ID propio estable y QR correspondiente. Se dejó este registro DEMO en el navegador para no restablecer ni borrar otros datos.
- Lectura de tests/fixtures/qr-v1.svg identifica ABC123 mediante decodificación de imagen. Payload manual también funciona; un ID inexistente muestra aviso sin asociarlo a otra placa.
- Navegación por los 13 módulos sin errores JS capturados. Configuración muestra reconocimiento DEMO, catálogo local, consulta no configurada y QR activo.
- Formulario manual revisado visualmente a 390×844: columnas adaptables y scroll interno del modal. Vistas de escritorio revisadas durante identificación y alta.

## Límites de esta verificación

No se obtuvo una captura de cámara física; sí se probaron permisos denegados y liberación de streams con dobles de prueba. No se verificaron cámaras reales de iOS/Android, impresión física, proveedores con credenciales ni todas las combinaciones de catálogo. QR por archivo y su generador/decoder sí se comprobaron. La impresión tiene una hoja CSS específica. No se validaron accesibilidad completa, múltiples navegadores ni concurrencia multiusuario.

El registro inferior documenta la ejecución previa de V0.1; sus referencias a OCR/QR simulados describen esa versión y quedan sustituidas por los resultados V0.2 anteriores.

---

# Registro histórico de verificación V0.1

Validación ejecutada el 15/09/2026, con Node.js 24 y navegador Chromium integrado, usando el servidor real en `http://localhost:4173`.

## Pruebas automatizadas

`npm test`: 10 pruebas aprobadas.

- Mínimos de datos, IDs únicos, placas y relaciones entre vehículos, propietarios, órdenes, técnicos y citas.
- Cantidades, descuento antes de IVA y redondeo a pesos.
- Creación, edición y persistencia al instanciar de nuevo el repositorio.
- Protección de clientes asociados frente a eliminación.
- Venta con descuento de existencias y registro de movimientos.
- Reversión completa por stock insuficiente, incluso después de procesar otro producto.
- Agregación de líneas duplicadas al validar stock.
- Caja cerrada, venta vacía y cantidades inválidas.
- Reversión de cambios si localStorage supera su cuota.
- Restauración de datos iniciales.

Se comprobó además sintaxis de los módulos con `node --check` y `git diff --check`.

## Flujos comprobados en el navegador

- Dashboard visible; navegación de los 13 módulos; sin errores de consola durante los recorridos verificados.
- Recepción por ABC123 devuelve Mazda 3 / Carlos Rodríguez.
- Wizard: motivo de ingreso → estado general → marca de rayón → imagen local SVG de prueba → resumen → OT-00140.
- Agregar trabajo de $85.000 a la orden actualiza el total.
- Cotizar OT con 10% de descuento y 19% de IVA produce $91.035: subtotal $85.000, descuento $8.500 e IVA $14.535.
- Aprobación local persiste al recargar y pasa la OT de RECIBIDO a EN PROCESO.
- La ficha del vehículo muestra la nueva visita junto al historial previo; la imagen de ingreso permanece disponible tras recargar (imagen cargada y dimensiones verificadas).
- POS: aceite $125.000 + servicio $85.000, descuento 10%, cobro $189.000. Venta registrada, carrito vacío y stock de aceite de 12 a 11.
- Caja: $484.000 en ventas del turno, $394.000 en efectivo + $300.000 de base = $694.000 esperado. Cierre sin diferencia; nuevo turno no vuelve a contar las ventas cerradas.
- Cliente de prueba creado, buscado, editado y recuperado tras recargar.
- Agenda: rechazo de cita superpuesta 08:30 para Andrés Moreno; cita a las 16:30 guardada.
- Filtrado por placa devuelve un solo vehículo coherente con su propietario.
- Vista de escritorio revisada visualmente. Móvil 390×844 y tablet 768×1024: menú adaptable y ausencia de desbordamiento horizontal del documento. Las tablas y el calendario usan scroll interno.

## Alcance y límites

La prueba de imágenes usa un archivo local pequeño; no prueba todas las cámaras ni todos los formatos. La cuota real varía por navegador. Impresión usa la hoja CSS de impresión; no se conectó impresora. Exportaciones usan Blob local. OCR, QR real, mensajería, datos vehiculares y pagos externos no se probaron porque intencionalmente están simulados. No se verificó Safari, Firefox, accesibilidad con lector de pantalla completo ni concurrencia multiusuario.

El archivo README enumera los límites funcionales y contratos de integración. Antes de producción se requieren pruebas de integración del backend, roles, autorización, transacciones concurrentes, recuperación de archivos y facturación real.
