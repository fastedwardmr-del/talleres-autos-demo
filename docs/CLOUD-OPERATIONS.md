# Operación CLOUD y recuperación

## Dominio personalizado (17 de septiembre de 2026)

`https://talleres-autos.edylaser3d.com` está activo y vinculado al proyecto Pages `talleres-autos-demo`. Se creó únicamente el CNAME `talleres-autos` con destino `talleres-autos-demo.pages.dev`, proxy habilitado y TTL automático. Pages confirmó dominio, verificación y validación activos; HTTPS devuelve 200 con TallerPro. El Worker permite este origen además de pages.dev (preflight 204 verificado). La dirección pages.dev sigue operativa. Los demás registros DNS permanecen intactos.

Todos los comandos de esta guía se limitan a los recursos creados para TallerPro. Antes de cada operación revisa nombre de Worker, ID D1 y bucket en wrangler.toml. No uses archivos de configuración de otros proyectos.

## Publicar cambios

1. `npm test` y `wrangler deploy --dry-run --config wrangler.toml`.
2. Si hay una migración nueva, exporta primero D1, revisa el SQL y aplica solo la migración necesaria. No reapliques schema.sql sobre una base poblada.
3. `wrangler deploy --config wrangler.toml` publica api-tallerpro-demo. Comprueba health y los flujos antes de avanzar.
4. Build con DATA_MODE=api y API_BASE_URL del Worker (README).
5. Desde `.pages/`: `wrangler pages deploy ../dist --project-name talleres-autos-demo --branch main --commit-dirty=true`. Regresa después a la raíz del repositorio..
6. Comprueba la URL estable https://talleres-autos-demo.pages.dev. Los dominios efímeros de preview no están incluidos en CORS y no se habilitan automáticamente.

La configuración de Pages vive en `.pages/wrangler.toml`, separada del Worker: Wrangler Pages no admite una ruta custom con --config ni account_id en ese archivo. La cuenta se obtiene de la sesión; puede fijarse mediante CLOUDFLARE_ACCOUNT_ID.

La creación de D1/R2/Pages, la migración inicial y el seed ya se ejecutaron. No es necesario repetirlos para desplegar frontend o Worker.

## Respaldo D1

Desde este repositorio, crea backups/ si no existe y ejecuta:

```powershell
wrangler d1 export tallerpro-demo-db --remote --config wrangler.toml --output backups/tallerpro-fecha.sql
```

Usa un nombre nuevo con fecha. El archivo contiene datos del taller: está ignorado por Git y no debe subirse a Pages. Comprueba que el archivo exista y tenga contenido. La exportación de Configuración es un respaldo lógico de los datos visibles; no reemplaza el respaldo SQL ni copia objetos R2.

Para R2, conserva también los objetos y un inventario de sus keys. El bucket es privado; las URLs de la interfaz expiran. No se configuró un backup programado ni credenciales S3 en esta entrega. Antes de una migración que afecte fotos, exporta metadata y copia los objetos con acceso exclusivo a tallerpro-demo-files. Nunca uses un comando de sincronización que borre el destino sin revisar sus efectos.

## Recuperación y rollback

- Pages: revisa despliegues de talleres-autos-demo y selecciona el anterior funcional desde el panel de ese proyecto. No toca D1.
- Worker: `wrangler deployments list --name api-tallerpro-demo` permite identificar la versión anterior; `wrangler rollback <VERSION_ID> --config wrangler.toml` cambia el código. Requiere revisar compatibilidad de esquema antes de ejecutarlo. No se ejecutó ningún rollback en esta entrega.
- D1: una reversión de código no revierte datos. Restaura preferentemente a una base NUEVA de recuperación, verifica relaciones/conteos y cambia el binding solo tras aprobación. No importes un dump sobre la D1 en uso sin plan y autorización: puede afectar datos existentes.
- R2: no renombres ni borres objetos al revertir código. Conserva keys y metadata; primero comprueba la referencia de cada archivo.

## API

GET /api/health es público y no revela secretos. POST /api/session valida el código compartido y devuelve sesión HMAC de ocho horas, ligada exclusivamente a demo. Intentos de código limitados en D1.

Todas las demás rutas de negocio requieren Bearer. GET /api/state devuelve `{ok:true,data:{state,revision}}`. Lecturas REST: companies, customers, vehicles, vehicles/plate/:plate, vehicles/:id/history, receptions, work-orders, quotes, products, services, inventory, sales, cash, appointments, technicians y reminders. Listados/detalles devuelven records y revision.

POST /api/transactions recibe requestId, revision y changes (lista de cambios por entidad). Es el comando transaccional compartido para los formularios; los nombres de tablas SQL no vienen del cliente. POST /api/sales ejecuta cobro/stock. No existe un endpoint de reemplazo total o reset. DELETE público no está implementado. La baja de cliente sin relaciones se valida dentro del comando; con relaciones se rechaza.

POST /api/files sube una imagen con vehicleId y, si ya existe, receptionId. GET /api/files/:id requiere URL firmada. Integraciones V0.2 quedan detrás de sesión, CORS y secretos.

Errores coherentes: `{ok:false,error:{code,message}}`. Conflicto 409: la UI carga el estado nuevo y conserva el formulario para revisar/reintentar. Red o 5xx: no se confirma éxito; Reintentar guardado usa el mismo requestId. No cierres la pestaña mientras haya un guardado sin confirmar; esa operación pendiente vive solo en memoria.

## Límites deliberados

Acceso compartido DEMO, sin roles efectivos por usuario. Revisión global por taller: cambios independientes concurrentes pueden producir conflicto conservador. La lectura inicial carga el taller completo; todavía sin paginación. Las ediciones masivas pueden alcanzar límites de statements D1. Las subidas previas a una recepción cancelada conservan metadata y requieren revisión administrativa. No hay tareas de limpieza ni backups automáticos.

Referencias oficiales: [D1 batch transaccional](https://developers.cloudflare.com/d1/worker-api/d1-database/), [migraciones](https://developers.cloudflare.com/d1/reference/migrations/), [Workers R2](https://developers.cloudflare.com/r2/api/workers/workers-api-reference/).
