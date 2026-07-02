/* ========================================
   estudiante.js
   Lógica exclusiva de estudiante.html.
   ======================================== */

// Array para guardar a qué asignaturas postuló en esta sesión
let appliedCourses = [
  { code: 'NRC:12900', status: 'revision' } // Ejemplo de postulación previa
];

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

function enterStudentPage() {
  const iniciales = studentData.name.split(' ').map(n => n[0]).join('').toUpperCase();
  document.getElementById('headerAvatar').textContent = iniciales;
  document.getElementById('headerName').textContent = studentData.name;
  document.getElementById('perfilNombre').textContent = studentData.name;
  document.getElementById('perfilCorreo').textContent = studentData.email;
  document.getElementById('perfilRut').textContent = studentData.rut;

  fetchRamosYRenderizar();
}

async function fetchRamosYRenderizar() {
  try {
    const response = await fetch(`${API_URL}/api/ramos`);
    if (!response.ok) throw new Error("Error al conectar con el servidor");
    coursesData = await response.json();
    renderDashboardCourses();
    renderMyApplications();
  } catch (error) {
    console.error(error);
    showToast('Error al cargar las asignaturas desde el servidor.', 'error');
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
  grid.innerHTML = coursesData.filter(c => {
    const studentGrade = studentData.notas[c.codigo_nrc];
    return studentGrade !== undefined && studentGrade >= 4.0 && c.esta_abierto;
  }).map(c => {
    const isApplied = appliedCourses.some(app => app.code === c.codigo_nrc);

    return `
      <div class="dash-course-card">
        <div class="card-top">
          <span class="course-code">${c.codigo_nrc}</span>
          <span style="font-size:0.8rem; color:var(--muted);">${c.cupos} cupos</span>
        </div>
        <h3>${c.nombre_ramo}</h3>
        <div class="meta"><i class="fas fa-chalkboard-teacher"></i> ${c.id_profesor_encargado || "Por asignar"}</div>
        <div class="meta"><i class="fas fa-star" style="color:var(--warning);"></i> Mi nota: <strong style="color:var(--success)">${studentData.notas[c.codigo_nrc]}</strong></div>
        <button class="btn-postular ${isApplied ? 'applied' : ''}" onclick="${isApplied ? '' : `abrirModalPostulacion('${c.nombre_ramo}', '${c.codigo_nrc}', ${studentData.notas[c.codigo_nrc]})`}">
          ${isApplied ? '<i class="fas fa-check"></i> Ya postulé' : '<i class="fas fa-paper-plane"></i> Postular'}
        </button>
      </div>`;
  }).join('');
}

function withdrawApplication(code, name) {
  appliedCourses = appliedCourses.filter(app => app.code !== code);
  renderDashboardCourses();
  renderMyApplications();
  showToast(`Has retirado tu postulación a ${name} correctamente.`, 'info');
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
        <td>${course ? (course.profesor || 'Por asignar') : 'Desconocido'}</td>
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