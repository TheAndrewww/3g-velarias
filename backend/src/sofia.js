// Ventana flotante de Sofía (la asistente interna de 3G) en el administrador del sitio.
//
// Bandera SOFIA_URL: la dirección base del servicio de Sofía (https://…). Vacía o mal escrita = idéntico a hoy:
// /admin se manda con el mismo sendFile de siempre y no se pide nada nuevo. Con ella, el servidor agrega al final del
// <body> del panel UNA etiqueta:
//
//   <script src="<SOFIA_URL>/flotante.js" data-sistema="sitio" async></script>
//
// Solo en el panel con sesión (/admin, después de requireAuth). Nunca en la entrada (/admin/login), ni en el sitio
// público, ni en los archivos estáticos de /admin/*.
//
// Política de seguridad (CSP): este servidor no manda ninguna hoy, así que nada bloquea el script ni el marco de Sofía.
// Si algún día se agrega una, debe permitir el origen de SOFIA_URL en script-src y en frame-src (ver `origen`).
'use strict';

const SISTEMA = 'sitio';

function escaparAtributo(texto) {
    return String(texto).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Solo http(s), sin usuario ni contraseña en la dirección, sin «?» ni «#». Devuelve la base sin «/» al final, o null.
function leerBase(valor) {
    const texto = String(valor == null ? '' : valor).trim();
    if (!texto) return null;
    let u;
    try { u = new URL(texto); } catch (e) { return null; }
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    if (u.username || u.password || u.search || u.hash) return null;
    return { base: (u.origin + u.pathname).replace(/\/+$/, ''), origen: u.origin };
}

/**
 * @param {object} [opciones]
 * @param {string} [opciones.url]      el valor de SOFIA_URL
 * @param {string} [opciones.sistema]  el nombre que ve Sofía (data-sistema); «sitio» por omisión
 * @param {Function} [opciones.anotar] para avisar en el registro si la variable viene mal escrita
 */
function crearSofia({ url, sistema = SISTEMA, anotar = (m) => console.warn(m) } = {}) {
    const leida = leerBase(url);
    const pedida = String(url == null ? '' : url).trim() !== '';
    if (pedida && !leida) anotar('⚠️  SOFIA_URL no es una dirección http(s) válida: el administrador sigue sin la ventana de Sofía.');

    const etiqueta = leida
        ? `<script src="${escaparAtributo(leida.base + '/flotante.js')}" data-sistema="${escaparAtributo(sistema)}" async></script>`
        : '';

    // Agrega la etiqueta justo antes del último </body> (o al final si la página no lo trae). Sin Sofía: la misma página.
    function conVentana(html) {
        if (!leida) return html;
        const i = html.toLowerCase().lastIndexOf('</body>');
        const linea = `    <!-- Sofía: ventana flotante (SOFIA_URL) -->\n    ${etiqueta}\n`;
        return i === -1 ? html + '\n' + linea : html.slice(0, i) + linea + html.slice(i);
    }

    // Para /api/inicio3g/v1/salud (WEB-02): sin SOFIA_URL no aparece nada (la salud queda como estaba).
    const salud = {
        faltan: () => [],
        pieza: () => {
            if (!pedida) return null;
            const base = { id: 'sofia', nombre: 'Ventana de Sofía' };
            return leida
                ? { ...base, estado: 'ok', mensaje: 'Encendida en el administrador' }
                : { ...base, estado: 'aviso', mensaje: 'SOFIA_URL no es una dirección válida: la ventana no se carga' };
        },
    };

    return { activa: !!leida, origen: leida ? leida.origen : null, etiqueta, conVentana, salud };
}

module.exports = crearSofia;
module.exports.leerBase = leerBase;
