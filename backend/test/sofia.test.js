// Pruebas de la ventana flotante de Sofía en el administrador (src/sofia.js). Sin red, sin base de datos.
//   npm test   (node --test)
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crearSofia = require('../src/sofia');

const callado = () => {};
const PANEL = fs.readFileSync(path.join(__dirname, '..', 'src', 'admin-public', 'index.html'), 'utf8');

test('sin SOFIA_URL: apagada, la página sale igual y /salud no cambia', () => {
    for (const url of [undefined, null, '', '   ']) {
        const s = crearSofia({ url, anotar: callado });
        assert.equal(s.activa, false);
        assert.equal(s.origen, null);
        assert.equal(s.conVentana(PANEL), PANEL);
        assert.equal(s.salud.pieza(), null);
        assert.deepEqual(s.salud.faltan(), []);
    }
});

test('con SOFIA_URL: una sola etiqueta antes de </body>, con data-sistema="sitio" y async', () => {
    const s = crearSofia({ url: 'https://sofia.ejemplo.test/', anotar: callado });
    assert.equal(s.activa, true);
    assert.equal(s.origen, 'https://sofia.ejemplo.test');
    const html = s.conVentana(PANEL);
    const etiquetas = html.match(/<script src="[^"]*flotante\.js"[^>]*><\/script>/g) || [];
    assert.equal(etiquetas.length, 1);
    assert.equal(etiquetas[0], '<script src="https://sofia.ejemplo.test/flotante.js" data-sistema="sitio" async></script>');
    assert.ok(html.indexOf(etiquetas[0]) < html.lastIndexOf('</body>'));
    assert.ok(html.indexOf(etiquetas[0]) > html.lastIndexOf('/admin/app.js'), 'va después de los scripts del panel');
    // Lo demás de la página no cambia
    assert.equal(html.replace(/ *<!-- Sofía: ventana flotante \(SOFIA_URL\) -->\n *<script[^\n]*flotante\.js[^\n]*\n/, ''), PANEL);
    assert.deepEqual(s.salud.pieza(), { id: 'sofia', nombre: 'Ventana de Sofía', estado: 'ok', mensaje: 'Encendida en el administrador' });
});

test('la base con ruta se respeta y se quitan las diagonales del final', () => {
    const s = crearSofia({ url: 'https://ejemplo.test/sofia//', anotar: callado });
    assert.match(s.etiqueta, /src="https:\/\/ejemplo\.test\/sofia\/flotante\.js"/);
    assert.equal(s.origen, 'https://ejemplo.test');
    const local = crearSofia({ url: 'http://127.0.0.1:3362', anotar: callado });
    assert.match(local.etiqueta, /src="http:\/\/127\.0\.0\.1:3362\/flotante\.js"/);
});

test('una SOFIA_URL mal escrita no enciende nada y lo avisa', () => {
    for (const url of ['javascript:alert(1)', 'ftp://ejemplo.test', 'sofia.ejemplo.test', 'https://u:p@ejemplo.test', 'https://ejemplo.test/?x=1', 'https://ejemplo.test/#a', '"><script>']) {
        const avisos = [];
        const s = crearSofia({ url, anotar: (m) => avisos.push(m) });
        assert.equal(s.activa, false, url);
        assert.equal(s.conVentana(PANEL), PANEL, url);
        assert.equal(avisos.length, 1, url);
        assert.equal(s.salud.pieza().estado, 'aviso', url);
    }
});

test('los caracteres raros de la dirección van escapados en el atributo', () => {
    const s = crearSofia({ url: 'https://ejemplo.test/a"b<c', anotar: callado });
    assert.ok(!/a"b/.test(s.etiqueta));
    assert.ok(!/<c/.test(s.etiqueta));
});

test('una página sin </body> recibe la etiqueta al final', () => {
    const s = crearSofia({ url: 'https://ejemplo.test', anotar: callado });
    assert.match(s.conVentana('<p>hola</p>'), /^<p>hola<\/p>\n.*flotante\.js/s);
});
