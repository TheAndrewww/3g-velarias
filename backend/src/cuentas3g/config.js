/**
 * Cuentas 3G en el Administrador del sitio · configuración (WEB-03 y WEB-04 · plan final §8.3 y §8.7).
 *
 * Lee las variables con `leerConfig` del paquete cuentas3g-cliente (CTA-08, copiado sin cambios en
 * ../cuentas3g-cliente/) y suma la regla propia del sitio: la dirección de regreso es /admin/entrar/regreso.
 *
 * Variables (solo nombres; los valores van por el gestor de contraseñas y nunca en el repositorio):
 *   CUENTAS3G_MODO             apagado (por omisión) | ambos (WEB-03) | solo (WEB-04)
 *   CUENTAS3G_EMISOR           https://cuentas.3gvelarias.com (sin diagonal final)
 *   CUENTAS3G_CLIENTE_ID       sitio
 *   CUENTAS3G_CLIENTE_SECRETO  el secreto que da Cuentas 3G › Sistemas (se ve una sola vez)
 *   CUENTAS3G_REGRESO          https://<servidor del sitio>/admin/entrar/regreso (exacta, la misma que se dio de alta)
 *   CUENTAS3G_EMERGENCIA       si | (vacía) · solo cuenta en «solo»: vuelve a abrir el acceso de siempre, solo para Dirección
 *   CUENTAS3G_LISTA_CADA_S     opcional: cada cuántos segundos se pide la lista de versiones (60 por omisión)
 *   CUENTAS3G_LISTA_ARCHIVO    opcional: dónde se guarda la última lista buena (por omisión, en la carpeta temporal)
 *
 * Reglas (DISEÑO-CUENTAS-3G §3.1):
 *   - «apagado» = idéntico a hoy: sin botón, las rutas nuevas no existen y no se consulta nada a Cuentas 3G.
 *   - «solo» (WEB-04): el acceso de siempre se esconde y las sesiones que no vienen de Cuentas 3G dejan de valer,
 *     salvo la llave de emergencia (CUENTAS3G_EMERGENCIA) mientras esté puesta.
 *   - Configuración incompleta (falta o no sirve el emisor, el cliente, el secreto o la dirección de regreso):
 *     el sitio SE QUEDA EN «apagado» y lo anota. Nunca se abre ni se cae. Un modo desconocido, igual.
 */
const c3g = require('../cuentas3g-cliente/cuentas3g-cliente.cjs');

const RUTA_DE_REGRESO = '/admin/entrar/regreso';

/**
 * @returns {{ pedido: string, modo: string, completa: boolean, faltan: string[], desconocido: boolean,
 *             emergencia: boolean, cliente: object|null, listaCadaMs: number, archivoLista: string|null }}
 *   `pedido` es lo que dice la variable; `modo` es el que de verdad corre (apagado si falta configuración).
 *   `faltan` son NOMBRES de variables (las que faltan o no sirven), nunca valores.
 */
function leerConfig(env = process.env) {
    const base = c3g.leerConfig(env);
    const desconocido = !c3g.MODOS.includes(base.pedido);
    const pedido = desconocido ? 'apagado' : base.pedido;
    const faltan = [...base.faltan, ...base.malas];
    let modo = base.modo;
    // Regla del sitio: el regreso es la ruta del administrador (el paquete ya revisó https, sin consulta y lo demás).
    if (base.cliente) {
        let ruta = '';
        try { ruta = new URL(base.cliente.regreso).pathname; } catch (e) { ruta = ''; }
        if (ruta !== RUTA_DE_REGRESO) {
            faltan.push('CUENTAS3G_REGRESO');
            modo = 'apagado';
        }
    }
    const segundos = Number(env.CUENTAS3G_LISTA_CADA_S);
    return {
        pedido,
        modo,
        completa: faltan.length === 0,
        faltan: pedido === 'apagado' ? [] : faltan,
        desconocido,
        emergencia: modo === 'solo' && base.emergencia,
        cliente: modo === 'apagado' ? null : base.cliente,
        listaCadaMs: Number.isFinite(segundos) && segundos >= 5 ? Math.round(segundos * 1000) : 60000,
        archivoLista: String(env.CUENTAS3G_LISTA_ARCHIVO || '').trim() || null,
    };
}

module.exports = { leerConfig, RUTA_DE_REGRESO };
