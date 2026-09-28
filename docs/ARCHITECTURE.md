# Arquitectura actual

La versión vigente es **TallerPro V0.3 CLOUD**. Lee:

- [README](../README.md): componentes, multi-taller, modos local/API y recursos.
- [Operación CLOUD](CLOUD-OPERATIONS.md): contratos de API, despliegue, respaldo y recuperación.
- [Informe V0.3](V03-REPORT.md): archivos, pruebas y límites comprobados.
- [Auditoría inicial](V03-AUDIT.md): punto de partida V0.2 y comprobación de aislamiento.

Se conserva la arquitectura modular de vistas y servicios de V0.2. ApiStore sustituye la persistencia local por comandos transaccionales al Worker. El modo local usa DemoStore sin conexión Cloudflare. La UI mantiene aliases de IDs; D1 usa claves compuestas por company_id, normalización de placa y relaciones hijas. R2 almacena binarios privados y D1 sus metadatos.
