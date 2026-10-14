/**
 * Puertas entre sistemas del servidor del sitio (WEB-02 · plan final §7.1 y §7.3).
 *
 *   GET /api/inicio3g/v1/salud    alcance «inicio.leer»  ¿Está en línea? (contrato del Inicio v2 §2.1 + config y banderas)
 *   GET /api/sistemas/v1/llaves   alcance «llaves.leer»  Llaves vivas del sitio, solo metadatos (B8; lo lee Cuentas 3G)
 *   GET /api/inicio3g/v1/llaves   el mismo de arriba (el plan nombra los dos prefijos para /llaves)
 *
 * Cómo se entra (igual en los cinco sistemas):
 *   - El que llama manda «Authorization: Bearer <llave>» y «X-3G-Origen: <sistema>» (inicio, cuentas…).
 *   - Aquí solo se guarda la HUELLA SHA-256 de cada llave y sus alcances, en variables de entorno:
 *       LLAVE_ENTRANTE_<ORIGEN>_SHA256=<64 caracteres hex>      ALCANCES_<ORIGEN>=inicio.leer,llaves.leer
 *   - La comparación es en tiempo constante. Sin llave o sin alcances para ese origen: 503 «puerta sin configurar»
 *     (son rutas nuevas: cerradas desde el primer día no tumban nada).
 *   - 60 peticiones por minuto por origen. Registro de hora, origen, ruta y código, sin datos personales.
 *   - Por /api/inicio3g/v1 nadie escribe: cualquier método que no sea GET responde 405.
 *   - Ninguna respuesta trae una llave, una contraseña ni una huella.
 */
const crypto = require('crypto');
const express = require('express');

const PREFIJO_INICIO = '/api/inicio3g/v1';
const PREFIJO_SISTEMAS = '/api/sistemas/v1';
const LIMITE_POR_MINUTO = 60;
const ESPERA_BASE_MS = 2000; // la respuesta completa debe tardar menos de 3 s

// Variables sin las que el sitio no trabaja completo (solo nombres; nunca se devuelve un valor).
const OBLIGATORIAS = [
    'JWT_SECRET',
    'ADMIN_USERNAME',
    'ADMIN_PASSWORD',
    'DATABASE_URL',
    'FRONTEND_URL',
    'CLOUDINARY_CLOUD_NAME',
    'CLOUDINARY_API_KEY',
    'CLOUDINARY_API_SECRET',
];

/** ¿Está encendida? «1», «true», «si»/«sí» u «on» (sin importar mayúsculas); cualquier otra cosa o nada = apagada. */
function banderaEncendida(valor) {
    return /^(1|true|s[ií]|on)$/i.test(String(valor === undefined || valor === null ? '' : valor).trim());
}

// Banderas del sitio: { nombre, encendida(env) }. /salud dice su nombre y si están encendidas, nunca su valor.
// WEB-03 (CUENTAS3G_MODO) se suma aquí cuando llegue.
const BANDERAS = [
    { nombre: 'CONTACTO_A_VENTAS', encendida: (env) => banderaEncendida(env.CONTACTO_A_VENTAS) }, // WEB-05, contactos de la web a Ventas
];

/** Fecha ISO con la zona de México (p. ej. 2026-10-15T10:00:00-06:00). */
function isoMexico(fecha = new Date()) {
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Mexico_City', hourCycle: 'h23',
        year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).formatToParts(fecha).map((x) => [x.type, x.value]));
    const local = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
    const minutos = Math.round((local - Math.floor(fecha.getTime() / 1000) * 1000) / 60000);
    const abs = Math.abs(minutos);
    const zona = `${minutos < 0 ? '-' : '+'}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`;
    return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}${zona}`;
}

/** Lee del entorno las llaves entrantes (solo huellas) y sus alcances. */
function leerRegistro(env) {
    const registro = new Map();
    for (const [nombre, valor] of Object.entries(env)) {
        const m = /^LLAVE_ENTRANTE_([A-Z0-9_]+)_SHA256$/.exec(nombre);
        if (!m) continue;
        const origen = m[1].toLowerCase().replace(/_/g, '-');
        const huella = String(valor || '').trim().toLowerCase();
        const alcances = String(env[`ALCANCES_${m[1]}`] || '').split(/[\s,]+/).map((a) => a.trim()).filter(Boolean);
        registro.set(origen, {
            origen,
            huella: /^[0-9a-f]{64}$/.test(huella) ? Buffer.from(huella, 'hex') : null,
            alcances,
        });
    }
    return registro;
}

function faltantes(env) {
    return OBLIGATORIAS.filter((nombre) => {
        const v = env[nombre];
        if (!v || !String(v).trim()) return true;
        // Lo mismo que el arranque en producción toma como fatal (server.js): se reporta como faltante.
        if (nombre === 'JWT_SECRET' && String(v).length < 32) return true;
        if (nombre === 'ADMIN_PASSWORD' && v === 'changeme123') return true;
        return false;
    });
}

/**
 * @param {object} opciones
 * @param {import('@prisma/client').PrismaClient} opciones.prisma
 * @param {object} [opciones.env]      variables de entorno (process.env)
 * @param {string} [opciones.version]  versión del servidor del sitio
 * @param {Function} [opciones.reloj]  () => Date (para pruebas)
 * @param {Function} [opciones.anotar] (fila) => void, registro sin datos personales
 * @param {Array}  [opciones.complementos] piezas de otras partes del servidor para /salud:
 *                 [{ pieza: () => objeto|null, faltan: (env) => [nombres] }] (p. ej. los contactos de WEB-05)
 */
function crearPuertas({ prisma, env = process.env, version = '0.0.0', reloj = () => new Date(), anotar, complementos = [] } = {}) {
    const router = express.Router();
    const registro = leerRegistro(env);
    const ultimoUso = new Map();
    const ventanas = new Map();
    let baseMalDesde = null; // primera revisión en que la base dejó de responder (contrato v2 §2.1: «desde»)
    const escribir = anotar || ((fila) => console.log('[puerta] ' + JSON.stringify(fila)));

    const error = (res, codigo, texto, extra = {}) => res.status(codigo).set(extra).json({ error: texto });

    // Registro de cada petición a las puertas (hora, origen, ruta, código y duración; sin IP ni contenido).
    router.use([PREFIJO_INICIO, PREFIJO_SISTEMAS], (req, res, next) => {
        const inicio = Date.now();
        const ruta = req.originalUrl.split('?')[0];
        res.on('finish', () => {
            escribir({
                hora: isoMexico(reloj()),
                origen: req.puerta ? req.puerta.origen : (/^[a-z0-9-]{2,30}$/.test(req.puertaOrigen || '') ? req.puertaOrigen : '—'),
                ruta,
                codigo: res.statusCode,
                ms: Date.now() - inicio,
            });
        });
        next();
    });

    // Llave por origen.
    router.use([PREFIJO_INICIO, PREFIJO_SISTEMAS], (req, res, next) => {
        const origen = String(req.get('X-3G-Origen') || '').trim().toLowerCase();
        req.puertaOrigen = origen;
        const llave = (/^Bearer\s+(.+)$/i.exec(req.get('Authorization') || '') || [])[1];
        if (!registro.size) return error(res, 503, 'Puerta sin configurar: este servidor todavía no tiene llaves de otros sistemas.');
        if (!origen || !llave) return error(res, 401, 'Falta la llave o el origen (Authorization y X-3G-Origen).');
        if (!/^[a-z0-9-]{2,30}$/.test(origen)) return error(res, 401, 'Origen no válido.');
        const entrada = registro.get(origen);
        if (!entrada || !entrada.huella || !entrada.alcances.length) {
            return error(res, 503, `Puerta sin configurar para «${origen}».`);
        }
        const presentada = crypto.createHash('sha256').update(String(llave).trim(), 'utf8').digest();
        if (!crypto.timingSafeEqual(presentada, entrada.huella)) return error(res, 401, 'Llave no válida.');

        // 60 por minuto por origen (ventana fija de un minuto).
        const ahora = Date.now();
        const v = ventanas.get(origen);
        if (!v || ahora - v.desde >= 60000) ventanas.set(origen, { desde: ahora, cuenta: 1 });
        else if (++v.cuenta > LIMITE_POR_MINUTO) {
            return error(res, 429, 'Demasiadas peticiones de este sistema; intenta de nuevo en un minuto.', { 'Retry-After': String(Math.ceil((60000 - (ahora - v.desde)) / 1000)) });
        }
        ultimoUso.set(origen, reloj());
        req.puerta = { origen, alcances: entrada.alcances };
        next();
    });

    const exigir = (alcance) => (req, res, next) => (req.puerta.alcances.includes(alcance)
        ? next()
        : error(res, 403, `Esta llave no tiene el alcance «${alcance}».`));

    // Por inicio3g solo se lee.
    router.use(PREFIJO_INICIO, (req, res, next) => (['GET', 'HEAD'].includes(req.method)
        ? next()
        : error(res, 405, 'Solo lectura: por /api/inicio3g nadie escribe.', { Allow: 'GET' })));

    // ---------------------------------------------------------------- GET /api/inicio3g/v1/salud
    router.get(`${PREFIJO_INICIO}/salud`, exigir('inicio.leer'), async (req, res) => {
        const piezas = [];

        const t0 = Date.now();
        let tiempo;
        try {
            await Promise.race([
                prisma.$queryRaw`SELECT 1`,
                new Promise((_, mal) => { tiempo = setTimeout(() => mal(new Error('tiempo')), ESPERA_BASE_MS); }),
            ]);
            baseMalDesde = null;
            piezas.push({ id: 'base', nombre: 'Base de datos del portafolio', estado: 'ok', mensaje: `Responde (${Date.now() - t0} ms)` });
        } catch (e) {
            if (!baseMalDesde) baseMalDesde = reloj();
            piezas.push({
                id: 'base', nombre: 'Base de datos del portafolio', estado: 'mal',
                mensaje: e && e.message === 'tiempo' ? `No respondió en ${ESPERA_BASE_MS / 1000} s` : 'No responde',
                desde: isoMexico(baseMalDesde),
            });
        } finally {
            clearTimeout(tiempo);
        }

        const faltan = [...faltantes(env), ...complementos.flatMap((c) => (c.faltan ? c.faltan(env) : []))];
        const sinFotos = ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'].some((n) => faltan.includes(n));
        piezas.push(sinFotos
            ? { id: 'fotos', nombre: 'Subida de fotos (Cloudinary)', estado: 'aviso', mensaje: 'Falta configuración: no se pueden subir fotos nuevas' }
            : { id: 'fotos', nombre: 'Subida de fotos (Cloudinary)', estado: 'ok', mensaje: 'Configurada' });
        const sinEntrada = ['JWT_SECRET', 'ADMIN_USERNAME', 'ADMIN_PASSWORD'].some((n) => faltan.includes(n));
        piezas.push(sinEntrada
            ? { id: 'entrada', nombre: 'Entrada al administrador', estado: 'aviso', mensaje: 'Configuración incompleta de la entrada' }
            : { id: 'entrada', nombre: 'Entrada al administrador', estado: 'ok', mensaje: 'Configurada' });
        for (const c of complementos) {
            const pieza = c.pieza ? c.pieza() : null;
            if (pieza) piezas.push(pieza);
        }

        const peor = piezas.some((p) => p.estado === 'mal') ? 'mal' : (piezas.some((p) => p.estado === 'aviso') || faltan.length ? 'aviso' : 'ok');
        const primera = piezas.find((p) => p.estado === peor);
        res.set('Cache-Control', 'no-store').json({
            sistema: 'sitio',
            version,
            estado: peor,
            mensaje: peor === 'ok' ? 'Todo en orden' : (primera ? `${primera.nombre}: ${primera.mensaje}` : 'Configuración incompleta'),
            revisado: isoMexico(reloj()),
            piezas,
            config: { completa: faltan.length === 0, faltan },
            banderas: BANDERAS.map((b) => ({ nombre: b.nombre, encendida: !!b.encendida(env) })),
        });
    });

    // ---------------------------------------------------------------- GET …/llaves (B8)
    // `alcance` es texto, como en el contrato del Inicio v2 §2.5 (p. ej. «Su chat y su hoja»): Cuentas 3G lo muestra tal cual.
    const llaves = (req, res) => {
        const lista = [
            {
                id: 'sitio-admin',
                tipo: 'contrasena-compartida',
                paraQuien: 'Quien conoce el usuario y la contraseña del Administrador del sitio',
                alcance: 'Todo el administrador del portafolio',
                creada: null,
                ultimoUso: null,
                vence: null,
                revocarEn: null,
            },
            ...[...registro.values()]
                .filter((e) => e.huella)
                .sort((a, b) => a.origen.localeCompare(b.origen))
                .map((e) => ({
                    id: `sitio-puerta-${e.origen}`,
                    tipo: 'llave-entre-sistemas',
                    paraQuien: e.origen,
                    alcance: e.alcances.join(', '),
                    creada: null,
                    ultimoUso: ultimoUso.has(e.origen) ? isoMexico(ultimoUso.get(e.origen)) : null,
                    vence: null,
                    revocarEn: null,
                })),
        ];
        // El sitio no tiene enlaces de agencias ni otros enlaces con token: no hay más que listar.
        res.set('Cache-Control', 'no-store').json({ sistema: 'sitio', generado: isoMexico(reloj()), llaves: lista.slice(0, 50) });
    };
    router.get(`${PREFIJO_SISTEMAS}/llaves`, exigir('llaves.leer'), llaves);
    router.get(`${PREFIJO_INICIO}/llaves`, exigir('llaves.leer'), llaves);

    // Cualquier otra ruta de las puertas.
    router.use([PREFIJO_INICIO, PREFIJO_SISTEMAS], (req, res) => error(res, 404, 'No existe esa puerta en el servidor del sitio.'));

    return router;
}

module.exports = crearPuertas;
module.exports.isoMexico = isoMexico;
module.exports.OBLIGATORIAS = OBLIGATORIAS;
module.exports.BANDERAS = BANDERAS;
module.exports.banderaEncendida = banderaEncendida;
