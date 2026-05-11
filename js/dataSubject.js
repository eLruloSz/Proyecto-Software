// 1. Declaramos la variable vacía (usamos 'let' para poder modificarla)
let coursesData = [];

// 2. Creamos la función que conecta con FastAPI
async function cargarRamosDesdeBackend() {
    try {
        // Hacemos la petición a tu servidor local
        const respuesta = await fetch('http://localhost:8000/api/ramos');
        const datosBaseDatos = await respuesta.json();

        // 3. Mapeamos los datos: conectamos Supabase con tus variables de JS
        coursesData = datosBaseDatos.map(ramo => ({
            code: ramo.codigo_nrc,
            name: ramo.nombre_ramo,
            prof: ramo.profesor || "Por asignar", // Si el profe está en NULL, pone esto
            dept: ramo.departamento,
            slots: ramo.cupos,
            applicants: ramo.postulantes,
            open: ramo.esta_abierto
        }));

        // 4. ¡A dibujar! Llamamos a tu función de siempre
        renderCourses(); 

    } catch (error) {
        console.error("Hubo un error conectando al backend:", error);
        // Opcional: Podrías poner aquí un document.getElementById('coursesGrid').innerHTML = "Error de conexión";
    }
}

// 5. Ejecutamos la conexión apenas se lea el archivo
cargarRamosDesdeBackend();