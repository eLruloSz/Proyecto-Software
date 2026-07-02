/* ========================================
   estudiante.js
   Lógica exclusiva de estudiante.html.
   ======================================== */

// Postulaciones reales del estudiante, cargadas desde el backend.
// (Antes había un dato de ejemplo hardcodeado 'NRC:12900' que quedó
// de cuando se maquetó la pantalla antes de tener base de datos real.
// Se eliminó: ahora esto se llena solo con fetchMisPostulaciones().)
let appliedCourses = [];

let coursesData = [];
let studentData = { notas: {} };
document.addEventListener('DOMContentLoaded', () => {
  // Si no hay sesión de estudiante válida, redirige a index.html
  const sesion = Sesion.exigirRol(['estudiante']);
  if (!sesion) return;
  studentData.name = sesion.nombre;
  studentData.rut = sesion.rut;
  studentData.email = sesion.correo;
  studentData.ppa = (sesion.ppa !== undefined && sesion.ppa !== null) ? sesion.ppa : 'N/A';

  enterStudentPage();
});

async function enterStudentPage() {
  const iniciales = studentData.name.split(' ').map(n => n[0]).join('').toUpperCase();
  document.getElementById('headerAvatar').textContent = iniciales;
  document.getElementById('headerName').textContent = studentData.name;
  document.getElementById('perfilNombre').textContent = studentData.name;
  document.getElementById('perfilCorreo').textContent = studentData.email;
  document.getElementById('perfilRut').textContent = studentData.rut;
  document.getElementById('perfilPPA').textContent = studentData.ppa;

  // Primero traemos los ramos, y solo después las postulaciones,
  // porque renderMyApplications necesita coursesData ya cargado
  // para poder mostrar el nombre de la asignatura.
  await fetchRamosYRenderizar();
  await fetchMisPostulaciones();
}

async function fetchRamosYRenderizar() {
  try {
    const response = await fetch(`${API_URL}/api/estudiante/${encodeURIComponent(studentData.rut)}/ramos-disponibles`);
    if (!response.ok) throw new Error("Error al conectar con el servidor");
    coursesData = await response.json();
    renderDashboardCourses();
  } catch (error) {
    console.error(error);
    showToast('Error al cargar las asignaturas desde el servidor.', 'error');
  }
}

async function fetchMisPostulaciones() {
  try {
    const response = await fetch(`${API_URL}/api/postulaciones`);
    if (!response.ok) throw new Error("Error al conectar con el servidor");
    const todas = await response.json();

    // El backend devuelve TODAS las postulaciones (las necesita el panel docente);
    // acá nos quedamos solo con las del estudiante logueado.
    appliedCourses = todas
      .filter(p => p.rut_estudiante === studentData.rut)
      .map(p => ({ code: p.nrc_ramo, status: p.estado }));

    renderDashboardCourses();
    renderMyApplications();
  } catch (error) {
    console.error(error);
    showToast('Error al cargar tus postulaciones desde el servidor.', 'error');
  }
}

function logout() {
  Sesion.limpiar();
  window.location.href = 'index.html';
}

function switchView(viewId, tabElement) {
  document.querySelectorAll('.view-section').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.app-tab').forEach(t => t.classList.remove('active'));

  document.getElementById(`view-${viewId}`).classList.add('active');
  tabElement.classList.add('active');
}

function renderDashboardCourses() {
  const grid = document.getElementById('dashCoursesGrid');
  
  // Solo filtramos para que muestre los ramos que tienen estado "abierto"
  const ramosValidos = coursesData.filter(c => c.esta_abierto);

  if (ramosValidos.length === 0) {
    grid.innerHTML = '<p style="color:var(--muted); text-align:center; grid-column: 1 / -1;">No hay ramos disponibles para postular.</p>';
    return;
  }

  grid.innerHTML = ramosValidos.map(c => {
    const isApplied = appliedCourses.some(app => app.code === c.codigo_nrc);

    return `
      <div class="dash-course-card">
        <div class="card-top">
          <span class="course-code">${c.codigo_nrc}</span>
          <span style="font-size:0.8rem; color:var(--muted);">${c.cupos} cupos</span>
        </div>
        <h3>${c.nombre_ramo}</h3>
        <div class="meta"><i class="fas fa-chalkboard-teacher"></i> ${c.id_profesor_encargado || "Por asignar"}</div>
        <div class="meta"><i class="fas fa-check-circle" style="color:var(--success);"></i> Requisito académico cumplido</div>
        
        <button class="btn-postular ${isApplied ? 'applied' : ''}" onclick="${isApplied ? '' : `abrirModalPostulacion('${c.nombre_ramo}', '${c.codigo_nrc}', 'Aprobado')`}">
          ${isApplied ? '<i class="fas fa-check"></i> Ya postulé' : '<i class="fas fa-paper-plane"></i> Postular'}
        </button>
      </div>`;
  }).join('');
}

async function withdrawApplication(code, name) {
  try {
    const url = `${API_URL}/api/postulaciones?nrc_ramo=${encodeURIComponent(code)}&rut_estudiante=${encodeURIComponent(studentData.rut)}`;
    const response = await fetch(url, { method: 'DELETE' });
    if (!response.ok) throw new Error("No se pudo retirar la postulación en el servidor");

    appliedCourses = appliedCourses.filter(app => app.code !== code);
    renderDashboardCourses();
    renderMyApplications();
    showToast(`Has retirado tu postulación a ${name} correctamente.`, 'info');
  } catch (error) {
    console.error(error);
    showToast('No se pudo retirar la postulación. Intenta de nuevo.', 'error');
  }
}

function renderMyApplications() {
  const tbody = document.getElementById('tablePostulaciones');
  if (appliedCourses.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--muted); padding:2rem;">No tienes postulaciones activas.</td></tr>`;
    return;
  }

  tbody.innerHTML = appliedCourses.map(app => {
    const course = coursesData.find(c => c.codigo_nrc === app.code);
    const statusConfig = {
      'revision': { text: 'En revisión', class: 'revision', icon: 'fa-clock' },
      'aceptado': { text: 'Aprobado', class: 'aceptado', icon: 'fa-check-circle' },
      'rechazado': { text: 'Rechazado', class: 'rechazado', icon: 'fa-times-circle' }
    };
    const s = statusConfig[app.status];
    const canWithdraw = app.status === 'revision';

    return `
      <tr>
        <td style="font-weight:700; color:var(--accent);">${app.code}</td>
        <td>${course ? course.nombre_ramo : 'Desconocida'}</td>
        <td>${course ? (course.id_profesor_encargado || 'Por asignar') : 'Desconocido'}</td>
        <td><span class="status-badge ${s.class}"><i class="fas ${s.icon}"></i> ${s.text}</span></td>
        <td>
          ${canWithdraw ? `
            <button class="btn btn-ghost" style="padding: 6px 12px; font-size: 0.8rem; color: var(--danger); border-color: var(--danger);" onclick="withdrawApplication('${app.code}', '${course ? course.nombre_ramo : ''}')">
              <i class="fas fa-times"></i> Retirar
            </button>
          ` : '<span style="color:var(--muted); font-size:0.8rem;">--</span>'}
        </td>
      </tr>`;
  }).join('');
}

/* ---------- Modal de postulación ---------- */

function abrirModalPostulacion(nombreAsignatura, nrc, notaObtenida) {
  document.getElementById('postulacionAsignatura').value = nombreAsignatura;
  document.getElementById('postulacionNrc').value = nrc;
  document.getElementById('postulacionNota').value = notaObtenida;
  document.getElementById('modalPostulacion').style.display = 'flex';
}

document.addEventListener('DOMContentLoaded', () => {
  const cerrarModalBtn = document.getElementById('cerrarModalBtn');
  const modalPostulacion = document.getElementById('modalPostulacion');
  const formPostulacion = document.getElementById('formPostulacion');

  cerrarModalBtn.onclick = () => { modalPostulacion.style.display = 'none'; };

  formPostulacion.addEventListener('submit', async (e) => {
    e.preventDefault();

    const nrcRamo = document.getElementById('postulacionNrc').value;
    const nombreRamo = document.getElementById('postulacionAsignatura').value;

    const payload = {
      nrc_ramo: nrcRamo,
      rut_estudiante: studentData.rut,
      nombre_estudiante: studentData.name,
      nota_obtenida: parseFloat(document.getElementById('postulacionNota').value)
    };

    try {
      const response = await fetch(`${API_URL}/api/postular`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) throw new Error("Error en el servidor al enviar la postulación");

      const ramosResponse = await fetch(`${API_URL}/api/ramos`);
      coursesData = await ramosResponse.json();

      appliedCourses.push({ code: nrcRamo, status: 'revision' });

      renderDashboardCourses();
      renderMyApplications();

      modalPostulacion.style.display = 'none';
      formPostulacion.reset();
      showToast(`Postulación a ${nombreRamo} enviada exitosamente.`, 'success');

    } catch (error) {
      console.error(error);
      showToast('Hubo un problema al enviar tu postulación.', 'error');
    }
  });
});