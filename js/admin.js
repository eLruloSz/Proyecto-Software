
document.addEventListener('DOMContentLoaded', () => {
  
  
document.getElementById('selectRamo').addEventListener('change', async (e) => {
  const codigoRamo = e.target.value;
  const datalist = document.getElementById('nrcSuggestions');
  

  datalist.innerHTML = '';
  
  if (!codigoRamo) return;
  
  try {
    const res = await fetch(`${API_URL}/api/admin/ramos/${codigoRamo}/nrcs`);
    if (!res.ok) throw new Error("No se pudieron obtener las sugerencias");
    
    const nrcs = await res.json();
    
    
    datalist.innerHTML = nrcs.map(nrc => `<option value="${nrc}"></option>`).join('');
  } catch (error) {
    console.error("Error al cargar sugerencias de NRC:", error);
  }
});
  
  
  
  const sesion = Sesion.exigirRol(['admin']);
  if (!sesion) return;

  document.getElementById('adminHeaderName').textContent = sesion.nombre || 'Admin';
  
  
  cargarSelects();
  cargarAyudantiasConfiguradas();

  document.getElementById('formApertura').addEventListener('submit', handleApertura);
});

async function cargarSelects() {
  try {
    
    const resRamos = await fetch(`${API_URL}/api/ramos/catalogo`);
    const ramos = await resRamos.json();
    const selectRamo = document.getElementById('selectRamo');
    selectRamo.innerHTML = '<option value="">-- Selecciona un Ramo --</option>' + 
      ramos.map(r => `<option value="${r.codigo}">${r.codigo} - ${r.nombre}</option>`).join('');

    const resProfes = await fetch(`${API_URL}/api/profesores`);
    const profesores = await resProfes.json();
    const selectProfe = document.getElementById('selectProfesor');
    selectProfe.innerHTML = '<option value="">-- Selecciona un Profesor --</option>' + 
      profesores.map(p => `<option value="${p.rut}">${p.nombre} (RUT: ${p.rut})</option>`).join('');

  } catch (error) {
    showToast('Error al cargar la base de datos de ramos/profesores.', 'error');
  }
}

async function cargarAyudantiasConfiguradas() {
  const grid = document.getElementById('adminAyudantiasGrid');
  try {
    const response = await fetch(`${API_URL}/api/ramos`);
    const data = await response.json();
    
    if (data.length === 0) {
      grid.innerHTML = '<p style="color:var(--muted); grid-column:span 2;">No hay ayudantías configuradas actualmente.</p>';
      return;
    }

    grid.innerHTML = data.map(c => `
      <div class="dash-course-card" style="border-left: 4px solid var(--warning);">
        <div class="card-top">
          <span class="course-code">NRC: ${c.codigo_nrc}</span>
          <span style="font-size:0.8rem; color:var(--muted);">${c.cupos} cupos</span>
        </div>
        <h3>${c.nombre_ramo}</h3>
        <div class="meta"><i class="fas fa-chalkboard-teacher"></i> Docente: ${c.id_profesor_encargado}</div>
        <div class="meta"><i class="fas fa-users"></i> ${c.postulantes} Postulantes actuales</div>
        <div style="margin-top: 10px; font-size:0.8rem; font-weight:bold; color: ${c.esta_abierto ? 'var(--success)' : 'var(--danger)'}">
          ${c.esta_abierto ? '● ABIERTA PARA POSTULAR' : '● CERRADA'}
        </div>
      </div>
    `).join('');
  } catch (error) {
    grid.innerHTML = '<p style="color:var(--danger);">Error al cargar las ayudantías.</p>';
  }
}

async function handleApertura(e) {
  e.preventDefault();
  
  const payload = {
    nrc: document.getElementById('inputNrc').value.trim(),
    codigo_ramo: document.getElementById('selectRamo').value,
    rut_profesor: document.getElementById('selectProfesor').value,
    cupos: parseInt(document.getElementById('inputCupos').value)
  };

  const btn = e.target.querySelector('button[type="submit"]');
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';
  btn.disabled = true;

  try {
    const response = await fetch(`${API_URL}/api/admin/ayudantias`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) throw new Error('Ocurrió un error al guardar en la base de datos');

    showToast('Ayudantía configurada exitosamente', 'success');
    e.target.reset(); 
    cargarAyudantiasConfiguradas(); 
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    btn.innerHTML = '<i class="fas fa-plus"></i> Abrir Ayudantía';
    btn.disabled = false;
  }
}