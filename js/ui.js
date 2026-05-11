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
            <span class="course-dept">${c.dept.split(' de ')[1] || c.dept}</span>
            <span class="course-applicants"><i class="fas fa-users"></i> ${c.applicants} postulantes</span>
          </div>
        </div>
      `).join('');
    }

    function handleCourseClick(code, open) {
      if (!open) {
        showToast('Esta asignatura no acepta postulaciones en este momento.', 'error');
      } else {
        showToast(`Debes iniciar sesión para postular a ${code}.`, 'info');
        setTimeout(() => openModal('login'), 1200);
      }
    }

    renderCourses();

    /* ========================================
       MODALES LOGIN/ GOOGLE MOCK
    ======================================== */
    let loginAttemptRole = null;

    function openModal(type) {
     const overlay = document.getElementById('modalOverlay');
     const title = document.getElementById('modalTitle');
     const body = document.getElementById('modalBody');
  
     // Siempre abre el login, sin importar el 'type'
     title.textContent = 'Autenticación UCN';
     body.innerHTML = buildRBACLogin();
  
     overlay.classList.add('active');
     document.body.style.overflow = 'hidden';
    }

    function closeModal() {
      document.getElementById('modalOverlay').classList.remove('active');
      document.body.style.overflow = '';
    }

    function closeGoogleMock() {
      document.getElementById('googleMockOverlay').classList.remove('active');
      document.body.style.overflow = '';
    }

    document.getElementById('modalOverlay').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) closeModal();
    });

    document.getElementById('googleMockOverlay').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) closeGoogleMock();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeModal();
        closeGoogleMock();
      }
    });

    // Pantalla 1: Selección de Rol (Estilo Campus UCN)
    function buildRBACLogin() {
      return `
        <p style="color: var(--fg-secondary); margin-bottom: 1.5rem; font-size: 0.95rem;">
          Selecciona cómo deseas ingresar. El sistema validará automáticamente tu dominio institucional.
        </p>
        <div style="display: flex; flex-direction: column; gap: 12px;">
          <button class="btn btn-ghost" style="justify-content: flex-start; padding: 16px 20px; border-radius: var(--radius);" onclick="initGoogleMock('estudiante')">
            <i class="fas fa-user-graduate" style="font-size: 1.2rem; color: var(--success); width: 24px;"></i>
            <div style="text-align: left;">
              <div style="font-weight: 700; color: var(--fg);">Acceso Estudiantes</div>
              <div style="font-size: 0.8rem; color: var(--muted); font-weight: 400;">Dominio @alumnos.ucn.cl</div>
            </div>
          </button>
          
          <button class="btn btn-ghost" style="justify-content: flex-start; padding: 16px 20px; border-radius: var(--radius);" onclick="initGoogleMock('docente')">
            <i class="fas fa-chalkboard-teacher" style="font-size: 1.2rem; color: var(--accent-light); width: 24px;"></i>
            <div style="text-align: left;">
              <div style="font-weight: 700; color: var(--fg);">Acceso Docentes</div>
              <div style="font-size: 0.8rem; color: var(--muted); font-weight: 400;">Dominio @ce.ucn.cl</div>
            </div>
          </button>

          <button class="btn btn-ghost" style="justify-content: flex-start; padding: 16px 20px; border-radius: var(--radius);" onclick="initGoogleMock('admin')">
            <i class="fas fa-shield-alt" style="font-size: 1.2rem; color: var(--warning); width: 24px;"></i>
            <div style="text-align: left;">
              <div style="font-weight: 700; color: var(--fg);">Acceso Administradores</div>
              <div style="font-size: 0.8rem; color: var(--muted); font-weight: 400;">Dominio @ucn.cl</div>
            </div>
          </button>
        </div>
      `;
    }

    // Pantalla 2: Simulación de flujo Google Workspace
    function initGoogleMock(role) {
      loginAttemptRole = role;
      closeModal(); // Cerrar modal principal
      
      setTimeout(() => {
        const overlay = document.getElementById('googleMockOverlay');
        const body = document.getElementById('googleMockBody');
        
        const domainMap = {
          estudiante: '@alumnos.ucn.cl',
          docente: '@ce.ucn.cl',
          admin: '@ucn.cl'
        };

        body.innerHTML = `
          <div style="margin-bottom: 2rem;">
            <img src="https://www.ucn.cl/content/uploads/2023/05/ucn-escudo-full-color.png" alt="UCN" style="height: 50px; margin-bottom: 1rem; ">
            <p style="font-size: 1.1rem; font-weight: 600; color: var(--fg);">Iniciar sesión con Google Workspace</p>
            <p style="font-size: 0.9rem; color: var(--muted); margin-top: 5px;">Continuar como <strong style="color:var(--accent-light); text-transform:capitalize;">${role === 'docente' ? 'Docente' : role}</strong></p>
          </div>
          
          <div class="form-group" style="text-align: left;">
            <label for="mockEmail">Correo electrónico</label>
            <input type="email" id="mockEmail" class="form-input" value="usuario${domainMap[role]}" style="color: var(--muted); cursor: not-allowed;" readonly>
            <small style="color: var(--danger); display: none; margin-top: 5px;" id="mockEmailError">
              <i class="fas fa-exclamation-triangle"></i> El correo no pertenece al dominio de ${role === 'docente' ? 'Docentes' : role}s.
            </small>
          </div>

          <div class="form-group" style="text-align: left; margin-top: 1.5rem;">
            <label for="mockPass">Contraseña</label>
            <input type="password" id="mockPass" class="form-input" placeholder="Ingresa tu contraseña institucional" autofocus>
          </div>

          <button class="btn btn-primary" style="width: 100%; justify-content: center; margin-top: 1.5rem;" onclick="handleMockLogin()">
            Acceder
          </button>
          <p style="font-size: 0.8rem; color: var(--muted); margin-top: 1rem;">
            * Simulación de entorno Frontend. Se conectará a API de Google Workspace posteriormente.
          </p>
        `;
        
        overlay.classList.add('active');
        document.body.style.overflow = 'hidden';
      }, 300);
    }

    /* ========================================
       LÓGICA DE AUTENTICACIÓN (MOCK RBAC)
    ======================================== */
    function handleMockLogin() {
      const email = document.getElementById('mockEmail').value.trim();
      const pass = document.getElementById('mockPass').value.trim();
      const errorDiv = document.getElementById('mockEmailError');

      if (!pass) {
        showToast('Debes ingresar tu contraseña.', 'error');
        return;
      }

      if (pass.length < 4) {
        showToast('Contraseña incorrecta.', 'error');
        return;
      }

      const roleNames = { estudiante: 'Estudiante', docente: 'Profesor', admin: 'Administrador' };
      const userName = email.split('@')[0].replace(/\./g, ' ');

      showToast(`Bienvenido/a (${roleNames[loginAttemptRole]}). Redirigiendo al sistema...`, 'success');
      closeGoogleMock();

      setTimeout(() => {
        alert(`--- REDIRECCIÓN SIMULADA ---\n\nRol: ${roleNames[loginAttemptRole]}\nUsuario: ${userName}\nCorreo: ${email}\n\n(En el siguiente paso, esta landing page desaparecerá y cargará el Dashboard de ${roleNames[loginAttemptRole]})`);
      }, 1500);
    }

    /* ========================================
       TOASTS
    ======================================== */
    function showToast(message, type = 'info') {
      const container = document.getElementById('toastContainer');
      const toast = document.createElement('div');
      toast.className = `toast ${type}`;
      const icons = { success: 'fa-check-circle', error: 'fa-exclamation-circle', info: 'fa-info-circle' };
      toast.innerHTML = `<i class="fas ${icons[type] || icons.info}"></i><span>${message}</span>`;
      container.appendChild(toast);
      setTimeout(() => {
        toast.classList.add('toast-out');
        setTimeout(() => toast.remove(), 300);
      }, 3500);
    }

    /* ========================================
       NAVBAR, SCROLL, PARTÍCULAS (Sin cambios)
    ======================================== */
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
      link.addEventListener('click', () => {
        navLinks.classList.remove('mobile-open');
        navToggle.innerHTML = '<i class="fas fa-bars"></i>';
      });
    });

    const revealObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => { if (entry.isIntersecting) entry.target.classList.add('visible'); });
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });
    document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));

    const counterObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const el = entry.target;
          animateCounter(el, parseInt(el.dataset.count));
          counterObserver.unobserve(el);
        }
      });
    }, { threshold: 0.5 });
    document.querySelectorAll('[data-count]').forEach(el => counterObserver.observe(el));

    function animateCounter(el, target) {
      let current = 0;
      const step = target / (1800 / 16);
      function update() {
        current += step;
        if (current >= target) { el.textContent = target; return; }
        el.textContent = Math.floor(current);
        requestAnimationFrame(update);
      }
      requestAnimationFrame(update);
    }