# Catálogo vehicular V0.4 — importación y mantenimiento

El catálogo es público e independiente de los datos del taller. No necesita API keys ni servicios de pago. Una vez importado, las consultas normales sólo usan la D1 de TallerPro. El navegador solicita como máximo 30 marcas, modelos, generaciones o motores por página; los años se limitan a un modelo.

## Fuente y licencia

Repositorio: https://github.com/gor3a/vehicle-makes-models

Commit auditado: `b4965631140fa82404359167621274601da69a5b`.
Archivo elegido: `data/vehicles.sqlite`, 59.547.648 bytes.
SHA256: `fd3e83550da158bf02d2b6e443392cd30af12a331fbca2e501050e409593857d`.
Licencia de datos: ODbL 1.0. Código del repositorio fuente: MIT. Atribución original: proyecto vehicle-makes-models y autoevolution.com; curación original de nombres del mercado egipcio por el proyecto.

Conservamos LICENSE-DATA en assets/catalog, mostramos atribución en el selector y ofrecemos `/assets/catalog/catalog.sql.gz`: base adaptada bajo ODbL, con esquema y datos exclusivos del catálogo. El archivo NO contiene clientes, vehículos del taller, sesiones, órdenes ni fotos; no se descarga durante el uso del formulario. `manifest.json` contiene procedencia, commit, SHA256, fecha y conteos. Se normalizaron espacios y búsquedas y se unificaron duplicados. Los nombres visibles se mantienen en su forma de origen, sin traducciones o versiones inventadas.

## Modelo y límites de los datos

Tablas nuevas: vehicle_catalog_sources, vehicle_makes, vehicle_models, vehicle_generations, vehicle_engines y vehicle_model_years. Índices para marca/modelo, búsquedas, relaciones y años. Ninguna tabla operativa se reconstruye ni se migra.

Todas las carrocerías son NULL en esta versión de la fuente. Tipo de vehículo permanece como atributo propio del taller; no filtra las marcas ni simula cobertura de motocicletas, buses o camiones. Country también se conserva NULL cuando no existe.

Años: unión de rangos explícitos de generaciones, sin rellenar huecos entre generaciones. Si un modelo no tiene generaciones se usa su rango explícito. Final NULL significa que sólo se ofrece el año inicial conocido, sin extrapolar a la fecha actual. Si falta el año real, el usuario puede registrarlo manualmente. No es una homologación oficial ni garantía de cobertura para Colombia.

## Reproducir una importación

Node.js 24 o superior. Revisar primero README, LICENSE-DATA y esquema de cualquier commit nuevo. No ejecutar scripts del repositorio externo.

```powershell
node scripts/import-vehicle-catalog.mjs --download --commit=b4965631140fa82404359167621274601da69a5b
# Alternativa offline con la copia ya descargada:
node scripts/import-vehicle-catalog.mjs --input=.catalog-source/vehicles.sqlite
npm test
```

El script valida integridad SQLite, relaciones, nombres, valores numéricos y rangos antes de generar SQL. Produce `.catalog-build/import.sql`, reporte y descarga pública comprimida. Identificadores deterministas por jerarquía/contenido normalizado; UPSERT y claves compuestas de años hacen que repetir la misma importación no duplique registros. Se preservan IDs originales como source_id. Los IDs técnicos de origen no se utilizan como IDs duraderos del catálogo.

La actualización es aditiva: no elimina automáticamente entradas antiguas que desaparezcan de un commit posterior. Para una nueva versión con retiradas o rangos corregidos, revisar esas diferencias y planificar su desactivación antes de importar; no borrar vehículos del taller. Los vehículos guardan textos además de IDs opcionales y siguen siendo legibles aunque cambie la fuente.

Sólo después de verificar el reporte y tomar un respaldo:

```powershell
wrangler d1 export tallerpro-demo-db --remote --config wrangler.toml --output backups/tallerpro-antes-catalogo-FECHA.sql
wrangler d1 migrations apply tallerpro-demo-db --remote --config wrangler.toml
wrangler d1 execute tallerpro-demo-db --remote --config wrangler.toml --file .catalog-build/import.sql
```

La migración 0002 ya se aplicó en V0.4. Importar no escribe ninguna tabla de clientes, vehículos u órdenes. No aplicar schema.sql sobre producción. Las operaciones CLI requieren acceso administrativo Cloudflare; los visitantes no necesitan credenciales del proveedor.

## Endpoints

En el Worker existente `api-tallerpro-demo`:

- `GET /api/catalog/makes?q=renau&offset=0`
- `GET /api/catalog/models?make_id=...&q=clio&offset=0`
- `GET /api/catalog/years?model_id=...`
- `GET /api/catalog/generations?model_id=...&year=2023&q=...&offset=0`
- `GET /api/catalog/engines?generation_id=...&q=...&offset=0`
- `GET /api/catalog/meta`

Respuesta `{ok:true,data:{items,hasMore,nextOffset,source,notice}}`. Meta devuelve procedencia. Catálogo público de lectura; escritura de vehículos conserva autenticación V0.3. Parámetros enlazados, longitud de búsqueda acotada, máximo 30 resultados por página. No existe endpoint que entregue todo el catálogo; descarga ODbL separada y voluntaria.

## Formulario compartido

Recepción y Vehículos llaman al mismo vehicleForm y catalogPicker. Búsqueda tras 250 ms sin teclear, normalización sin espacios, acentos ni guiones, paginación y controles de teclado. Cambiar marca limpia modelo, año, generación, motor e IDs; cambiar modelo limpia año y descendientes; cambiar año conserva modelo y actualiza generaciones compatibles. Respuestas atrasadas se descartan. Generación y motor son opcionales y sólo se muestran si existen datos.

«No encuentro mi vehículo» habilita marca, modelo, año y versión libres. Ante caída del catálogo se cambia al catálogo local, limpiando la selección para no mezclar IDs D1 con opciones locales. El local anterior se conserva como emergencia y sus versiones orientativas no se presentan como especificaciones verificadas.

El Worker valida las combinaciones de IDs y snapshots nuevos. Ediciones manuales no exigen catálogo. Registros antiguos permanecen accesibles por su identidad, sin migración.
