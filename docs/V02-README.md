# TallerPro V0.2 — Identificación inteligente y catálogo vehicular

Evolución de V0.1 sobre el mismo proyecto: conserva diseño, navegación, los 13 módulos y datos locales. HTML/CSS/JavaScript modular sin compilación, con QR real y proxies opcionales para proveedores externos.

## Ejecutar

Requiere Node.js 22 o posterior. Desde esta carpeta:

```sh
npm start
```

Abre [TallerPro](http://localhost:4173). No hace falta instalar paquetes: las bibliotecas QR están incluidas en `js/vendor/`. `npm ci` permite reinstalar las dependencias de desarrollo. Detén con Ctrl+C. Usa este servidor, no `file://` ni un servidor estático genérico sobre la raíz: `server.mjs` protege los archivos privados y proporciona los endpoints.

```sh
npm test
```

48 pruebas: las 10 originales y 38 nuevas. Consulta [QA](QA.md).

## Recorrido de prueba

1. **Placa:** Recepción → Ingresar placa. `ABC123`, `ABC 123` y `abc123` encuentran el mismo Mazda 3 de Carlos Rodríguez. Abre historial o nueva recepción. `ZZZ999` ofrece foto, consulta opcional y registro si no lo has creado.
2. **Foto/cámara:** Recepción → Fotografiar vehículo / placa → Usar cámara → Capturar fotografía, o Subir fotografía. JPG/PNG/WebP hasta 1,5 MB. Puedes usar `tests/fixtures/vehicle-demo.png`, una ilustración de prueba. Pulsa Analizar vehículo. Sin credenciales, el escenario devuelve ABC123 o ZZZ999: **la simulación no interpreta la imagen**. ZZZ999 permite completar registro con Toyota/Corolla/color precargados. Puedes corregir la placa.
3. **Catálogo:** Vehículos → Nuevo vehículo. Automóvil → Mazda → 2022 → Mazda 3 → versión. Cambiar Mazda por Toyota limpia año, modelo, versión y especificaciones, conservando placa/VIN/color/kilometraje/propietario. Puedes forzar catálogo local aunque haya proveedor.
4. **Manual:** Recepción → Registro manual, o Registrar manualmente en el formulario. Admite marcas/modelos fuera del catálogo, con versión y especificaciones opcionales. Completa los campos obligatorios y propietario para guardar.
5. **QR:** Ficha → Identificación QR → Descargar QR o Imprimir QR. Recepción → Escanear QR → subir el SVG descargado, o usar cámara y Leer QR en cámara. También acepta `tallerpro:vehicle:v1`. El código conserva el identificador aunque cambie la placa y busca en los datos de este navegador.
6. **Integraciones:** Configuración muestra DEMO/local/no configurado/QR activo. Tener una credencial no significa CONECTADO: debe existir una solicitud exitosa al proveedor.

La cámara necesita permiso y contexto seguro (localhost o HTTPS). Si falla, selecciona un archivo o registra manualmente. No se validó una cámara física en esta entrega.

## Real frente a DEMO

| Función | Alcance |
|---|---|
| Captura/preview | APIs reales del navegador; imágenes locales |
| QR | Generación y decodificación reales con qrcode-generator y jsQR |
| Registro/historial/recepción/operaciones | Funcionales en localStorage |
| Reconocimiento sin token | Resultado fijo DEMO, sin OCR ni envío de imágenes |
| Plate Recognizer | Proxy y adapter implementados; falta validar con cuenta real |
| Catálogo local | Diez marcas, varios modelos/años/versiones orientativos; no homologación técnica |
| CarAPI | Adapter remoto implementado; cobertura Colombia no garantizada y fallback local |
| Consulta vehicular | Contrato genérico para proveedor autorizado; ninguno configurado |
| Pagos/mensajería/documentos comerciales | DEMO local, sin cobros externos ni validez fiscal |

Las especificaciones no confirmadas quedan vacías y editables. No se inventa precisión técnica.

## Credenciales para activar proveedores

Copia `.env.example` a `.env` en tu equipo. Reinicia `npm start` al cambiarlo. `.env` está ignorado por Git y no se publica. No pongas secretos en `js/`, capturas ni chats.

| Variable | Qué obtener/configurar |
|---|---|
| `PLATE_RECOGNIZER_TOKEN` | Token de tu cuenta Snapshot Cloud de Plate Recognizer |
| `PLATE_RECOGNIZER_MMC` | `true` solo con Make/Model/Color habilitado en tu plan; defecto `false` |
| `CARAPI_TOKEN` | `api_token` de una cuenta CarAPI con acceso a los endpoints usados |
| `CARAPI_SECRET` | `api_secret` de esa cuenta; backend obtiene el JWT |
| `VEHICLE_LOOKUP_URL` | Endpoint HTTPS autorizado que cumpla el contrato indicado abajo |
| `VEHICLE_LOOKUP_TOKEN` | Token Bearer para ese endpoint |
| `VEHICLE_LOOKUP_REQUIRES_DOCUMENT` | `true` si exige documento del propietario |
| `PORT` | Puerto local, 4173 por defecto |

Documentación oficial: [Plate Recognizer Snapshot](https://guides.platerecognizer.com/docs/snapshot/api-reference/) y [autenticación CarAPI](https://carapi.app/docs/api/auth/). El adapter usa Snapshot `plate-reader/`; CarAPI `makes/v2`, `years/v2`, `models/v2`, `trims/v2` y detalle de versión. Costos, cupos y cobertura dependen del contrato. No se enviaron fotos a proveedores durante las pruebas.

La consulta opcional envía POST JSON `{ "plate": "ABC123", "ownerDocument": "..." }` con Bearer desde el backend. Espera JSON con campos TallerPro: `make`, `model`, `year`, `version`, `vin`, `engine`, `displacement`, `fuel`, `transmission`, `drive`, `bodyType`, `color`. El documento no se guarda en el vehículo; se solicita consentimiento. Es un contrato genérico, no una integración oficial RUNT ni un proveedor colombiano contratado. No hay scraping.

## Servicios y fallbacks

- `vehicleRecognitionService`: placa/confianzas/marca/modelo/color/carrocería normalizados. Sin token usa DEMO sin enviar foto. Los fallos reales permiten reintentar, simular explícitamente o registrar manualmente.
- `vehicleCatalogService`: única entrada de la UI al catálogo. Remoto, local automático ante error/vacío, selección local explícita y alternativa manual.
- `vehicleLookupService`: consulta opcional con documento si hace falta; ausencia/error conserva el registro manual.
- `qrService`: QR real `tallerpro:vehicle:<vehicle_id>`, rechaza códigos ajenos y no abre URLs externas.
- `adapters.js`: mantiene la fachada existente; `backend/providers.js` transforma respuestas externas sin exponer secretos.

## Compatibilidad y seguridad

Se mantiene la clave `tallerpro.demo.v1` y `data.version = 1`; se añade `schemaVersion = 2`. Migración idempotente, sin reinicio de datos: `vehicle_id = id`, `make = brand`, `customer_id = ownerId` conservan relaciones con órdenes, ventas, cotizaciones, clientes y citas. La placa no es clave primaria. Las especificaciones genéricas del seed se corrigen solo con su firma original y se conservan en `legacyDemoSpecs`.

Exporta un respaldo en Configuración antes de cargar datos importantes. localStorage pertenece al navegador/origen, tiene cuota y no es respaldo permanente ni base compartida. Cambiar puerto o navegador cambia los datos visibles.

El servidor escucha solo en `127.0.0.1`, permite únicamente archivos frontend, comprueba origen/host y limita tamaño, concurrencia y frecuencia. Errores de proveedor redactados, sin tokens ni respuestas privadas. Fotos de identificación DEMO en URLs temporales locales, liberadas al cerrar. Procesamiento real requiere consentimiento. Fotos de recepción conservan el almacenamiento V0.1.

No hay autenticación multiusuario: **no expongas este servidor directamente a Internet**. El límite de frecuencia es local al proceso y no sustituye controles de producción.

## Continuidad y V0.3

Se conservan Inicio, Clientes, Vehículos, Recepción, Órdenes, Cotizaciones, Agenda, Inventario, POS/Ventas, Caja, Técnicos, Reportes y Configuración, incluidas transacciones locales de stock/caja e historial.

Arquitectura prevista: navegador → Cloudflare Pages → Worker → D1/R2 y proveedores. `backend/worker.js` es un punto de entrada Request/Response, sin desplegar. V0.3: autenticación/roles/talleres, auditoría, migraciones D1 y transacciones, archivos privados R2, respaldo/importación, pruebas de proveedores y cámaras móviles, catálogo validado para Colombia. D1, R2, WhatsApp y facturación electrónica no se conectaron.

Detalles: [arquitectura](ARCHITECTURE.md), [QA](QA.md), [archivos V0.2](V02-CHANGES.md).
