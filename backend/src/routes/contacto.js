/**
 * Contactos de la web al reparto de Ventas (WEB-05 · C12).
 *
 *   POST /api/contacto   La página (Industrial y Residencial) la llama en su mismo dominio: Vercel reenvía solo esta
 *                        ruta pública al servidor del sitio (reescritura en frontend/vercel.json, como /api/projects).
 *
 * La página manda aquí una COPIA de su formulario y, aparte, el correo de FormSubmit de siempre, que no cambia: la
 * página no espera esta respuesta, así que si este servidor o Ventas no responden, el correo llega igual.
 *
 * Aquí se revisa:
 *   - Trampa contra robots: el campo escondido «_honey» lleno, o un envío en menos de 2.5 s desde que abrió la página
 *     (o sin ese dato: llamada directa). Al robot se le contesta 202 como a todos; solo no sale nada a Ventas.
 *   - Límite: 5 envíos por visitante cada 10 min (429; CONTACTO_LIMITE_VISITANTE) y 60 por hora en total hacia Ventas
 *     (CONTACTO_LIMITE_HORA). El mismo teléfono en la misma página dentro de 10 min sale una sola vez.
 *   - Turnstile de Cloudflare, opcional: solo si existe TURNSTILE_SECRETO (y la página trae su llave de sitio).
 *   - Datos de campaña (utm_*, gclid, gbraid, wbraid, página de llegada y de dónde venía) van con el lead.
 *
 * Envío de servidor a servidor (contrato §7.1 y §7.2 del plan final):
 *   POST {VENTAS_URL}/api/sistemas/v1/leads
 *   Authorization: Bearer {LLAVE_HACIA_VENTAS} · X-3G-Origen: sitio · Idempotency-Key: <uuid por contacto>
 *   { nombre, telefono, correo?, mensaje?, pagina, producto?, utm: { … }, origen: "web", recibido }  →  { leadId, duplicado }
 * Corte a los 3 s; si Ventas no responde (o da 429/5xx) se reintenta a los 30 s, 2 min y 10 min con la MISMA
 * Idempotency-Key; un 4xx no se reintenta (es configuración). Los reintentos viven en memoria: si el servidor se
 * reinicia se pierden, y ese contacto queda solo en el correo, como hoy.
 *
 * Bandera CONTACTO_A_VENTAS (apagada por omisión = hoy): apagada, todo se revisa y se anota «apagado» en el registro
 * (sirve para medir antes de encender), pero NO sale nada a Ventas. Encendida sin VENTAS_URL con https (o sin
 * LLAVE_HACIA_VENTAS) no manda nada y /salud lo avisa: no se exige sin su configuración.
 *
 * Registro: una línea «[contacto] {…}» por contacto y por intento, con hora, página, resultado, código y duración.
 * Nunca nombre, teléfono, correo, mensaje, IP ni llaves.
 */
const crypto = require('crypto');
const express = require('express');
const { isoMexico, banderaEncendida } = require('./sistemas');

const RUTA = '/api/contacto';
const MIN_MS_EN_PAGINA = 2500;
const MAX_MS_EN_PAGINA = 7 * 24 * 60 * 60 * 1000;
const VENTANA_VISITANTE_MS = 10 * 60 * 1000;
const VENTANA_REPETIDO_MS = 10 * 60 * 1000;
const ESPERA_MS = 3000;
const REINTENTOS_MS = [30 * 1000, 2 * 60 * 1000, 10 * 60 * 1000];
const MAX_PENDIENTES = 100;
const TURNSTILE_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const PAGINAS = { industrial: 'industrial', residencial: 'residencial', residential: 'residencial' };
// Solo las llaves propias de PAGINAS y solo texto: «constructor», «__proto__», «toString» o un arreglo no son página.
const paginaDe = (valor) => (typeof valor === 'string' && Object.prototype.hasOwnProperty.call(PAGINAS, valor) ? PAGINAS[valor] : null);
// Tope de cada campo (la página ya los recorta igual; más largo = llamada que no viene de la página).
const TOPES = { nombre: 120, telefono: 40, correo: 200, mensaje: 2000, empresa: 120, area: 40, producto: 80, trampa: 500, turnstile: 2048 };
// Datos de campaña que guarda tracking.js en la sesión del navegador → nombre corto en el lead.
const CAMPANIA = {
    utm_source: 'source', utm_medium: 'medium', utm_campaign: 'campaign', utm_term: 'term', utm_content: 'content',
    gclid: 'gclid', gbraid: 'gbraid', wbraid: 'wbraid', landing_page: 'landing', referente: 'referente',
};
const TOPE_CAMPANIA = 300;

/** Teléfono a E.164 (+52 y 10 dígitos para México); null si no se puede. */
function normalizarTelefono(texto) {
    const crudo = String(texto || '').trim();
    if (!crudo) return null;
    const d = crudo.replace(/\D/g, '');
    if (d.length === 10) return '+52' + d;
    if (d.length === 12 && d.startsWith('52')) return '+' + d;
    if (d.length === 13 && d.startsWith('521')) return '+52' + d.slice(3); // móvil con el «1» de antes
    if (d.length === 14 && d.startsWith('0052')) return '+52' + d.slice(4);
    if (d.length === 13 && /^04[45]/.test(d)) return '+52' + d.slice(3); // 044 / 045 de antes
    if (d.length === 12 && d.startsWith('01')) return '+52' + d.slice(2); // 01 de larga distancia de antes
    if (crudo.startsWith('+') && d.length >= 8 && d.length <= 15 && !d.startsWith('52')) return '+' + d;
    return null;
}

/** VENTAS_URL válida: https (o http solo hacia esta misma máquina, para pruebas). Devuelve la base sin «/» final. */
function urlVentas(valor) {
    const texto = String(valor || '').trim().replace(/\/+$/, '');
    if (!texto) return null;
    try {
        const u = new URL(texto);
        if (u.protocol === 'https:') return texto;
        if (u.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(u.hostname)) return texto;
    } catch { /* no es dirección */ }
    return null;
}

/**
 * @param {object} [opciones]
 * @param {object}   [opciones.env]          variables de entorno (process.env)
 * @param {Function} [opciones.fetch]        fetch (para pruebas)
 * @param {Function} [opciones.reloj]        () => Date (para pruebas)
 * @param {Function} [opciones.anotar]       (fila) => void, registro sin datos personales
 * @param {number[]} [opciones.reintentosMs] esperas entre intentos (para pruebas)
 * @param {string}   [opciones.turnstileUrl] dirección de verificación de Turnstile (para pruebas)
 */
function crearContacto({ env = process.env, fetch: hacerFetch = (...a) => fetch(...a), reloj = () => new Date(), anotar, reintentosMs = REINTENTOS_MS, turnstileUrl = TURNSTILE_URL } = {}) {
    const router = express.Router();
    const escribir = anotar || ((fila) => console.log('[contacto] ' + JSON.stringify(fila)));
    const limiteVisitante = Math.max(1, Number(env.CONTACTO_LIMITE_VISITANTE) || 5);
    const limiteHora = Math.max(1, Number(env.CONTACTO_LIMITE_HORA) || 60);
    const visitantes = new Map(); // clave → { desde, cuenta }
    const recientes = new Map(); // huella(teléfono|página) → hora
    let horaTotal = { desde: 0, cuenta: 0 };
    let pendientes = 0;
    const estado = { ultimoBien: null, fallandoDesde: null, ultimoCodigo: null, rechazo: null };

    const encendida = () => banderaEncendida(env.CONTACTO_A_VENTAS);
    const faltan = () => {
        if (!encendida()) return [];
        const f = [];
        if (!urlVentas(env.VENTAS_URL)) f.push('VENTAS_URL');
        if (!String(env.LLAVE_HACIA_VENTAS || '').trim()) f.push('LLAVE_HACIA_VENTAS');
        return f;
    };
    const fila = (pagina, resultado, extra = {}) => escribir({ hora: isoMexico(reloj()), pagina, resultado, ...extra });

    // Quién es el visitante: la primera dirección de X-Forwarded-For (Vercel pone la del visitante; Railway agrega la
    // de Vercel al final) o, sin ella, la del que conecta. Solo vive en memoria para el límite; nunca se anota.
    const claveVisitante = (req) => String(req.get('x-forwarded-for') || '').split(',')[0].trim() || req.ip || '—';
    const limpiar = (ahora) => {
        if (visitantes.size > 1000) for (const [k, v] of visitantes) if (ahora - v.desde >= VENTANA_VISITANTE_MS) visitantes.delete(k);
        if (recientes.size > 1000) for (const [k, t] of recientes) if (ahora - t >= VENTANA_REPETIDO_MS) recientes.delete(k);
    };

    const texto = (v, tope) => {
        if (v === undefined || v === null) return '';
        if (typeof v !== 'string' && typeof v !== 'number') return null;
        const t = String(v).trim();
        return t.length > tope ? null : t;
    };

    // ---------------------------------------------------------------- envío a Ventas (con reintentos)
    async function mandar(trabajo) {
        trabajo.intento++;
        const t0 = Date.now();
        const base = urlVentas(env.VENTAS_URL);
        const llave = String(env.LLAVE_HACIA_VENTAS || '').trim();
        try {
            if (!base || !llave) throw Object.assign(new Error('sin-configuracion'), { final: true });
            const r = await hacerFetch(`${base}/api/sistemas/v1/leads`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${llave}`,
                    'X-3G-Origen': 'sitio',
                    'Idempotency-Key': trabajo.id,
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                },
                body: JSON.stringify(trabajo.cuerpo),
                signal: AbortSignal.timeout(ESPERA_MS),
            });
            const ms = Date.now() - t0;
            if (r.ok) {
                let j = {};
                try { j = await r.json(); } catch { /* sin cuerpo */ }
                const leadId = typeof j.leadId === 'string' ? j.leadId.slice(0, 64) : undefined;
                fila(trabajo.pagina, j.duplicado ? 'duplicado' : 'enviado', { codigo: r.status, intento: trabajo.intento, ms, ...(leadId && { leadId }), ...trabajo.extra });
                estado.ultimoBien = reloj(); estado.fallandoDesde = null; estado.ultimoCodigo = null; estado.rechazo = null;
                pendientes--;
                return;
            }
            if (r.status !== 429 && r.status < 500) {
                // 4xx: la llave, la puerta o el cuerpo; reintentar no lo arregla.
                fila(trabajo.pagina, 'rechazado', { codigo: r.status, intento: trabajo.intento, ms, ...trabajo.extra });
                estado.rechazo = { codigo: r.status, desde: reloj() };
                pendientes--;
                return;
            }
            throw Object.assign(new Error('http'), { codigo: r.status });
        } catch (e) {
            const ms = Date.now() - t0;
            const codigo = e.codigo || (e.final ? 'sin-configuracion' : (e.name === 'TimeoutError' || e.name === 'AbortError' ? 'tiempo' : 'sin-conexion'));
            if (!estado.fallandoDesde) estado.fallandoDesde = reloj();
            estado.ultimoCodigo = codigo;
            const espera = reintentosMs[trabajo.intento - 1];
            if (!e.final && espera !== undefined) {
                fila(trabajo.pagina, 'reintento', { codigo, intento: trabajo.intento, ms, siguienteEnS: Math.round(espera / 1000), ...trabajo.extra });
                const t = setTimeout(() => { mandar(trabajo).catch(() => { pendientes = Math.max(0, pendientes - 1); }); }, espera);
                if (t.unref) t.unref();
                return;
            }
            fila(trabajo.pagina, 'perdido', { codigo, intento: trabajo.intento, ms, ...trabajo.extra });
            pendientes--;
        }
    }

    async function verificarTurnstile(token, ip) {
        try {
            const datos = new URLSearchParams({ secret: String(env.TURNSTILE_SECRETO).trim(), response: token });
            if (ip && ip !== '—') datos.set('remoteip', ip);
            const r = await hacerFetch(turnstileUrl, { method: 'POST', body: datos, signal: AbortSignal.timeout(ESPERA_MS) });
            const j = await r.json();
            return j && j.success === true ? 'bien' : 'mal';
        } catch {
            return 'sin-respuesta'; // Cloudflare no contestó: no se castiga al visitante (el robot no puede provocarlo).
        }
    }

    // ---------------------------------------------------------------- POST /api/contacto
    // Express 4 no atrapa los errores de una función async: cualquier falla inesperada responde 500 y nunca tumba el proceso.
    router.post(RUTA, (req, res) => recibir(req, res).catch(() => {
        if (!res.headersSent) res.status(500).json({ error: 'No se pudo recibir el contacto.' });
    }));

    async function recibir(req, res) {
        const ahora = Date.now();
        limpiar(ahora);
        const listo = () => res.status(202).set('Cache-Control', 'no-store').json({ ok: true });

        // 1) Límite por visitante (cuenta todo, también lo que luego resulta robot).
        const clave = claveVisitante(req);
        const v = visitantes.get(clave);
        if (!v || ahora - v.desde >= VENTANA_VISITANTE_MS) visitantes.set(clave, { desde: ahora, cuenta: 1 });
        else if (++v.cuenta > limiteVisitante) {
            fila(paginaDe(req.body && req.body.pagina) || '—', 'limite-visitante');
            return res.status(429).set('Retry-After', String(Math.ceil((VENTANA_VISITANTE_MS - (ahora - v.desde)) / 1000)))
                .json({ error: 'Demasiados envíos desde aquí; intenta de nuevo en unos minutos.' });
        }

        // 2) Forma del cuerpo.
        const b = req.body;
        if (!b || typeof b !== 'object' || Array.isArray(b)) return res.status(400).json({ error: 'Cuerpo no válido.' });
        const pagina = paginaDe(b.pagina);
        if (!pagina) return res.status(400).json({ error: 'Página no válida.' });
        const campos = {};
        for (const [nombre, tope] of Object.entries(TOPES)) {
            const t = texto(b[nombre], tope);
            if (t === null) return res.status(400).json({ error: `El campo «${nombre}» no es válido o es demasiado largo.` });
            campos[nombre] = t;
        }
        if (!campos.nombre) return res.status(400).json({ error: 'Falta el nombre.' });
        const utm = {};
        if (b.utm !== undefined && (typeof b.utm !== 'object' || b.utm === null || Array.isArray(b.utm))) return res.status(400).json({ error: 'Datos de campaña no válidos.' });
        for (const [k, corto] of Object.entries(CAMPANIA)) {
            const t = texto(b.utm && b.utm[k], TOPE_CAMPANIA);
            if (t === null) return res.status(400).json({ error: 'Datos de campaña no válidos.' });
            if (t) utm[corto] = t;
        }

        // 3) Trampas contra robots: se contesta igual que a todos.
        if (campos.trampa) { fila(pagina, 'robot-trampa'); return listo(); }
        const abierto = Number(b.abierto);
        if (!Number.isFinite(abierto) || abierto < MIN_MS_EN_PAGINA || abierto > MAX_MS_EN_PAGINA) { fila(pagina, 'robot-rapido'); return listo(); }
        let turnstile;
        if (String(env.TURNSTILE_SECRETO || '').trim()) {
            turnstile = campos.turnstile ? await verificarTurnstile(campos.turnstile, clave) : 'mal';
            if (turnstile === 'mal') {
                fila(pagina, 'robot-turnstile');
                return res.status(403).json({ error: 'No se pudo confirmar que eres una persona.' });
            }
        }

        // 4) Lo que necesita Ventas: teléfono (sin él, el contacto queda solo en el correo).
        const telefono = normalizarTelefono(campos.telefono);
        const extra = turnstile ? { turnstile } : {};
        if (!telefono) { fila(pagina, 'sin-telefono', extra); return listo(); }
        const huella = crypto.createHash('sha256').update(`${telefono}|${pagina}`).digest('hex');
        if (recientes.has(huella) && ahora - recientes.get(huella) < VENTANA_REPETIDO_MS) { fila(pagina, 'repetido', extra); return listo(); }
        recientes.set(huella, ahora);
        if (ahora - horaTotal.desde >= 60 * 60 * 1000) horaTotal = { desde: ahora, cuenta: 0 };
        if (++horaTotal.cuenta > limiteHora) { fila(pagina, 'limite-total', extra); return listo(); }

        // 5) Bandera y configuración.
        if (!encendida()) { fila(pagina, 'apagado', extra); return listo(); }
        if (faltan().length) { fila(pagina, 'sin-configuracion', extra); return listo(); }
        if (pendientes >= MAX_PENDIENTES) { fila(pagina, 'perdido', { codigo: 'cola-llena', ...extra }); return listo(); }

        const lineas = [];
        if (campos.empresa) lineas.push(`Empresa: ${campos.empresa}`);
        if (campos.area) lineas.push(`Área aproximada (m²): ${campos.area}`);
        if (campos.mensaje) lineas.push(campos.mensaje);
        const mensaje = lineas.join('\n').slice(0, TOPES.mensaje);
        const correo = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(campos.correo) ? campos.correo : '';
        const cuerpo = {
            nombre: campos.nombre,
            telefono,
            ...(correo && { correo }),
            ...(mensaje && { mensaje }),
            pagina,
            ...(campos.producto && { producto: campos.producto }),
            utm,
            origen: 'web',
            recibido: isoMexico(reloj()),
        };
        pendientes++;
        listo();
        mandar({ id: crypto.randomUUID(), pagina, cuerpo, intento: 0, extra }).catch(() => { pendientes = Math.max(0, pendientes - 1); });
    }

    router.all(RUTA, (req, res) => res.status(405).set('Allow', 'POST').json({ error: 'Solo se puede enviar (POST).' }));

    // Para /salud (WEB-02): la pieza solo aparece con la bandera encendida; apagada, /salud queda como estaba.
    router.salud = {
        faltan,
        pieza() {
            if (!encendida()) return null;
            const base = { id: 'contacto', nombre: 'Contactos de la web a Ventas' };
            const f = faltan();
            if (f.length) return { ...base, estado: 'aviso', mensaje: `Encendido sin ${f.map((n) => (n === 'VENTAS_URL' ? 'VENTAS_URL (https)' : n)).join(' ni ')}: no se manda nada a Ventas; los contactos llegan solo por correo` };
            if (estado.fallandoDesde) return { ...base, estado: 'aviso', mensaje: `Ventas no responde (${estado.ultimoCodigo}); se reintenta y los contactos siguen llegando por correo`, desde: isoMexico(estado.fallandoDesde) };
            if (estado.rechazo) return { ...base, estado: 'aviso', mensaje: `Ventas rechazó el último envío (${estado.rechazo.codigo}): revisar la llave o la puerta de Ventas`, desde: isoMexico(estado.rechazo.desde) };
            return { ...base, estado: 'ok', mensaje: estado.ultimoBien ? `Encendido; último envío a Ventas ${isoMexico(estado.ultimoBien)}` : 'Encendido; sin envíos desde que arrancó' };
        },
    };

    // JSON mal formado o demasiado grande en /api/contacto: { error } en JSON (lo demás sigue con el manejo de siempre).
    // Va en server.js justo después del router: app.use('/api/contacto', contacto.alFallarCuerpo).
    router.alFallarCuerpo = (err, req, res, next) => {
        if (!err || !(err.type === 'entity.parse.failed' || err.type === 'entity.too.large')) return next(err);
        return res.status(err.type === 'entity.too.large' ? 413 : 400).json({ error: 'Cuerpo no válido.' });
    };

    return router;
}

module.exports = crearContacto;
module.exports.normalizarTelefono = normalizarTelefono;
module.exports.urlVentas = urlVentas;
