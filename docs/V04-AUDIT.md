# Auditoría V0.4 previa a cambios

Fecha: 2026-09-19. Recursos existentes: Pages talleres-autos-demo, Worker api-tallerpro-demo, D1 tallerpro-demo-db y R2 tallerpro-demo-files. No se requieren recursos nuevos.

Vehículos → Nuevo y Recepción → Registro manual comparten openVehicleForm/saveVehicleForm en js/modules/vehicleForm.js. El formulario previo usa type → make → year → model → versionId. vehicleCatalogService usa el catálogo local y opcionalmente CarAPI. vehicleCatalog.js también se usa en pruebas y debe conservarse. Identificación y edición de vehículos precargados usan entrada manual para preservar valores.

El Worker V0.3 autentica operaciones, envuelve respuestas y delega integraciones V0.2. D1 mantiene vehicles con columnas consultables y payload JSON, snapshots textuales make/model/year, claves por compañía; catálogo nuevo independiente, sin migración de vehículos. ApiStore escribe cambios atómicos y conserva campos adicionales del payload. Los nuevos endpoints consultarán sólo tablas de catálogo, sin cargar el estado del taller.

Fuente auditada: gor3a/vehicle-makes-models, commit b4965631140fa82404359167621274601da69a5b. README, LICENSE-DATA, árbol y SQLite real revisados. JSON agregado: 84.048.018 bytes; SQLite: 59.547.648; CSV motores: 5.259.055; CSV marcas/modelos: 86.075. SQLite conserva jerarquías y campos tipados, evitando parsear especificaciones crudas innecesarias.

SQLite: 164 marcas, 2.621 modelos, 7.169 generaciones, 30.390 motores. Todas las 7.169 carrocerías son NULL: no hay clasificación fiable por tipo. Se conserva tipo propio del vehículo, sin filtrar el catálogo por categorías inventadas. Generaciones: 1909–2026, 1.029 con final NULL, ninguno con inicio NULL ni rango invertido. Final NULL no autoriza extrapolar hasta hoy: ofrecer sólo inicio conocido, salvo años explícitos de otras generaciones. Opción manual siempre disponible.

ODbL 1.0 para datos, MIT para código fuente. Conservar avisos, atribuir proyecto y autoevolution.com, declarar normalización y publicar descarga del catálogo adaptado bajo ODbL, separada por completo de clientes y operaciones. No se usa API de proveedor ni GitHub durante registro.
