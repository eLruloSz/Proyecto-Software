// Array para guardar a qué asignaturas postuló en esta sesión
let appliedCourses = [
  { code: 'NRC:12900', status: 'revision' } // Ejemplo de postulación previa
];
       /* ========================================
       LANDING PAGE (Ahora conectada al Backend)
    ======================================== */
    
    // Variable global para guardar los ramos que vienen de la BD
    let coursesData = []; 

    async function fetchAndRenderCourses() {
      const grid = document.getElementById('coursesGrid');
      grid.innerHTML = '<p style="color:var(--muted); text-align:center; grid-column: 1 / -1;">Cargando asignaturas...</p>';

      try {
        // Hacer la petición a tu backend de FastAPI
        const response = await fetch('http://127.0.0.1:8000/api/ramos');
        if (!response.ok) throw new Error("Error al conectar con el servidor");
        
        coursesData = await response.json();
        renderCourses(); // Pintar los datos en el HTML
      } catch (error) {
        console.error(error);
        grid.innerHTML = '<p style="color:var(--danger); text-align:center; grid-column: 1 / -1;">Error al cargar las asignaturas desde el servidor.</p>';
      }
    }

  function renderCourses() {
  const grid = document.getElementById('coursesGrid');
  if (coursesData.length === 0) {
    grid.innerHTML = '<p style="color:var(--muted); text-align:center; grid-column: 1 / -1;">No hay asignaturas disponibles en este momento.</p>';
    return;
  }

  grid.innerHTML = coursesData.map(c => `
    <div class="course-card" onclick="handleCourseClick('${c.codigo_nrc}', ${c.esta_abierto})">
      <div class="course-header">
        <span class="course-code">${c.codigo_nrc}</span>
        ${!c.esta_abierto ? '<span style="font-size:0.8rem;color:var(--danger);font-weight:600;">Cerrada</span>' : `<span class="course-slots"><i class="fas fa-user-friends" style="margin-right:4px;"></i>${c.cupos} cupos</span>`}
      </div>
      <h3>${c.nombre_ramo}</h3>
      <div class="course-prof"><i class="fas fa-chalkboard-teacher"></i>${c.id_profesor_encargado || "Por asignar"}</div>
      <div class="course-footer">
        <span class="course-dept">${c.departamento}</span>
        <span class="course-applicants"><i class="fas fa-users"></i> ${c.postulantes || 0} postulantes</span>
      </div>
    </div>
  `).join('');
}

    function handleCourseClick(code, open) {
      if (!open) showToast('Esta asignatura no acepta postulaciones.', 'error');
      else { showToast(`Debes iniciar sesión para postular a ${code}.`, 'info'); setTimeout(() => openModal('login'), 1200); }
    }

    // Ejecutar la función al cargar la página
    fetchAndRenderCourses();

    /* ========================================
       MODALES LOGIN (Google Workspace Mock)
    ======================================== */
    let loginAttemptRole = null;
    let extractedUserName = ""; // Guarda el nombre extraído del correo

    function openModal(type) {
      document.getElementById('modalTitle').textContent = 'Autenticación UCN';
      document.getElementById('modalBody').innerHTML = buildRBACLogin();
      document.getElementById('modalOverlay').classList.add('active');
      document.body.style.overflow = 'hidden';
    }

    function closeModal() { document.getElementById('modalOverlay').classList.remove('active'); document.body.style.overflow = ''; }
    function closeGoogleMock() { document.getElementById('googleMockOverlay').classList.remove('active'); document.body.style.overflow = ''; }

    document.getElementById('modalOverlay').addEventListener('click', (e) => { if (e.target === e.currentTarget) closeModal(); });
    document.getElementById('googleMockOverlay').addEventListener('click', (e) => { if (e.target === e.currentTarget) closeGoogleMock(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeModal(); closeGoogleMock(); } });

    function buildRBACLogin() {
      return `
        <p style="color: var(--fg-secondary); margin-bottom: 1.5rem; font-size: 0.95rem;">Selecciona cómo deseas ingresar.</p>
        <div style="display: flex; flex-direction: column; gap: 12px;">
          <button class="btn btn-ghost" style="justify-content: flex-start; padding: 16px 20px; border-radius: var(--radius);" onclick="initGoogleMock('estudiante')">
            <i class="fas fa-user-graduate" style="font-size: 1.2rem; color: var(--success); width: 24px;"></i>
            <div style="text-align: left;"><div style="font-weight: 700; color: var(--fg);">Acceso Estudiantes</div><div style="font-size: 0.8rem; color: var(--muted); font-weight: 400;">Dominio @alumnos.ucn.cl</div></div>
          </button>
          <button class="btn btn-ghost" style="justify-content: flex-start; padding: 16px 20px; border-radius: var(--radius);" onclick="initGoogleMock('docente')">
            <i class="fas fa-chalkboard-teacher" style="font-size: 1.2rem; color: var(--accent-light); width: 24px;"></i>
            <div style="text-align: left;"><div style="font-weight: 700; color: var(--fg);">Acceso Docentes</div><div style="font-size: 0.8rem; color: var(--muted); font-weight: 400;">Dominio @ce.ucn.cl</div></div>
          </button>
          <button class="btn btn-ghost" style="justify-content: flex-start; padding: 16px 20px; border-radius: var(--radius);" onclick="initGoogleMock('admin')">
            <i class="fas fa-shield-alt" style="font-size: 1.2rem; color: var(--warning); width: 24px;"></i>
            <div style="text-align: left;"><div style="font-weight: 700; color: var(--fg);">Acceso Administradores</div><div style="font-size: 0.8rem; color: var(--muted); font-weight: 400;">Dominio @ucn.cl</div></div>
          </button>
        </div>`;
    }

    function initGoogleMock(role) {
      loginAttemptRole = role; closeModal();
      setTimeout(() => {
        const domainMap = { estudiante: '@alumnos.ucn.cl', docente: '@ce.ucn.cl', admin: '@ucn.cl' };
        document.getElementById('googleMockBody').innerHTML = `
          <div style="margin-bottom: 2rem;">
            <img src="https://www.ucn.cl/content/uploads/2023/05/ucn-escudo-full-color.png" alt="UCN" style="height: 50px; margin-bottom: 1rem;">
            <p style="font-size: 1.1rem; font-weight: 600; color: var(--fg);">Iniciar sesión con Google Workspace</p>
            <p style="font-size: 0.9rem; color: var(--muted); margin-top: 5px;">Continuar como <strong style="color:var(--accent-light); text-transform:capitalize;">${role === 'docente' ? 'Docente' : role}</strong></p>
          </div>
          <div class="form-group" style="text-align: left;">
            <label for="mockEmail">Correo electrónico</label>
            <input type="email" id="mockEmail" class="form-input" placeholder="usuario${domainMap[role]}" oninput="handleMockEmailInput(this.value, '${role}')">
            <small id="mockEmailError" style="color: var(--danger); display: none; margin-top: 5px;">
              <i class="fas fa-exclamation-triangle"></i> Debes usar un correo terminado en ${domainMap[role]}
            </small>
          </div>
          <div class="form-group" style="text-align: left; margin-top: 1.5rem;">
            <label for="mockPass">Contraseña</label>
            <input type="password" id="mockPass" class="form-input" placeholder="Ingresa tu contraseña institucional">
          </div>
          <button class="btn btn-primary" style="width: 100%; justify-content: center; margin-top: 1.5rem;" onclick="handleMockLogin()">Acceder</button>
          <p style="font-size: 0.8rem; color: var(--muted); margin-top: 1rem;">* Simulación Frontend. Se conectará a API Google Workspace posteriormente.</p>
        `;
        document.getElementById('googleMockOverlay').classList.add('active'); 
        document.body.style.overflow = 'hidden';
      }, 300);
    }

/* ========================================
       LÓGICA DE AUTENTICACIÓN (MOCK RBAC)
    ======================================== */
   function handleMockEmailInput(email, role) {
      const errorDiv = document.getElementById('mockEmailError');
      const domainMap = { estudiante: '@alumnos.ucn.cl', docente: '@ce.ucn.cl', admin: '@ucn.cl' };
      const requiredDomain = domainMap[role];

      if (!email.endsWith(requiredDomain) && email.length > 5) {
        errorDiv.style.display = 'block';
      } else {
        errorDiv.style.display = 'none';
      }

      if (email.includes('@')) {
        const userPart = email.split('@')[0]; 
        extractedUserName = userPart.split('.').map(name => name.charAt(0).toUpperCase() + name.slice(1)).join(' ');
      } else {
        extractedUserName = "";
      }
    }

 async function handleMockLogin() {
  const email = document.getElementById('mockEmail').value.trim();
  const pass = document.getElementById('mockPass').value.trim();
  const errorDiv = document.getElementById('mockEmailError');

  // Mapeo de dominios para validación obligatoria
  const domainMap = { estudiante: '@alumnos.ucn.cl', docente: '@ce.ucn.cl', admin: '@ucn.cl' };
  const requiredDomain = domainMap[loginAttemptRole];

  if (!email) { showToast('Debes ingresar tu correo.', 'error'); return; }
  
  // VALIDACIÓN ESTRICTA: Obliga a que termine con el dominio seleccionado (ej: @ce.ucn.cl)
  if (!email.endsWith(requiredDomain)) { 
    showToast(`Error: El correo debe terminar sí o sí en ${requiredDomain}`, 'error'); 
    return; 
  }
  
  if (!pass) { showToast('Debes ingresar tu contraseña.', 'error'); return; }
  if (pass.length < 4) { showToast('Contraseña incorrecta.', 'error'); return; }
  
  // ====================================================================
  // NUEVA LÓGICA: CONSULTA AL BACKEND (FASTAPI)
  // ====================================================================
  try {
    // Cambiamos el texto del botón temporalmente para que el usuario sepa que está cargando
    const btn = document.querySelector('#googleMockBody .btn-primary');
    const textoOriginal = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Verificando...';
    btn.disabled = true;

    const response = await fetch('http://127.0.0.1:8000/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ correo: email, password: pass, rol: loginAttemptRole })
    });

    // Restauramos el botón
    btn.innerHTML = textoOriginal;
    btn.disabled = false;

    // Si es estudiante y recibe un 404, significa que NO está registrado.
    if (response.status === 404 && loginAttemptRole === 'estudiante') {
        showToast('No tienes cuenta. Debes registrarte por primera vez.', 'info');
        
        // Aquí deberías llamar a una función que cierre este modal y abra el de registro
        // pasándole el correo y la password que ya escribió para ahorrarle tiempo.
        // Ejemplo: abrirModalRegistro(email, pass);
        return; 
    }

    if (!response.ok) {
        throw new Error("Contraseña incorrecta o error de servidor.");
    }

    const data = await response.json();
    
    // Si la BD nos devuelve el nombre real, lo usamos. Si no, usamos el que extrajimos del correo.
    const nombreFinal = (data.usuario && data.usuario.nombre) ? data.usuario.nombre : extractedUserName;

    // ====================================================================
    // CONTINÚA TU LÓGICA ORIGINAL SI TODO SALE BIEN
    // ====================================================================
    showToast(`Bienvenido/a, ${nombreFinal}. Redirigiendo...`, 'success'); 
    closeGoogleMock();
    
    // SOLUCIÓN AL NOMBRE: Guardamos los datos reales de la sesión en el navegador
    localStorage.setItem('docenteNombre', nombreFinal);
    localStorage.setItem('userRole', loginAttemptRole);
    
    setTimeout(() => {
      if(loginAttemptRole === 'estudiante') {
        studentData.name = nombreFinal;
        studentData.email = email;
        // Si el backend nos mandó el RUT, también lo actualizamos en la variable global
        if(data.usuario && data.usuario.rut) {
            studentData.rut = data.usuario.rut;
        }
        enterStudentPage();
      } 
      else if (loginAttemptRole === 'docente' || loginAttemptRole === 'admin') {
        enterDocentePage(loginAttemptRole, email);
      }
    }, 1000);

  } catch (error) {
    showToast(error.message, 'error');
  }
}
    /* ========================================
       LÓGICA APP PÁGINA ESTUDIANTE
    ======================================== */
    function enterStudentPage() {
      // Ocultar Landing y fondos
      document.querySelector('.content-wrapper').style.display = 'none';
      document.querySelector('.bg-atmosphere').style.display = 'none';
      document.querySelector('.bg-grid').style.display = 'none';
      document.querySelector('#particleCanvas').style.display = 'none';
      
      // Mostrar Página entera del estudiante
      document.getElementById('app-estudiante').style.display = 'block';
      
      // Inyectar datos dinámicos en el Header y Perfil
      document.getElementById('headerAvatar').textContent = extractedUserName.split(' ').map(n => n[0]).join('');
      document.getElementById('headerName').textContent = extractedUserName;
      document.getElementById('perfilNombre').textContent = extractedUserName;
      document.getElementById('perfilCorreo').textContent = studentData.email;
      
      renderDashboardCourses();
      renderMyApplications();
    }

    function logout() {
      document.getElementById('app-estudiante').style.display = 'none';
      document.querySelector('.content-wrapper').style.display = 'block';
      document.querySelector('.bg-atmosphere').style.display = 'block';
      document.querySelector('.bg-grid').style.display = 'block';
      document.querySelector('#particleCanvas').style.display = 'block';
      showToast('Sesión cerrada correctamente.', 'info');
    }

    /* ========================================
       LÓGICA APP PÁGINA DOCENTE / ADMIN
    ======================================== */
    let pendingAction = null;

    function enterDocentePage(role, email) {
      // Ocultar landing y fondos
      document.querySelector('.content-wrapper').style.display = 'none';
      document.querySelector('.bg-atmosphere').style.display = 'none';
      document.querySelector('.bg-grid').style.display = 'none';
      document.querySelector('#particleCanvas').style.display = 'none';

      // Mostrar panel docente
      document.getElementById('app-docente').style.display = 'block';

      // Inyectar datos en el header
      const initials = extractedUserName.split(' ').map(n => n[0]).join('').toUpperCase();
      document.getElementById('docenteHeaderAvatar').textContent = initials;
      document.getElementById('docenteHeaderName').textContent = extractedUserName;

      const displayRole = role === 'admin' ? 'Administrador' : 'Profesor';
      document.getElementById('docenteRoleBadge').textContent = `| Panel ${displayRole}`;
      document.getElementById('docenteWelcomeText').innerHTML =
        `Bienvenido, ${displayRole} <span class="gradient-text">${extractedUserName}</span>`;

      // Registrar listener del modal confirmación (solo una vez)
      const confirmBtn = document.getElementById('confirmActionBtn');
      confirmBtn.replaceWith(confirmBtn.cloneNode(true)); // limpia listeners previos
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

      cargarPanelDocente();
    }

    function logoutDocente() {
      document.getElementById('app-docente').style.display = 'none';
      document.querySelector('.content-wrapper').style.display = 'block';
      document.querySelector('.bg-atmosphere').style.display = 'block';
      document.querySelector('.bg-grid').style.display = 'block';
      document.querySelector('#particleCanvas').style.display = 'block';
      showToast('Sesión cerrada correctamente.', 'info');
    }

    async function cargarPanelDocente() {
      const container = document.getElementById('docenteDashboardContent');
      container.innerHTML = '<p style="color:var(--muted); text-align:center; padding: 3rem;">Cargando asignaturas y postulaciones...</p>';

      try {
        const [resRamos, resPostulaciones] = await Promise.all([
          fetch('http://127.0.0.1:8000/api/ramos'),
          fetch('http://127.0.0.1:8000/api/postulaciones')
        ]);

        if (!resRamos.ok || !resPostulaciones.ok) throw new Error('Error en los datos del servidor');

        const ramosData = await resRamos.json();
        const postulacionesData = await resPostulaciones.json();

        renderizarPanelDocente(ramosData, postulacionesData);
      } catch (error) {
        console.error(error);
        container.innerHTML = '<p style="color:var(--danger); text-align:center; padding: 3rem;">Error al conectar con el backend. Asegúrate de que FastAPI está corriendo.</p>';
      }
    }

    function renderizarPanelDocente(ramos, postulaciones) {
      // Ordenar postulantes por nota (de mayor a menor)
      postulantesCurso.sort((a, b) => b.nota_obtenida - a.nota_obtenida);
      const container = document.getElementById('docenteDashboardContent');
      let html = '';

      ramos.forEach(curso => {
        const postulantesCurso = postulaciones.filter(
          p => p.nrc_ramo === curso.codigo_nrc && p.estado !== 'rechazado'
        );

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

      // Delegación de eventos con data-attributes
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
            <div style="font-size:0.95rem; color:var(--warning); font-weight: bold;">
            <i class="fas fa-star"></i> Nota: ${p.nota_obtenida}
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
        const response = await fetch('http://127.0.0.1:8000/api/postulaciones/estado', {
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

    // Cerrar modal confirmación al hacer click fuera
    document.getElementById('confirmModalOverlay').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) cerrarModalConfirmacion();
    });

    function switchView(viewId, tabElement) {
      document.querySelectorAll('.view-section').forEach(v => v.classList.remove('active'));
      document.querySelectorAll('.app-tab').forEach(t => t.classList.remove('active'));
      
      document.getElementById(`view-${viewId}`).classList.add('active');
      tabElement.classList.add('active');
    }

   function renderDashboardCourses() {
  const grid = document.getElementById('dashCoursesGrid');
  grid.innerHTML = coursesData.filter(c => {
    // 1. Filtramos por la nota del estudiante usando "codigo_nrc"
    const studentGrade = studentData.notas[c.codigo_nrc];
    return studentGrade !== undefined && studentGrade >= 4.0 && c.esta_abierto;
  }).map(c => {
    // 2. Verificamos si ya postuló
    const isApplied = appliedCourses.some(app => app.code === c.codigo_nrc);
    
    // 3. Pintamos la tarjeta con los datos reales
    return `
      <div class="dash-course-card">
        <div class="card-top">
          <span class="course-code">${c.codigo_nrc}</span>
          <span style="font-size:0.8rem; color:var(--muted);">${c.cupos} cupos</span>
        </div>
        <h3>${c.nombre_ramo}</h3>
        <div class="meta"><i class="fas fa-chalkboard-teacher"></i> ${c.id_profesor_encargado || "Por asignar"}</div>
        <div class="meta"><i class="fas fa-star" style="color:var(--warning);"></i> Mi nota: <strong style="color:var(--success)">${studentData.notas[c.codigo_nrc]}</strong></div>
        <button class="btn-postular ${isApplied ? 'applied' : ''}" onclick="${isApplied ? '' : `applyToCourse('${c.codigo_nrc}', '${c.nombre_ramo}')`}">
          ${isApplied ? '<i class="fas fa-check"></i> Ya postulé' : '<i class="fas fa-paper-plane"></i> Postular'}
        </button>
      </div>`;
  }).join('');
}
  async function applyToCourse(code, name) {
  try {
    const response = await fetch('http://127.0.0.1:8000/api/postular', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nrc_ramo: code,
        rut_estudiante: studentData.rut,
        nombre_estudiante: studentData.name
      })
    });

    if (!response.ok) {
        throw new Error("Error en el servidor al enviar la postulación");
    }

    // --- MAGIA AQUÍ: Volvemos a descargar los ramos para obtener el nuevo contador ---
    const ramosResponse = await fetch('http://127.0.0.1:8000/api/ramos');
    coursesData = await ramosResponse.json();
    // --------------------------------------------------------------------------------

    appliedCourses.push({ code, status: 'revision' });
    
    // Al redibujar las tarjetas, ya usarán el nuevo número de "coursesData"
    renderDashboardCourses(); 
    renderMyApplications();
    renderCourses(); // También actualizamos la página de inicio por si el usuario vuelve atrás
    
    showToast(`Postulación a ${name} enviada exitosamente.`, 'success');

  } catch (error) {
    console.error(error);
    showToast('Hubo un problema al enviar tu postulación.', 'error');
  }
}
    function withdrawApplication(code, name) {
      // 1. Eliminar del array de postulaciones
      appliedCourses = appliedCourses.filter(app => app.code !== code);
      
      // 2. Refrescar la vista de tarjetas (para que vuelva a aparecer el botón "Postular")
      renderDashboardCourses();
      
      // 3. Refrescar la tabla de postulaciones (para que desaparezca de la lista)
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
      // Usamos codigo_nrc para encontrar el ramo
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

    /* ========================================
       UTILIDADES (Toasts, Nav, Partículas)
    ======================================== */
    function showToast(message, type = 'info') {
      const container = document.getElementById('toastContainer');
      const toast = document.createElement('div'); toast.className = `toast ${type}`;
      const icons = { success: 'fa-check-circle', error: 'fa-exclamation-circle', info: 'fa-info-circle' };
      toast.innerHTML = `<i class="fas ${icons[type] || icons.info}"></i><span>${message}</span>`;
      container.appendChild(toast);
      setTimeout(() => { toast.classList.add('toast-out'); setTimeout(() => toast.remove(), 300); }, 3500);
    }

    // Navbar Landing
    const navbar = document.getElementById('navbar'); 
    const navToggle = document.getElementById('navToggle'); 
    const navLinks = document.getElementById('navLinks');
    
    window.addEventListener('scroll', () => navbar.classList.toggle('scrolled', window.scrollY > 40));
    navToggle.addEventListener('click', () => {
      navLinks.classList.toggle('mobile-open'); 
      const isOpen = navLinks.classList.contains('mobile-open'); 
      navToggle.innerHTML = isOpen ? '<i class="fas fa-times"></i>' : '<i class="fas fa-bars"></i>';
    });
    navLinks.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => { navLinks.classList.remove('mobile-open'); navToggle.innerHTML = '<i class="fas fa-bars"></i>'; });
    });

    // Scroll Reveal & Counters
    const revealObserver = new IntersectionObserver((entries) => { entries.forEach(entry => { if (entry.isIntersecting) entry.target.classList.add('visible'); }); }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });
    document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));
    
    const counterObserver = new IntersectionObserver((entries) => { entries.forEach(entry => { if (entry.isIntersecting) { animateCounter(entry.target, parseInt(entry.target.dataset.count)); counterObserver.unobserve(entry.target); } }); }, { threshold: 0.5 });
    document.querySelectorAll('[data-count]').forEach(el => counterObserver.observe(el));
    
    function animateCounter(el, target) { 
      let current = 0; const step = target / (1800 / 16); 
      function update() { current += step; if (current >= target) { el.textContent = target; return; } el.textContent = Math.floor(current); requestAnimationFrame(update); } 
      requestAnimationFrame(update); 
    }