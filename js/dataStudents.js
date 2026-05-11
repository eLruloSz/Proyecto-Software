/* ========================================
       DATOS MOCK DEL ESTUDIANTE
    ======================================== */
    const studentData = {
      name: "Abraham Sepúlveda",
      rut: "21.290.036-2",
      email: "abraham.sepulveda@alumnos.ucn.cl",
      ppa: 5.4,
      // Historial de notas (Física I está reprobada con 3.8, por eso no le aparece)
      notas: {
        'NRC:12900': 5.5, 'NRC:10409': 6.1, 'NRC:10413': 4.5, 
        'NRC:10404': 3.8, 'NRC:11539': 5.8
      }
    };
