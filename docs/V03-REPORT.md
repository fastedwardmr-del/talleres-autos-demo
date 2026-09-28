# Informe final · TallerPro V0.3 CLOUD

Entrega del 17/09/2026. Estado: Pages y Worker publicados; D1 y R2 reales verificados. V0.4 no iniciada.

## Estado inicial y arquitectura

V0.2: aplicación local modular, 48 pruebas aprobadas, datos en localStorage, QR real y proxies opcionales. Se conservó el proyecto y sus datos locales. Wrangler 4.108.0 tenía sesión válida. Antes de crear recursos se listaron D1/R2/Pages y se verificó la inexistencia del Worker propuesto. No se modificó ningún recurso ajeno.

Ahora: navegador → Pages → capa ApiStore/apiClient → Worker → D1/R2. Mutaciones asíncronas, confirmación de servidor, validación por tenant, claves compuestas, revisión global y lotes transaccionales con idempotencia. Acceso DEMO compartido firmado; tabla users preparada para roles futuros. No hay reset remoto.

## Recursos creados

| Recurso | Nombre / URL |
|---|---|
| Pages | talleres-autos-demo |
| URL estable | https://talleres-autos-demo.pages.dev |
| Último despliegue Pages | e235e054.talleres-autos-demo.pages.dev |
| Worker | api-tallerpro-demo |
| API | https://api-tallerpro-demo.fastedwardmr.workers.dev |
| Versión Worker final | 66a28342-4b0b-488b-8f74-483ad8dd6604 |
| D1 | tallerpro-demo-db |
| ID D1 | 1c8bb5a9-3cad-4d9c-8c6a-32a91ab3d5b1 |
| R2 privado | tallerpro-demo-files |
| Migración | 0001_initial.sql aplicada remotamente |
| Seed | seed/demo.sql aplicado remotamente, idempotente |

La URL que debe compartirse es la estable de Pages. El código está en cloud-access.txt, ignorado por Git. No se incluyeron secretos en frontend ni documentación versionada.

## Tablas y datos

28 tablas de aplicación: companies, users, customers, technicians, products, services, vehicles, work_orders, quotes, appointments, sales, inventory_movements, activity, receptions, work_order_items, vehicle_history, quote_items, sale_items, reminders, vehicle_documents, vehicle_photos, reception_photos, cash_sessions, cash_movements, files, request_receipts, seed_runs, auth_attempts. Además d1_migrations gestionada por Wrangler.

Seed: 12 clientes, 15 vehículos, 60 órdenes/visitas con sus inspecciones/items/eventos, 15 productos, 8 servicios, 5 técnicos, 9 citas, 7 ventas, 1 cotización, 30 recordatorios, documentos y caja. ABC123 conserva a Carlos Rodríguez como propietario.

Después de las pruebas: 14 clientes, 17 vehículos, 62 órdenes, 8 ventas y 3 archivos con metadata D1. Se conservaron los datos ficticios de QA: QAC303 (prueba API) y QBN303 (prueba navegador). No se borraron registros para limpiar la demostración.

## Archivos creados

- wrangler.toml; .pages/wrangler.toml; .dev.vars.example.
- schema.sql; migrations/0001_initial.sql; seed/demo.sql.
- backend/cloud/model.js, repository.js, validation.js, auth.js, files.js, worker.js.
- js/runtime-config.js; js/bootstrap.js; js/services/localStore.js, apiClient.js, apiStore.js, fileService.js; css/cloud.css.
- scripts/generate-schema.mjs, seed.mjs, build.mjs, cloud-smoke.mjs.
- tests/cloud.test.mjs; tests/helpers/sqlite-d1.mjs.
- docs/V03-AUDIT.md, CLOUD-OPERATIONS.md, V03-REPORT.md, V02-README.md.
- Locales ignorados: dist/, .wrangler/, .dev.vars, cloud-access.txt, test-artifacts/cloud-smoke.json y backups/tallerpro-v03-20260917.sql.

## Archivos modificados

.gitignore, package.json, package-lock.json, index.html, README.md, docs/ARCHITECTURE.md, docs/QA.md; js/app.js; js/components/ui.js; js/services/store.js, integrationClient.js, qrService.js, vehicleIdentity.js; js/modules/entities.js, vehicleForm.js, reception.js, identification.js, orders.js, commerce.js, operations.js y dashboard.js; tests/run.mjs.

Los cambios en vistas son integración de guardado asíncrono, fotos/QR cloud y mensajes correctos. No se reconstruyó el diseño.

## Pruebas ejecutadas

**66/66 automatizadas aprobadas**: 48 de V0.2 + 18 cloud. SQL real de schema/seed contra SQLite en memoria con una fachada D1; se modeló el límite de SELECT compuestos observado en D1. R2 se dobla en pruebas unitarias, además de las comprobaciones remotas reales siguientes.

- Seed repetido sin duplicar, relaciones y claves foráneas compuestas.
- Autenticación, CORS, rechazo de otro company_id y ausencia de reset.
- Alta cliente/vehículo, placas equivalentes, IDs estables y conflictos.
- Venta/inventario atómicos, idempotencia y stock insuficiente.
- Recepción/orden/trabajo, actividad heredada, cotización/orden, caja y citas.
- Fotos válidas, MIME falso, referencias, lectura firmada y errores.
- Sin persistencia local fingida ante error; reintento con requestId idéntico.
- QR URL estable y compatibilidad con formato V0.2.

**Pruebas remotas D1/R2:** scripts/cloud-smoke.mjs creó cliente → vehículo → recepción/orden → trabajo, hizo una venta con salida de stock, subió una imagen y la recuperó desde R2. Una sesión nueva volvió a leer los mismos datos. Variantes ABC123/ABC 123/abc123 devolvieron v1. La verificación final de solo lectura pasó sobre el código publicado, revisión 11.

**Navegador público:** ingreso con código; alta de Cliente navegador CLOUD; catálogo Mazda → 2022 → Mazda 3 → Touring; registro QBN303; foto de ficha y persistencia al recargar; recepción completa con otra foto; OT-99004 y trabajo de $85.000; kilometraje actualizado a 100 e historial relacionado; foto de recepción recuperada tras recarga; QR con URL pública e identificación correcta. Navegación por los 13 módulos sin errores de consola capturados. Integraciones y reset deshabilitado visibles.

**Responsive:** móvil 390×844 y tablet 768×1024 revisados visualmente; documento sin desbordamiento horizontal en Configuración. Modal QR revisado en escritorio. No se probó una cámara física ni una impresora, Safari/Firefox, accesibilidad integral o carga concurrente de producción. Caja/cotizaciones se verificaron automáticamente contra SQL; no se cerró la caja pública manualmente.

Sintaxis JS validada, build realizado, dry-run Worker correcto y git diff --check sin errores (solo aviso CRLF). Secretos y builds comprobados como ignorados por Git.

**Respaldo:** exportación D1 a backups/tallerpro-v03-20260917.sql (128.488 bytes), restaurada en memoria para verificar conteos y PRAGMA foreign_key_check: cero errores. No se restauró ni sobrescribió la D1 remota. No incluye binarios R2.

## Qué persiste y qué queda DEMO

En CLOUD, D1 conserva los datos de negocio de todos los módulos y R2 conserva las fotografías. localStorage solo mantiene la preferencia del menú; sessionStorage mantiene la sesión temporal. El origen local conserva toda la base V0.2, sin importarla ni destruirla. La nube arranca con seed equivalente, no con una copia de las ediciones privadas del navegador.

Reconocimiento permanece DEMO, catálogo local orientativo y consulta externa no configurada. Se mantienen adapters seguros del Worker; faltan tokens de Plate Recognizer, CarAPI y proveedor de consulta si se desea activarlos. Para operar la DEMO publicada no faltan credenciales Cloudflare.

## Problemas encontrados y resueltos

- D1 rechazó SELECT compuestos más grandes que SQLite local: se agruparon hasta cinco términos por sentencia dentro de un batch consistente y se añadió regresión.
- Actividad de recepción heredada sin ID: se asigna ID compatible antes de persistir; no se generaron órdenes parciales.
- Pages no acepta --config a una ruta custom ni account_id en su archivo: se separó configuración estándar en .pages/ y se completó publicación.
- Se corrigieron textos que aún decían guardado local, nombres repetidos en recepción y se añadió preview/progreso al subir fotos.

## Límites y recomendaciones V0.4 (no implementadas)

Implementar autenticación individual/roles y autorización por taller; paginación y controles de concurrencia más finos; catálogo colombiano validado; pruebas de cámaras móviles; auditoría por usuario; backups programados D1/R2; retención y limpieza administrativa de subidas abandonadas. No hay edición cloud offline, actualizaciones en tiempo real ni restauración/importación pública. La sesión DEMO compartida permite a quienes tengan el código editar los mismos datos ficticios. Fotos previas a una recepción cancelada pueden quedar sin referencia de ficha/orden y requieren revisión administrativa.

Guía operativa y comandos seguros: CLOUD-OPERATIONS.md. No se inició V0.4.
