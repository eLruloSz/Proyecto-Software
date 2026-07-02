
    let coursesData = []; 

    async function fetchAndRenderCourses() {
      const grid = document.getElementById('coursesGrid');
      grid.innerHTML = '<p style="color:var(--muted); text-align:center; grid-column: 1 / -1;">Cargando asignaturas...</p>';

      try {
        
        const response = await fetch('http://127.0.0.1:8000/api/ramos');
        if (!response.ok) throw new Error("Error al conectar con el servidor");
        
        coursesData = await response.json();
        renderCourses(); 
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

    fetchAndRenderCourses();

       
    let currentUser = null; 
    let studentAvailableCourses = []; 
    let appliedCourses = []; 

  
    function openModal(type) {
      document.getElementById('modalTitle').textContent = 'Autenticación UCN';
      document.getElementById('modalBody').innerHTML = buildRealLogin();
      document.getElementById('modalOverlay').classList.add('active');
      document.body.style.overflow = 'hidden';
    }

    function closeModal() { document.getElementById('modalOverlay').classList.remove('active'); document.body.style.overflow = ''; }
    function closeGoogleMock() { document.getElementById('googleMockOverlay').classList.remove('active'); document.body.style.overflow = ''; }

    document.getElementById('modalOverlay').addEventListener('click', (e) => { if (e.target === e.currentTarget) closeModal(); });
    document.getElementById('googleMockOverlay').addEventListener('click', (e) => { if (e.target === e.currentTarget) closeGoogleMock(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeModal(); closeGoogleMock(); } });

    function buildRealLogin() {
      return `
        <p style="color: var(--fg-secondary); margin-bottom: 1.5rem; font-size: 0.95rem;">Ingresa tu RUT y contraseña institucional.</p>
        <div class="form-group" style="text-align: left;">
          <label for="loginRut">RUT</label>
          <input type="text" id="loginRut" class="form-input" placeholder="12.345.678-9">
        </div>
        <div class="form-group" style="text-align: left; margin-top: 1rem;">
          <label for="loginPass">Contraseña</label>
          <input type="password" id="loginPass" class="form-input" placeholder="Tu contraseña">
        </div>
        <div class="form-footer">
          <button class="btn btn-primary" onclick="handleRealLogin()">
            <i class="fas fa-sign-in-alt"></i> Ingresar
          </button>
        </div>
        <div id="loginError" style="color: var(--danger); font-size: 0.85rem; text-align: center; margin-top: 1rem; display: none;"></div>
      `;
    }

    async function handleRealLogin() {
      const rut = document.getElementById('loginRut').value.trim();
      const pass = document.getElementById('loginPass').value.trim();
      const errorDiv = document.getElementById('loginError');

      if (!rut || !pass) { errorDiv.textContent = "Debes ingresar RUT y contraseña."; errorDiv.style.display = 'block'; return; }

      errorDiv.style.display = 'none';
      const btn = event.target; 
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Validando...';
      btn.disabled = true;

      try {
        const response = await fetch('http://127.0.0.1:8000/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rut, password: pass })
        });

        const data = await response.json();

        if (!response.ok) {
          if (data.detail === 'NEEDS_ACTIVATION_STUDENT' || data.detail === 'NEEDS_ACTIVATION_PROFESSOR') {
            const rol = data.detail.includes('STUDENT') ? 'estudiante' : 'profesor';
            showActivationScreen(rut, rol);
            btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Ingresar';
            btn.disabled = false;
            return;
          }
          throw new Error(data.detail);
        }

        currentUser = data.user;
        currentUser.rol = data.rol;
        closeModal();
        showToast(`Bienvenido/a, ${currentUser.nombre}`, 'success');

        setTimeout(() => {
          if (currentUser.rol === 'estudiante') enterStudentPage();
          else enterDocentePage(currentUser.rol, currentUser.correo);
        }, 500);

      } catch (error) {
        errorDiv.textContent = error.message;
        errorDiv.style.display = 'block';
      } finally {
        btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Ingresar';
        btn.disabled = false;
      }
    }

    function showActivationScreen(rut, rol) {
      document.getElementById('modalTitle').textContent = 'Primera vez ingresando';
      document.getElementById('modalBody').innerHTML = `
        <p style="color: var(--accent-light); margin-bottom: 1.5rem; font-size: 0.9rem;">
          RUT <strong>${rut}</strong> validado correctamente. Crea tu contraseña para continuar.
        </p>
        <div class="form-group" style="text-align: left;">
          <label>Nueva Contraseña (mínimo 6 caracteres)</label>
          <input type="password" id="newPass" class="form-input" placeholder="Crear contraseña">
        </div>
        <div class="form-group" style="text-align: left; margin-top: 1rem;">
          <label>Confirmar Contraseña</label>
          <input type="password" id="confirmPass" class="form-input" placeholder="Repetir contraseña">
        </div>
        <div class="form-footer">
          <button class="btn btn-primary" onclick="handleActivacion('${rut}', '${rol}')">
            <i class="fas fa-check"></i> Activar Cuenta
          </button>
        </div>
        <div id="activationError" style="color: var(--danger); font-size: 0.85rem; text-align: center; margin-top: 1rem; display: none;"></div>
      `;
    }

    async function handleActivacion(rut, rol) {
      const newPass = document.getElementById('newPass').value;
      const confirmPass = document.getElementById('confirmPass').value;
      const errorDiv = document.getElementById('activationError');

      if (newPass.length < 6) { errorDiv.textContent = "La contraseña debe tener al menos 6 caracteres."; errorDiv.style.display = 'block'; return; }
      if (newPass !== confirmPass) { errorDiv.textContent = "Las contraseñas no coinciden."; errorDiv.style.display = 'block'; return; }

      try {
        const response = await fetch('http://127.0.0.1:8000/api/auth/activar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rut, nueva_password: newPass, rol })
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.detail);

        showToast('Cuenta activada. Ya puedes iniciar sesión.', 'success');
        openModal('login');
      } catch (error) {
        errorDiv.textContent = error.message;
        errorDiv.style.display = 'block';
      }
    }

   
    async function enterStudentPage() {
      document.querySelector('.content-wrapper').style.display = 'none';
      document.querySelector('.bg-atmosphere').style.display = 'none';
      document.querySelector('.bg-grid').style.display = 'none';
      document.querySelector('#particleCanvas').style.display = 'none';
      document.getElementById('app-estudiante').style.display = 'block';
      document.getElementById('perfilPPA').textContent = currentUser.ppa || 'No registrado';
      
     
      const initials = currentUser.nombre ? currentUser.nombre.split(' ').map(n => n[0]).join('') : '??';
      document.getElementById('headerAvatar').textContent = initials;
      document.getElementById('headerName').textContent = currentUser.nombre || currentUser.rut;
      document.getElementById('perfilNombre').textContent = currentUser.nombre;
      document.getElementById('perfilCorreo').textContent = currentUser.correo;
      
      
      await loadStudentCourses();
      await loadMyApplications();
    }

    async function loadStudentCourses() {
      const grid = document.getElementById('dashCoursesGrid');
      grid.innerHTML = '<p style="color:var(--muted); text-align:center; grid-column: 1 / -1;">Cargando ramos disponibles...</p>';
      try {
        const response = await fetch(`http://127.0.0.1:8000/api/estudiante/${currentUser.rut}/ramos-disponibles`);
        if (!response.ok) throw new Error("Error al cargar ramos");
        studentAvailableCourses = await response.json();
        renderDashboardCourses();
      } catch (error) {
        grid.innerHTML = `<p style="color:var(--danger); text-align:center; grid-column: 1 / -1;">Error: ${error.message}</p>`;
      }
    }

    function renderDashboardCourses() {
      const grid = document.getElementById('dashCoursesGrid');
      if (studentAvailableCourses.length === 0) {
        grid.innerHTML = '<p style="color:var(--muted); text-align:center; grid-column: 1 / -1;">No tienes ramos disponibles para postular en este momento.</p>';
        return;
      }

      grid.innerHTML = studentAvailableCourses.map(c => {
      
        const nombreRamo = c.ramos ? c.ramos.nombre : 'Sin nombre';
        const isApplied = appliedCourses.some(app => app.nrc === c.nrc);
        
        return `
          <div class="dash-course-card">
            <div class="card-top">
              <span class="course-code">NRC: ${c.nrc}</span>
              <span style="font-size:0.8rem; color:var(--muted);">${c.cupos} cupos</span>
            </div>
            <h3>${nombreRamo}</h3>
            <div class="meta"><i class="fas fa-code"></i> Código: ${c.codigo_ramo}</div>
            <button class="btn-postular ${isApplied ? 'applied' : ''}" onclick="${isApplied ? '' : `applyToCourse('${c.nrc}', '${nombreRamo}')`}">
              ${isApplied ? '<i class="fas fa-check"></i> Ya postulé' : '<i class="fas fa-paper-plane"></i> Postular'}
            </button>
          </div>`;
      }).join('');
    }

    async function applyToCourse(nrc, name) {
      try {
        const response = await fetch(`http://127.0.0.1:8000/api/estudiante/${currentUser.rut}/postular`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nrc: nrc })
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.detail);

        showToast(data.message, 'success');
        
        await loadStudentCourses();
        await loadMyApplications();
      } catch (error) {
        showToast(error.message, 'error');
      }
    }

    async function withdrawApplication(nrc, name) {
      if (!confirm(`¿Estás seguro de que quieres retirar tu postulación a ${name}?`)) return;
      
      try {
        const response = await fetch(`http://127.0.0.1:8000/api/estudiante/${currentUser.rut}/postular/${nrc}`, { method: 'DELETE' });
        if (!response.ok) throw new Error("Error al retirar postulación");
        
        showToast('Postulación retirada correctamente.', 'info');
        await loadStudentCourses();
        await loadMyApplications();
      } catch (error) {
        showToast(error.message, 'error');
      }
    }

    async function loadMyApplications() {
      const tbody = document.getElementById('tablePostulaciones');
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:var(--muted); padding:2rem;">Cargando...</td></tr>';
      
      try {
        const response = await fetch(`http://127.0.0.1:8000/api/estudiante/${currentUser.rut}/mis-postulaciones`);
        const data = await response.json();
        
        appliedCourses = data; 
        
        if (data.length === 0) {
          tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--muted); padding:2rem;">No tienes postulaciones activas.</td></tr>`;
          return;
        }

        const statusConfig = {
          'revision': { text: 'En revisión', class: 'revision', icon: 'fa-clock' },
          'aceptado': { text: 'Aprobado', class: 'aceptado', icon: 'fa-check-circle' },
          'rechazado': { text: 'Rechazado', class: 'rechazado', icon: 'fa-times-circle' }
        };

        tbody.innerHTML = data.map(app => {
          const s = statusConfig[app.estado] || statusConfig['revision'];
          const nombreRamo = app.configuracion_ayudantias?.ramos?.nombre || 'Ramo desconocido';
          const canWithdraw = app.estado === 'revision';

          return `
            <tr>
              <td style="font-weight:700; color:var(--accent);">NRC: ${app.nrc}</td>
              <td>${nombreRamo}</td>
              <td>--</td>
              <td><span class="status-badge ${s.class}"><i class="fas ${s.icon}"></i> ${s.text}</span></td>
              <td>
                ${canWithdraw ? `
                  <button class="btn btn-ghost" style="padding: 6px 12px; font-size: 0.8rem; color: var(--danger); border-color: var(--danger);" onclick="withdrawApplication('${app.nrc}', '${nombreRamo}')">
                    <i class="fas fa-times"></i> Retirar
                  </button>
                ` : '<span style="color:var(--muted); font-size:0.8rem;">--</span>'}
              </td>
            </tr>`;
        }).join('');
      } catch (error) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--danger); padding:2rem;">Error al cargar postulaciones.</td></tr>`;
      }
    }

    
    let pendingAction = null;

    function enterDocentePage(role, email) {
      document.querySelector('.content-wrapper').style.display = 'none';
      document.querySelector('.bg-atmosphere').style.display = 'none';
      document.querySelector('.bg-grid').style.display = 'none';
      document.querySelector('#particleCanvas').style.display = 'none';
      document.getElementById('app-docente').style.display = 'block';

      
      const nameToShow = currentUser ? currentUser.nombre : 'Docente';
      const initials = nameToShow.split(' ').map(n => n[0]).join('').toUpperCase();
      
      document.getElementById('docenteHeaderAvatar').textContent = initials;
      document.getElementById('docenteHeaderName').textContent = nameToShow;
      const displayRole = role === 'admin' ? 'Administrador' : 'Profesor';
      document.getElementById('docenteRoleBadge').textContent = `| Panel ${displayRole}`;
      document.getElementById('docenteWelcomeText').innerHTML = `Bienvenido, ${displayRole} <span class="gradient-text">${nameToShow}</span>`;

      const confirmBtn = document.getElementById('confirmActionBtn');
      confirmBtn.replaceWith(confirmBtn.cloneNode(true)); 
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

    
    function showToast(message, type = 'info') {
      const container = document.getElementById('toastContainer');
      const toast = document.createElement('div'); toast.className = `toast ${type}`;
      const icons = { success: 'fa-check-circle', error: 'fa-exclamation-circle', info: 'fa-info-circle' };
      toast.innerHTML = `<i class="fas ${icons[type] || icons.info}"></i><span>${message}</span>`;
      container.appendChild(toast);
      setTimeout(() => { toast.classList.add('toast-out'); setTimeout(() => toast.remove(), 300); }, 3500);
    }

    
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

    
    const revealObserver = new IntersectionObserver((entries) => { entries.forEach(entry => { if (entry.isIntersecting) entry.target.classList.add('visible'); }); }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });
    document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));
    
    const counterObserver = new IntersectionObserver((entries) => { entries.forEach(entry => { if (entry.isIntersecting) { animateCounter(entry.target, parseInt(entry.target.dataset.count)); counterObserver.unobserve(entry.target); } }); }, { threshold: 0.5 });
    document.querySelectorAll('[data-count]').forEach(el => counterObserver.observe(el));
    
    function animateCounter(el, target) { 
      let current = 0; const step = target / (1800 / 16); 
      function update() { current += step; if (current >= target) { el.textContent = target; return; } el.textContent = Math.floor(current); requestAnimationFrame(update); } 
      requestAnimationFrame(update); 
    }