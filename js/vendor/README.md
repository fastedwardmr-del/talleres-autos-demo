# Bibliotecas locales de QR

- `qrcode.js`: qrcode-generator 2.0.4, Kazuhiko Arase, MIT. Copia sin cambios de `dist/qrcode.mjs` (cabecera de licencia incluida). https://github.com/kazuhikoarase/qrcode-generator
- `jsqr.js`: jsQR 1.4.0, Cozmo. MIT, texto en `jsqr-LICENSE.txt`. Bundle UMD envuelto con `module/exports` locales y una exportación ESM; algoritmo sin cambios. https://github.com/cozmo/jsQR

Se incluyen en el repositorio para que QR funcione sin CDN ni instalación de dependencias. `package-lock.json` fija las versiones originales para auditar/actualizar.
