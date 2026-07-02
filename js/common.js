/* ========================================
   common.js
   ======================================== */

const API_URL = 'http://127.0.0.1:8000';

const Sesion = {
  guardar({ rol, nombre, correo, rut, ppa }) {
    localStorage.setItem('userRole', rol);
    localStorage.setItem('userName', nombre);
    localStorage.setItem('userEmail', correo);
    if (rut) localStorage.setItem('userRut', rut);
    if (ppa !== undefined && ppa !== null) localStorage.setItem('userPpa', ppa);
  },
  obtener() {
    return {
      rol: localStorage.getItem('userRole'),
      nombre: localStorage.getItem('userName'),
      correo: localStorage.getItem('userEmail'),
      rut: localStorage.getItem('userRut'),
      ppa: localStorage.getItem('userPpa')
    };
  },
  limpiar() {
    localStorage.removeItem('userRole');
    localStorage.removeItem('userName');
    localStorage.removeItem('userEmail');
    localStorage.removeItem('userRut');
    localStorage.removeItem('userPpa');
  },
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

/* ---------- MODAL LOGIN ---------- */
function openModal(type) {
  document.getElementById('modalTitle').textContent = 'Iniciar sesión';
  document.getElementById('modalBody').innerHTML = buildRutLogin();
  document.getElementById('modalOverlay').classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeModal() { document.getElementById('modalOverlay').classList.remove('active'); document.body.style.overflow = ''; }
function closeGoogleMock() { document.getElementById('googleMockOverlay').classList.remove('active'); document.body.style.overflow = ''; }

function buildRutLogin() {
  return `
    <p style="color: var(--fg-secondary); margin-bottom: 1.5rem; font-size: 0.95rem;">Ingresa tu RUT o Usuario institucional.</p>
    <div class="form-group" style="text-align: left;">
      <label for="loginRut">Usuario / RUT</label>
      <input type="text" id="loginRut" class="form-input" placeholder="Ej: 12345678-9 o admin">
    </div>
    <div class="form-group" style="text-align: left; margin-top: 1.5rem;">
      <label for="loginPass">Contraseña</label>
      <input type="password" id="loginPass" class="form-input" placeholder="Tu contraseña">
    </div>
    <button class="btn btn-primary" style="width: 100%; justify-content: center; margin-top: 1.5rem;" onclick="handleRutLogin()">
      Ingresar
    </button>
    <div id="loginError" style="color: var(--danger); font-size: 0.85rem; text-align: center; margin-top: 1rem; display: none;"></div>
  `;
}

async function handleRutLogin() {
  const rut = document.getElementById('loginRut').value.trim();
  const pass = document.getElementById('loginPass').value.trim();
  const errorDiv = document.getElementById('loginError');
  errorDiv.style.display = 'none';

  if (!rut || !pass) {
    errorDiv.textContent = 'Debes ingresar Usuario/RUT y contraseña.';
    errorDiv.style.display = 'block';
    return;
  }

  try {
    const btn = document.querySelector('#modalBody .btn-primary');
    const textoOriginal = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Verificando...';
    btn.disabled = true;

    const response = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rut, password: pass })
    });

    btn.innerHTML = textoOriginal;
    btn.disabled = false;

    if (response.status === 403) {
      const data = await response.json();
      
      let rolTabla = 'estudiante';
      if (data.detail === 'NEEDS_ACTIVATION_PROFESSOR') {
        rolTabla = 'profesor';
      } else if (data.detail === 'NEEDS_ACTIVATION_ADMIN') {
        rolTabla = 'admin';
      }
      
      closeModal();
      showActivationScreen(rut, rolTabla);
      return;
    }

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      errorDiv.textContent = data.detail || 'Credenciales incorrectas.';
      errorDiv.style.display = 'block';
      return;
    }

    const data = await response.json();
    const usuario = data.user || {};
    const rolFinal = data.rol;

    showToast(`Bienvenido/a, ${usuario.nombre || rut}. Redirigiendo...`, 'success');
    closeModal();

    Sesion.guardar({ rol: rolFinal, nombre: usuario.nombre, correo: usuario.correo || '', rut: usuario.rut || rut, ppa: usuario.ppa });

    setTimeout(() => {
      if (rolFinal === 'admin') {
        window.location.href = 'admin.html';
      } else if (rolFinal === 'profesor') {
        window.location.href = 'docente.html';
      } else {
        window.location.href = 'estudiante.html';
      }
    }, 800);

  } catch (error) {
    errorDiv.textContent = 'Error de conexión con el servidor.';
    errorDiv.style.display = 'block';
  }
}

function showActivationScreen(rut, rolTabla) {
  document.getElementById('googleMockBody').innerHTML = `
    <div style="margin-bottom: 1.5rem;">
      <p style="font-size: 1.05rem; font-weight: 600; color: var(--fg);">Primer ingreso</p>
      <p style="font-size: 0.9rem; color: var(--muted); margin-top: 5px;">
        Usuario <strong>${rut}</strong> encontrado. Crea tu contraseña para continuar.
      </p>
    </div>
    <div class="form-group" style="text-align: left;">
      <label for="newPass">Nueva contraseña</label>
      <input type="password" id="newPass" class="form-input" placeholder="Mínimo 6 caracteres">
    </div>
    <div class="form-group" style="text-align: left; margin-top: 1rem;">
      <label for="confirmPass">Repetir contraseña</label>
      <input type="password" id="confirmPass" class="form-input" placeholder="Repite tu contraseña">
    </div>
    <button class="btn btn-primary" style="width: 100%; justify-content: center; margin-top: 1.5rem;" onclick="handleActivacion('${rut}', '${rolTabla}')">
      Crear contraseña e ingresar
    </button>
    <div id="activarError" style="color: var(--danger); font-size: 0.85rem; text-align: center; margin-top: 1rem; display: none;"></div>
  `;
  document.getElementById('googleMockOverlay').classList.add('active');
  document.body.style.overflow = 'hidden';
}

async function handleActivacion(rut, rolTabla) {
  const newPass = document.getElementById('newPass').value.trim();
  const confirmPass = document.getElementById('confirmPass').value.trim();
  const errorDiv = document.getElementById('activarError');
  errorDiv.style.display = 'none';

  if (newPass.length < 6) {
    errorDiv.textContent = 'La contraseña debe tener al menos 6 caracteres.';
    errorDiv.style.display = 'block';
    return;
  }
  if (newPass !== confirmPass) {
    errorDiv.textContent = 'Las contraseñas no coinciden.';
    errorDiv.style.display = 'block';
    return;
  }

  try {
    const response = await fetch(`${API_URL}/api/auth/activar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rut, nueva_password: newPass, rol: rolTabla })
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      errorDiv.textContent = data.detail || 'No se pudo activar la cuenta.';
      errorDiv.style.display = 'block';
      return;
    }

    showToast('Cuenta activada. Ahora inicia sesión con tu nueva contraseña.', 'success');
    closeGoogleMock();
    openModal('login');

  } catch (error) {
    errorDiv.textContent = 'Error de conexión con el servidor.';
    errorDiv.style.display = 'block';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const modalOverlay = document.getElementById('modalOverlay');
  const googleMockOverlay = document.getElementById('googleMockOverlay');

  if (modalOverlay) modalOverlay.addEventListener('click', (e) => { if (e.target === e.currentTarget) closeModal(); });
  if (googleMockOverlay) googleMockOverlay.addEventListener('click', (e) => { if (e.target === e.currentTarget) closeGoogleMock(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeModal(); closeGoogleMock(); } });
});