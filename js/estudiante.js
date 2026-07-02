/* ========================================
   estudiante.js
   Lógica exclusiva de estudiante.html.
   ======================================== */

// Antes vivía en js/dataStudents.js con datos mock (nombre/notas de prueba).
// Se eliminó ese archivo: ahora este objeto nace vacío y se llena 100% con
// datos reales apenas carga la página (sesión real + /api/estudiantes/{rut}/notas).
const studentData = {
  name: '',
  rut: '',
  email: '',
  notas: {}
};

// Postulaciones reales del estudiante, cargadas desde el backend.
// (Antes había un dato de ejemplo hardcodeado 'NRC:12900' que quedó
// de cuando se maquetó la pantalla antes de tener base de datos real.
// Se eliminó: ahora esto se llena solo con fetchMisPostulaciones().)
let appliedCourses = [];

let coursesData = [];

document.addEventListener('DOMContentLoaded', () => {
  // Si no hay sesión de estudiante válida, redirige a index.html
  const sesion = Sesion.exigirRol(['estudiante']);
  if (!sesion) return;

  // Usamos los datos reales de la sesión en vez de studentData mock
  studentData.name = sesion.nombre;
  studentData.email = sesion.correo;
  if (sesion.rut) studentData.rut = sesion.rut;

  enterStudentPage();
});

async function enterStudentPage() {
  const iniciales = studentData.name.split(' ').map(n => n[0]).join('').toUpperCase();
  document.getElementById('headerAvatar').textContent = iniciales;
  document.getElementById('headerName').textContent = studentData.name;
  document.getElementById('perfilNombre').textContent = studentData.name;
  document.getElementById('perfilCorreo').textContent = studentData.email;
  document.getElementById('perfilRut').textContent = studentData.rut;

  // Primero traemos las notas reales (reemplazan el mock de dataStudents.js),
  // luego los ramos, y solo después las postulaciones, porque
  // renderMyApplications necesita coursesData ya cargado para poder
  // mostrar el nombre de la asignatura.
  await fetchNotasEstudiante();
  await fetchRamosYRenderizar();
  await fetchMisPostulaciones();
}

async function fetchNotasEstudiante() {
  try {
    const response = await fetch(`${API_URL}/api/estudiantes/${encodeURIComponent(studentData.rut)}/notas`);
    if (!response.ok) throw new Error("Error al conectar con el servidor");
    // Pisa el objeto mock de dataStudents.js (ej. {'NRC:12900': 5.5}) con las
    // notas reales indexadas por NRC (ej. {'SG031': 5.5}), que es la clave
    // que realmente usa renderDashboardCourses() para comparar contra c.codigo_nrc.
    studentData.notas = await response.json();
  } catch (error) {
    console.error(error);
    showToast('No se pudieron cargar tus notas desde el servidor.', 'error');
    studentData.notas = {};
  }
}

async function fetchRamosYRenderizar() {
  try {
    const response = await fetch(`${API_URL}/api/ramos`);
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

// Debe ser EXACTAMENTE la misma normalización que usa el backend
// (_normalizar_nombre en main.py): MAYÚSCULAS + espacios colapsados.
function normalizarNombreRamo(nombre) {
  if (!nombre) return nombre;
  return nombre.trim().toUpperCase().replace(/\s+/g, ' ');
}

function renderDashboardCourses() {
  const grid = document.getElementById('dashCoursesGrid');
  grid.innerHTML = coursesData.filter(c => {
    // Se compara por NOMBRE de la asignatura (no por código ni por NRC):
    // el código cambia según el año/periodo en que se dicta el ramo, pero
    // el nombre se mantiene, así que es la clave estable para saber si el
    // estudiante ya lo aprobó en cualquier periodo anterior.
    const studentGrade = studentData.notas[normalizarNombreRamo(c.nombre_ramo)];
    return studentGrade !== undefined && studentGrade >= 4.0 && c.esta_abierto;
  }).map(c => {
    const isApplied = appliedCourses.some(app => app.code === c.codigo_nrc);
    const notaAprobacion = studentData.notas[normalizarNombreRamo(c.nombre_ramo)];

    return `
      <div class="dash-course-card">
        <div class="card-top">
          <span class="course-code">${c.codigo_nrc}</span>
          <span style="font-size:0.8rem; color:var(--muted);">${c.cupos} cupos</span>
        </div>
        <h3>${c.nombre_ramo}</h3>
        <div class="meta"><i class="fas fa-chalkboard-teacher"></i> ${c.id_profesor_encargado || "Por asignar"}</div>
        <div class="meta"><i class="fas fa-star" style="color:var(--warning);"></i> Mi nota: <strong style="color:var(--success)">${notaAprobacion}</strong></div>
        <button class="btn-postular ${isApplied ? 'applied' : ''}" onclick="${isApplied ? '' : `abrirModalPostulacion('${c.nombre_ramo}', '${c.codigo_nrc}', ${notaAprobacion})`}">
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