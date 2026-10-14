# Diseño 3G en el Administrador del sitio

Esta carpeta trae el paquete **Diseño 3G v1.1.0** copiado (vendorizado) desde `Plataforma-3G/diseno-3g/` el 12-oct-2026, más los ajustes propios del panel `/admin`.

| Archivo | Origen | Nota |
|---|---|---|
| `diseno-3g.css` | paquete v1.1.0, sin cambios (sha256 c28ef2683a9f8353…) | Tokens `--g3-*` y componentes `.g3-*`, todo bajo `html[data-diseno="3g"]`. |
| `diseno-3g.js` | paquete v1.1.0, sin cambios (sha256 27b767ac4806205c…) | Interruptor, selector de apps, avisos, confirmar, íconos. |
| `sistemas.json` | paquete v1.1.0, sin cambios (sha256 f4bac54ef921c330…) | Mismos datos que `G3.sistemas` (solo referencia). |
| `admin-3g.css` | propio del administrador | Lista de obras, ficha en cajón, fotos, subida y entrada. Todo bajo el atributo. |
| `admin-3g.js` | propio del administrador | Lo usa `app.js` solo con el interruptor encendido (`G3_ON`). |

**Cómo se enciende:** abrir `/admin?diseno=3g` (se recuerda en ese navegador) o el interruptor "Diseño 3G" del panel de apps (9 puntos). `?diseno=actual` lo apaga.
Apagado, el panel se ve y funciona exactamente como antes (comprobado con capturas píxel por píxel).

Para actualizar el paquete: copia de nuevo los tres archivos del paquete y revisa la primera línea (versión).

## Diseño 3G v1.1.0 (12-oct-2026): qué cambió para este sistema

- **Direcciones:** el paquete ya no trae las direcciones internas (Operación, Entregas, Finanzas, Administrador del sitio):
  `url: null, sensible: true`. Sin dirección, el selector de apps dice «Ábrela desde Inicio 3G» y no es enlace.
  Se completan con `G3.configurar({ urls })` **solo desde un archivo servido con sesión** (DESIGN.md §14 del paquete).
  Nunca pongas direcciones internas en esta carpeta.
- **Fragmento de `<head>`:** ahora `<style>` + `<script>` (copiado igual en las páginas de este sistema): oculta `.g3-si`
  aunque `diseno-3g.css` no cargue y respeta `<html data-g3-excluir>` / `window.G3_RUTAS_SIN_DISENO`.
- **Movimiento reducido** solo afecta a los componentes `g3-*`; **barra inferior**: `--g3-espacio-inferior` y
  `g3-sobre-barra-inferior` para que las barras fijas del sistema queden encima; sesión en la barra con `g3-sesion`.
- **Esta carpeta se sirve sin sesión** (`express.static`): aquí no va ninguna dirección interna. La del propio panel sale
  de `location.origin + '/admin'`; las demás, solo desde una ruta del servidor que revise la sesión (DESIGN.md §14).
- `index.html` y `login.html` ya traen el fragmento v1.1.0.

## Ola 2 (12-oct-2026)

- **Armazón común (solo encendido):** riel con Portafolio › Residencial e Industrial (con su número de obras) y
  Sitio público › Ver sitio; barra superior con tema, selector de apps y la sesión (`g3-sesion`, cierra sesión);
  en celular, barra inferior Residencial · Industrial · Sitio · Más (abre el riel). El marcado vive en `index.html`
  (`g3-si`) y `admin-3g.js` mete `#admin-contenido` en `#g3-principal` al cargar; si no pudiera, no define `G3A` y
  el panel queda como siempre.
- **Sin cambios de lógica:** Guardar usa el mismo `saveProject` sin compuertas; el error de carga ya no trae
  «Reintentar» (no agrega peticiones); la estrella se desactiva en fotos nuevas de una obra que ya tiene fotos
  («Guarda la obra para poder elegirla como principal»); pegar en Latitud solo llena los dos campos con
  «20.9437, -101.4270» o un enlace de Google Maps; Latitud y Longitud usan el teclado normal.
