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

    let loginAttemptRole = null;
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