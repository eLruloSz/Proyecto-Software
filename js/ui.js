 // Array para guardar a qué asignaturas postuló en esta sesión
let appliedCourses = [
  { code: 'NRC:12900', status: 'revision' } // Ejemplo de postulación previa
];

    /* ========================================
       LANDING PAGE (Lógica Original)
    ======================================== */
    function renderCourses() {
      const grid = document.getElementById('coursesGrid');
      grid.innerHTML = coursesData.map(c => `
        <div class="course-card" onclick="handleCourseClick('${c.code}', ${c.open})">
          <div class="course-header">
            <span class="course-code">${c.code}</span>
            ${!c.open ? '<span style="font-size:0.8rem;color:var(--danger);font-weight:600;">Cerrada</span>' : `<span class="course-slots"><i class="fas fa-user-friends" style="margin-right:4px;"></i>${c.slots} cupos</span>`}
          </div>
          <h3>${c.name}</h3>
          <div class="course-prof"><i class="fas fa-chalkboard-teacher"></i>${c.prof}</div>
          <div class="course-footer">
            <span class="course-dept">${c.dept}</span>
            <span class="course-applicants"><i class="fas fa-users"></i> ${c.applicants} postulantes</span>
          </div>
        </div>
      `).join('');
    }

    function handleCourseClick(code, open) {
      if (!open) showToast('Esta asignatura no acepta postulaciones.', 'error');
      else { showToast(`Debes iniciar sesión para postular a ${code}.`, 'info'); setTimeout(() => openModal('login'), 1200); }
    }
    renderCourses();

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

    function handleMockLogin() {
      const email = document.getElementById('mockEmail').value.trim();
      const pass = document.getElementById('mockPass').value.trim();
      const errorDiv = document.getElementById('mockEmailError');

      if (!email) { showToast('Debes ingresar tu correo.', 'error'); return; }
      if (errorDiv.style.display === 'block') { showToast('El dominio del correo no corresponde al rol seleccionado.', 'error'); return; }
      if (!pass) { showToast('Debes ingresar tu contraseña.', 'error'); return; }
      if (pass.length < 4) { showToast('Contraseña incorrecta.', 'error'); return; }
      
      showToast(`Bienvenido/a, ${extractedUserName}. Redirigiendo...`, 'success'); 
      closeGoogleMock();
      
      setTimeout(() => {
        if(loginAttemptRole === 'estudiante') {
          studentData.name = extractedUserName;
          studentData.email = email;
          enterStudentPage();
        } else {
          alert(`Redirección simulada para: ${extractedUserName} (${loginAttemptRole})`);
        }
      }, 1000);
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

    function switchView(viewId, tabElement) {
      document.querySelectorAll('.view-section').forEach(v => v.classList.remove('active'));
      document.querySelectorAll('.app-tab').forEach(t => t.classList.remove('active'));
      
      document.getElementById(`view-${viewId}`).classList.add('active');
      tabElement.classList.add('active');
    }

    function renderDashboardCourses() {
      const grid = document.getElementById('dashCoursesGrid');
      grid.innerHTML = coursesData.filter(c => {
        const studentGrade = studentData.notas[c.code];
        return studentGrade !== undefined && studentGrade >= 4.0 && c.open;
      }).map(c => {
        const isApplied = appliedCourses.some(app => app.code === c.code);
        return `
          <div class="dash-course-card">
            <div class="card-top">
              <span class="course-code">${c.code}</span>
              <span style="font-size:0.8rem; color:var(--muted);">${c.slots} cupos</span>
            </div>
            <h3>${c.name}</h3>
            <div class="meta"><i class="fas fa-chalkboard-teacher"></i> ${c.prof}</div>
            <div class="meta"><i class="fas fa-star" style="color:var(--warning);"></i> Mi nota: <strong style="color:var(--success)">${studentData.notas[c.code]}</strong></div>
            <button class="btn-postular ${isApplied ? 'applied' : ''}" onclick="${isApplied ? '' : `applyToCourse('${c.code}', '${c.name}')`}">
              ${isApplied ? '<i class="fas fa-check"></i> Ya postulé' : '<i class="fas fa-paper-plane"></i> Postular'}
            </button>
          </div>`;
      }).join('');
    }

    function applyToCourse(code, name) {
      appliedCourses.push({ code, status: 'revision' });
      renderDashboardCourses(); 
      renderMyApplications(); 
      showToast(`Postulación a ${name} enviada exitosamente.`, 'success');
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
        const course = coursesData.find(c => c.code === app.code);
        const statusConfig = {
          'revision': { text: 'En revisión', class: 'revision', icon: 'fa-clock' },
          'aceptado': { text: 'Aprobado', class: 'aceptado', icon: 'fa-check-circle' },
          'rechazado': { text: 'Rechazado', class: 'rechazado', icon: 'fa-times-circle' }
        };
        const s = statusConfig[app.status];
        
        // Solo mostramos el botón de retirar si está "En revisión". 
        // Si ya fue aceptado o rechazado, el proceso terminó.
        const canWithdraw = app.status === 'revision';

        return `
          <tr>
            <td style="font-weight:700; color:var(--accent);">${app.code}</td>
            <td>${course ? course.name : 'Desconocida'}</td>
            <td>${course ? course.prof : 'Desconocido'}</td>
            <td><span class="status-badge ${s.class}"><i class="fas ${s.icon}"></i> ${s.text}</span></td>
            <td>
              ${canWithdraw ? `
                <button class="btn btn-ghost" style="padding: 6px 12px; font-size: 0.8rem; color: var(--danger); border-color: var(--danger);" onclick="withdrawApplication('${app.code}', '${course ? course.name : ''}')">
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