/* ========================================
   docente.js
   Lógica exclusiva de docente.html (sirve tanto a rol 'docente' como 'admin').
   ======================================== */

let pendingAction = null;
let datosGlobalesRamos = [];     
let datosGlobalesPostulaciones = []; 

document.addEventListener('DOMContentLoaded', () => {
  // Si no hay sesión de docente/admin válida, redirige a index.html
  const sesion = Sesion.exigirRol(['profesor', 'admin']);
  if (!sesion) return;

  enterDocentePage(sesion.rol, sesion.nombre);

  // Listener del modal de confirmación
  document.getElementById('confirmActionBtn').addEventListener('click', async () => {
    if (!pendingAction) return;
    const btn = document.getElementById('confirmActionBtn');
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Procesando...';
    btn.disabled = true;
    await pendingAction();
    btn.innerHTML = 'Confirmar';
    btn.disabled = false;
    cerrarModalConfirmacion();
  });

  document.getElementById('confirmModalOverlay').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) cerrarModalConfirmacion();
  });
});

function enterDocentePage(role, nombre) {
  const initials = nombre.split(' ').map(n => n[0]).join('').toUpperCase();
  document.getElementById('docenteHeaderAvatar').textContent = initials;
  document.getElementById('docenteHeaderName').textContent = nombre;

  const displayRole = role === 'admin' ? 'Administrador' : 'Profesor';
  document.getElementById('docenteRoleBadge').textContent = `| Panel ${displayRole}`;
  document.getElementById('docenteWelcomeText').innerHTML =
    `Bienvenido, ${displayRole} <span class="gradient-text">${nombre}</span>`;

  cargarPanelDocente();
}

function logoutDocente() {
  Sesion.limpiar();
  window.location.href = 'index.html';
}

async function cargarPanelDocente() {
  const container = document.getElementById('docenteDashboardContent');
  container.innerHTML = '<p style="color:var(--muted); text-align:center; padding: 3rem;">Cargando asignaturas y postulaciones...</p>';

  try {
    const [resRamos, resPostulaciones] = await Promise.all([
      fetch(`${API_URL}/api/ramos`),
      fetch(`${API_URL}/api/postulaciones`)
    ]);

    if (!resRamos.ok || !resPostulaciones.ok) throw new Error('Error en los datos del servidor');

    const ramosData = await resRamos.json();
    const postulacionesData = await resPostulaciones.json();


    datosGlobalesRamos = ramosData;
    datosGlobalesPostulaciones = postulacionesData;
    
    
    document.getElementById('btnDescargarExcel').style.display = 'inline-flex';

    renderizarPanelDocente(ramosData, postulacionesData);
  } catch (error) {
    console.error(error);
    container.innerHTML = '<p style="color:var(--danger); text-align:center; padding: 3rem;">Error al conectar con el backend. Asegúrate de que FastAPI está corriendo.</p>';
  }
}

function renderizarPanelDocente(ramos, postulaciones) {
  const container = document.getElementById('docenteDashboardContent');
  let html = '';

  ramos.forEach(curso => {
    // FIX: antes se intentaba ordenar "postulantesCurso" antes de declararla (ReferenceError).
    // Ahora se declara primero y se ordena después, dentro del mismo scope del forEach.
    const postulantesCurso = postulaciones.filter(
      p => p.nrc_ramo === curso.codigo_nrc && p.estado !== 'rechazado'
    );
    postulantesCurso.sort((a, b) => b.nota_obtenida - a.nota_obtenida);

    html += `
      <div class="panel-card">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:1.5rem; flex-wrap:wrap; gap:1rem;">
          <div>
            <span class="course-code">${curso.codigo_nrc}</span>
            <h3 style="margin-top:8px; font-size:1.4rem;">${curso.nombre_ramo}</h3>
            <div style="font-size:0.85rem; color:var(--muted); margin-top:4px;">${curso.departamento}</div>
          </div>
          <div style="text-align:right; color:var(--muted); font-size:0.9rem;">
            <i class="fas fa-users"></i> ${postulantesCurso.length} / ${curso.cupos} Solicitudes Activas
          </div>
        </div>
        <div style="background:var(--bg-secondary); border-radius:var(--radius-sm); border:1px solid var(--border);">
          ${postulantesCurso.length > 0
            ? postulantesCurso.map(p => renderizarFilaPostulante(p)).join('')
            : '<div style="padding:1.5rem; text-align:center; color:var(--muted);">No hay postulantes activos para esta asignatura.</div>'
          }
        </div>
      </div>`;
  });

  container.innerHTML = html || '<p style="color:var(--muted); text-align:center; padding:2rem;">No hay asignaturas registradas.</p>';

  container.querySelectorAll('[data-action="cambiar-estado"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const { nrc, rut, estado, nombre } = btn.dataset;
      abrirModalConfirmacion(nrc, rut, estado, nombre);
    });
  });
}

function renderizarFilaPostulante(p) {
  const esAceptado = p.estado === 'aceptado';
  const claseBadge = esAceptado ? 'status-aprobado' : 'status-pendiente';
  const textoEstado = esAceptado ? 'Aprobado' : 'En revisión';

  const botonesAccion = p.estado === 'revision' ? `
    <button class="btn btn-primary"
      style="padding:6px 12px; font-size:0.8rem; background:var(--success);"
      data-action="cambiar-estado"
      data-nrc="${p.nrc_ramo}"
      data-rut="${p.rut_estudiante}"
      data-estado="aceptado"
      data-nombre="${p.nombre_estudiante}">
      <i class="fas fa-check"></i> Aprobar
    </button>
    <button class="btn btn-ghost"
      style="padding:6px 12px; font-size:0.8rem; color:var(--danger); border-color:var(--danger);"
      data-action="cambiar-estado"
      data-nrc="${p.nrc_ramo}"
      data-rut="${p.rut_estudiante}"
      data-estado="rechazado"
      data-nombre="${p.nombre_estudiante}">
      <i class="fas fa-times"></i> Rechazar
    </button>` : '';

  return `
    <div style="display:flex; justify-content:space-between; align-items:center; padding:1.2rem; border-bottom:1px solid var(--border);">
      <div style="display:flex; align-items:center; gap:15px;">
        <div style="width:45px;height:45px;border-radius:12px;background:linear-gradient(135deg,var(--accent),var(--accent-deep));color:white;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:1.2rem;">
          ${p.nombre_estudiante.charAt(0).toUpperCase()}
        </div>
        
        <div style="font-size:0.95rem; font-weight: bold; display: flex; flex-direction: column; gap: 5px;">
          <span style="color:var(--warning);"><i class="fas fa-star"></i> Nota Ramo: ${p.nota_obtenida || 'N/A'}</span>
          <span style="color:var(--accent-light);"><i class="fas fa-chart-line"></i> PPA: ${p.ppa || 'N/A'}</span>
        </div>
        <div>
          <div style="font-weight:700; color:var(--fg); font-size:1.05rem;">${p.nombre_estudiante}</div>
          <div style="font-size:0.85rem; color:var(--muted);">
            <i class="fas fa-id-card" style="margin-right:5px;"></i>RUT: ${p.rut_estudiante}
          </div>
        </div>
      </div>
      <div style="display:flex; align-items:center; gap:12px; flex-wrap:wrap; justify-content:flex-end;">
        <span class="status-badge ${claseBadge}">${textoEstado}</span>
        ${botonesAccion}
      </div>
    </div>`;
}

function abrirModalConfirmacion(nrc, rut, nuevoEstado, nombreEstudiante) {
  const esAprobacion = nuevoEstado === 'aceptado';
  const color = esAprobacion ? 'var(--success)' : 'var(--danger)';
  const accionText = esAprobacion ? 'APROBAR' : 'RECHAZAR';

  document.getElementById('confirmMessage').innerHTML =
    `¿Estás seguro de que deseas <strong style="color:${color};">${accionText}</strong> a <strong>${nombreEstudiante}</strong>?`;

  const btn = document.getElementById('confirmActionBtn');
  btn.style.background = color;
  btn.style.boxShadow = `0 4px 16px ${color}40`;

  pendingAction = () => ejecutarCambioEstado(nrc, rut, nuevoEstado);
  document.getElementById('confirmModalOverlay').classList.add('active');
}

function cerrarModalConfirmacion() {
  document.getElementById('confirmModalOverlay').classList.remove('active');
  pendingAction = null;
}

async function ejecutarCambioEstado(nrc, rut, nuevoEstado) {
  try {
    const response = await fetch(`${API_URL}/api/postulaciones/estado`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nrc_ramo: nrc, rut_estudiante: rut, nuevo_estado: nuevoEstado })
    });
    if (!response.ok) throw new Error('Error al modificar el estado en el backend');
    await cargarPanelDocente();
    showToast(`Postulación ${nuevoEstado === 'aceptado' ? 'aprobada' : 'rechazada'} correctamente.`, nuevoEstado === 'aceptado' ? 'success' : 'info');
  } catch (error) {
    console.error(error);
    showToast('Ocurrió un error al cambiar el estado de la postulación.', 'error');
  }
}

async function ejecutarCambioEstado(nrc, rut, nuevoEstado) {
  try {
    const response = await fetch(`${API_URL}/api/postulaciones/estado`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nrc_ramo: nrc, rut_estudiante: rut, nuevo_estado: nuevoEstado })
    });
    if (!response.ok) throw new Error('Error al modificar el estado en el backend');
    await cargarPanelDocente();
    showToast(`Postulación ${nuevoEstado === 'aceptado' ? 'aprobada' : 'rechazada'} correctamente.`, nuevoEstado === 'aceptado' ? 'success' : 'info');
  } catch (error) {
    console.error(error);
    showToast('Ocurrió un error al cambiar el estado de la postulación.', 'error');
  }
}

// ==============================================================
// PEGA EL CÓDIGO NUEVO JUSTO AQUÍ, AL FINAL DEL ARCHIVO:
// ==============================================================

// --- NUEVA FUNCIÓN PARA EXPORTAR A EXCEL (CSV) ---
function descargarReporteExcel() {
  if (datosGlobalesPostulaciones.length === 0) {
    showToast('No hay postulaciones para descargar.', 'info');
    return;
  }

  // Usamos \uFEFF para que Excel reconozca los acentos (UTF-8 BOM)
  // Usamos punto y coma (;) porque es el separador estándar de Excel en español
  let csvContent = "\uFEFF"; 
  csvContent += "NRC;Asignatura;RUT;Nombre Estudiante;Nota Asignatura;PPA;Estado\n";

  datosGlobalesPostulaciones.forEach(p => {
    // Buscar el nombre del ramo cruzando los datos
    const ramo = datosGlobalesRamos.find(r => r.codigo_nrc === p.nrc_ramo);
    const nombreRamo = ramo ? ramo.nombre_ramo : 'Desconocido';

    // Limpiamos la data para que no rompa el CSV (quitamos posibles punto y comas en los nombres)
    const nrc = p.nrc_ramo || '';
    const asig = nombreRamo.replace(/;/g, ',');
    const rut = p.rut_estudiante || '';
    const nombre = (p.nombre_estudiante || '').replace(/;/g, ',');
    const correo = p.correo || 'Sin correo';
    const nota = p.nota_obtenida || 'N/A';
    const ppa = p.ppa || 'N/A';
    
    // Traducimos el estado para el Excel
    let estadoTexto = 'En revisión';
    if (p.estado === 'aceptado') estadoTexto = 'Aprobado';
    if (p.estado === 'rechazado') estadoTexto = 'Rechazado';

    // Armamos la fila
    csvContent += `${nrc};${asig};${rut};${nombre};${nota};${ppa};${estadoTexto}\n`;
  });

  // Creamos un Blob y forzamos la descarga del archivo .csv (Se abrirá nativamente en Excel)
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  
  // Nombre del archivo con la fecha de hoy
  const fecha = new Date().toISOString().split('T')[0];
  link.setAttribute("href", url);
  link.setAttribute("download", `Postulantes_Ayudantias_${fecha}.csv`);
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}