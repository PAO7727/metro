//  Metro — Sistema de Gestión (app.js)
const COLORES_DEFAULT = ['#c0392b','#2980b9','#27ae60','#8e44ad','#e67e22','#16a085'];
let lineasCache = [];

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

// ── RESUMEN (stats) ──────────────────────────
async function cargarResumen() {
  try {
    const d = await fetch('/api/resumen').then(r => r.json());
    document.getElementById('s-lineas').textContent     = d.lineas;
    document.getElementById('s-estaciones').textContent = d.estaciones;
    document.getElementById('s-trenes').textContent     = d.trenes;
    document.getElementById('s-cocheras').textContent   = d.cocheras;
    document.getElementById('s-accesos').textContent    = d.accesos;
  } catch(e) { console.warn('Resumen:', e); }
}

// ── LÍNEAS ───────────────────────────────────
async function cargarLineas() {
  try {
    const lineas = await fetch('/api/lineas').then(r => r.json());
    lineasCache = lineas;
    poblarSelectLineas(lineas);

    const container = document.getElementById('cards-lineas');
    if (!lineas.length) {
      container.innerHTML = '<p class="loading">No hay líneas registradas.</p>';
      return;
    }

    container.innerHTML = '';
    for (let i = 0; i < lineas.length; i++) {
      const l = lineas[i];
      const color = colorLinea(l, i);
      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML = `
        <div class="card-head">
          <div>
            <div class="card-title">
              <span style="width:14px;height:14px;border-radius:50%;background:${color};display:inline-block;flex-shrink:0"></span>
              ${l.nombre}
            </div>
            <div class="card-sub">${l.num_estaciones} estaciones · ${l.num_trenes} trenes</div>
          </div>
          <span class="badge badge-ok">Activa</span>
        </div>
        <div style="font-size:12px;color:#6b6b67;margin-bottom:8px;font-weight:500">Estaciones en orden</div>
        <ul class="est-list" id="est-linea-${l.id_linea}">
          <li class="est-item" style="color:#aaa">Cargando…</li>
        </ul>`;
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
    const ul = document.getElementById('est-linea-' + id_linea);
    if (!ests.length) {
      ul.innerHTML = '<li class="est-item" style="color:#aaa">Sin estaciones</li>';
      return;
    }
    ul.innerHTML = ests.map(e => `
      <li class="est-item">
        <span class="orden" style="background:${color}20;color:${color}">${e.orden}</span>
        ${e.nombre}
        ${e.num_accesos > 0 ? `<span style="font-size:11px;color:#888">(${e.num_accesos} acceso${e.num_accesos !== 1 ? 's' : ''})</span>` : ''}
        ${e.id_cochera ? '<span class="cochera-dot" title="Tiene cochera">●</span>' : ''}
      </li>`).join('');
  } catch(e) { console.warn(e); }
}

// ── ESTACIONES ───────────────────────────────
async function cargarEstaciones() {
  const tbody = document.getElementById('tbody-estaciones');
  tbody.innerHTML = '<tr><td colspan="6" class="loading">Cargando…</td></tr>';
  try {
    const ests = await fetch('/api/estaciones').then(r => r.json());
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

// ── FORMULARIO TRENES ────────────────────────

// Muestra el formulario limpio y carga selects
async function mostrarFormularioTren() {
  // Limpiar campos
  document.getElementById("tren-id").value = "";
  document.getElementById("form-tren").style.display = "block";

  // Poblar select de líneas (línea es OPCIONAL según el ejercicio)
  const selLinea = document.getElementById("tren-linea");
  selLinea.innerHTML = '<option value="">Sin línea (no asignado)</option>';
  lineasCache.forEach(l => {
    const opt = document.createElement('option');
    opt.value = l.id_linea;
    opt.textContent = l.nombre;
    selLinea.appendChild(opt);
  });

  // Poblar select de cocheras (OBLIGATORIO según el ejercicio)
  const selCochera = document.getElementById("tren-cochera");
  selCochera.innerHTML = '<option value="">-- Seleccionar cochera (obligatorio) --</option>';
  try {
    const cochs = await fetch('/api/cocheras').then(r => r.json());
    cochs.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id_cochera;
      opt.textContent = `#${c.id_cochera} — ${c.estacion}`;
      selCochera.appendChild(opt);
    });
  } catch(e) {
    console.warn('Error cargando cocheras:', e);
  }
}

function cancelarTren() {
  document.getElementById("form-tren").style.display = "none";
  document.getElementById("tren-id").value = "";
}

async function guardarTren() {
  const id       = document.getElementById("tren-id").value.trim();
  const linea    = document.getElementById("tren-linea").value;
  const cochera  = document.getElementById("tren-cochera").value;

  // Validaciones en el frontend
  if (!id) {
    alert("Debes ingresar un ID para el tren.");
    return;
  }
  if (parseInt(id) <= 0) {
    alert("El ID del tren debe ser un número positivo.");
    return;
  }
  if (!cochera) {
    // REGLA: tren siempre debe tener cochera asignada
    alert("La cochera es obligatoria. Un tren no puede quedar sin cochera.");
    return;
  }

  try {
    const res = await fetch("/api/trenes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id_tren:    parseInt(id),
        id_linea:   linea   ? parseInt(linea)   : null,  // línea es opcional
        id_cochera: parseInt(cochera)                     // cochera es obligatoria
      })
    });

    const data = await res.json();

    if (data.error) {
      alert("Error: " + data.error);
    } else {
      alert("✅ Tren agregado correctamente.");
      cancelarTren();
      cargarTrenes();
      cargarResumen(); // actualizar estadísticas
    }
  } catch(e) {
    alert("Error de conexión: " + e.message);
  }
}

// ── TRENES: listar ───────────────────────────
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

async function cargarTrenes() {
  const tbody = document.getElementById('tbody-trenes');
  tbody.innerHTML = '<tr><td colspan="4" class="loading">Cargando…</td></tr>';

  // Usar query param en vez de path param
  const id = document.getElementById('filtro-linea').value;
  const url = id ? `/api/trenes?id_linea=${id}` : '/api/trenes';

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const trenes = await res.json();

    if (!trenes.length) {
      tbody.innerHTML = '<tr><td colspan="4" class="loading">Sin trenes registrados</td></tr>';
      return;
    }

    tbody.innerHTML = trenes.map(t => {
      const idx = lineasCache.findIndex(l => l.id_linea == t.id_linea);
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

// ── ACCESOS POR LÍNEA ────────────────────────
// REGLA: interesa conocer todos los accesos de cada línea
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

// ── COCHERAS ─────────────────────────────────
async function cargarCocheras() {
  const tbody = document.getElementById('tbody-cocheras');
  tbody.innerHTML = '<tr><td colspan="3" class="loading">Cargando…</td></tr>';
  try {
    const cochs = await fetch('/api/cocheras').then(r => r.json());
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

// ── INICIO ───────────────────────────────────
cargarResumen();
cargarLineas();
