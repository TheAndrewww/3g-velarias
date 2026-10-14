/*! Administrador del sitio · Diseño 3G (niveles 1 y 2, ola 2) — admin-3g.js
   app.js llama a estas funciones SOLO cuando el interruptor Diseño 3G está encendido (constante G3_ON).
   Con el interruptor apagado este archivo solo define window.G3A y no toca la página.
   Encendido, al cargar mete #admin-contenido (el mismo nodo, con sus ids y handlers) en el armazón común
   (#g3-principal: riel, barra superior y barra inferior). Si eso fallara, no define G3A: app.js ve G3_ON = false,
   quita el atributo y el panel queda como siempre (nunca una mezcla).
   No hace ninguna petición propia: la lista, las fotos y el globo siguen llamando a la API desde app.js.
   Usa, al momento de llamarse, las variables de app.js (currentTab, projects, currentImages, editProjectId,
   categoryFilter, searchTerm, grid, emptyState, modal, modalContent, form, gallery, industrialFields, imageInput...)
   y sus funciones (renderProjects, editProject, deleteProject, toggleGlobeVisibility, removeImage, updateMapMarker,
   setupImageDragDrop, closeModal, hideUploadProgress). Mismos datos y mismas llamadas a la API que el panel de siempre. */
(function () {
  'use strict';
  var G3 = window.G3;
  var activo = !!(G3 && typeof G3.activo === 'function' && G3.activo());

  var NOMBRES = {
    pergola: 'Pérgola', terraza: 'Terraza', cochera: 'Cochera', jardin: 'Jardín', otro: 'Otro',
    estacionamiento: 'Estacionamiento', comercial: 'Comercial', escuela: 'Escuela', deportivo: 'Deportivo', industrial: 'Industrial'
  };
  var SITIO = { residential: 'Residencial', industrial: 'Industrial' };
  var PLURAL = { residential: ['obra residencial', 'obras residenciales'], industrial: ['obra industrial', 'obras industriales'] };
  var soloIncompletas = false;
  var origenFicha = null;

  /* ------------------------------------------------------------ armazón (solo encendido, al cargar) */
  var montado = false;
  if (activo) {
    try {
      var principal = document.getElementById('g3-principal');
      var contenido = document.getElementById('admin-contenido');
      if (principal && contenido) { principal.appendChild(contenido); montado = true; }
    } catch (e) { montado = false; }
    // Dirección propia para el selector de apps: sale de la página, no se escribe en ningún archivo.
    // Las de los demás sistemas NO se configuran aquí: esta carpeta se sirve sin sesión (salen «Ábrela desde Inicio 3G»).
    if (montado && typeof G3.configurar === 'function') {
      try { G3.configurar({ urls: { 'admin-sitio': location.origin + '/admin' } }); } catch (e) { /* el selector sigue sin enlace propio */ }
    }
  }

  /* ------------------------------------------------------------ utilidades */
  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function ico(nombre, tam) { return G3.icono(nombre, { tamano: tam || 18 }); }
  function nombreCategoria(c) { return NOMBRES[c] || (c ? String(c).charAt(0).toUpperCase() + String(c).slice(1) : 'Sin categoría'); }
  function urlImagen(src) {
    if (!src) return '';
    src = String(src);
    if (!/^https?:/.test(src) && !/^blob:/.test(src)) src = src.replace(/^\.\.\//, '/').replace(/^images\//, '/images/');
    return src;
  }
  function listaActual() { return currentTab === 'residential' ? projects.residentialProjects : projects.industrialProjects; }
  function buscarObra(id) { var l = listaActual() || []; for (var i = 0; i < l.length; i++) if (l[i].id === id) return l[i]; return null; }
  function plural(n, tipo) { return n + ' ' + PLURAL[tipo][n === 1 ? 0 : 1]; }
  /* Área "38 m²" se deja igual; un número suelto ("1") se etiqueta para que se note. */
  function medida(v, etiqueta) {
    if (v == null || String(v).trim() === '') return '';
    return /^\s*[\d.,]+\s*$/.test(String(v)) ? etiqueta + ' ' + String(v).trim() : String(v).trim();
  }
  function esRelleno(v) { return /^\s*1\s*$/.test(String(v == null ? '' : v)); }
  function conCoordenadas(p) { return !!(p.coordinates && p.coordinates.length === 2); }

  /* Qué le falta a la ficha (solo se calcula en el navegador; no cambia nada en la base de datos). */
  function faltantes(p, tipo) {
    var f = [];
    if (tipo === 'industrial' && !conCoordenadas(p)) f.push('Sin coordenadas');
    var a = esRelleno(p.area), d = esRelleno(p.duration);
    if (a && d) f.push('Área y duración de relleno');
    else if (a) f.push('Área de relleno');
    else if (d) f.push('Duración de relleno');
    if (!p.area || !String(p.area).trim()) f.push('Falta el área');
    if (!(p.images && p.images.length) && !p.image) f.push('Sin fotos');
    return f;
  }

  function aviso(texto, tipo, extra) {
    var op = extra || {};
    op.tipo = tipo || 'info';
    if (op.tipo === 'mal' && op.duracion == null) op.duracion = 9000;
    return G3.aviso(texto, op);
  }

  /* ------------------------------------------------------------ arranque (una vez) */
  function iniciar() {
    // Barra superior: selector de apps (trae el interruptor abajo) y tema. Como en los demás sistemas, el interruptor
    // vive solo dentro del selector de apps (revisión cruzada de la ola 1: ya no se repite suelto en la barra).
    G3.selectorApps('#g3-apps', { actual: 'admin-sitio' });
    var bTema = $('g3-tema');
    var pintarTema = function () {
      var oscuro = G3.esOscuro();
      // Mismo criterio que Planta, Operación, Finanzas y Ventas: el ícono enseña el tema ACTUAL (sol = claro, luna = oscuro).
      var t = oscuro ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro';
      bTema.innerHTML = ico(oscuro ? 'luna' : 'sol', 20);
      bTema.setAttribute('aria-label', (oscuro ? 'Tema oscuro. ' : 'Tema claro. ') + t);
      bTema.title = t;
    };
    bTema.addEventListener('click', function () { G3.tema(G3.esOscuro() ? 'claro' : 'oscuro'); pintarTema(); });
    G3.alCambiar(pintarTema);
    if (window.matchMedia) {
      var mq = window.matchMedia('(prefers-color-scheme: dark)');
      if (mq.addEventListener) mq.addEventListener('change', pintarTema);
    }
    pintarTema();

    // Residencial / Industrial: viven en el riel (y en la barra inferior del celular). Hacen lo mismo que las
    // pestañas de siempre: switchTab() de app.js. En celular, al elegir se cierra el menú.
    $('g3-marco').addEventListener('click', function (e) {
      var b = e.target.closest('[data-g3a-pestana]');
      if (!b) return;
      e.preventDefault();
      var riel = $('g3-riel');
      if (riel && riel.hasAttribute('data-abierto') && typeof G3.cerrar === 'function') G3.cerrar(riel);
      switchTab(b.getAttribute('data-g3a-pestana'));
    });

    // Chips de categoría y "Solo incompletas".
    $('g3-categorias').addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b) return;
      var clave;
      if (b.hasAttribute('data-incompletas')) { soloIncompletas = !soloIncompletas; clave = '[data-incompletas]'; }
      else {
        categoryFilter = b.getAttribute('data-categoria') || '';
        categoryFilterSelect.value = categoryFilter;
        clave = '[data-categoria="' + categoryFilter + '"]';
      }
      renderProjects();
      var nuevo = $('g3-categorias').querySelector(clave);
      if (nuevo) nuevo.focus();
    });
    $('g3-ver-incompletas').addEventListener('click', function () { soloIncompletas = !soloIncompletas; renderProjects(); });

    // Lista y vacío.
    grid.className = 'g3a-obras';
    grid.setAttribute('aria-label', 'Obras');
    emptyState.className = 'g3-vacio hidden';
    emptyState.innerHTML = '';
    emptyState.addEventListener('click', function (e) {
      var b = e.target.closest('[data-accion]');
      if (!b) return;
      if (b.getAttribute('data-accion') === 'limpiar') clearFilters();
      if (b.getAttribute('data-accion') === 'agregar') openModal();
    });

    prepararFicha();
    prepararSubida();

    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      if (document.querySelector('dialog[open]')) return;
      if (!$('upload-progress-modal').classList.contains('hidden')) return;
      if (!modal.classList.contains('hidden')) { e.preventDefault(); closeModal(); }
    });
  }

  /* ------------------------------------------------------------ barra y pestañas */
  // Misma dirección que el «Ver Sitio Web» de siempre (FRONTEND_URL de /api/config + /residencial/ o /industrial/).
  function actualizarSitio() {
    var url = (window.FRONTEND_URL || '') + (currentTab === 'industrial' ? '/industrial/' : '/residencial/');
    ['g3-ver-sitio', 'g3-ver-sitio-inferior'].forEach(function (id) {
      var a = $(id);
      if (!a) return;
      a.href = url;
      a.setAttribute('aria-label', 'Ver el sitio ' + SITIO[currentTab] + ' en otra pestaña');
    });
    if ($('g3-ver-sitio-texto')) $('g3-ver-sitio-texto').textContent = 'Ver sitio ' + SITIO[currentTab];
  }
  function marcarPestana() {
    Array.prototype.forEach.call(document.querySelectorAll('#g3-marco [data-g3a-pestana]'), function (b) {
      if (b.getAttribute('data-g3a-pestana') === currentTab) b.setAttribute('aria-current', 'page');
      else b.removeAttribute('aria-current');
    });
    $('g3-miga-sitio').textContent = SITIO[currentTab];
    $('g3-titulo').textContent = currentTab === 'industrial' ? 'Obras industriales' : 'Obras residenciales';
    $('g3-titulo-texto').textContent = 'Las obras de la galería de la página ' + SITIO[currentTab] + ' de www.3gvelarias.com. Toca una obra para editar sus datos, fotos y ubicación.';
  }
  function alCambiarPestana() {
    marcarPestana();
    soloIncompletas = false;
    actualizarSitio();
  }
  function limpiar() { soloIncompletas = false; }
  function pasaFiltroExtra(p) { return !soloIncompletas || faltantes(p, currentTab).length > 0; }

  /* ------------------------------------------------------------ lista de obras */
  function chip(valor, texto, n, encendido) {
    return '<button type="button" class="g3-chip" data-categoria="' + esc(valor) + '" aria-pressed="' + encendido + '">' + esc(texto) +
      ' <span class="g3-insignia" aria-label="' + n + (n === 1 ? ' obra' : ' obras') + '">' + n + '</span></button>';
  }
  function pintarChips(lista, nIncompletas) {
    var cuenta = {};
    lista.forEach(function (p) { cuenta[p.category] = (cuenta[p.category] || 0) + 1; });
    var html = chip('', 'Todas', lista.length, !categoryFilter);
    var cats = (CATEGORIES[currentTab] || []).slice();
    Object.keys(cuenta).forEach(function (c) { if (cats.indexOf(c) === -1) cats.push(c); });
    cats.forEach(function (c) { html += chip(c, nombreCategoria(c), cuenta[c] || 0, categoryFilter === c); });
    if (nIncompletas || soloIncompletas) {
      html += '<span class="g3a-chips-sep" aria-hidden="true"></span><button type="button" class="g3-chip" data-incompletas aria-pressed="' + soloIncompletas + '">' +
        ico('alerta', 16) + 'Solo incompletas <span class="g3-insignia" aria-label="' + nIncompletas + (nIncompletas === 1 ? ' obra' : ' obras') + '">' + nIncompletas + '</span></button>';
    }
    $('g3-categorias').innerHTML = html;
  }
  function pintarIncompletas(incompletas) {
    var caja = $('g3-incompletas');
    if (!incompletas.length) { caja.classList.add('hidden'); return; }
    var sinCoord = incompletas.filter(function (p) { return currentTab === 'industrial' && !conCoordenadas(p); }).length;
    var relleno = incompletas.filter(function (p) { return esRelleno(p.area) || esRelleno(p.duration); }).length;
    var otras = incompletas.length - incompletas.filter(function (p) { return (currentTab === 'industrial' && !conCoordenadas(p)) || esRelleno(p.area) || esRelleno(p.duration); }).length;
    var partes = [];
    if (sinCoord) partes.push(sinCoord + (sinCoord === 1 ? ' no tiene coordenadas y no sale' : ' no tienen coordenadas y no salen') + ' en el globo 3D');
    if (relleno) partes.push(relleno + (relleno === 1 ? ' dice' : ' dicen') + ' «1» en área o duración (parece dato de relleno)');
    if (otras) partes.push(otras + (otras === 1 ? ' le falta el área o las fotos' : ' les falta el área o las fotos'));
    $('g3-incompletas-titulo').textContent = (incompletas.length === 1 ? '1 obra' : incompletas.length + ' obras') + ' en ' + SITIO[currentTab] + ' con la ficha incompleta';
    var texto = partes.join('; ') + '. Se marcan en amarillo abajo.';
    $('g3-incompletas-texto').textContent = texto.charAt(0).toUpperCase() + texto.slice(1);
    $('g3-ver-incompletas').textContent = soloIncompletas ? 'Ver todas' : 'Ver solo esas';
    caja.classList.remove('hidden');
  }

  function tarjeta(p, tipo) {
    var falta = faltantes(p, tipo);
    var el = document.createElement('article');
    el.className = 'g3a-obra' + (falta.length ? ' g3a-obra--incompleta' : '');
    var src = urlImagen(p.image || (p.images && p.images[0]));
    var nFotos = (p.images && p.images.length) || (p.image ? 1 : 0);
    var datos = [p.location, medida(p.area, 'Área'), medida(p.duration, 'Duración')].filter(Boolean).join(' · ');
    var globo = '';
    if (tipo === 'industrial') {
      globo = conCoordenadas(p)
        ? '<label class="g3-interruptor" title="Mostrar u ocultar en el globo 3D de la página Industrial"><input type="checkbox" role="switch"' + (p.showInGlobe !== false ? ' checked' : '') +
          ' aria-label="Mostrar «' + esc(p.title) + '» en el globo 3D">Globo 3D</label>'
        : '<label class="g3-interruptor g3a-apagado" title="Necesita coordenadas para salir en el globo 3D"><input type="checkbox" role="switch" disabled aria-label="«' + esc(p.title) + '» no puede salir en el globo 3D: le faltan las coordenadas">Globo 3D</label>';
    }
    el.innerHTML =
      '<div class="g3a-obra-foto">' + (src ? '<img src="' + esc(src) + '" alt="">' : '') +
        '<span class="g3a-obra-cat">' + esc(nombreCategoria(p.category)) + '</span>' +
        (nFotos > 1 ? '<span class="g3a-obra-fotos-n" aria-label="' + nFotos + ' fotos">' + ico('foto', 14) + nFotos + '</span>' : '') +
      '</div>' +
      '<div class="g3a-obra-cuerpo">' +
        '<h3 class="g3a-obra-titulo">' + esc(p.title) + '</h3>' +
        '<p class="g3a-obra-datos">' + ico('ubicacion', 16) + '<span>' + esc(datos) + '</span></p>' +
        (falta.length ? '<span class="g3-estado g3-estado--aviso">' + esc(falta.join(' · ')) + '</span>' : '') +
      '</div>' +
      '<div class="g3a-obra-pie">' + globo +
        '<div class="g3a-obra-acciones">' +
          '<button type="button" class="g3-btn g3-btn--tonal g3-btn--ch" data-accion="editar">' + ico('editar', 16) + (falta.length ? 'Corregir' : 'Editar') +
            '<span class="g3-oculto-visual"> «' + esc(p.title) + '»</span></button>' +
          '<button type="button" class="g3-btn-icono" data-accion="borrar" aria-label="Eliminar «' + esc(p.title) + '»" title="Eliminar obra">' + ico('borrar', 18) + '</button>' +
        '</div>' +
      '</div>';
    var img = el.querySelector('.g3a-obra-foto img');
    if (img) img.addEventListener('error', function () { img.parentElement.classList.add('g3a-sin-foto'); });
    else el.querySelector('.g3a-obra-foto').classList.add('g3a-sin-foto');
    // Igual que hoy: tocar la tarjeta abre la ficha para editar.
    el.addEventListener('click', function () { editProject(p.id); });
    var pie = el.querySelector('.g3a-obra-pie');
    pie.addEventListener('click', function (e) {
      e.stopPropagation();
      var b = e.target.closest('[data-accion]');
      if (!b) return;
      if (b.getAttribute('data-accion') === 'editar') editProject(p.id);
      if (b.getAttribute('data-accion') === 'borrar') deleteProject(p.id);
    });
    var sw = pie.querySelector('input[type="checkbox"]');
    if (sw) sw.addEventListener('change', function () { toggleGlobeVisibility(p.id, sw); });
    return el;
  }

  function pintarObras(lista, filtrada) {
    var tipo = currentTab;
    ['residential', 'industrial'].forEach(function (t) {
      var n = (projects[t + 'Projects'] || []).length;
      var ins = $('g3-n-' + t);
      ins.textContent = n;
      ins.setAttribute('aria-label', n + (n === 1 ? ' obra' : ' obras'));
    });
    var incompletas = lista.filter(function (p) { return faltantes(p, tipo).length > 0; });
    pintarChips(lista, incompletas.length);
    pintarIncompletas(incompletas);
    var n = filtrada.length, total = lista.length;
    var hayFiltro = !!(searchTerm || categoryFilter || soloIncompletas);
    $('g3-conteo').textContent = !total ? '' : (hayFiltro ? 'Mostrando ' + n + ' de ' + plural(total, tipo) + '.' : plural(total, tipo) + ' publicadas en el sitio.');
    $('g3-limpiar').classList.toggle('hidden', !hayFiltro);
    if (typeof projectCount !== 'undefined' && projectCount) projectCount.textContent = n + ' proyecto' + (n !== 1 ? 's' : '');

    grid.innerHTML = '';
    if (!n) {
      grid.classList.add('hidden');
      emptyState.innerHTML = !total
        ? ico('foto', 40) + '<b>Todavía no hay ' + PLURAL[tipo][1] + '</b><p>Agrega la primera con sus fotos; sale en la galería del sitio ' + SITIO[tipo] + ' al guardarla.</p>' +
          '<button type="button" class="g3-btn g3-btn--primario" data-accion="agregar">' + ico('mas', 18) + 'Agregar obra</button>'
        : ico('buscar', 40) + '<b>Ninguna obra coincide con los filtros</b><p>Prueba con otra palabra o categoría, o quita los filtros para ver las ' + total + '.</p>' +
          '<button type="button" class="g3-btn" data-accion="limpiar">' + ico('cerrar', 18) + 'Limpiar filtros</button>';
      emptyState.classList.remove('hidden');
      return;
    }
    grid.classList.remove('hidden');
    emptyState.classList.add('hidden');
    var frag = document.createDocumentFragment();
    filtrada.forEach(function (p) { frag.appendChild(tarjeta(p, tipo)); });
    grid.appendChild(frag);
  }

  function errorCarga() {
    grid.innerHTML = '';
    grid.classList.add('hidden');
    // Sin botón «Reintentar»: hoy no hay ninguna petición de reintento (el panel de siempre solo avisa).
    emptyState.innerHTML = ico('error', 40) + '<b>No se pudo cargar el portafolio</b><p>El servidor no contestó. Revisa la conexión y recarga la página para intentar de nuevo.</p>';
    emptyState.classList.remove('hidden');
  }

  /* ------------------------------------------------------------ ficha de obra (modal → cajón) */
  function campo(div, id, etiqueta, opciones) {
    var op = opciones || {};
    div.className = 'g3-campo';
    var lab = div.querySelector('label');
    var ctl = div.querySelector('input, select, textarea');
    ctl.id = id;
    lab.htmlFor = id;
    lab.className = 'g3-etq';
    lab.innerHTML = esc(etiqueta) + (op.opcional ? ' <small>opcional</small>' : '');
    ctl.className = ctl.tagName === 'SELECT' ? 'g3-selector' : ctl.tagName === 'TEXTAREA' ? 'g3-area' : 'g3-entrada';
    if (op.placeholder != null) ctl.placeholder = op.placeholder;
    if (op.ayuda) {
      var p = document.createElement('p');
      p.className = 'g3-ayuda';
      p.id = id + '-ayuda';
      p.textContent = op.ayuda;
      div.appendChild(p);
      ctl.setAttribute('aria-describedby', p.id);
    }
    return ctl;
  }
  function titulo(texto, id) {
    var t = document.createElement('p');
    t.className = 'g3a-seccion-titulo';
    if (id) t.id = id;
    t.textContent = texto;
    return t;
  }

  function prepararFicha() {
    modal.className = 'g3a-modal hidden opacity-0';
    modalContent.className = 'g3a-hoja scale-95';
    modalContent.setAttribute('role', 'dialog');
    modalContent.setAttribute('aria-modal', 'true');

    // Cabecera
    var cab = modalContent.firstElementChild;
    var h = cab.querySelector('h3');
    h.id = 'g3-ficha-titulo';
    h.className = '';
    modalContent.setAttribute('aria-labelledby', 'g3-ficha-titulo');
    cab.className = 'g3-cajon-cab';
    var env = document.createElement('div');
    cab.insertBefore(env, h);
    env.appendChild(h);
    var sub = document.createElement('p');
    sub.id = 'g3-ficha-sitio';
    sub.className = 'g3-tenue g3-chico';
    env.appendChild(sub);
    var x = cab.querySelector('button');
    x.className = 'g3-btn-icono';
    x.innerHTML = ico('cerrar', 20);
    x.setAttribute('aria-label', 'Cerrar sin guardar');
    x.title = 'Cerrar sin guardar';

    // Formulario: mismos campos y nombres; se acomodan en el orden de la maqueta.
    form.className = 'g3a-form';
    var fila1 = form.querySelector('[name="title"]').closest('.grid');
    var fila2 = form.querySelector('[name="category"]').closest('.grid');
    var desc = form.querySelector('[name="description"]').parentElement;
    var fotos = gallery.parentElement;
    var pie = form.querySelector('button[type="submit"]').parentElement;

    fila1.className = 'g3-campos';
    campo(fila1.children[0], 'g3-f-titulo', 'Título');
    campo(fila1.children[1], 'g3-f-ubicacion', 'Ubicación', { ayuda: 'Ciudad y estado, por ejemplo León, Gto.' });
    fila2.className = 'g3-campos';
    campo(fila2.children[0], 'g3-f-categoria', 'Categoría');
    campo(fila2.children[1], 'g3-f-area', 'Área (m²)');
    campo(fila2.children[2], 'g3-f-duracion', 'Duración', { opcional: true });
    campo(desc, 'g3-f-descripcion', 'Descripción', { placeholder: 'Qué se hizo, con qué lona y para qué sirve.' });

    // Fotos
    fotos.className = 'g3a-seccion';
    fotos.replaceChild(titulo('Fotos', 'g3-fotos-titulo'), fotos.querySelector('label'));
    var ayudaF = document.createElement('p');
    ayudaF.className = 'g3-ayuda';
    ayudaF.id = 'g3-fotos-ayuda';
    ayudaF.textContent = 'La foto marcada «Principal» es la que sale en la tarjeta. Toca la estrella de otra foto para hacerla principal o arrastra para cambiar el orden. Al guardar, las fotos nuevas quedan después de las que ya estaban. Las de más de 10 MB se comprimen solas al guardar.';
    fotos.insertBefore(ayudaF, gallery);
    var notaF = document.createElement('p');
    notaF.className = 'g3-ayuda g3a-fotos-nota hidden';
    notaF.id = 'g3-fotos-nota';
    notaF.textContent = 'Las fotos nuevas no pueden ser la principal todavía. Guarda la obra para poder elegirla como principal.';
    fotos.insertBefore(notaF, gallery.nextSibling);
    gallery.className = 'g3a-galeria';
    gallery.setAttribute('role', 'group');
    gallery.setAttribute('aria-labelledby', 'g3-fotos-titulo');
    gallery.setAttribute('aria-describedby', 'g3-fotos-ayuda');
    gallery.addEventListener('click', function (e) {
      var q = e.target.closest('[data-quitar]');
      if (q) { e.preventDefault(); removeImage(Number(q.getAttribute('data-quitar'))); return; }
      var s = e.target.closest('[data-principal]');
      if (s) { e.preventDefault(); hacerPrincipal(Number(s.getAttribute('data-principal'))); return; }
      var bl = e.target.closest('[data-principal-bloqueada]');
      if (bl) { e.preventDefault(); aviso('Guarda la obra para poder elegirla como principal.', 'info'); }
    });

    // Solo obras industriales: coordenadas, mapa y globo.
    prepararIndustrial();

    // Pie: Cancelar · Guardar. Eliminar vive solo en la tarjeta, como hoy (verificación ola 2: no se duplica en la ficha).
    pie.className = 'g3a-pie';
    var cancelar = pie.querySelector('button[type="button"]');
    cancelar.className = 'g3-btn g3-btn--fantasma';
    var guardar = pie.querySelector('button[type="submit"]');
    guardar.className = 'g3-btn g3-btn--primario';
    guardar.id = 'g3-guardar';

    // Orden: datos → descripción → fotos → ubicación en el mapa → botones.
    [fila1, fila2, desc, fotos, industrialFields, pie].forEach(function (n) { form.appendChild(n); });
  }

  function prepararIndustrial() {
    var ind = industrialFields;
    ind.className = 'g3a-industrial hidden';
    var lat = $('lat-input'), lng = $('lng-input');
    var bloqueCoord = lat.closest('.grid').parentElement;
    var bloqueMapa = $('map').parentElement;
    var bloqueGlobo = $('showInGlobe').closest('label').parentElement;

    bloqueCoord.className = 'g3a-seccion';
    bloqueCoord.replaceChild(titulo('Ubicación en el mapa'), bloqueCoord.querySelector('label'));
    var rejilla = lat.parentElement;
    rejilla.className = 'g3-campos';
    [[lat, 'Latitud', '20.6767'], [lng, 'Longitud', '-101.3563']].forEach(function (par) {
      var c = document.createElement('div');
      c.className = 'g3-campo';
      var l = document.createElement('label');
      l.className = 'g3-etq';
      l.htmlFor = par[0].id;
      l.textContent = par[1];
      rejilla.insertBefore(c, par[0]);
      c.appendChild(l);
      c.appendChild(par[0]);
      par[0].className = 'g3-entrada'; // teclado normal, como hoy (el numérico del iPhone no trae el signo menos)
      par[0].placeholder = 'Ej. ' + par[2];
      par[0].setAttribute('aria-describedby', 'g3-coord-ayuda');
    });
    var ayuda = bloqueCoord.querySelector('p.text-xs') || document.createElement('p');
    if (!ayuda.parentElement) bloqueCoord.appendChild(ayuda);
    ayuda.className = 'g3-ayuda g3a-ayuda';
    ayuda.id = 'g3-coord-ayuda';
    ayuda.innerHTML = 'Cópialas de <a href="https://www.google.com/maps" target="_blank" rel="noopener">Google Maps</a>: clic derecho sobre la obra y toca los números de arriba (por ejemplo 20.6767, -101.3563). Puedes pegar los dos juntos en Latitud, o el enlace de Google Maps. Sin coordenadas la obra no sale en el globo 3D.';
    // Pegar en Latitud «20.94, -101.42» (dos números con punto decimal, coma y espacio) o un enlace de Google Maps
    // llena los dos campos. Cualquier otra cosa se pega normal, como hoy.
    lat.addEventListener('paste', function (e) {
      var t = (e.clipboardData || window.clipboardData).getData('text') || '';
      var par = coordenadasPegadas(t);
      if (!par) return;
      e.preventDefault();
      lat.value = par[0];
      lng.value = par[1];
      updateMapMarker();
    });

    bloqueMapa.className = 'g3a-seccion';
    var etqMapa = bloqueMapa.querySelector('label');
    var tm = document.createElement('p');
    tm.className = 'g3-etq';
    tm.textContent = 'Vista previa';
    bloqueMapa.replaceChild(tm, etqMapa);
    $('map').className = '';
    $('map').setAttribute('aria-label', 'Vista previa del mapa con el marcador de la obra');
    var notaMapa = bloqueMapa.querySelector('p.text-xs');
    if (notaMapa) { notaMapa.className = 'g3-ayuda'; notaMapa.textContent = 'El marcador se mueve solo al escribir las coordenadas.'; }

    bloqueGlobo.className = 'g3a-globo';
    var etqGlobo = $('showInGlobe').closest('label');
    var entrada = $('showInGlobe');
    etqGlobo.className = 'g3-interruptor';
    entrada.className = '';
    entrada.setAttribute('role', 'switch');
    entrada.setAttribute('aria-describedby', 'g3-globo-ayuda');
    etqGlobo.innerHTML = '';
    etqGlobo.appendChild(entrada);
    etqGlobo.appendChild(document.createTextNode('Mostrar en el globo 3D de la página Industrial'));
    var ag = document.createElement('p');
    ag.className = 'g3-ayuda';
    ag.id = 'g3-globo-ayuda';
    ag.textContent = 'Solo aparece si la obra tiene coordenadas. También se prende o apaga desde la tarjeta.';
    bloqueGlobo.appendChild(ag);
  }

  /* «lat, lng» pegado: solo dos números con punto decimal separados por coma y espacio («20.9437, -101.4270»),
     o un enlace de Google Maps que traiga las coordenadas (!3d…!4d…, @lat,lng o ?q=lat,lng). Si no, null. */
  var NUM = '(-?\\d{1,3}\\.\\d+)';
  var RE_PAR = new RegExp('^' + NUM + ', +' + NUM + '$');
  var RE_MAPS = /^https?:\/\/(?:www\.)?(?:google\.[a-z.]+\/maps|maps\.google\.[a-z.]+)(?:[\/?#]|$)/i;
  var RE_ENLACE = [
    new RegExp('!3d' + NUM + '!4d' + NUM),
    new RegExp('@' + NUM + ',' + NUM + '(?:[,/z]|$)'),
    new RegExp('[?&](?:q|query|ll|center|destination)=' + NUM + '(?:,|%2C)(?:\\+|%20)*' + NUM + '(?:[&#]|$)', 'i')
  ];
  function coordenadasPegadas(texto) {
    var t = String(texto || '').trim();
    var m = RE_PAR.exec(t);
    if (m) return [m[1], m[2]];
    if (!RE_MAPS.test(t)) return null;
    for (var i = 0; i < RE_ENLACE.length; i++) { m = RE_ENLACE[i].exec(t); if (m) return [m[1], m[2]]; }
    return null;
  }

  function alAbrir(edicion) {
    document.querySelector('#modal h3').textContent = edicion ? 'Editar obra' : 'Agregar obra';
    $('g3-ficha-sitio').textContent = 'Sitio ' + SITIO[currentTab] + ' · ' + (edicion ? 'los cambios se ven en www.3gvelarias.com al guardar' : 'se publica en www.3gvelarias.com al guardar');
    $('g3-guardar').textContent = edicion ? 'Guardar cambios' : 'Guardar obra';
    var sel = form.querySelector('[name="category"]');
    Array.prototype.forEach.call(sel.options, function (o) { o.textContent = nombreCategoria(o.value); });
    form.scrollTop = 0;
    if (modal.classList.contains('hidden') || !origenFicha) origenFicha = document.activeElement;
    $('g3-marco').inert = true; // riel, barras y lista quedan inertes mientras la ficha está abierta
    setTimeout(function () { var t = $('g3-f-titulo'); if (t) t.focus({ preventScroll: true }); }, 60);
  }
  function alCerrar() {
    $('g3-marco').inert = false;
    var o = origenFicha;
    origenFicha = null;
    if (o && typeof o.focus === 'function' && document.contains(o)) o.focus({ preventScroll: true });
  }

  /* ------------------------------------------------------------ fotos */
  /* Cuál queda como principal al guardar, con la misma regla de saveProject (app.js, sin cambios): primero van las
     fotos ya guardadas y después las nuevas, así que si la obra ya tiene fotos, la principal es la primera guardada. */
  function hayGuardadas() { return currentImages.some(function (x) { return typeof x === 'string'; }); }
  function indicePrincipal() {
    if (!hayGuardadas()) return 0;
    for (var k = 0; k < currentImages.length; k++) if (typeof currentImages[k] === 'string') return k;
    return 0;
  }
  function pintarGaleria() {
    gallery.innerHTML = '';
    var guardadas = hayGuardadas();
    var principal = indicePrincipal();
    var bloqueadas = 0;
    currentImages.forEach(function (item, i) {
      var nueva = item instanceof File;
      var src = nueva ? URL.createObjectURL(item) : urlImagen(item);
      var esPrincipal = i === principal;
      // Una foto nueva en una obra que ya tiene fotos no puede quedar como principal al guardar (error de hoy, W-05):
      // su estrella se desactiva con la explicación; saveProject no cambia.
      var bloqueada = nueva && guardadas;
      if (bloqueada) bloqueadas++;
      var d = document.createElement('div');
      d.className = 'g3a-foto draggable-image' + (esPrincipal ? ' g3a-foto--principal' : '') + (nueva ? ' g3a-foto--nueva' : '');
      d.innerHTML = '<img src="' + esc(src) + '" alt="Foto ' + (i + 1) + (esPrincipal ? ', principal' : '') + (nueva ? ', nueva' : '') + '">' +
        (esPrincipal
          ? '<span class="g3a-foto-principal">Principal</span>'
          : bloqueada
            ? '<button type="button" class="g3a-foto-btn g3a-foto-estrella" data-principal-bloqueada aria-disabled="true" aria-label="Foto ' + (i + 1) + ': guarda la obra para poder elegirla como principal" title="Guarda la obra para poder elegirla como principal">' + ico('estrella', 16) + '</button>'
            : '<button type="button" class="g3a-foto-btn g3a-foto-estrella" data-principal="' + i + '" aria-label="Hacer principal la foto ' + (i + 1) + '" title="Hacer principal">' + ico('estrella', 16) + '</button>') +
        (nueva && guardadas ? '<span class="g3a-foto-nueva">Nueva</span>' : '') +
        '<button type="button" class="g3a-foto-btn g3a-foto-quitar" data-quitar="' + i + '" aria-label="Quitar la foto ' + (i + 1) + '" title="Quitar foto">' + ico('cerrar', 16) + '</button>';
      gallery.appendChild(d);
    });
    var nota = $('g3-fotos-nota');
    if (nota) nota.classList.toggle('hidden', !bloqueadas);
    var add = document.createElement('button');
    add.type = 'button';
    add.className = 'add-image-btn g3a-foto-agregar';
    add.innerHTML = ico('subir', 24) + '<span>' + (currentImages.length ? 'Agregar más' : 'Agregar fotos') + '</span>';
    add.addEventListener('click', function () { imageInput.click(); });
    gallery.appendChild(add);
    setupImageDragDrop();
  }
  function hacerPrincipal(i) {
    if (i <= 0 || i >= currentImages.length) return;
    if (currentImages[i] instanceof File && hayGuardadas()) return; // ver pintarGaleria (W-05)
    var x = currentImages.splice(i, 1)[0];
    currentImages.unshift(x);
    renderGallery();
    var primera = gallery.querySelector('.g3a-foto-quitar');
    if (primera) primera.focus();
  }

  /* ------------------------------------------------------------ subida de fotos */
  function prepararSubida() {
    var m = $('upload-progress-modal');
    m.className = 'g3a-subida hidden';
    m.innerHTML =
      '<div class="g3a-subida-caja" role="dialog" aria-modal="true" aria-labelledby="g3-subida-titulo">' +
        '<div class="g3-cajon-cab"><h2 id="g3-subida-titulo">Subiendo fotos</h2>' +
          '<button type="button" class="g3-btn-icono" onclick="hideUploadProgress()" aria-label="Cerrar">' + ico('cerrar', 20) + '</button></div>' +
        '<div class="g3-cajon-cuerpo">' +
          '<div id="upload-progress-list" class="g3-lista g3a-subida-lista"></div>' +
          '<div class="g3a-subida-estado"><span id="upload-current-status" aria-live="polite">Preparando…</span><span id="upload-progress-text" class="g3-num">0 de 0</span></div>' +
          '<div class="g3-progreso" id="g3-subida-barra" role="progressbar" aria-labelledby="g3-subida-titulo" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><span id="upload-progress-bar" style="width: 0%"></span></div>' +
        '</div>' +
        '<div class="g3-cajon-pie"><button type="button" id="close-upload-modal-btn" class="g3-btn g3-btn--primario hidden" onclick="hideUploadProgress()">Cerrar</button></div>' +
      '</div>';
  }
  var ESTADOS = { pending: ['neutro', 'En espera'], compressing: ['aviso', 'Comprimiendo'], uploading: ['info', 'Subiendo'], success: ['ok', 'Lista'], error: ['mal', 'No se subió'] };
  function mensajeSubida(estado, mensaje) {
    if (!mensaje) return '';
    var m = String(mensaje).replace(/(\d)MB/g, '$1 MB').replace(/Comprimiendo\.\.\./, 'comprimiendo…');
    if (estado === 'error' && m === 'Error de red') m = 'Sin conexión con el servidor';
    return m;
  }
  function filaSubida(nombre, estado, mensaje) {
    var e = ESTADOS[estado] || ESTADOS.pending;
    var msg = mensajeSubida(estado, mensaje);
    return '<span class="g3-fila-ico">' + ico('foto', 20) + '</span>' +
      '<div class="g3-fila-cuerpo"><b>' + esc(nombre) + '</b>' + (msg ? '<small>' + esc(msg) + '</small>' : '') + '</div>' +
      '<div class="g3-fila-der"><span class="g3-estado g3-estado--' + e[0] + '">' + e[1] + '</span></div>';
  }
  function agregarSubida(nombre, estado) {
    var item = document.createElement('div');
    item.id = 'upload-item-' + nombre;
    item.className = 'g3-fila';
    item.innerHTML = filaSubida(nombre, estado);
    $('upload-progress-list').appendChild(item);
  }
  function actualizarSubida(nombre, estado, mensaje) {
    var item = document.getElementById('upload-item-' + nombre);
    if (item) item.innerHTML = filaSubida(nombre, estado, mensaje);
  }
  function progresoSubida(actual, total, nombre, estado) {
    var pct = total ? Math.round((actual / total) * 100) : 0;
    $('upload-progress-bar').style.width = pct + '%';
    $('g3-subida-barra').setAttribute('aria-valuenow', String(pct));
    $('g3-subida-barra').className = 'g3-progreso';
    $('upload-progress-text').textContent = actual + ' de ' + total;
    $('upload-current-status').textContent =
      estado === 'compressing' ? 'Comprimiendo ' + nombre :
      estado === 'uploading' ? 'Subiendo ' + nombre :
      estado === 'success' ? 'Lista: ' + nombre :
      estado === 'error' ? 'No se pudo subir ' + nombre : 'Preparando…';
  }
  function resumenSubida(bien, mal, comprimidas, total) {
    progresoSubida(total, total, '', 'resumen');
    $('g3-subida-barra').className = 'g3-progreso ' + (mal ? 'g3-progreso--aviso' : 'g3-progreso--ok');
    $('upload-current-status').textContent =
      bien + (bien === 1 ? ' foto subida' : ' fotos subidas') +
      (comprimidas ? ' (' + comprimidas + (comprimidas === 1 ? ' comprimida)' : ' comprimidas)') : '') +
      (mal ? '; ' + mal + (mal === 1 ? ' no se pudo subir. Revisa la lista.' : ' no se pudieron subir. Revisa la lista.') : '.');
  }

  /* ------------------------------------------------------------ confirmaciones */
  function confirmarBorrado(id) {
    var p = buscarObra(id) || {};
    var sitio = SITIO[currentTab];
    var nFotos = (p.images && p.images.length) || (p.image ? 1 : 0);
    var pasa = ['Deja de verse en la galería de la página ' + sitio + ' de www.3gvelarias.com.'];
    if (currentTab === 'industrial' && conCoordenadas(p) && p.showInGlobe !== false) pasa.push('También sale del globo 3D de la página Industrial.');
    pasa.push('Las fotos no se borran de la nube (Cloudinary); solo dejan de estar ligadas a esta obra.');
    pasa.push('No se puede deshacer: para recuperarla habría que capturarla otra vez.');
    return G3.confirmar({
      titulo: '¿Eliminar esta obra?',
      aviso: 'Se quita del portafolio del sitio público.',
      datos: [['Obra', p.title || '—'], ['Sitio', sitio], ['Categoría', nombreCategoria(p.category)], ['Ubicación', p.location || '—'], ['Fotos', String(nFotos)]],
      pasa: pasa,
      confirmar: 'Eliminar obra',
      cancelar: 'No eliminar',
      peligro: true
    });
  }
  function alBorrar(id, titulo) {
    if (editProjectId === id && !modal.classList.contains('hidden')) closeModal();
    aviso('Obra eliminada' + (titulo ? ': «' + titulo + '»' : '') + '.', 'ok');
  }
  function confirmarSalida() {
    return G3.confirmar({
      titulo: '¿Cerrar sesión?',
      texto: 'Para volver a entrar al administrador vas a necesitar tu usuario y contraseña.',
      confirmar: 'Cerrar sesión',
      cancelar: 'Seguir aquí'
    });
  }

  // Guardar: el mismo submit de siempre (saveProject), sin compuertas propias del diseño nuevo.

  if (activo && !montado) return; // sin armazón no hay G3A: app.js deja el panel de siempre
  window.G3A = {
    activo: activo,
    iniciar: iniciar,
    actualizarSitio: actualizarSitio,
    alCambiarPestana: alCambiarPestana,
    limpiar: limpiar,
    pasaFiltroExtra: pasaFiltroExtra,
    pintarObras: pintarObras,
    errorCarga: errorCarga,
    alAbrir: alAbrir,
    alCerrar: alCerrar,
    pintarGaleria: pintarGaleria,
    hacerPrincipal: hacerPrincipal,
    agregarSubida: agregarSubida,
    actualizarSubida: actualizarSubida,
    progresoSubida: progresoSubida,
    resumenSubida: resumenSubida,
    confirmarBorrado: confirmarBorrado,
    alBorrar: alBorrar,
    confirmarSalida: confirmarSalida,
    aviso: aviso,
    buscarObra: buscarObra
  };
})();
