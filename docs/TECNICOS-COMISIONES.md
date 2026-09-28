# Técnicos y comisiones

## Inspección y alcance

Base revisada: `ecd8f0e`, rama `desarrollo-tecnicos-comisiones`, coincidente con GitHub el 28/09/2026. Se conservó el catálogo de vehículos. El frontend usa módulos ES y `ApiStore`; el Worker valida cambios y persiste mediante `D1.batch`, con revisión de taller y recibos idempotentes.

Antes de este cambio existían el cálculo puro, la migración 0003 y la inserción de comisiones junto con la venta. Faltaban cuentas individuales, autorización por rol, gestión de porcentajes/asignaciones, panel técnico, pagos y reversión auditada. Las pruebas de comisiones no estaban importadas por `tests/run.mjs`.

## Flujo de uso

1. Un administrador entra con su usuario y contraseña. En **Técnicos** registra los técnicos; en **Comisiones y accesos** crea sus cuentas, restablece contraseñas o desactiva el acceso. No se puede transferir una cuenta existente a otro técnico.
2. Configura el porcentaje general, el modo general/por servicio y las excepciones. Prioridad: técnico + servicio → técnico → servicio (solo modo SERVICE) → general. Cero es un porcentaje válido. El formulario vacío elimina una excepción y permite heredar.
3. En la OT agrega los servicios y pulsa **Asignar técnicos**. Puede asignar varios técnicos a cada línea. Los servicios nuevos conservan `serviceId`; para líneas antiguas sin referencia, el administrador confirma su servicio de catálogo en ese diálogo. Sin referencia se utiliza el porcentaje general o la excepción general del técnico. No se crean asignaciones retrospectivas automáticamente a partir del antiguo `technicianId`.
4. Crea y aprueba la cotización por el flujo existente. Al facturar, el servidor obtiene la OT y el origen desde la cotización, resuelve los porcentajes vigentes y crea venta, inventario y comisiones en un mismo batch. Un servicio sin asignación no genera comisión.
5. En **Liquidar comisiones**, selecciona un técnico y las comisiones a pagar. Puede abonar parte del saldo por comisión o liquidarlas completas. Registra fecha, importe, método y referencia. Un pago solo puede contener comisiones del mismo técnico. Los registros son inmutables; no se ejecuta una transferencia bancaria ni se crea automáticamente un movimiento de caja.
6. El técnico entra por la misma página y recibe un panel específico: sus servicios, estado, base, porcentaje, comisiones, saldos y pagos. Puede actualizar la consulta y cerrar sesión. El avance se modifica desde la OT por el administrador; el técnico tiene acceso de consulta.

Cada técnico recibe su propio porcentaje sobre la base completa del servicio; no se divide automáticamente entre participantes. La interfaz lo indica antes de asignar. Los importes se guardan en centavos COP y los porcentajes en puntos básicos. Se usa aritmética entera para descuento y redondeo, con hasta dos decimales en importes y porcentajes. Se excluyen productos e impuestos.

## Seguridad, concurrencia e historial

- Contraseñas PBKDF2-SHA256, sal aleatoria individual, 100.000 iteraciones versionadas por credencial; nunca se devuelve el hash al frontend. Longitud de contraseña: 12–200 caracteres. Inicio de sesión limitado a 20 intentos por IP en diez minutos.
- Sesiones HMAC de ocho horas. Cada solicitud comprueba credencial activa, rol, versión de sesión y vínculo técnico. Cambiar contraseña o guardar el acceso revoca las sesiones anteriores. Desactivar el técnico también bloquea su acceso.
- Una vez creada cualquier credencial individual, se rechazan tanto nuevos accesos DEMO como sesiones DEMO antiguas. El código compartido no puede administrar las cuentas individuales. Sin credenciales se conserva el funcionamiento de la demostración heredada.
- Para técnicos, el Worker solo permite `/api/me` y `/api/technician`; las rutas administrativas y operativas se bloquean antes de cargar el estado general. Su consulta SQL filtra por el técnico autenticado. No se entregan clientes, ventas generales, otros técnicos ni la instantánea administrativa completa.
- Configuración, cuentas, asignaciones, venta y pagos comparten el control de revisión de `companies`/`request_receipts`. Los reintentos conservan la operación; un conflicto obliga a actualizar. El frontend conserva en memoria un comando de resultado incierto para **Reintentar guardado**; tras recargar la página se debe consultar el historial antes de registrar otro pago.
- No se permite borrar o cambiar la identidad de un servicio asignado sin retirar primero sus asignaciones. Los identificadores se conservan al volver a guardar. Las órdenes facturadas no permiten reasignación. Un índice impide comisionar dos veces el mismo servicio/técnico aunque se intente otra cotización.
- La comisión conserva técnico, servicio, OT, factura, base, porcentaje, importe y una instantánea de línea, números de documentos, fecha, descuento e impuesto. Cambiar la configuración no recalcula registros existentes.
- Eliminar una venta o limpiar datos operativos mediante las funciones existentes revierte sus comisiones en el mismo batch y registra actor, motivo y valor pagado hasta ese momento. No se borran comisiones ni pagos. Si ya había pagos, el historial muestra el importe a revisar para recuperación; no se descuenta automáticamente de comisiones futuras. La limpieza administrativa existente sigue siendo destructiva para datos operativos y no fue ejecutada en producción.

## Migraciones

`0003_technicians_commissions.sql` se conserva compatible con las claves compuestas de 0001. `0004_commission_access_audit.sql` es aditiva: incorpora parámetros de credenciales, revocación de sesiones, estado de asignación, instantánea histórica, tabla de reversiones, guardia SQL de saldo e índice contra duplicados entre facturas.

Aplicar **0003 y luego 0004** antes de activar este Worker. Si un entorno de pruebas ya tiene 0003, aplicar solamente las pendientes; no recrear tablas. La información indicada por el propietario es que 0003 todavía no se ha ejecutado en producción. Si existiera una variante anterior distinta de 0003, comparar su esquema antes de continuar. El índice de 0004 rechaza duplicados activos preexistentes y requiere revisión manual si los hubiera; no los borra.

`schema.sql` y `scripts/generate-schema.mjs` siguen describiendo el esquema inicial. No utilizar ese generador para actualizar una base existente. Las pruebas ahora aplican los archivos de `migrations/` en orden sobre SQLite en memoria.

## Validación y límites

- Línea base: `npm test`: **73/74**, fallo previo `tests/cloud.test.mjs:28`, cierre y reapertura de caja (`4 !== 0`). La prueba mezcla el seed fechado respecto al día actual con una reapertura fija el 17/09/2026. No se modificó caja ni se ocultó la prueba.
- Las pruebas del módulo cubren credenciales/revocación, rutas por rol, aislamiento, precedencia, servicios antiguos, asignaciones múltiples/duplicadas, edición de OT, facturación, rollback completo ante fallo SQL, duplicado desde otra cotización, pagos parciales/completos/concurrentes, reversión e historial.
- Verificación de navegador sobre `tests/preview-team.mjs`, SQLite en memoria: configuración 25%, dos técnicos en una OT, cotización con descuento 10% e IVA 19%, factura y dos comisiones de $19.125 sobre base individual $76.500; abono de $5.000 y liquidación de $14.125; panel técnico aislado. Diseño revisado en escritorio y a 390 × 844 px; las tablas permiten desplazamiento horizontal en móvil.
- Incidencia previa adicional: algunas líneas de repuesto del seed (`js/data/seed.js:13`, también la cotización inicial) carecen de `productId`. Intentar facturarlas produce “Stock insuficiente: producto”. No se infiere el producto por nombre ni se cambia el catálogo. Para esa prueba visual se usó una cotización nueva de mano de obra; las pruebas API sí facturan servicios y productos con referencias válidas.
- El módulo requiere modo API. No se simulan cuentas ni liquidaciones seguras en modo local. No se migran comisiones retrospectivas de ventas anteriores. No se implementa devolución bancaria automática de pagos de facturas revertidas.
- No se realizaron despliegues, migraciones remotas, borrado de datos del usuario ni cambios en otros proyectos de Cloudflare.

## Pruebas y vista local reproducible

Requiere Node 24 y dependencias de `package-lock.json`.

```powershell
npm test
node tests/team.test.mjs
$env:API_BASE_URL='http://127.0.0.1:4188'
npm run build
node tests/preview-team.mjs
```

La vista crea una base **en memoria**, no usa `.dev.vars`, publica solamente `dist/` en `127.0.0.1:4188` y muestra dos usuarios QA con contraseña aleatoria temporal. Detener el proceso descarta esos datos. Nunca usar este servidor para producción. Para empaquetar el Worker sin publicar:

```powershell
npx wrangler deploy --dry-run --config wrangler.toml --outdir test-artifacts/worker-review
```

## Guía operativa para una publicación posterior (no ejecutada)

Estos pasos se entregan para que el responsable los ejecute tras aprobar la revisión. Requieren una ventana de mantenimiento y confirmar la cuenta y los recursos de TallerPro en `wrangler.toml`: Worker `api-tallerpro-demo`, D1 `tallerpro-demo-db`, R2 `tallerpro-demo-files`. No usar configuraciones de otros proyectos.

### 1. Respaldo D1 y revisión de pendientes

Con Wrangler autenticado en la cuenta correcta, guardar el respaldo fuera del repositorio y protegerlo: contiene datos personales y, después de la activación, hashes de credenciales.

```powershell
$tallerBackupDir=Join-Path $env:USERPROFILE 'TallerPro-respaldos'
New-Item -ItemType Directory -Force -Path $tallerBackupDir
$tallerBackupFile=Join-Path $tallerBackupDir ('d1-antes-comisiones-'+(Get-Date -Format 'yyyyMMdd-HHmmss')+'.sql')
npx wrangler d1 export tallerpro-demo-db --remote --config wrangler.toml --output $tallerBackupFile
Get-Item -LiteralPath $tallerBackupFile
npx wrangler d1 migrations list tallerpro-demo-db --remote --config wrangler.toml
```

Verificar que el export terminó correctamente y que el archivo contiene esquema y datos. Ensayar restauración en una base de pruebas independiente antes de continuar; el export D1 no contiene objetos R2. Esta entrega no cambia ni elimina objetos R2 por sí misma.

### 2. Aplicar las migraciones pendientes

Primero ensayar localmente sobre una copia de datos. Para la base remota, únicamente cuando se haya aprobado la publicación y comprobado el respaldo:

```powershell
npx wrangler d1 migrations apply tallerpro-demo-db --remote --config wrangler.toml
```

Debe aplicar las pendientes en orden, incluidas 0003 y 0004. No ejecutar seed, reset ni `schema.sql` en producción. Ante un error, detener el procedimiento y revisar; no borrar tablas ni marcar una migración como aplicada manualmente.

### 3. Crear el primer administrador

Elegir un identificador nuevo que no exista en `users`. El script solo genera SQL; recibe la contraseña por entrada estándar y no la escribe en el archivo. En PowerShell 7:

```powershell
$tallerAdminSql=Join-Path $tallerBackupDir 'alta-admin.sql'
Read-Host 'Contraseña del administrador (mínimo 12 caracteres)' -MaskInput |
  node scripts/create-admin.mjs administrador 'Administrador del taller' $tallerAdminSql
npx wrangler d1 execute tallerpro-demo-db --remote --config wrangler.toml --file $tallerAdminSql
```

No pegar la contraseña en comandos, archivos de ejemplo, historial Git o variables versionadas. El script no sobreescribe un archivo existente. Guardar o eliminar posteriormente el SQL derivado conforme a la política de respaldo del taller. Las siguientes cuentas se gestionan en el panel. No volver al Worker antiguo después de habilitar usuarios: el antiguo acceso DEMO no implementa esta separación.

### 4. Worker

Conservar los secretos existentes fuera del repositorio; `SESSION_SECRET` debe ser aleatorio y estar configurado como secreto del Worker. Para establecerlo o rotarlo de forma interactiva, si fuera necesario, usar `npx wrangler secret put SESSION_SECRET --config wrangler.toml`; rotarlo cierra todas las sesiones. Verificar `ALLOWED_ORIGINS` para el dominio real de Pages.

```powershell
npx wrangler deploy --config wrangler.toml
```

Tomar la URL HTTPS confirmada por Wrangler. Validar `/api/health`, inicio de sesión del administrador y rechazo del DEMO antes de habilitar tráfico normal.

### 5. Pages

Reconstruir con la URL **real** del Worker, nunca con la URL local del ejemplo. El proyecto Pages existente se llama `talleres-autos-demo`.

```powershell
$env:DATA_MODE='api'
$env:API_BASE_URL='https://URL-REAL-DEL-WORKER'
npm run build
npx wrangler pages deploy dist --project-name talleres-autos-demo --branch main
```

El último comando publica en la rama de producción de Pages si es `main`; comprobar esa configuración antes de ejecutarlo. No fusiona ramas Git. Publicar únicamente `dist/`, nunca el repositorio, los respaldos ni `.dev.vars`. Verificar después con dos usuarios distintos: configuración/asignación/facturación/pago como administrador, y consulta aislada como técnico. Mantener la publicación bloqueada si falla alguna operación esencial. El fallo previo de caja debe evaluarse separadamente antes de liberar.
