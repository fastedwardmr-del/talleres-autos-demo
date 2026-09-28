# Archivos V0.2

## Creados

- `.env.example`, `.gitignore`, `package-lock.json`.
- `backend/api.js`, `providers.js`, `staticPolicy.js`, `worker.js`: proxy, adapters y frontera pública.
- `js/data/vehicleCatalog.js`: catálogo local.
- `js/services/vehicleIdentity.js`, `vehicleMigration.js`, `vehicleRecognitionService.js`, `vehicleCatalogService.js`, `vehicleLookupService.js`, `integrationClient.js`, `cameraService.js`, `qrService.js`.
- `js/modules/vehicleForm.js`, `identification.js`; `css/vehicles-v02.css`.
- `js/vendor/`: bibliotecas QR, documentación y licencias.
- `tests/vehicles-v02.test.mjs`, `tests/run.mjs`, `tests/fixtures/vehicle-demo.png`, `tests/fixtures/qr-v1.svg`.
- Este inventario.

## Modificados sobre V0.1

- `js/app.js`: eventos/formularios, búsqueda normalizada, integración de vistas.
- `js/components/ui.js`: cierre de modales y nombres de vehículo.
- `js/services/store.js`, `adapters.js`: migración, validación, compatibilidad y servicios.
- `js/modules/entities.js`, `reception.js`, `operations.js`: formulario/ficha, identificación, estados de integraciones.
- `index.html`: hoja de estilos adicional.
- `server.mjs`, `package.json`: servidor/proxy local y pruebas.
- `README.md`, `docs/ARCHITECTURE.md`, `docs/QA.md`: uso, credenciales, arquitectura y evidencia.

Dashboard, órdenes, cotizaciones, agenda, POS, caja y reportes conservan sus flujos; no se reconstruyeron.
