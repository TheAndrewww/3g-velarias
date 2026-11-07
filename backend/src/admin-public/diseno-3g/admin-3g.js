/*! Administrador del sitio · Diseño 3G — REDISEÑO 2 (fijo) — admin-3g.js
   La vista del panel /admin. app.js llama a estas funciones mientras html[data-diseno="3g"] esté puesto (constante G3_ON);
   desde el rediseño 2 el atributo va FIJO en index.html, así que esta es la vista de todos.
   Al cargar mete #admin-contenido (el mismo nodo, con sus ids y manejadores) en el armazón común (#g3-principal: riel,
   barra superior y barra inferior). Si eso fallara, no define G3A: app.js ve G3_ON = false, quita el atributo y el panel
   queda como siempre (nunca una mezcla).

   LA LÓGICA NO SE TOCA: este archivo no hace ninguna petición. La lista, las fotos, el globo, guardar, eliminar y salir
   siguen llamando a la API desde app.js, con las mismas rutas, métodos y cuerpos. Aquí solo se dibuja: usa, al momento de
   llamarse, las variables de app.js (currentTab, projects, currentImages, editProjectId, categoryFilter, searchTerm, grid,
   emptyState, modal, modalContent, form, gallery, industrialFields, imageInput, categoryFilterSelect, CATEGORIES...) y sus
   funciones (renderProjects, editProject, deleteProject, toggleGlobeVisibility, removeImage, updateMapMarker,
   setupImageDragDrop, openModal, closeModal, clearFilters, switchTab, hideUploadProgress).

   Lo que es solo de la vista (no cambia datos): el filtro por estado de la ficha (Todas · Por completar · En el globo ·
   Fuera del globo), la vista Lista o Galería (se recuerda en este navegador) y los conteos. */
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
  var CLAVE_VISTA = 'admin-sitio-vista';
  var filtroEstado = 'todas'; // todas | incompletas | globo | sin-globo (solo de la vista)
  var vista = 'lista';
  var origenFicha = null;
  var cargado = false;

  /* ------------------------------------------------------------ armazón (al cargar) */
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
  try { var v = localStorage.getItem(CLAVE_VISTA); if (v === 'lista' || v === 'galeria') vista = v; } catch (e) { /* sin memoria: Lista */ }

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
  function vacioTexto(v) { return v == null || String(v).trim() === ''; }
  function esRelleno(v) { return /^\s*1\s*$/.test(String(v == null ? '' : v)); }
  function conCoordenadas(p) { return !!(p.coordinates && p.coordinates.length === 2); }
  function enGlobo(p) { return conCoordenadas(p) && p.showInGlobe !== false; }
  function numFotos(p) { return (p.images && p.images.length) || (p.image ? 1 : 0); }

  /* Qué le falta a la ficha (solo se calcula en el navegador; no cambia nada en la base de datos). */
  function faltantes(p, tipo) {
    var f = [];
    if (tipo === 'industrial' && !conCoordenadas(p)) f.push('Sin coordenadas');
    var a = esRelleno(p.area), d = esRelleno(p.duration);
    if (a && d) f.push('Área y duración de relleno');
    else if (a) f.push('Área de relleno');
    else if (d) f.push('Duración de relleno');
    if (vacioTexto(p.area)) f.push('Falta el área');
    if (!numFotos(p)) f.push('Sin fotos');
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
    // Barra superior: selector de apps (sin interruptor: el diseño ya es fijo) y tema.
    G3.selectorApps('#g3-apps', { actual: 'admin-sitio', interruptor: false });
    var bTema = $('g3-tema');
    var pintarTema = function () {
      var oscuro = G3.esOscuro();
      // Mismo criterio que los demás sistemas: el ícono enseña el tema ACTUAL (sol = claro, luna = oscuro).
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

    // Estado de la ficha (solo de la vista).
    $('g3-estados').addEventListener('click', function (e) {
      var b = e.target.closest('[data-estado]');
      if (!b) return;
      filtroEstado = b.getAttribute('data-estado');
      renderProjects();
      var nuevo = $('g3-estados').querySelector('[data-estado="' + filtroEstado + '"]');
      if (nuevo) nuevo.focus();
    });

    // Categorías: mismo filtro de siempre (categoryFilter y el selector escondido).
    $('g3-categorias').addEventListener('click', function (e) {
      var b = e.target.closest('[data-categoria]');
      if (!b) return;
      categoryFilter = b.getAttribute('data-categoria') || '';
      categoryFilterSelect.value = categoryFilter;
      renderProjects();
      var nuevo = $('g3-categorias').querySelector('[data-categoria="' + categoryFilter + '"]');
      if (nuevo) nuevo.focus();
    });

    // Lista o Galería (se recuerda en este navegador).
    Array.prototype.forEach.call(document.querySelectorAll('.r2a-vista [data-vista]'), function (b) {
      b.addEventListener('click', function () {
        vista = b.getAttribute('data-vista');
        try { localStorage.setItem(CLAVE_VISTA, vista); } catch (e) { /* solo esta vez */ }
        marcarVista();
        if (cargado) renderProjects();
      });
    });
    marcarVista();

    // Lista y vacío.
    grid.className = 'r2a-obras';
    grid.setAttribute('aria-label', 'Obras');
    grid.innerHTML = esqueleto();
    emptyState.className = 'g3-vacio r2a-vacio hidden';
    emptyState.innerHTML = '';
    emptyState.addEventListener('click', function (e) {
      var b = e.target.closest('[data-accion]');
      if (!b) return;
      if (b.getAttribute('data-accion') === 'limpiar') clearFilters();
      if (b.getAttribute('data-accion') === 'agregar') openModal();
    });
    grid.addEventListener('click', alTocarLista);
    grid.addEventListener('change', alCambiarGlobo);

    prepararFicha();
    prepararSubida();

    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      if (document.querySelector('dialog[open]')) return;
      if (!$('upload-progress-modal').classList.contains('hidden')) return;
      if (!modal.classList.contains('hidden')) { e.preventDefault(); closeModal(); }
    });
  }

  function marcarVista() {
    Array.prototype.forEach.call(document.querySelectorAll('.r2a-vista [data-vista]'), function (b) {
      b.setAttribute('aria-pressed', String(b.getAttribute('data-vista') === vista));
    });
  }

  /* ------------------------------------------------------------ barra, riel y pestañas */
  // Mismas direcciones que el «Ver Sitio Web» de siempre (FRONTEND_URL de /api/config + /residencial/ o /industrial/).
  function actualizarSitio() {
    var base = window.FRONTEND_URL || '';
    if ($('g3-ver-residencial')) $('g3-ver-residencial').href = base + '/residencial/';
    if ($('g3-ver-industrial')) $('g3-ver-industrial').href = base + '/industrial/';
    var abajo = $('g3-ver-sitio-inferior');
    if (abajo) {
      abajo.href = base + (currentTab === 'industrial' ? '/industrial/' : '/residencial/');
      abajo.setAttribute('aria-label', 'Abrir la página ' + SITIO[currentTab] + ' en otra pestaña');
    }
  }
  function marcarPestana() {
    Array.prototype.forEach.call(document.querySelectorAll('#g3-marco [data-g3a-pestana]'), function (b) {
      if (b.getAttribute('data-g3a-pestana') === currentTab) b.setAttribute('aria-current', 'page');
      else b.removeAttribute('aria-current');
    });
    $('g3-miga-sitio').textContent = SITIO[currentTab];
    $('g3-titulo').textContent = currentTab === 'industrial' ? 'Obras industriales' : 'Obras residenciales';
    $('g3-titulo-texto').textContent = currentTab === 'industrial'
      ? 'La galería y el globo 3D de la página Industrial de www.3gvelarias.com. Lo que guardas aquí se publica al momento.'
      : 'La galería de la página Residencial de www.3gvelarias.com. Lo que guardas aquí se publica al momento.';
  }
  function alCambiarPestana() {
    marcarPestana();
    filtroEstado = 'todas';
    actualizarSitio();
  }
  function limpiar() { filtroEstado = 'todas'; }
  function pasaFiltroExtra(p) {
    if (filtroEstado === 'incompletas') return faltantes(p, currentTab).length > 0;
    if (filtroEstado === 'globo') return currentTab === 'industrial' && enGlobo(p);
    if (filtroEstado === 'sin-globo') return currentTab === 'industrial' && !enGlobo(p);
    return true;
  }

  /* ------------------------------------------------------------ estado de las fichas y categorías */
  function botonEstado(valor, texto, n, ayuda) {
    var activo = filtroEstado === valor;
    return '<button type="button" data-estado="' + valor + '" aria-pressed="' + activo + '"' + (activo ? ' aria-current="true"' : '') +
      (ayuda ? ' title="' + esc(ayuda) + '"' : '') + '>' + esc(texto) +
      ' <span class="g3-insignia' + (valor === 'incompletas' && n ? ' r2a-insignia-aviso' : '') + '" aria-label="' + n + (n === 1 ? ' obra' : ' obras') + '">' + n + '</span></button>';
  }
  function pintarEstados(lista) {
    var tipo = currentTab;
    var nInc = 0, nGlobo = 0;
    lista.forEach(function (p) { if (faltantes(p, tipo).length) nInc++; if (enGlobo(p)) nGlobo++; });
    var html = botonEstado('todas', 'Todas', lista.length) +
      botonEstado('incompletas', 'Por completar', nInc, 'Obras con datos de relleno, sin área, sin fotos o sin coordenadas');
    if (tipo === 'industrial') {
      html += botonEstado('globo', 'En el globo 3D', nGlobo, 'Tienen coordenadas y salen en el globo de la página Industrial') +
        botonEstado('sin-globo', 'Fuera del globo', lista.length - nGlobo, 'Sin coordenadas o con el globo apagado');
    }
    $('g3-estados').innerHTML = html;
  }
  function chip(valor, texto, n, encendido) {
    return '<button type="button" class="g3-chip" data-categoria="' + esc(valor) + '" aria-pressed="' + encendido + '">' + esc(texto) +
      ' <span class="g3-insignia" aria-label="' + n + (n === 1 ? ' obra' : ' obras') + '">' + n + '</span></button>';
  }
  function pintarChips(lista) {
    var cuenta = {};
    lista.forEach(function (p) { cuenta[p.category] = (cuenta[p.category] || 0) + 1; });
    var html = chip('', 'Todas', lista.length, !categoryFilter);
    var cats = (CATEGORIES[currentTab] || []).slice();
    Object.keys(cuenta).forEach(function (c) { if (cats.indexOf(c) === -1) cats.push(c); });
    cats.forEach(function (c) { html += chip(c, nombreCategoria(c), cuenta[c] || 0, categoryFilter === c); });
    $('g3-categorias').innerHTML = html;
  }

  /* ------------------------------------------------------------ lista (tabla) y galería */
  function foto(p, clase, conNumero) {
    var src = urlImagen(p.image || (p.images && p.images[0]));
    var n = numFotos(p);
    return '<span class="' + clase + (src ? '' : ' r2a-sin-foto') + '">' + (src ? '<img src="' + esc(src) + '" alt="" loading="lazy" decoding="async">' : '') +
      (conNumero && n > 1 ? '<span class="r2a-foto-n" aria-label="' + n + ' fotos">' + n + '</span>' : '') + '</span>';
  }
  function dato(v) { return vacioTexto(v) ? '<span class="r2a-falta" aria-label="Sin dato">—</span>' : esc(String(v).trim()); }
  function estadoFicha(falta) {
    return falta.length
      ? '<span class="r2a-faltas">' + falta.map(function (f) { return '<span class="g3-estado g3-estado--aviso">' + esc(f) + '</span>'; }).join('') + '</span>'
      : '<span class="r2a-completa">Completa</span>';
  }
  function interruptorGlobo(p) {
    if (!conCoordenadas(p)) return '<span class="r2a-falta r2a-sin-coord" title="Necesita coordenadas para salir en el globo 3D">—<span class="g3-oculto-visual">: sin coordenadas, no puede salir en el globo 3D</span></span>';
    return '<label class="g3-interruptor r2a-globo" title="Mostrar u ocultar en el globo 3D de la página Industrial"><input type="checkbox" role="switch" data-globo="' + p.id + '"' +
      (p.showInGlobe !== false ? ' checked' : '') + ' aria-label="Mostrar «' + esc(p.title) + '» en el globo 3D"><span class="r2a-globo-texto" aria-hidden="true"></span></label>';
  }
  function acciones(p, falta) {
    return '<button type="button" class="g3-btn g3-btn--tonal g3-btn--ch" data-accion="editar" data-id="' + p.id + '">' + ico('editar', 16) + (falta.length ? 'Completar' : 'Editar') +
        '<span class="g3-oculto-visual"> «' + esc(p.title) + '»</span></button>' +
      '<button type="button" class="g3-btn-icono r2a-borrar" data-accion="borrar" data-id="' + p.id + '" aria-label="Eliminar «' + esc(p.title) + '»" title="Eliminar obra">' + ico('borrar', 18) + '</button>';
  }

  function filaTabla(p, tipo) {
    var falta = faltantes(p, tipo);
    var meta = [nombreCategoria(p.category), vacioTexto(p.area) ? '' : String(p.area).trim(), vacioTexto(p.duration) ? '' : String(p.duration).trim()].filter(Boolean).join(' · ');
    return '<tr class="r2a-fila' + (falta.length ? ' r2a-fila--aviso' : '') + '" data-id="' + p.id + '">' +
      '<td class="r2a-c-foto">' + foto(p, 'r2a-miniatura', true) + '</td>' +
      '<td class="r2a-c-obra"><b class="r2a-titulo">' + esc(p.title) + '</b><span class="r2a-lugar">' + ico('ubicacion', 14) + esc(p.location) + '</span>' +
        '<span class="r2a-meta">' + esc(meta) + '</span>' + (falta.length ? '<span class="r2a-ficha-en-obra">' + estadoFicha(falta) + '</span>' : '') + '</td>' +
      '<td class="r2a-c-cat">' + esc(nombreCategoria(p.category)) + '</td>' +
      '<td class="r2a-c-medidas"><span class="r2a-area">' + dato(p.area) + '</span><span class="r2a-dur">' + dato(p.duration) + '</span></td>' +
      (tipo === 'industrial' ? '<td class="r2a-c-globo">' + interruptorGlobo(p) + '</td>' : '') +
      '<td class="r2a-c-ficha">' + estadoFicha(falta) + '</td>' +
      '<td class="r2a-c-acciones">' + acciones(p, falta) + '</td>' +
      '</tr>';
  }
  function tabla(lista, tipo) {
    return '<div class="r2a-tabla' + (tipo === 'industrial' ? ' r2a-tabla--industrial' : '') + '"><table>' +
      '<caption class="g3-oculto-visual">' + esc(plural(lista.length, tipo)) + '. Toca una fila para editarla.</caption>' +
      '<thead><tr><th class="r2a-c-foto" scope="col"><span class="g3-oculto-visual">Foto</span></th><th scope="col">Obra</th><th class="r2a-c-cat" scope="col">Categoría</th>' +
      '<th class="r2a-c-medidas" scope="col">Área y duración</th>' +
      (tipo === 'industrial' ? '<th class="r2a-c-globo" scope="col">Globo 3D</th>' : '') +
      '<th class="r2a-c-ficha" scope="col">Ficha</th><th class="r2a-c-acciones" scope="col"><span class="g3-oculto-visual">Acciones</span></th></tr></thead>' +
      '<tbody>' + lista.map(function (p) { return filaTabla(p, tipo); }).join('') + '</tbody></table></div>';
  }
  function tarjeta(p, tipo) {
    var falta = faltantes(p, tipo);
    var n = numFotos(p);
    var datos = [p.location, vacioTexto(p.area) ? '' : String(p.area).trim(), vacioTexto(p.duration) ? '' : String(p.duration).trim()].filter(Boolean).join(' · ');
    return '<article class="r2a-tarjeta' + (falta.length ? ' r2a-tarjeta--aviso' : '') + '" data-id="' + p.id + '">' +
      '<div class="r2a-tarjeta-foto">' + foto(p, 'r2a-foto-marco') +
        '<span class="r2a-tarjeta-cat">' + esc(nombreCategoria(p.category)) + '</span>' +
        (n > 1 ? '<span class="r2a-tarjeta-n" aria-label="' + n + ' fotos">' + ico('foto', 14) + n + '</span>' : '') +
      '</div>' +
      '<div class="r2a-tarjeta-cuerpo"><b class="r2a-titulo">' + esc(p.title) + '</b><span class="r2a-lugar">' + ico('ubicacion', 14) + esc(datos) + '</span>' +
        (falta.length ? estadoFicha(falta) : '') + '</div>' +
      '<div class="r2a-tarjeta-pie">' + (tipo === 'industrial' ? interruptorGlobo(p) : '') + '<div class="r2a-tarjeta-acciones">' + acciones(p, falta) + '</div></div>' +
      '</article>';
  }

  function alTocarLista(e) {
    if (e.target.closest('label, input')) return; // el interruptor del globo se maneja en «change»
    var b = e.target.closest('[data-accion]');
    if (b) {
      e.stopPropagation();
      var id = Number(b.getAttribute('data-id'));
      if (b.getAttribute('data-accion') === 'editar') editProject(id);
      if (b.getAttribute('data-accion') === 'borrar') deleteProject(id);
      return;
    }
    // Igual que hoy: tocar la obra abre la ficha para editar.
    var fila = e.target.closest('[data-id]');
    if (fila) editProject(Number(fila.getAttribute('data-id')));
  }
  function alCambiarGlobo(e) {
    var sw = e.target.closest('input[data-globo]');
    if (!sw) return;
    // La misma función de siempre (PUT /api/projects/:id con showInGlobe); al terminar solo se recuentan los números.
    Promise.resolve(toggleGlobeVisibility(Number(sw.getAttribute('data-globo')), sw)).then(function () { pintarEstados(listaActual() || []); });
  }

  function esqueleto() {
    var filas = '';
    for (var i = 0; i < 6; i++) {
      filas += '<div class="r2a-esq-fila"><span class="g3-esqueleto r2a-esq-foto"></span><span class="r2a-esq-texto"><span class="g3-esqueleto" style="width:' + (46 + (i * 13) % 30) + '%"></span><span class="g3-esqueleto" style="width:' + (24 + (i * 7) % 18) + '%"></span></span></div>';
    }
    return '<div class="r2a-esqueleto" role="status" aria-label="Cargando las obras…">' + filas + '</div>';
  }

  function pintarObras(lista, filtrada) {
    cargado = true;
    var tipo = currentTab;
    ['residential', 'industrial'].forEach(function (t) {
      var n = (projects[t + 'Projects'] || []).length;
      var ins = $('g3-n-' + t);
      ins.textContent = n;
      ins.setAttribute('aria-label', n + (n === 1 ? ' obra' : ' obras'));
    });
    pintarEstados(lista);
    pintarChips(lista);
    var n = filtrada.length, total = lista.length;
    var hayFiltro = !!(searchTerm || categoryFilter || filtroEstado !== 'todas');
    $('g3-conteo').textContent = !total ? '' : (hayFiltro ? 'Mostrando ' + n + ' de ' + plural(total, tipo) + '.' : plural(total, tipo) + ' publicadas en el sitio.');
    $('g3-limpiar').classList.toggle('hidden', !hayFiltro);
    if (typeof projectCount !== 'undefined' && projectCount) projectCount.textContent = n + ' proyecto' + (n !== 1 ? 's' : '');

    if (!n) {
      grid.innerHTML = '';
      grid.classList.add('hidden');
      emptyState.innerHTML = !total
        ? ico('foto', 40) + '<b>Todavía no hay ' + PLURAL[tipo][1] + '</b><p>Agrega la primera con sus fotos; sale en la galería de la página ' + SITIO[tipo] + ' al guardarla.</p>' +
          '<button type="button" class="g3-btn g3-btn--primario" data-accion="agregar">' + ico('mas', 18) + 'Agregar obra</button>'
        : ico('buscar', 40) + '<b>Ninguna obra coincide con los filtros</b><p>Prueba con otra palabra o categoría, o quita los filtros para ver las ' + total + '.</p>' +
          '<button type="button" class="g3-btn" data-accion="limpiar">' + ico('cerrar', 18) + 'Quitar filtros</button>';
      emptyState.classList.remove('hidden');
      return;
    }
    grid.classList.remove('hidden');
    emptyState.classList.add('hidden');
    grid.className = 'r2a-obras r2a-obras--' + vista;
    grid.innerHTML = vista === 'galeria'
      ? '<div class="r2a-galeria">' + filtrada.map(function (p) { return tarjeta(p, tipo); }).join('') + '</div>'
      : tabla(filtrada, tipo);
    Array.prototype.forEach.call(grid.querySelectorAll('img'), function (img) {
      img.addEventListener('error', function () { img.parentElement.classList.add('r2a-sin-foto'); }, { once: true });
    });
  }

  function errorCarga() {
    grid.innerHTML = '';
    grid.classList.add('hidden');
    // Sin botón «Reintentar»: hoy no hay ninguna petición de reintento (el panel de siempre solo avisa).
    emptyState.innerHTML = ico('error', 40) + '<b>No se pudo cargar el portafolio</b><p>El servidor no contestó. Revisa la conexión y recarga la página para intentar de nuevo.</p>';
    emptyState.classList.remove('hidden');
  }

  /* ------------------------------------------------------------ ficha de obra (el modal de siempre convertido en cajón ancho) */
  function campo(div, id, etiqueta, opciones) {
    var op = opciones || {};
    div.className = 'g3-campo' + (op.ancho ? ' g3-campo--ancho' : '');
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
  function seccion(clase, titulo, id, texto) {
    var s = document.createElement('section');
    s.className = 'r2a-bloque ' + (clase || '');
    var h = document.createElement('h4');
    h.className = 'r2a-bloque-titulo';
    if (id) { h.id = id; s.setAttribute('aria-labelledby', id); }
    h.textContent = titulo;
    s.appendChild(h);
    if (texto) {
      var p = document.createElement('p');
      p.className = 'g3-ayuda r2a-bloque-texto';
      p.textContent = texto;
      s.appendChild(p);
    }
    return s;
  }

  function prepararFicha() {
    modal.className = 'r2a-modal hidden opacity-0';
    modalContent.className = 'r2a-hoja scale-95';
    modalContent.setAttribute('role', 'dialog');
    modalContent.setAttribute('aria-modal', 'true');

    // Cabecera
    var cab = modalContent.firstElementChild;
    var h = cab.querySelector('h3');
    h.id = 'g3-ficha-titulo';
    h.className = '';
    modalContent.setAttribute('aria-labelledby', 'g3-ficha-titulo');
    cab.className = 'g3-cajon-cab r2a-hoja-cab';
    var env = document.createElement('div');
    cab.insertBefore(env, h);
    env.appendChild(h);
    var sub = document.createElement('p');
    sub.id = 'g3-ficha-sitio';
    sub.className = 'r2a-hoja-sub';
    env.appendChild(sub);
    var x = cab.querySelector('button');
    x.className = 'g3-btn-icono';
    x.innerHTML = ico('cerrar', 20);
    x.setAttribute('aria-label', 'Cerrar sin guardar');
    x.title = 'Cerrar sin guardar';

    // Formulario: mismos campos y nombres; solo se acomodan en dos columnas (datos | fotos) y la ubicación abajo.
    form.className = 'r2a-form';
    var fila1 = form.querySelector('[name="title"]').closest('.grid');
    var fila2 = form.querySelector('[name="category"]').closest('.grid');
    var desc = form.querySelector('[name="description"]').parentElement;
    var fotos = gallery.parentElement;
    var pie = form.querySelector('button[type="submit"]').parentElement;

    fila1.className = 'g3-campos r2a-campos-2';
    campo(fila1.children[0], 'g3-f-titulo', 'Título', { ayuda: 'Así sale en la tarjeta del sitio.' });
    campo(fila1.children[1], 'g3-f-ubicacion', 'Ubicación', { ayuda: 'Ciudad y estado, por ejemplo León, Gto.' });
    fila2.className = 'g3-campos r2a-campos-3';
    campo(fila2.children[0], 'g3-f-categoria', 'Categoría');
    campo(fila2.children[1], 'g3-f-area', 'Área (m²)', { placeholder: 'Ej. 120 m²' });
    campo(fila2.children[2], 'g3-f-duracion', 'Duración', { opcional: true, placeholder: 'Ej. 3 semanas' });
    var areaDesc = campo(desc, 'g3-f-descripcion', 'Descripción', { placeholder: 'Qué se hizo, con qué lona y para qué sirve.' });
    areaDesc.rows = 5;

    var datos = seccion('r2a-bloque--datos', 'Datos de la obra', 'g3-datos-titulo');
    datos.appendChild(fila1);
    datos.appendChild(fila2);
    datos.appendChild(desc);

    // Fotos
    var bloqueFotos = seccion('r2a-bloque--fotos', 'Fotos', 'g3-fotos-titulo');
    fotos.className = 'r2a-fotos';
    var etqVieja = fotos.querySelector('label');
    if (etqVieja) etqVieja.remove();
    var ayudaF = document.createElement('p');
    ayudaF.className = 'g3-ayuda';
    ayudaF.id = 'g3-fotos-ayuda';
    ayudaF.textContent = 'La foto «Principal» es la de la tarjeta del sitio. Toca la estrella de otra para hacerla principal o arrastra para cambiar el orden. Al guardar, las fotos nuevas quedan después de las que ya estaban; las de más de 10 MB se comprimen solas.';
    fotos.insertBefore(ayudaF, gallery);
    var notaF = document.createElement('p');
    notaF.className = 'g3-ayuda r2a-fotos-nota hidden';
    notaF.id = 'g3-fotos-nota';
    notaF.textContent = 'Las fotos nuevas no pueden ser la principal todavía. Guarda la obra para poder elegirla como principal.';
    fotos.insertBefore(notaF, gallery.nextSibling);
    gallery.className = 'r2a-galeria-fotos';
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
    bloqueFotos.appendChild(fotos);

    // Solo obras industriales: coordenadas, mapa y globo.
    prepararIndustrial();

    // Pie: Cancelar · Guardar. Eliminar vive solo en la lista, como hoy (no se duplica en la ficha).
    pie.className = 'r2a-pie';
    var nota = document.createElement('p');
    nota.className = 'r2a-pie-nota';
    nota.id = 'g3-pie-nota';
    pie.insertBefore(nota, pie.firstChild);
    var cancelar = pie.querySelector('button[type="button"]');
    cancelar.className = 'g3-btn g3-btn--fantasma';
    var guardar = pie.querySelector('button[type="submit"]');
    guardar.className = 'g3-btn g3-btn--primario';
    guardar.id = 'g3-guardar';

    // Orden: [datos | fotos] → ubicación en el mapa (industrial) → botones.
    var rejilla = document.createElement('div');
    rejilla.className = 'r2a-ficha-rejilla';
    rejilla.appendChild(datos);
    rejilla.appendChild(bloqueFotos);
    [rejilla, industrialFields, pie].forEach(function (n) { form.appendChild(n); });
  }

  function prepararIndustrial() {
    var ind = industrialFields;
    ind.className = 'r2a-bloque r2a-bloque--mapa hidden';
    ind.setAttribute('aria-labelledby', 'g3-mapa-titulo');
    var lat = $('lat-input'), lng = $('lng-input');
    var bloqueCoord = lat.closest('.grid').parentElement;
    var bloqueMapa = $('map').parentElement;
    var bloqueGlobo = $('showInGlobe').closest('label').parentElement;

    var t = document.createElement('h4');
    t.className = 'r2a-bloque-titulo';
    t.id = 'g3-mapa-titulo';
    t.textContent = 'Ubicación en el mapa y globo 3D';
    ind.insertBefore(t, ind.firstChild);

    bloqueCoord.className = 'r2a-coordenadas';
    var etq = bloqueCoord.querySelector('label');
    if (etq) etq.remove();
    var rejilla = lat.parentElement;
    rejilla.className = 'g3-campos r2a-campos-2';
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
    ayuda.className = 'g3-ayuda r2a-ayuda';
    ayuda.id = 'g3-coord-ayuda';
    ayuda.innerHTML = 'Cópialas de <a href="https://www.google.com/maps" target="_blank" rel="noopener">Google Maps</a>: clic derecho sobre la obra y toca los números de arriba (por ejemplo 20.6767, -101.3563). Puedes pegar los dos juntos en Latitud, o el enlace de Google Maps. Sin coordenadas la obra no sale en el globo 3D.';
    // Pegar en Latitud «20.94, -101.42» (dos números con punto decimal, coma y espacio) o un enlace de Google Maps
    // llena los dos campos. Cualquier otra cosa se pega normal, como hoy.
    lat.addEventListener('paste', function (e) {
      var tx = (e.clipboardData || window.clipboardData).getData('text') || '';
      var par = coordenadasPegadas(tx);
      if (!par) return;
      e.preventDefault();
      lat.value = par[0];
      lng.value = par[1];
      updateMapMarker();
    });

    bloqueGlobo.className = 'r2a-globo-ficha';
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
    ag.textContent = 'Solo aparece si la obra tiene coordenadas. También se prende o apaga desde la lista.';
    bloqueGlobo.appendChild(ag);
    bloqueCoord.appendChild(bloqueGlobo);

    bloqueMapa.className = 'r2a-mapa';
    var etqMapa = bloqueMapa.querySelector('label');
    var tm = document.createElement('p');
    tm.className = 'g3-etq';
    tm.textContent = 'Vista previa';
    bloqueMapa.replaceChild(tm, etqMapa);
    $('map').className = '';
    $('map').setAttribute('aria-label', 'Vista previa del mapa con el marcador de la obra');
    var notaMapa = bloqueMapa.querySelector('p.text-xs');
    if (notaMapa) { notaMapa.className = 'g3-ayuda'; notaMapa.textContent = 'El marcador se mueve solo al escribir las coordenadas.'; }

    var dos = document.createElement('div');
    dos.className = 'r2a-mapa-rejilla';
    ind.appendChild(dos);
    dos.appendChild(bloqueCoord);
    dos.appendChild(bloqueMapa);
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
    $('g3-ficha-sitio').textContent = 'Página ' + SITIO[currentTab] + ' de www.3gvelarias.com';
    $('g3-pie-nota').textContent = edicion ? 'Los cambios se ven en el sitio al guardar.' : 'La obra se publica en el sitio al guardar.';
    $('g3-guardar').textContent = edicion ? 'Guardar cambios' : 'Guardar obra';
    var sel = form.querySelector('[name="category"]');
    Array.prototype.forEach.call(sel.options, function (o) { o.textContent = nombreCategoria(o.value); });
    modalContent.classList.toggle('r2a-hoja--industrial', currentTab === 'industrial');
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

  /* ------------------------------------------------------------ fotos de la ficha */
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
      d.className = 'r2a-foto draggable-image' + (esPrincipal ? ' r2a-foto--principal' : '') + (nueva ? ' r2a-foto--nueva' : '');
      d.innerHTML = '<img src="' + esc(src) + '" alt="Foto ' + (i + 1) + (esPrincipal ? ', principal' : '') + (nueva ? ', nueva' : '') + '">' +
        (esPrincipal
          ? '<span class="r2a-foto-principal">Principal</span>'
          : bloqueada
            ? '<button type="button" class="r2a-foto-btn r2a-foto-estrella" data-principal-bloqueada aria-disabled="true" aria-label="Foto ' + (i + 1) + ': guarda la obra para poder elegirla como principal" title="Guarda la obra para poder elegirla como principal">' + ico('estrella', 16) + '</button>'
            : '<button type="button" class="r2a-foto-btn r2a-foto-estrella" data-principal="' + i + '" aria-label="Hacer principal la foto ' + (i + 1) + '" title="Hacer principal">' + ico('estrella', 16) + '</button>') +
        (nueva && guardadas ? '<span class="r2a-foto-nueva">Nueva</span>' : '') +
        '<button type="button" class="r2a-foto-btn r2a-foto-quitar" data-quitar="' + i + '" aria-label="Quitar la foto ' + (i + 1) + '" title="Quitar foto">' + ico('cerrar', 16) + '</button>';
      gallery.appendChild(d);
    });
    var nota = $('g3-fotos-nota');
    if (nota) nota.classList.toggle('hidden', !bloqueadas);
    var add = document.createElement('button');
    add.type = 'button';
    add.className = 'add-image-btn r2a-foto-agregar';
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
    var primera = gallery.querySelector('.r2a-foto-quitar');
    if (primera) primera.focus();
  }

  /* ------------------------------------------------------------ subida de fotos */
  function prepararSubida() {
    var m = $('upload-progress-modal');
    m.className = 'r2a-subida hidden';
    m.innerHTML =
      '<div class="r2a-subida-caja" role="dialog" aria-modal="true" aria-labelledby="g3-subida-titulo">' +
        '<div class="g3-cajon-cab"><h2 id="g3-subida-titulo">Subiendo fotos</h2>' +
          '<button type="button" class="g3-btn-icono" onclick="hideUploadProgress()" aria-label="Cerrar">' + ico('cerrar', 20) + '</button></div>' +
        '<div class="g3-cajon-cuerpo">' +
          '<div id="upload-progress-list" class="g3-lista r2a-subida-lista"></div>' +
          '<div class="r2a-subida-estado"><span id="upload-current-status" aria-live="polite">Preparando…</span><span id="upload-progress-text" class="g3-num">0 de 0</span></div>' +
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
    var pasa = ['Deja de verse en la galería de la página ' + sitio + ' de www.3gvelarias.com.'];
    if (currentTab === 'industrial' && enGlobo(p)) pasa.push('También sale del globo 3D de la página Industrial.');
    pasa.push('Las fotos no se borran de la nube (Cloudinary); solo dejan de estar ligadas a esta obra.');
    pasa.push('No se puede deshacer: para recuperarla habría que capturarla otra vez.');
    return G3.confirmar({
      titulo: '¿Eliminar esta obra?',
      aviso: 'Se quita del portafolio del sitio público.',
      datos: [['Obra', p.title || '—'], ['Página', sitio], ['Categoría', nombreCategoria(p.category)], ['Ubicación', p.location || '—'], ['Fotos', String(numFotos(p))]],
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
      texto: 'Para volver a entrar al administrador vas a tener que iniciar sesión otra vez.',
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
