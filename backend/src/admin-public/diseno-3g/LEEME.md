# Diseño 3G en el Administrador del sitio

Esta carpeta trae el paquete **Diseño 3G v1.1.0** copiado (vendorizado) desde `Plataforma-3G/diseno-3g/` el 12-oct-2026, más los ajustes propios del panel `/admin`.

| Archivo | Origen | Nota |
|---|---|---|
| `diseno-3g.css` | paquete v1.1.0 + marca de **v1.2.0 (marca original) 7-nov-2026** (sha256 26426b801fc4db13…) | Tokens `--g3-*` y componentes `.g3-*`, todo bajo `html[data-diseno="3g"]`. |
| `diseno-3g.js` | paquete v1.1.0, sin cambios (sha256 27b767ac4806205c…) | Interruptor, selector de apps, avisos, confirmar, íconos. |
| `sistemas.json` | paquete v1.1.0, sin cambios (sha256 f4bac54ef921c330…) | Mismos datos que `G3.sistemas` (solo referencia). |
| `admin-3g.css` | propio del administrador | Rediseño 2: lista en tabla o galería, estados de la ficha, ficha en cajón ancho, fotos, subida y entrada. Todo bajo el atributo. |
| `admin-3g.js` | propio del administrador | Lo usa `app.js` mientras el atributo esté puesto (`G3_ON`). No hace peticiones propias. |

## Rediseño 2 (nov-2026): diseño FIJO

- `index.html` y `login.html` llevan `<html data-diseno="3g">` y el fragmento **fijo** (el mismo de Operación): el diseño nuevo
  es el de todos; `?diseno=actual` y la preferencia vieja «actual» ya no regresan a lo viejo. El selector de apps va sin el
  interruptor y la entrada ya no lo trae.
- **Respaldo:** si `diseno-3g.js` o `admin-3g.js` no llegan, `app.js` quita el atributo y queda el panel de siempre (nunca una
  mezcla). El marcado `.g3-no` y las ramas «apagado» de `app.js` son ese respaldo; se pueden borrar una semana después de
  publicar, como en los demás sistemas.
- **Lista:** tabla con miniatura, obra (título y ciudad), categoría, área y duración, globo 3D (Industrial), ficha y acciones.
  En anchos medianos lo que no cabe pasa debajo del nombre; en celular cada obra es un renglón. **Galería** como segunda vista
  (se recuerda en el navegador, `admin-sitio-vista`).
- **Estados de la ficha** (solo de la vista, sin peticiones): Todas · Por completar · En el globo 3D · Fuera del globo.
- **Ficha:** cajón ancho con Datos de la obra | Fotos y, en Industrial, Ubicación en el mapa y globo 3D abajo. Mismos campos,
  mismos nombres y el mismo `saveProject`.
- **Sofía:** con la variable `SOFIA_URL` en el servidor, `/admin` agrega su ventana flotante (`src/sofia.js`). Sin ella, nada.
- Comprobado: las 18 acciones del guion de peticiones mandan lo mismo que hoy (ruta, método, cuerpo, número y orden).

Antes del rediseño 2 se encendía con `/admin?diseno=3g` o el interruptor «Diseño 3G»; apagado se veía el panel de siempre.

Para actualizar el paquete: copia de nuevo los tres archivos del paquete y revisa la primera línea (versión).

## Marca: v1.2.0 (marca original) 7-nov-2026

- En `diseno-3g.css` cambiaron solo dos cosas, copiadas del paquete: la regla `.g3-logo-marca` ahora dibuja el **isologo
  original** de 3G (letras blancas y el cuadro rojo #BE202E) incrustado sobre un cuadro oscuro #111614, con el texto «3G» del
  HTML solo para lectores de pantalla; y el token claro `--g3-rojo-3g` pasa de #c4122f a **#be202e** (el oscuro #d9203d no
  cambia). El riel y la barra de celular del panel ya usaban `.g3-logo-marca`.
- Icono de pestaña de `index.html` y `login.html`: `/admin/icono-oscuro.svg` (de `Plataforma-3G/diseno-3g/marca/`). Antes el
  panel usaba un emoji y la entrada no tenía. El logotipo de la entrada (`assets/residencial/logo.svg`) no cambió.

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
