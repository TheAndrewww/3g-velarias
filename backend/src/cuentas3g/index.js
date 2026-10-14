/**
 * Cuenta 3G en el Administrador del sitio (WEB-03 · propuesta E1 · plan final §8 y DISEÑO-CUENTAS-3G §2.6,
 * §2.7, §3). Usa el paquete cuentas3g-cliente (CTA-08) copiado sin cambios en ../cuentas3g-cliente/.
 *
 * Bandera: CUENTAS3G_MODO (por omisión «apagado» = idéntico a hoy: sin botón y estas rutas no existen).
 * En «ambos» (WEB-03): botón «Entrar con tu cuenta 3G» en /admin/login y el acceso de siempre igual.
 * («solo» llega con WEB-04; mientras tanto se comporta como «ambos».)
 *
 *   GET  /admin/entrar/cuentas3g   cookie temporal sellada (10 min) con state, nonce y verificador → Cuentas 3G
 *   GET  /admin/entrar/regreso     canjea el código, valida la ficha y crea la cookie de siempre `auth_token`
 *                                  (24 h) con { sub, ver, en, via: 'cuentas3g' }; solo entra el nivel «admin»
 *   POST /api/cuentas3g/aviso      aviso de baja de Cuentas 3G (OpenID Back-Channel Logout): corta al instante
 *
 * Además: jwtAuth y requireAuth (server.js) llaman a revisarSesion(), que corta la sesión que trae `sub` y `ver`
 * si la persona ya no está activa o su versión subió (lista firmada de versiones cada 60 s, guardada en disco).
 * Cuentas 3G no escribe nada en la base del sitio. Para regresar: CUENTAS3G_MODO=apagado.
 */
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const express = require('express');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const c3g = require('../cuentas3g-cliente/cuentas3g-cliente.cjs');
const { leerConfig } = require('./config');
const { isoMexico } = require('../routes/sistemas');

const DURACION_SESION_MS = 24 * 60 * 60 * 1000; // D-C8: sitio, 24 h
const IDA_S = 10 * 60;
const NIVEL_DEL_SITIO = 'admin';

// Textos para la pantalla de entrada (la página los toma por código; la dirección nunca lleva otra cosa).
const CODIGOS = new Set(['cancelada', 'vencida', 'sin-acceso', 'no-responde', 'invalida', 'termino', 'demasiados']);

/** Código del paquete (ErrorCuentas3G.codigo) → el aviso de la pantalla de entrada. */
function codigoDePantalla(e) {
    const c = e && e.codigo;
    if (c === 'cancelada') return 'cancelada';
    if (c === 'vencida' || c === 'state' || c === 'canje' || c === 'codigo') return 'vencida'; // canje: código usado o vencido
    if (c === 'sin_respuesta' || c === 'jwks') return 'no-responde';
    if (c === 'sin_nivel' || c === 'nivel_desconocido') return 'sin-acceso';
    return 'invalida';
}

/**
 * @param {object} o
 * @param {object} [o.env]         process.env
 * @param {string} o.jwtSecret     el secreto de la cookie de siempre (server.js)
 * @param {boolean} o.produccion   NODE_ENV === 'production' (cookies Secure y __Host-)
 * @param {string} o.raizAdmin     carpeta de admin-public (para login.html)
 * @param {Function} [o.anotar]    (fila) => void · registro sin datos sensibles
 * @param {Function} [o.pedir]     fetch (pruebas)
 * @param {Function} [o.ahora]     () => ms (pruebas)
 */
function crearCuentas3G(o) {
    const env = o.env || process.env;
    const config = leerConfig(env);
    const activo = config.modo !== 'apagado';
    const ahora = o.ahora || (() => Date.now());
    const anotar = o.anotar || ((fila) => console.log('[cuentas3g] ' + JSON.stringify({ hora: isoMexico(new Date(ahora())), ...fila })));

    if (config.desconocido) anotar({ evento: 'config', resultado: 'modo-desconocido', mensaje: 'CUENTAS3G_MODO no es apagado, ambos ni solo: se queda en apagado' });
    if (config.pedido !== 'apagado' && !activo) {
        anotar({ evento: 'config', resultado: 'incompleta', faltan: config.faltan, mensaje: 'Se queda en apagado: sigue solo el acceso de siempre' });
    }

    // ---------------------------------------------------------------- el cliente (paquete) y la lista de versiones
    let cliente = null;
    let reloj = null;
    let listo = Promise.resolve();
    if (activo) {
        let fallaba = false;
        cliente = c3g.crearCliente({
            ...config.cliente,
            niveles: [NIVEL_DEL_SITIO],
            almacen: c3g.almacenEnDisco(config.archivoLista || path.join(os.tmpdir(), `sitio-cuentas3g-lista-${config.cliente.clienteId}.json`)),
            cadaMs: config.listaCadaMs,
            pedir: o.pedir,
            ahora,
            // Solo lo raro; que Cuentas 3G no responda se anota una vez al empezar y otra al volver (abajo).
            registro: { warn: (x, m) => { if (!/sigue con la última lista buena/.test(m)) anotar({ evento: 'lista', resultado: 'aviso', detalle: m }); } },
        });
        const revisar = () => {
            const e = cliente.estado();
            if (e.ultimoError && !fallaba) anotar({ evento: 'lista', resultado: 'no-responde', detalle: e.ultimoError });
            if (!e.ultimoError && fallaba) anotar({ evento: 'lista', resultado: 'ok' });
            fallaba = !!e.ultimoError;
        };
        anotar({ evento: 'config', resultado: 'ok', modo: config.modo, cliente: c3g.VERSION });
        // La última lista guardada (con su firma) y la primera consulta; después, cada minuto.
        listo = cliente.arrancar({ sinReloj: true }).then(revisar, revisar);
        reloj = setInterval(() => { cliente.listaDeVersiones({ forzar: true }).then(revisar, revisar); }, config.listaCadaMs);
        if (reloj.unref) reloj.unref();
    }

    // ---------------------------------------------------------------- cookie temporal de la ida (sellada, no es un JWT)
    // Se sella con una llave DERIVADA del secreto de siempre y no tiene forma de JWT: nunca sirve como auth_token.
    const llaveIda = crypto.createHmac('sha256', String(o.jwtSecret)).update('cuentas3g-ida-v1').digest('hex');
    const nombreIda = o.produccion ? '__Host-sitio_c3g_ida' : 'sitio_c3g_ida';
    const opcionesIda = { httpOnly: true, secure: !!o.produccion, sameSite: 'lax', path: '/' };

    const router = express.Router();
    // Apagado: estas rutas no existen (siguen a lo de siempre: el 404 de hoy o la página de siempre).
    const soloActivo = (req, res, next) => (activo ? next() : next('router'));

    // ---------------------------------------------------------------- /admin/login con el botón
    // Aviso pendiente (p. ej. «tu sesión terminó») que dejó una petición de la API cortada: el panel manda después a
    // /admin/login sin decir por qué, así que el motivo viaja en una cookie corta y solo con un código conocido.
    const NOMBRE_AVISO = 'sitio_c3g_aviso';
    const opcionesAviso = { httpOnly: true, secure: !!o.produccion, sameSite: 'lax', path: '/' };
    const entrada = (req, res, next) => {
        fs.readFile(path.join(o.raizAdmin, 'login.html'), 'utf8', (err, html) => {
            if (err) return next(err);
            const pendiente = req.cookies && req.cookies[NOMBRE_AVISO];
            let marca = ` data-c3g-modo="${config.modo}"`;
            if (pendiente !== undefined) {
                if (CODIGOS.has(pendiente)) marca += ` data-c3g-aviso="${pendiente}"`;
                res.clearCookie(NOMBRE_AVISO, opcionesAviso);
            }
            res.set('Cache-Control', 'no-store').type('html').send(html.replace(/<html\b([^>]*)>/i, (m, a) => `<html${a}${marca}>`));
        });
    };
    router.get(['/admin/login', '/admin/login.html'], soloActivo, entrada);

    // ---------------------------------------------------------------- ida
    router.get('/admin/entrar/cuentas3g', soloActivo, async (req, res, next) => {
        try {
            const { url, temporal } = await cliente.iniciar({ despues: '/admin' });
            res.cookie(nombreIda, await c3g.sellar(temporal, llaveIda, IDA_S, ahora()), { ...opcionesIda, maxAge: IDA_S * 1000 });
            res.set({ 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' });
            return res.redirect(302, url);
        } catch (e) {
            return next(e);
        }
    });

    // ---------------------------------------------------------------- regreso
    // 30 regresos cada 15 min por IP (la oficina comparte IP, pero cada sesión dura 24 h).
    const limiteRegreso = activo
        ? rateLimit({
            windowMs: 15 * 60 * 1000,
            max: 30,
            standardHeaders: true,
            legacyHeaders: false,
            handler: (req, res) => res.set('Cache-Control', 'no-store').redirect(303, '/admin/login?c3g=demasiados'),
        })
        : (req, res, next) => next();
    const aLaEntrada = (res, codigo) => {
        res.clearCookie(nombreIda, opcionesIda);
        res.set({ 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' });
        return res.redirect(303, `/admin/login?c3g=${CODIGOS.has(codigo) ? codigo : 'invalida'}`);
    };
    router.get('/admin/entrar/regreso', soloActivo, limiteRegreso, async (req, res) => {
        let p;
        try {
            const temporal = await c3g.abrir(req.cookies && req.cookies[nombreIda], llaveIda, ahora());
            p = await cliente.regreso({ url: req.originalUrl, temporal });
        } catch (e) {
            const codigo = codigoDePantalla(e);
            anotar({ evento: 'entrada', resultado: codigo, detalle: (e && e.codigo) || 'error' });
            return aLaEntrada(res, codigo);
        }
        const nombre = p.nombre.slice(0, 120);
        // La misma cookie de siempre (DISEÑO §2.7): auth_token, 24 h, con sub, ver, en (cuándo nació) y via.
        const token = jwt.sign(
            { username: (p.correo || nombre || p.sub).slice(0, 200), nombre, sub: p.sub, ver: p.ver, en: p.en, via: 'cuentas3g' },
            o.jwtSecret,
            { expiresIn: '24h' },
        );
        res.clearCookie(nombreIda, opcionesIda);
        res.cookie('auth_token', token, { httpOnly: true, secure: !!o.produccion, sameSite: 'strict', maxAge: DURACION_SESION_MS });
        anotar({ evento: 'entrada', resultado: 'ok', sub: p.sub, nombre });
        // La cookie es SameSite=Strict: después de venir de otro sitio, el paso a /admin se hace desde esta misma
        // página (y no con una redirección) para que el navegador sí la mande.
        return res.set({ 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' }).type('html').send(
            '<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">'
            + '<meta name="color-scheme" content="light dark"><meta name="robots" content="noindex"><meta http-equiv="refresh" content="0;url=/admin">'
            + '<title>Entrando… | 3G Velarias</title></head><body style="font-family:system-ui,-apple-system,sans-serif;padding:24px">'
            + '<p>Entrando al Administrador del sitio… <a href="/admin">Continuar</a></p>'
            + '<script>location.replace("/admin")</script></body></html>',
        );
    });

    // ---------------------------------------------------------------- aviso de baja (Back-Channel Logout)
    router.post('/api/cuentas3g/aviso', soloActivo, express.urlencoded({ extended: false, limit: '8kb' }), async (req, res) => {
        res.set('Cache-Control', 'no-store');
        try {
            const token = req.body && typeof req.body.logout_token === 'string' ? req.body.logout_token : '';
            // El paquete lo valida, corta desde ya las sesiones de ese sub y vuelve a pedir la lista.
            // (El sitio no tiene enlaces ni accesos amarrados a personas: no hay nada más que revocar.)
            const { sub } = await cliente.avisoDeBaja(token);
            anotar({ evento: 'aviso', resultado: 'ok', sub });
            return res.status(200).end();
        } catch (e) {
            anotar({ evento: 'aviso', resultado: 'invalido', detalle: (e && e.codigo) || 'error' });
            return res.status(400).json({ error: 'Aviso inválido' });
        }
    });
    router.use('/api/cuentas3g/aviso', (err, req, res, next) => (activo ? res.status(400).set('Cache-Control', 'no-store').json({ error: 'Aviso inválido' }) : next(err)));

    // ---------------------------------------------------------------- revisión de cada sesión (jwtAuth y requireAuth)
    /**
     * @param {object} decoded  la cookie auth_token ya verificada
     * @returns {null | { codigo: string, texto: string }}  null = sigue como siempre
     */
    function revisarSesion(decoded) {
        if (!activo || !decoded || typeof decoded !== 'object') return null;
        // WEB-03: si la cookie trae sub y ver (o dice venir de Cuentas 3G), se revisa contra la lista y los avisos.
        const es3G = decoded.via === 'cuentas3g' || decoded.sub !== undefined || decoded.ver !== undefined;
        if (!es3G) return null; // la cookie del acceso de siempre no cambia
        const en = typeof decoded.en === 'number' ? decoded.en : (typeof decoded.iat === 'number' ? decoded.iat * 1000 : 0);
        const ver = Number.isInteger(decoded.ver) ? decoded.ver : undefined;
        const motivo = cliente.motivoDeCorte({ sub: decoded.sub, ver, en });
        if (motivo === null) return null;
        anotar({ evento: 'sesion-cortada', motivo, ...(typeof decoded.sub === 'string' ? { sub: decoded.sub.slice(0, 100) } : {}) });
        return { codigo: 'termino', texto: 'Tu sesión terminó: tu acceso cambió en Cuentas 3G. Vuelve a entrar.' };
    }

    // ---------------------------------------------------------------- /salud (puertas de WEB-02)
    const salud = {
        faltan: () => config.faltan,
        pieza: () => {
            if (config.pedido === 'apagado') return null;
            const base = { id: 'cuentas3g', nombre: 'Entrada con cuenta 3G' };
            if (!activo) return { ...base, estado: 'aviso', mensaje: 'Configuración incompleta: sigue solo el acceso de siempre' };
            const e = cliente.estado();
            if (!e.lista) return { ...base, estado: 'aviso', mensaje: 'Todavía no llega la lista de versiones de Cuentas 3G' };
            const recibida = Date.parse(e.lista.en) || 0;
            if (e.listaVieja) {
                return { ...base, estado: 'aviso', mensaje: `La lista de versiones no se actualiza desde hace ${Math.floor((ahora() - recibida) / 3600000)} h; las sesiones siguen`, desde: isoMexico(new Date(recibida)) };
            }
            if (e.ultimoError) {
                const min = Math.max(1, Math.round((ahora() - recibida) / 60000));
                return { ...base, estado: 'ok', mensaje: `Cuentas 3G no respondió la última vez; se usa la lista de hace ${min} min` };
            }
            return { ...base, estado: 'ok', mensaje: 'Lista de versiones al día' };
        },
    };

    /** Cierra la sesión cortada: borra auth_token (como hoy) y deja el motivo para la pantalla de entrada. */
    function cerrarSesion(res, corte) {
        res.clearCookie('auth_token');
        res.cookie(NOMBRE_AVISO, corte.codigo, { ...opcionesAviso, maxAge: 5 * 60 * 1000 });
    }

    return {
        router,
        modo: config.modo,
        revisarSesion,
        cerrarSesion,
        salud,
        /** Para pruebas: la primera lista (guardada y de Cuentas 3G) ya se intentó. */
        listo: () => listo,
        detener: () => { if (reloj) clearInterval(reloj); if (cliente) cliente.detener(); },
    };
}

module.exports = crearCuentas3G;
