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
    // Usamos el endpoint específico que creaste en el backend, el cual ya trae
    // la asignatura y el profesor correctos cruzados con la base de datos.
    const response = await fetch(`${API_URL}/api/postulaciones/estudiante?rut_estudiante=${encodeURIComponent(studentData.rut)}`);
    if (!response.ok) throw new Error("Error al conectar con el servidor");
    
    const data = await response.json();

    // Guardamos la data estructurada en la variable global que usan ambas vistas
    appliedCourses = data.postulaciones.map(p => ({
      code: p.nrc, 
      status: p.estado,
      name: p.asignatura,
      prof: p.profesor
    }));

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
  if (!grid) return;

  // 1. Extraemos todos los ramos aprobados del historial del estudiante (nota >= 4.0)
  const ramosAprobados = Object.keys(studentData.notas).filter(nombre => {
    return studentData.notas[nombre] >= 4.0;
  });

  // Si el estudiante no registra ningún ramo aprobado en el sistema
  if (ramosAprobados.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 3rem; background: var(--card); border-radius: var(--radius); border: 1px solid var(--border);">
        <i class="fas fa-info-circle" style="font-size: 2rem; color: var(--muted); margin-bottom: 1rem;"></i>
        <p style="color:var(--muted); font-size: 1.1rem;">No registras asignaturas aprobadas en el sistema para poder postular.</p>
      </div>`;
    return;
  }

  // 2. Renderizamos las tarjetas basándonos en sus ramos aprobados
  grid.innerHTML = ramosAprobados.map(nombreRamoNormalizado => {
    const notaAprobacion = studentData.notas[nombreRamoNormalizado];
    
    // Cruzamos los datos: Buscamos si el administrador creó una vacante para este ramo específico
    const configuracionAdmin = coursesData.find(c => normalizarNombreRamo(c.nombre_ramo) === nombreRamoNormalizado);

    // Valores por defecto para ramos que el admin NO ha configurado/abierto todavía
    let nrc = "Por definir";
    let docente = "Por asignar";
    let esPostulable = false;
    let isApplied = false;
    let botonTexto = '<i class="fas fa-eye-slash"></i> No habilitada por Admin';
    let botonClase = 'disabled';
    let estadoLabel = '<span style="font-size:0.8rem; color:var(--muted); font-weight:600;"><i class="fas fa-ban"></i> Sin convocatoria</span>';

    // Si el administrador sí propuso la ayudantía en el sistema
    if (configuracionAdmin) {
      nrc = configuracionAdmin.codigo_nrc;
      docente = configuracionAdmin.id_profesor_encargado || "Por asignar";
      isApplied = appliedCourses.some(app => app.code === configuracionAdmin.codigo_nrc);
      
      if (configuracionAdmin.esta_abierto) {
        estadoLabel = `<span class="course-slots"><i class="fas fa-user-friends" style="margin-right:4px;"></i>${configuracionAdmin.cupos} cupos</span>`;
        if (isApplied) {
          esPostulable = false;
          botonTexto = '<i class="fas fa-check-circle"></i> Postulación enviada';
          botonClase = 'applied';
        } else {
          esPostulable = true;
          botonTexto = '<i class="fas fa-paper-plane"></i> Postular';
          botonClase = '';
        }
      } else {
        estadoLabel = '<span style="font-size:0.8rem; color:var(--danger); font-weight:600;">Cerrada</span>';
        botonTexto = '<i class="fas fa-lock"></i> Convocatoria cerrada';
        botonClase = 'disabled';
        esPostulable = false;
      }
    }

    // Retornamos el diseño manteniendo la estética responsiva y atmosférica de la app
    return `
      <div class="dash-course-card" style="${!configuracionAdmin ? 'opacity: 0.7; border-style: dashed; background: rgba(17, 45, 72, 0.4);' : ''}">
        <div class="card-top">
          <span class="course-code" title="Código NRC">NRC: ${nrc}</span>
          ${estadoLabel}
        </div>
        
        <h3 style="margin-bottom: 1.2rem; line-height: 1.3; color: ${!configuracionAdmin ? 'var(--fg-secondary)' : 'var(--fg)'};">${nombreRamoNormalizado}</h3>
        
        <div style="display: flex; flex-direction: column; gap: 10px; margin-bottom: 1.5rem;">
          <div class="meta" title="Docente a cargo">
            <i class="fas fa-chalkboard-teacher" style="width: 20px; text-align: center;"></i> 
            <span>Docente: <strong>${docente}</strong></span>
          </div>
          <div class="meta" title="Horario de la ayudantía">
            <i class="fas fa-clock" style="width: 20px; text-align: center;"></i> 
            <span>Horario: <strong>${configuracionAdmin ? 'A convenir' : 'No disponible'}</strong></span>
          </div>
          <div class="meta" title="Requisitos de postulación">
            <i class="fas fa-clipboard-list" style="width: 20px; text-align: center;"></i> 
            <span>Requisito: <strong>Nota ≥ 4.0</strong></span>
          </div>
          <div class="meta" title="Tu calificación histórica en el ramo">
            <i class="fas fa-star" style="color:var(--warning); width: 20px; text-align: center;"></i> 
            <span>Tu nota: <strong style="color:var(--success)">${notaAprobacion}</strong></span>
          </div>
        </div>

        <button 
          class="btn-postular ${botonClase}" 
          ${!esPostulable ? 'disabled' : `onclick="abrirModalPostulacion('${nombreRamoNormalizado}', '${nrc}', ${notaAprobacion})"`}
          style="${!esPostulable ? 'cursor: not-allowed; opacity: 0.6; background: var(--bg-secondary); color: var(--muted); border-color: var(--border);' : ''}"
        >
          ${botonTexto}
        </button>
      </div>`;
  }).join('');
}

// 3. Mejoramos la función de retirar para que actualice la vista al instante
/* =========================================================
   LÓGICA DEL MODAL DE RETIRO DE POSTULACIÓN
========================================================= */
let retiroPendiente = null;

function abrirModalRetiro(code, name) {
  document.getElementById('confirmMessageEstudiante').innerHTML = `¿Estás seguro de que deseas retirar tu postulación a <strong style="color:var(--fg);">${name}</strong>?`;
  document.getElementById('confirmModalEstudiante').classList.add('active');
  retiroPendiente = { code, name };
}

function cerrarModalRetiro() {
  document.getElementById('confirmModalEstudiante').classList.remove('active');
  retiroPendiente = null;
}

// Permitir cerrar el modal al hacer clic afuera
document.getElementById('confirmModalEstudiante')?.addEventListener('click', (e) => {
  if (e.target === e.currentTarget) cerrarModalRetiro();
});

// Evento al presionar el botón rojo de "Retirar" en el modal
document.getElementById('confirmRetiroBtn')?.addEventListener('click', async () => {
  if (!retiroPendiente) return;
  
  const { code, name } = retiroPendiente;
  const btn = document.getElementById('confirmRetiroBtn');
  const textoOriginal = btn.innerHTML;
  
  // Efecto de carga en el botón
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Procesando...';
  btn.disabled = true;

  try {
    const url = `${API_URL}/api/postulaciones?nrc_ramo=${encodeURIComponent(code)}&rut_estudiante=${encodeURIComponent(studentData.rut)}`;
    const response = await fetch(url, { method: 'DELETE' });
    
    if (!response.ok) throw new Error("No se pudo retirar la postulación");

    // Quitar del array local y recargar las interfaces
    appliedCourses = appliedCourses.filter(app => app.code !== code);
    renderDashboardCourses();
    renderMyApplications();
    
    showToast(`Postulación a ${name} retirada exitosamente.`, 'success');
  } catch (error) {
    console.error(error);
    showToast('Error de conexión con el servidor. Intenta de nuevo.', 'error');
  } finally {
    // Restaurar estado del botón y cerrar modal
    btn.innerHTML = textoOriginal;
    btn.disabled = false;
    cerrarModalRetiro();
  }
});

function renderMyApplications() {
  const tbody = document.getElementById('tablePostulaciones');
  
  // Como ahora la tabla mostrará todo perfecto, ocultamos las tarjetas duplicadas de arriba
  const contenedorTarjetas = document.getElementById("misPostulacionesContainer");
  if (contenedorTarjetas) contenedorTarjetas.style.display = 'none';

  if (appliedCourses.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--muted); padding:2rem;">No tienes postulaciones activas.</td></tr>`;
    return;
  }

  tbody.innerHTML = appliedCourses.map(app => {
    const statusConfig = {
      'revision': { text: 'En revisión', class: 'revision', icon: 'fa-clock' },
      'aceptado': { text: 'Aprobado', class: 'aceptado', icon: 'fa-check-circle' },
      'rechazado': { text: 'Rechazado', class: 'rechazado', icon: 'fa-times-circle' }
    };
    
    const s = statusConfig[app.status] || statusConfig['revision'];
    const canWithdraw = app.status === 'revision';

    return `
      <tr>
        <td style="font-weight:700; color:var(--accent);">${app.code}</td>
        <td style="font-weight:600;">${app.name}</td>
        <td>${app.prof}</td>
        <td><span class="status-badge ${s.class}"><i class="fas ${s.icon}"></i> ${s.text}</span></td>
        <td>
          ${canWithdraw ? `
            <button class="btn btn-ghost" style="padding: 6px 12px; font-size: 0.8rem; color: var(--danger); border-color: var(--danger);" onclick="abrirModalRetiro('${app.code}', '${app.name}')">
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

async function cargarMisPostulaciones() {
  return;
}

function formatearEstado(estado) {
  const mapa = { pendiente: "Pendiente", aceptado: "Aceptado", rechazado: "Rechazado" };
  return mapa[estado] || estado;
}

document.addEventListener("DOMContentLoaded", cargarMisPostulaciones);