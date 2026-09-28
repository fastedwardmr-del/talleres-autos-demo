# Auditoría inicial V0.3 · 17/09/2026

- V0.2 funcional: frontend modular nativo, sin compilación, servidor Node 4173; QR real vendorizado; proveedores opcionales vía backend.
- 48/48 pruebas aprobadas antes de cambios.
- Datos concentrados en DemoStore, clave localStorage tallerpro.demo.v1, version 1 y schemaVersion 2. Varias vistas llaman mutaciones síncronas; se requiere adaptación asíncrona para confirmar persistencia remota.
- Relaciones existentes: cliente/vehículo/órdenes/cotizaciones/ventas/citas. Inspección y fotos anidadas en órdenes; recordatorios/documentos/fotos en vehículos. Caja actual e histórico anidados. No conviene perder estas estructuras al migrar.
- Base equivalente del seed: 12 clientes, 15 vehículos, 60 órdenes/visitas, 5 técnicos, 15 productos, 8 servicios, 9 citas, 7 ventas, 1 cotización, 30 recordatorios, documentos y caja inicial. No se exportaron datos privados del navegador a Cloudflare.
- Wrangler global 4.108.0 instalado y OAuth válido. Se listaron D1, Pages y R2 en modo lectura. Los nombres talleres-autos-demo, tallerpro-demo-db y tallerpro-demo-files estaban libres. Cloudflare confirmó que api-tallerpro-demo no existía (10007).
- Los recursos ajenos se observaron únicamente para verificar nombres: no se reutilizaron ni modificaron. No existe configuración Cloudflare previa de este repositorio.
- Git conserva el trabajo previo sin commit (muchos archivos no rastreados); no se descarta ni resetea.

Decisión: repositorio API con lecturas de estado consistente y comandos de cambios por entidad, preservando los contratos de vistas. D1 normaliza entidades y relaciones hijas; cada tabla de negocio incorpora company_id y claves foráneas compuestas. Guardados con revisión, idempotencia y batch transaccional. R2 privado, metadata D1 y URLs de lectura firmadas. DEMO protegida por código compartido con sesión de duración limitada; roles productivos pendientes. Restablecimiento remoto ausente.
