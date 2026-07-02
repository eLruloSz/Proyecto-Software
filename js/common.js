/* ========================================
   common.js
   Lógica compartida por las 3 páginas (index, estudiante, docente):
   - Manejo de sesión (localStorage) para que sobreviva al cambiar de página
   - Toasts
   - Modales de login (Google Workspace mock)
   ======================================== */

const API_URL = 'http://127.0.0.1:8000';

/* ---------- SESIÓN (localStorage) ----------
   Antes esto vivía en variables JS (extractedUserName, loginAttemptRole)
   y se perdía al navegar a otra página. Ahora vive en localStorage,
   así que sobrevive al cambio de archivo .html. */

const Sesion = {
  guardar({ rol, nombre, correo, rut }) {
    localStorage.setItem('userRole', rol);
    localStorage.setItem('userName', nombre);
    localStorage.setItem('userEmail', correo);
    if (rut) localStorage.setItem('userRut', rut);
  },
  obtener() {
    return {
      rol: localStorage.getItem('userRole'),
      nombre: localStorage.getItem('userName'),
      correo: localStorage.getItem('userEmail'),
      rut: localStorage.getItem('userRut')
    };
  },
  limpiar() {
    localStorage.removeItem('userRole');
    localStorage.removeItem('userName');
    localStorage.removeItem('userEmail');
    localStorage.removeItem('userRut');
  },
  /**
   * Llamar al inicio de estudiante.html o docente.html.
   * Si no hay sesión válida para el rol esperado, redirige a index.html.
   * rolesPermitidos: array, ej. ['docente', 'admin']
   */
  exigirRol(rolesPermitidos) {
    const { rol } = this.obtener();
    if (!rol || !rolesPermitidos.includes(rol)) {
      window.location.href = 'index.html';
      return null;
    }
    return this.obtener();
  }
};

/* ---------- TOASTS ---------- */

function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  const icons = { success: 'fa-check-circle', error: 'fa-exclamation-circle', info: 'fa-info-circle' };
  toast.innerHTML = `<i class="fas ${icons[type] || icons.info}"></i><span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => { toast.classList.add('toast-out'); setTimeout(() => toast.remove(), 300); }, 3500);
}

/* ========================================
   MODALES LOGIN (Google Workspace Mock)
   Usado solo desde index.html, pero vive aquí porque
   comparte lógica de sesión con las otras páginas.
   ======================================== */

let loginAttemptRole = null;
let extractedUserName = ""; // Nombre extraído del correo mientras se escribe

function openModal(type) {
  document.getElementById('modalTitle').textContent = 'Autenticación UCN';
  document.getElementById('modalBody').innerHTML = buildRBACLogin();
  document.getElementById('modalOverlay').classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeModal() { document.getElementById('modalOverlay').classList.remove('active'); document.body.style.overflow = ''; }
function closeGoogleMock() { document.getElementById('googleMockOverlay').classList.remove('active'); document.body.style.overflow = ''; }

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

async function handleMockLogin() {
  const email = document.getElementById('mockEmail').value.trim();
  const pass = document.getElementById('mockPass').value.trim();

  const domainMap = { estudiante: '@alumnos.ucn.cl', docente: '@ce.ucn.cl', admin: '@ucn.cl' };
  const requiredDomain = domainMap[loginAttemptRole];

  if (!email) { showToast('Debes ingresar tu correo.', 'error'); return; }
  if (!email.endsWith(requiredDomain)) {
    showToast(`Error: El correo debe terminar sí o sí en ${requiredDomain}`, 'error');
    return;
  }
  if (!pass) { showToast('Debes ingresar tu contraseña.', 'error'); return; }
  if (pass.length < 4) { showToast('Contraseña incorrecta.', 'error'); return; }

  try {
    const btn = document.querySelector('#googleMockBody .btn-primary');
    const textoOriginal = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Verificando...';
    btn.disabled = true;

    const response = await fetch(`${API_URL}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ correo: email, password: pass, rol: loginAttemptRole })
    });

    btn.innerHTML = textoOriginal;
    btn.disabled = false;

    if (response.status === 404 && loginAttemptRole === 'estudiante') {
      showToast('No tienes cuenta. Debes registrarte por primera vez.', 'info');
      return;
    }

    if (!response.ok) {
      throw new Error("Contraseña incorrecta o error de servidor.");
    }

    const data = await response.json();
    const nombreFinal = (data.usuario && data.usuario.nombre) ? data.usuario.nombre : extractedUserName;
    const rutFinal = (data.usuario && data.usuario.rut) ? data.usuario.rut : null;

    showToast(`Bienvenido/a, ${nombreFinal}. Redirigiendo...`, 'success');
    closeGoogleMock();

    // Guardamos la sesión en localStorage para que sobreviva al cambio de página
    Sesion.guardar({ rol: loginAttemptRole, nombre: nombreFinal, correo: email, rut: rutFinal });

    setTimeout(() => {
      if (loginAttemptRole === 'estudiante') {
        window.location.href = 'estudiante.html';
      } else if (loginAttemptRole === 'docente' || loginAttemptRole === 'admin') {
        window.location.href = 'docente.html';
      }
    }, 1000);

  } catch (error) {
    showToast(error.message, 'error');
  }
}

/* ---------- Listeners comunes de los modales de login (solo aplican si existen en la página) ---------- */
document.addEventListener('DOMContentLoaded', () => {
  const modalOverlay = document.getElementById('modalOverlay');
  const googleMockOverlay = document.getElementById('googleMockOverlay');

  if (modalOverlay) {
    modalOverlay.addEventListener('click', (e) => { if (e.target === e.currentTarget) closeModal(); });
  }
  if (googleMockOverlay) {
    googleMockOverlay.addEventListener('click', (e) => { if (e.target === e.currentTarget) closeGoogleMock(); });
  }
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeModal(); closeGoogleMock(); } });
});