// ─────────────────────────────────────────
//  Metro — Sistema de Gestión (app.js)
// ─────────────────────────────────────────

const COLORES_DEFAULT = ['#c0392b','#2980b9','#27ae60','#8e44ad','#e67e22','#16a085'];
let lineasCache    = [];
let estacionesCache = [];

// ── UTILIDADES ──────────────────────────────
function colorLinea(linea, idx) {
  if (linea?.color) return linea.color;
  return COLORES_DEFAULT[idx % COLORES_DEFAULT.length];
}

function badgeLinea(nombre, color) {
  return `<span class="badge badge-linea" style="background:${color}">${nombre}</span>`;
}

function mostrarError(contenedor, msg) {
  document.getElementById(contenedor).innerHTML =
    `<div class="error">⚠️ ${msg}</div>`;
}

// ── TABS ────────────────────────────────────
function cambiarTab(nombre, btn) {
  document.querySelectorAll('.seccion').forEach(s => s.classList.remove('activa'));
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.getElementById('seccion-' + nombre).classList.add('activa');
  btn.classList.add('active');
  if (nombre === 'estaciones') cargarEstaciones();
  if (nombre === 'trenes')     cargarTrenes();
  if (nombre === 'cocheras')   cargarCocheras();
}

// ── CONTADOR ANIMADO ─────────────────────────
function actualizarContador(id, nuevoValor) {
  const el = document.getElementById(id);
  if (!el) return;
  const valorAnterior = parseInt(el.textContent) || 0;
  const diferencia    = nuevoValor - valorAnterior;
  if (diferencia === 0) { el.textContent = nuevoValor; return; }

  const duracion = 600, pasos = 20;
  const incremento = diferencia / pasos;
  let actual = valorAnterior, paso = 0;

  el.style.transition = 'color 0.3s';
  el.style.color = diferencia > 0 ? '#27ae60' : '#c0392b';

  const intervalo = setInterval(() => {
    paso++; actual += incremento;
    el.textContent = Math.round(actual);
    if (paso >= pasos) {
      clearInterval(intervalo);
      el.textContent = nuevoValor;
      setTimeout(() => { el.style.color = ''; }, 800);
    }
  }, duracion / pasos);
}

// ── RESUMEN ──────────────────────────────────
async function cargarResumen() {
  try {
    const d = await fetch('/api/resumen').then(r => r.json());
    actualizarContador('s-lineas',     d.lineas);
    actualizarContador('s-estaciones', d.estaciones);
    actualizarContador('s-trenes',     d.trenes);
    actualizarContador('s-cocheras',   d.cocheras);
    actualizarContador('s-accesos',    d.accesos);
  } catch(e) { console.warn('Resumen:', e); }
}

// ════════════════════════════════════════════
//  LÍNEAS
// ════════════════════════════════════════════
async function cargarLineas() {
  try {
    const lineas = await fetch('/api/lineas').then(r => r.json());
    lineasCache = lineas;

    // Cargar estaciones al cache para usarlas en el formulario de ruta
    const ests = await fetch('/api/estaciones').then(r => r.json());
    estacionesCache = ests;

    poblarSelectLineas(lineas);

    const container = document.getElementById('cards-lineas');
    if (!lineas.length) {
      container.innerHTML = '<p class="loading">No hay líneas registradas.</p>';
      return;
    }

    container.innerHTML = '';
    for (let i = 0; i < lineas.length; i++) {
      const l     = lineas[i];
      const color = colorLinea(l, i);
      const card  = document.createElement('div');
      card.className = 'card';
      card.innerHTML = `
        <div class="card-head">
          <div>
            <div class="card-title">
              <span style="width:14px;height:14px;border-radius:50%;background:${color};display:inline-block;flex-shrink:0"></span>
              ${l.nombre}
            </div>
            <div class="card-sub">
              <span id="contador-est-${l.id_linea}">${l.num_estaciones}</span> estaciones ·
              <span id="contador-tren-${l.id_linea}">${l.num_trenes}</span> trenes
            </div>
          </div>
          <span class="badge badge-ok">Activa</span>
        </div>

        <div style="font-size:12px;color:#6b6b67;margin-bottom:8px;font-weight:500">Estaciones en orden</div>
        <ul class="est-list" id="est-linea-${l.id_linea}">
          <li class="est-item" style="color:#aaa">Cargando…</li>
        </ul>

        <!-- Botón para mostrar formulario de ruta dentro de la card -->
        <div style="margin-top:10px;">
          <button class="btn-agregar" style="font-size:12px;padding:4px 10px;"
            onclick="mostrarFormularioRuta(${l.id_linea})">
            + Asignar estación a esta línea
          </button>
        </div>

        <!-- Formulario de ruta oculto dentro de cada card -->
        <div id="form-ruta-${l.id_linea}" style="display:none; margin-top:8px;">
          <select id="ruta-estacion-${l.id_linea}">
            <option value="">-- Seleccionar estación --</option>
          </select>
          <input type="number" id="ruta-orden-${l.id_linea}"
            placeholder="Orden (ej: 3)" min="1" style="width:110px;">
          <button onclick="guardarRuta(${l.id_linea})">Asignar</button>
          <button onclick="cancelarRuta(${l.id_linea})">Cancelar</button>
          <div id="ruta-msg-${l.id_linea}" style="font-size:12px;margin-top:4px;"></div>
        </div>`;

      container.appendChild(card);
      cargarEstacionesLinea(l.id_linea, color);
    }
  } catch(e) {
    mostrarError('cards-lineas', 'No se pudo conectar. (' + e.message + ')');
  }
}

async function cargarEstacionesLinea(id_linea, color) {
  try {
    const ests = await fetch(`/api/estaciones_linea/${id_linea}`).then(r => r.json());
    const ul   = document.getElementById('est-linea-' + id_linea);
    const contEst = document.getElementById(`contador-est-${id_linea}`);
    if (contEst) contEst.textContent = ests.length;

    if (!ests.length) {
      ul.innerHTML = '<li class="est-item" style="color:#aaa">Sin estaciones asignadas</li>';
      return;
    }
    ul.innerHTML = ests.map(e => `
      <li class="est-item">
        <span class="orden" style="background:${color}20;color:${color}">${e.orden}</span>
        ${e.nombre}
        ${e.num_accesos > 0
          ? `<span style="font-size:11px;color:#888">(${e.num_accesos} acceso${e.num_accesos !== 1 ? 's' : ''})</span>`
          : ''}
        ${e.id_cochera ? '<span class="cochera-dot" title="Tiene cochera">●</span>' : ''}
      </li>`).join('');
  } catch(e) { console.warn(e); }
}

// Formulario — Agregar Línea
function mostrarFormularioLinea() {
  document.getElementById('linea-id').value        = '';
  document.getElementById('linea-nombre').value    = '';
  document.getElementById('linea-direccion').value = '';
  document.getElementById('linea-color').value     = '';
  document.getElementById('form-linea').style.display = 'block';
}

function cancelarLinea() {
  document.getElementById('form-linea').style.display = 'none';
}

async function guardarLinea() {
  const id        = document.getElementById('linea-id').value.trim();
  const nombre    = document.getElementById('linea-nombre').value.trim();
  const direccion = document.getElementById('linea-direccion').value.trim();
  const color     = document.getElementById('linea-color').value.trim();

  if (!id)               { alert('Debes ingresar un ID para la línea.'); return; }
  if (!nombre)           { alert('Debes ingresar un nombre para la línea.'); return; }
  if (parseInt(id) <= 0) { alert('El ID debe ser un número positivo.'); return; }

  try {
    const res = await fetch('/api/lineas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id_linea: parseInt(id), nombre, direccion, color })
    });
    const data = await res.json();
    if (data.error) { alert('Error: ' + data.error); return; }
    alert('✅ Línea agregada correctamente. Ahora podés asignarle estaciones desde su card.');
    cancelarLinea();
    cargarLineas();
    cargarResumen();
  } catch(e) { alert('Error de conexión: ' + e.message); }
}

// ════════════════════════════════════════════
//  RUTA — Asignar estacion a linea
// REGLA: una estación nunca puede dejar de pertenecer a una línea
// ════════════════════════════════════════════
function mostrarFormularioRuta(id_linea) {
  // Ocultar otros formularios de ruta abiertos
  document.querySelectorAll('[id^="form-ruta-"]').forEach(f => {
    f.style.display = 'none';
  });

  const form = document.getElementById(`form-ruta-${id_linea}`);
  form.style.display = 'block';

  // Poblar select con todas las estaciones disponibles
  const sel = document.getElementById(`ruta-estacion-${id_linea}`);
  sel.innerHTML = '<option value="">-- Seleccionar estación --</option>';
  estacionesCache.forEach(e => {
    const opt = document.createElement('option');
    opt.value = e.id_estacion;
    opt.textContent = `${e.nombre} (${e.direccion ?? '—'})`;
    sel.appendChild(opt);
  });

  // Limpiar orden y mensaje
  document.getElementById(`ruta-orden-${id_linea}`).value = '';
  document.getElementById(`ruta-msg-${id_linea}`).textContent = '';
}

function cancelarRuta(id_linea) {
  document.getElementById(`form-ruta-${id_linea}`).style.display = 'none';
}

async function guardarRuta(id_linea) {
  const id_estacion = document.getElementById(`ruta-estacion-${id_linea}`).value;
  const orden       = document.getElementById(`ruta-orden-${id_linea}`).value.trim();
  const msgEl       = document.getElementById(`ruta-msg-${id_linea}`);

  if (!id_estacion) { msgEl.style.color='#c0392b'; msgEl.textContent = '⚠️ Debes seleccionar una estación.'; return; }
  if (!orden)       { msgEl.style.color='#c0392b'; msgEl.textContent = '⚠️ Debes ingresar el orden.'; return; }
  if (parseInt(orden) <= 0) { msgEl.style.color='#c0392b'; msgEl.textContent = '⚠️ El orden debe ser positivo.'; return; }

  try {
    const res = await fetch('/api/rutas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id_linea:    parseInt(id_linea),
        id_estacion: parseInt(id_estacion),
        orden:       parseInt(orden)
      })
    });
    const data = await res.json();
    if (data.error) {
      msgEl.style.color = '#c0392b';
      msgEl.textContent = '⚠️ ' + data.error;
      return;
    }
    msgEl.style.color = '#27ae60';
    msgEl.textContent = '✅ ' + data.mensaje;

    // Refrescar la lista de estaciones de esta línea
    const idx   = lineasCache.findIndex(l => l.id_linea == id_linea);
    const color = idx >= 0 ? colorLinea(lineasCache[idx], idx) : '#aaa';
    cargarEstacionesLinea(id_linea, color);
    cargarResumen();

    // Limpiar campos
    document.getElementById(`ruta-estacion-${id_linea}`).value = '';
    document.getElementById(`ruta-orden-${id_linea}`).value    = '';

    setTimeout(() => {
      msgEl.textContent = '';
      cancelarRuta(id_linea);
    }, 2000);
  } catch(e) {
    msgEl.style.color = '#c0392b';
    msgEl.textContent = '⚠️ Error de conexión: ' + e.message;
  }
}

// ════════════════════════════════════════════
//  ESTACIONES
// ════════════════════════════════════════════
async function cargarEstaciones() {
  const tbody = document.getElementById('tbody-estaciones');
  tbody.innerHTML = '<tr><td colspan="6" class="loading">Cargando…</td></tr>';
  try {
    const ests = await fetch('/api/estaciones').then(r => r.json());
    estacionesCache = ests;
    actualizarContador('s-estaciones', ests.length);

    if (!ests.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="loading">Sin registros</td></tr>';
      return;
    }
    tbody.innerHTML = ests.map(e => `
      <tr>
        <td style="font-weight:600">${e.nombre}</td>
        <td style="color:#6b6b67">${e.direccion ?? '—'}</td>
        <td style="text-align:center">${e.andenes ?? '—'}</td>
        <td>${e.lineas
          ? e.lineas.split(', ').map((l, i) => badgeLinea(l, COLORES_DEFAULT[i % COLORES_DEFAULT.length])).join(' ')
          : '—'}</td>
        <td style="text-align:center">${e.num_accesos}</td>
        <td style="text-align:center">${+e.tiene_cochera > 0
          ? '<span class="badge badge-ok">Sí</span>'
          : '<span style="color:#aaa">—</span>'}</td>
      </tr>`).join('');
  } catch(e) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="error">⚠️ ${e.message}</div></td></tr>`;
  }
}

function mostrarFormularioEstacion() {
  document.getElementById('estacion-id').value        = '';
  document.getElementById('estacion-nombre').value    = '';
  document.getElementById('estacion-direccion').value = '';
  document.getElementById('estacion-andenes').value   = '';
  document.getElementById('form-estacion').style.display = 'block';
}

function cancelarEstacion() {
  document.getElementById('form-estacion').style.display = 'none';
}

async function guardarEstacion() {
  const id        = document.getElementById('estacion-id').value.trim();
  const nombre    = document.getElementById('estacion-nombre').value.trim();
  const direccion = document.getElementById('estacion-direccion').value.trim();
  const andenes   = document.getElementById('estacion-andenes').value.trim();

  if (!id)               { alert('Debes ingresar un ID para la estación.'); return; }
  if (!nombre)           { alert('Debes ingresar un nombre para la estación.'); return; }
  if (parseInt(id) <= 0) { alert('El ID debe ser un número positivo.'); return; }

  try {
    const res = await fetch('/api/estaciones', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id_estacion: parseInt(id), nombre, direccion,
        andenes: andenes ? parseInt(andenes) : null
      })
    });
    const data = await res.json();
    if (data.error) { alert('Error: ' + data.error); return; }
    alert('✅ Estación agregada correctamente.');
    cancelarEstacion();
    cargarEstaciones();
    cargarResumen();
  } catch(e) { alert('Error de conexión: ' + e.message); }
}

// ════════════════════════════════════════════
//  TRENES
// ════════════════════════════════════════════
function poblarSelectLineas(lineas) {
  const s1 = document.getElementById('filtro-linea');
  const s2 = document.getElementById('filtro-accesos');
  lineas.forEach((l, i) => {
    const color = colorLinea(l, i);
    [s1, s2].forEach(sel => {
      if (!sel) return;
      const opt = document.createElement('option');
      opt.value = l.id_linea;
      opt.textContent = l.nombre;
      opt.dataset.color = color;
      sel.appendChild(opt);
    });
  });
}

async function mostrarFormularioTren() {
  document.getElementById('tren-id').value = '';
  document.getElementById('form-tren').style.display = 'block';

  const selLinea = document.getElementById('tren-linea');
  selLinea.innerHTML = '<option value="">Sin línea (no asignado)</option>';
  lineasCache.forEach(l => {
    const opt = document.createElement('option');
    opt.value = l.id_linea;
    opt.textContent = `${l.nombre}  (${l.num_estaciones} est. · ${l.num_trenes} trenes)`;
    selLinea.appendChild(opt);
  });

  const selCochera = document.getElementById('tren-cochera');
  selCochera.innerHTML = '<option value="">-- Seleccionar cochera (obligatorio) --</option>';
  try {
    const cochs = await fetch('/api/cocheras').then(r => r.json());
    cochs.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id_cochera;
      opt.textContent = `#${c.id_cochera} — ${c.estacion}  (${c.num_trenes} trenes)`;
      selCochera.appendChild(opt);
    });
  } catch(e) { console.warn('Error cargando cocheras:', e); }
}

function cancelarTren() {
  document.getElementById('form-tren').style.display = 'none';
  document.getElementById('tren-id').value = '';
}

async function guardarTren() {
  const id      = document.getElementById('tren-id').value.trim();
  const linea   = document.getElementById('tren-linea').value;
  const cochera = document.getElementById('tren-cochera').value;

  if (!id)               { alert('Debes ingresar un ID para el tren.'); return; }
  if (parseInt(id) <= 0) { alert('El ID del tren debe ser un número positivo.'); return; }
  if (!cochera)          { alert('La cochera es obligatoria. Un tren no puede quedar sin cochera.'); return; }

  try {
    const res = await fetch('/api/trenes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id_tren:    parseInt(id),
        id_linea:   linea   ? parseInt(linea)   : null,
        id_cochera: parseInt(cochera)
      })
    });
    const data = await res.json();
    if (data.error) { alert('Error: ' + data.error); return; }
    alert('✅ Tren agregado correctamente.');
    cancelarTren();
    cargarTrenes();
    cargarResumen();
    cargarLineas();
  } catch(e) { alert('Error de conexión: ' + e.message); }
}

async function cargarTrenes() {
  const tbody = document.getElementById('tbody-trenes');
  tbody.innerHTML = '<tr><td colspan="4" class="loading">Cargando…</td></tr>';
  const id  = document.getElementById('filtro-linea').value;
  const url = id ? `/api/trenes?id_linea=${id}` : '/api/trenes';

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const trenes = await res.json();

    if (!id) actualizarContador('s-trenes', trenes.length);
    if (id) {
      const contTren = document.getElementById(`contador-tren-${id}`);
      if (contTren) contTren.textContent = trenes.length;
    }

    if (!trenes.length) {
      tbody.innerHTML = '<tr><td colspan="4" class="loading">Sin trenes registrados</td></tr>';
      return;
    }
    tbody.innerHTML = trenes.map(t => {
      const idx   = lineasCache.findIndex(l => l.id_linea == t.id_linea);
      const color = idx >= 0 ? colorLinea(lineasCache[idx], idx) : '#aaa';
      return `<tr>
        <td style="font-family:monospace;font-weight:600">#${t.id_tren}</td>
        <td>${t.nombre_linea
          ? badgeLinea(t.nombre_linea, color)
          : '<span style="color:#aaa">Sin asignar</span>'}</td>
        <td style="font-family:monospace">#${t.id_cochera}</td>
        <td>${t.estacion_cochera ?? '—'}</td>
      </tr>`;
    }).join('');
  } catch(e) {
    tbody.innerHTML = `<tr><td colspan="4"><div class="error">⚠️ ${e.message}</div></td></tr>`;
  }
}

// ════════════════════════════════════════════
//  ACCESOS POR LÍNEA
// ════════════════════════════════════════════
async function cargarAccesos() {
  const id   = document.getElementById('filtro-accesos').value;
  const cont = document.getElementById('lista-accesos');
  if (!id) { cont.innerHTML = ''; return; }

  const linea = lineasCache.find(l => l.id_linea == id);
  const color = linea ? colorLinea(linea, lineasCache.indexOf(linea)) : '#1a3f7a';

  cont.innerHTML = '<div class="loading">Cargando accesos…</div>';
  try {
    const res = await fetch(`/api/accesos_linea/${id}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const grupos = await res.json();

    if (!grupos.length) {
      cont.innerHTML = '<p class="loading">Esta línea no tiene accesos registrados.</p>';
      return;
    }
    cont.innerHTML = grupos.map(g => `
      <div class="acc-card">
        <div class="acc-head">
          <span style="width:12px;height:12px;border-radius:50%;background:${color};display:inline-block"></span>
          ${g.estacion}
          <span class="badge badge-ok" style="margin-left:auto">
            ${g.accesos.length} acceso${g.accesos.length !== 1 ? 's' : ''}
          </span>
        </div>
        ${g.accesos.map(a => `<div class="acc-item"><span>${a}</span></div>`).join('')}
      </div>`).join('');
  } catch(e) {
    cont.innerHTML = `<div class="error">⚠️ ${e.message}</div>`;
  }
}

// ════════════════════════════════════════════
//  COCHERAS
// ════════════════════════════════════════════
async function cargarCocheras() {
  const tbody = document.getElementById('tbody-cocheras');
  tbody.innerHTML = '<tr><td colspan="3" class="loading">Cargando…</td></tr>';
  try {
    const cochs = await fetch('/api/cocheras').then(r => r.json());
    actualizarContador('s-cocheras', cochs.length);
    if (!cochs.length) {
      tbody.innerHTML = '<tr><td colspan="3" class="loading">Sin cocheras</td></tr>';
      return;
    }
    tbody.innerHTML = cochs.map(c => `
      <tr>
        <td style="font-family:monospace;font-weight:600">#${c.id_cochera}</td>
        <td>${c.estacion}</td>
        <td style="text-align:center">${c.num_trenes} trenes</td>
      </tr>`).join('');
  } catch(e) {
    tbody.innerHTML = `<tr><td colspan="3"><div class="error">⚠️ ${e.message}</div></td></tr>`;
  }
}

async function mostrarFormularioCochera() {
  document.getElementById('cochera-id').value = '';
  document.getElementById('form-cochera').style.display = 'block';

  const selEst = document.getElementById('cochera-estacion');
  selEst.innerHTML = '<option value="">-- Seleccionar estación --</option>';
  try {
    const ests = await fetch('/api/estaciones').then(r => r.json());
    ests.forEach(e => {
      const opt = document.createElement('option');
      opt.value = e.id_estacion;
      opt.textContent = `${e.nombre} (${e.direccion ?? '—'})${+e.tiene_cochera > 0 ? ' — ya tiene cochera' : ''}`;
      selEst.appendChild(opt);
    });
  } catch(e) { console.warn('Error cargando estaciones:', e); }
}

function cancelarCochera() {
  document.getElementById('form-cochera').style.display = 'none';
  document.getElementById('cochera-id').value = '';
}

async function guardarCochera() {
  const id          = document.getElementById('cochera-id').value.trim();
  const id_estacion = document.getElementById('cochera-estacion').value;

  if (!id)               { alert('Debes ingresar un ID para la cochera.'); return; }
  if (parseInt(id) <= 0) { alert('El ID debe ser un número positivo.'); return; }
  if (!id_estacion)      { alert('Debes seleccionar una estación para la cochera.'); return; }

  try {
    const res = await fetch('/api/cocheras', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id_cochera: parseInt(id), id_estacion: parseInt(id_estacion) })
    });
    const data = await res.json();
    if (data.error) { alert('Error: ' + data.error); return; }
    alert('✅ Cochera agregada correctamente.');
    cancelarCochera();
    cargarCocheras();
    cargarResumen();
  } catch(e) { alert('Error de conexión: ' + e.message); }
}

// ── INICIO ───────────────────────────────────
async function iniciar() {
  await cargarResumen();
  await cargarLineas();
  // Forzar carga de estaciones y trenes para actualizar contadores
  const ests   = await fetch('/api/estaciones').then(r => r.json());
  const trenes = await fetch('/api/trenes').then(r => r.json());
  actualizarContador('s-estaciones', ests.length);
  actualizarContador('s-trenes',     trenes.length);
}

iniciar();
