# Sistema de Gestión de Ayudantías - UCN

## Descripción del Proyecto
Plataforma web desarrollada para optimizar, descentralizar y administrar el proceso de postulación y selección de ayudantes en la Universidad Católica del Norte. El sistema conecta a estudiantes interesados en ejercer como ayudantes con los docentes que requieren apoyo en sus asignaturas, estandarizando el flujo de aprobación y rechazo mediante una arquitectura Cliente-Servidor.

## Arquitectura del Sistema
El proyecto está construido bajo un patrón de arquitectura Cliente-Servidor, separando claramente la capa de presentación (Frontend) de la lógica de negocio y persistencia de datos (Backend + Base de Datos).

* **Frontend:** Vanilla JavaScript, HTML5 y CSS3. Aplicación de página única (SPA) modularizada que maneja vistas basadas en roles (Estudiante, Docente, Administrador).
* **Backend:** Python con FastAPI. Encargado de exponer la API RESTful, validación de esquemas de datos y lógica de negocio.
* **Base de Datos:** Supabase (PostgreSQL). Actúa como servicio de persistencia para ramos, postulaciones y usuarios.

## Estructura del Repositorio y Módulos

El proyecto se divide en dos grandes bloques lógicos: el directorio `backend/` y los archivos de la raíz que componen el `frontend`.

### 1. Capa Backend (`/backend`)
Contiene la lógica central del servidor y la conexión a la base de datos.

* `database.py`: Módulo de persistencia. Se encarga de inicializar el cliente de Supabase y cargar de manera segura las variables de entorno (`SUPABASE_URL`, `SUPABASE_KEY`) mediante `dotenv`.
* `main.py`: Módulo principal y enrutador de la API. Inicializa la aplicación FastAPI, configura los middlewares (CORS) y define los endpoints. Además, aloja las **clases de dominio (Modelos de Pydantic)** que estructuran el intercambio de datos.

#### Clases y Modelos de Datos (Pydantic)
Estas clases validan y tipan los datos que ingresan al sistema. Serán fundamentales para el modelado de clases posterior:

* **`Postulacion`**: Estructura de datos para crear una nueva solicitud de ayudantía.
    * Atributos: `nrc_ramo` (str), `rut_estudiante` (str), `nombre_estudiante` (str), `nota_obtenida` (float).
* **`ActualizarEstado`**: Estructura para que los docentes aprueben o rechacen postulaciones.
    * Atributos: `nrc_ramo` (str), `rut_estudiante` (str), `nuevo_estado` (str).
* **`EstudianteRegistro`**: Estructura para la creación de nuevas cuentas de estudiante.
    * Atributos: `rut` (str), `nombre` (str), `correo` (str), `password` (str).
* **`EstudianteLogin`**: Estructura para la autenticación de usuarios.
    * Atributos: `correo` (str), `password` (str).

### 2. Capa Frontend (Directorio Raíz)
Encargada de la interfaz de usuario y del consumo de la API REST.

* `index.html`: Punto de entrada de la aplicación. Contiene la estructura del DOM para la Landing Page, el Panel de Estudiante y el Panel Docente.
* `css/styles.css`: Hojas de estilo centralizadas. Define variables de entorno visual (colores, sombras) y el diseño responsivo general del aplicativo.
* `js/ui.js`: Controlador principal del cliente. Maneja los eventos del DOM, la renderización dinámica de componentes (tarjetas de ramos, tablas de postulación) y encapsula las llamadas asíncronas (`fetch`) a la API de FastAPI.
* `js/dataStudents.js`: Módulo de datos simulados (Mock). Provee la estructura inicial de datos académicos del estudiante logueado (RUT, nombre, PPA y diccionario de notas por asignatura) para la lógica de validación del frontend.
* `js/particles.js`: Módulo gráfico independiente que renderiza el fondo interactivo utilizando la API de Canvas de HTML5.

## Resumen de Endpoints (API REST)

| Método | Endpoint | Descripción |
| :--- | :--- | :--- |
| `GET` | `/api/ramos` | Retorna el listado completo de asignaturas disponibles desde Supabase. |
| `POST` | `/api/postular` | Registra una nueva postulación y actualiza el contador de postulantes del ramo. |
| `GET` | `/api/postulaciones` | Obtiene todas las postulaciones activas para el panel de revisión docente. |
| `PUT` | `/api/postulaciones/estado` | Modifica el estado (`aceptado`/`rechazado`) de una postulación. |
| `POST` | `/api/login` | Valida credenciales contra la tabla de estudiantes. |
| `POST` | `/api/registro` | Crea un nuevo registro de estudiante en la base de datos. |

## Instrucciones de Despliegue Local

### Requisitos Previos
* Python 3.10 o superior.
* Git.
* Una cuenta en Supabase con las tablas configuradas (`ramos`, `postulaciones`, `estudiantes`).

### Pasos de Configuración del Backend

1. Clonar el repositorio:
   ```bash
   git clone <url-del-repositorio>
   cd <nombre-del-directorio>
