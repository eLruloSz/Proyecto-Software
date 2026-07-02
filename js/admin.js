
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
      <div class="dash-course-card" style="border-left: 4px solid var(--warning); position: relative;">
        <button onclick="eliminarAyudantia('${c.codigo_nrc}')" 
                style="position: absolute; top: 12px; right: 12px; background: transparent; border: none; color: var(--danger); cursor: pointer; font-size: 1.1rem; padding: 4px; transition: 0.2s;" 
                onmouseover="this.style.transform='scale(1.1)'" onmouseout="this.style.transform='scale(1)'"
                title="Eliminar esta ayudantía">
          <i class="fas fa-trash-alt"></i>
        </button>
        
        <div class="card-top">
          <span class="course-code">NRC: ${c.codigo_nrc}</span>
          <span style="font-size:0.8rem; color:var(--muted); margin-right: 30px;">${c.cupos} cupos</span>
        </div>
        <h3 style="padding-right: 20px;">${c.nombre_ramo}</h3>
        <div class="meta"><i class="fas fa-id-badge"></i> RUT Prof: ${c.id_profesor_encargado}</div>
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

// --- NUEVA FUNCIÓN PARA ELIMINAR AYUDANTÍA ---
async function eliminarAyudantia(nrc) {
  // Siempre es buena práctica pedir confirmación antes de un DELETE
  const confirmar = confirm(`¿Estás seguro de que deseas eliminar la ayudantía para el NRC ${nrc}? Esta acción no se puede deshacer.`);
  if (!confirmar) return;

  try {
    const response = await fetch(`${API_URL}/api/admin/ayudantias/${nrc}`, {
      method: 'DELETE'
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || "Ocurrió un error al intentar eliminar la ayudantía.");
    }

    // Mostramos éxito y recargamos la grilla
    showToast(`La ayudantía (NRC: ${nrc}) fue eliminada con éxito.`, 'success');
    cargarAyudantiasConfiguradas();

  } catch (error) {
    console.error("Error al eliminar:", error);
    showToast(error.message, 'error');
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

// --- NUEVA FUNCIÓN PARA GATILLAR LA SINCRONIZACIÓN CON LA API UCN ---
async function sincronizarDatosUCN() {
  const btn = document.getElementById('btnSincronizar');
  if (!btn) return;

  // Guardamos el estado original del botón y activamos el estado de carga
  const textoOriginal = btn.innerHTML;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sincronizando...';
  btn.disabled = true;

  try {
    const response = await fetch(`${API_URL}/api/admin/sincronizar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ periodo: "202520" }) // Puedes ajustar el periodo por defecto según lo requieras
    });

    if (!response.ok) throw new Error('Ocurrió un problema al sincronizar con el servidor central de la UCN.');

    const respuestaJson = await response.json();
    const resumen = respuestaJson.data || {};

    // Desplegamos un Toast detallando el éxito de la operación
    showToast(
      `¡Sincronización exitosa! Se procesaron ${resumen.asignaturas || 0} ramos, ${resumen.estudiantes || 0} estudiantes y ${resumen.notas || 0} calificaciones históricas.`, 
      'success'
    );

    // Recargamos los selectores del formulario y las ayudantías para mostrar los datos recién importados
    await cargarSelects();
    await cargarAyudantiasConfiguradas();

  } catch (error) {
    console.error(error);
    showToast(error.message || 'Error de conexión durante la sincronización.', 'error');
  } finally {
    // Restauramos el botón a su estado normal
    btn.innerHTML = textoOriginal;
    btn.disabled = false;
  }
}