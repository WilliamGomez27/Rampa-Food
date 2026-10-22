# Rampa Food 🍔✈️

**Rampa Food** es una Aplicación Web Progresiva (PWA) diseñada para optimizar y gestionar la compra y venta de alimentos y bebidas en entornos operativos con turnos rotativos (como aeropuertos, centros logísticos o complejos empresariales). 

Permite a los compradores ordenar de forma inmediata sin necesidad de crear cuentas, y a los vendedores gestionar su disponibilidad por turnos, publicar su menú y despachar pedidos en tiempo real.

---

## 📋 Tabla de Contenidos
- [Características Principales](#-características-principales)
- [Roles y Flujos de Usuario](#-roles-y-flujos-de-usuario)
- [Arquitectura y Tecnologías](#-arquitectura-y-tecnologías)
- [Estructura del Proyecto](#-estructura-del-proyecto)
- [Lógica de Negocio Central](#-lógica-de-negocio-central)
- [Configuración y Puesta en Marcha](#-configuración-y-puesta-en-marcha)
- [Base de Datos y Supabase](#-base-de-datos-y-supabase)
- [Notificaciones Push y PWA](#-notificaciones-push-y-pwa)
- [Scripts Disponibles](#-scripts-disponibles)

---

## 🚀 Características Principales

- **Acceso Sin Fricción para Compradores:** Entrada instantánea mediante autenticación anónima transparente. Sin registros largos ni contraseñas.
- **Gestión Basada en Turnos:** Los vendedores programan días y horarios de atención; la plataforma solo muestra disponibles a quienes tienen turno activo e iniciaron sesión de servicio.
- **Pedidos en Tiempo Real:** Actualización bidireccional inmediata de pedidos entre comprador y vendedor respaldada por Supabase Realtime.
- **Notificaciones Push Nativas:** Avisos en dispositivo móvil o escritorio cuando un vendedor entra en turno o cuando cambia el estado de un pedido.
- **PWA Instalable:** Experiencia nativa en Android e iOS, soporte para pantalla completa (`standalone`), splash screen y adaptive icon maskable.
- **Panel Administrativo con Métricas:** Visualización de métricas de ventas, calificaciones y actividad mediante gráficos interactivos con ECharts.

---

## 👥 Roles y Flujos de Usuario

### 1. Comprador (`/`)
- **Acceso directo:** Al ingresar a la URL raíz, la app genera o recupera una sesión anónima en Supabase.
- **Exploración:** Visualiza vendedores activos clasificados por categoría ("Comida", "Bebidas", "Todos").
- **Avisos de disponibilidad:** Para vendedores fuera de turno, puede activar un recordatorio ("Avisarme") que envía una notificación push cuando el vendedor se conecte.
- **Carrito y Pedido:** Agrega productos, especifica observaciones o personalizaciones, y confirma su pedido. Se envía la orden a la base de datos y se ofrece confirmación directa vía WhatsApp.
- **Seguimiento y Calificación:** Rastrea el estado en vivo (Pendiente → En preparación → Listo → Entregado) y califica la atención recibida.

### 2. Vendedor (`/#vendedor`)
- **Autenticación formal:** Registro e inicio de sesión con correo y contraseña.
- **Mis Turnos:** Configuración de días de la semana y rangos horarios programados de atención.
- **Mi Menú:** Creación, edición, precios, imágenes y activación/desactivación de productos.
- **Estoy en Línea:** Apertura y cierre explícito de la sesión de atención cuando coincide con su turno programado.
- **Pedidos Entrantes:** Bandeja de pedidos en tiempo real con alertas sonoras/push y botones de cambio de estado.

### 3. Administrador (`/#admin`)
- **Acceso restringido:** Carga diferida (`lazy-loading`) y verificación de rol administrativo en servidor.
- **Métricas:** Resumen de volumen de ventas, tiempos de atención, calificaciones promedio y gráficas analíticas.

---

## 🛠 Arquitectura y Tecnologías

- **Frontend:**
  - [React 19](https://react.dev/) + [Vite 8](https://vitejs.dev/)
  - Vanilla CSS modularizado para rendimiento y control visual fino (`portada.css`, `fondo.css`, etc.)
  - [ECharts](https://echarts.apache.org/) para visualización de métricas analíticas
  - Enrutamiento ligero basado en Hash (`window.location.hash`) para compatibilidad directa con PWA y despliegues estáticos
- **Backend y Servicios (BaaS):**
  - [Supabase](https://supabase.com/):
    - **PostgreSQL:** Base de datos relacional con Row Level Security (RLS) estricto.
    - **Supabase Auth:** Autenticación mixta (anónima para clientes, email/password para vendedores/admin).
    - **Supabase Storage:** Almacenamiento optimizado de imágenes de productos y perfiles.
    - **Supabase Realtime:** Suscripciones a cambios en tablas (`pedidos`, `sesiones_en_linea`).
    - **Edge Functions:** Función en Deno/TypeScript (`enviar-push`) para procesar Web Push a través de disparadores SQL / Webhooks.

---

## 📂 Estructura del Proyecto

```text
rampa-food/
├── public/
│   ├── icon-192.png              # Ícono PWA estándar (192x192)
│   ├── icon-512.png              # Ícono PWA estándar (512x512)
│   ├── icon-512-maskable.png     # Ícono adaptativo para Android (área segura respetada)
│   ├── manifest.webmanifest      # Manifiesto de la aplicación web instalable
│   └── sw.js                     # Service Worker (recepción y clic de push notifications)
├── src/
│   ├── assets/                   # Ilustraciones y recursos gráficos (portada, fondo)
│   ├── components/               # Componentes reutilizables
│   │   ├── AvisosPush.jsx        # Gestión de permisos y suscripción push
│   │   ├── FormCalificacion.jsx  # Modal de calificación de servicio
│   │   ├── Grafica.jsx           # Renderizador de gráficos ECharts
│   │   ├── InfoBoton.jsx         # Componente flotante de ayuda y detalles
│   │   └── Portada.jsx           # Pantalla de bienvenida (splash animado)
│   ├── lib/                      # Capa de utilidades y lógica de negocio
│   │   ├── graficas.js           # Preparación de datasets para ECharts
│   │   ├── pedidos.js            # Construcción de pedidos y mensajes WhatsApp
│   │   ├── push.js               # Registro de SW, VAPID y sincronización push
│   │   └── utils.js              # Helpers de fechas, horas, formateo y subida de imágenes
│   ├── pages/                    # Vistas principales divididas por rol
│   │   ├── admin/
│   │   │   └── PanelAdmin.jsx    # Panel administrativo
│   │   ├── comprador/
│   │   │   ├── Inicio.jsx        # Lista de vendedores en turno
│   │   │   ├── MenuVendedor.jsx  # Catálogo del vendedor seleccionado
│   │   │   ├── Carrito.jsx       # Canasta de compra
│   │   │   ├── Confirmar.jsx     # Confirmación de datos y envío
│   │   │   ├── Seguimiento.jsx   # Estado en vivo del pedido
│   │   │   └── PanelComprador.jsx# Enrutador interno del comprador
│   │   ├── vendedor/
│   │   │   ├── EstoyEnLinea.jsx  # Control de conexión en turno
│   │   │   ├── MiMenu.jsx        # Gestión de productos
│   │   │   ├── MisTurnos.jsx     # Gestión de horarios
│   │   │   ├── PedidosEntrantes.jsx # Gestión de comandas
│   │   │   └── PanelVendedor.jsx # Enrutador interno del vendedor
│   │   ├── Auth.jsx              # Inicio de sesión de vendedores
│   │   └── Registro.jsx          # Registro de nuevos vendedores
│   ├── App.jsx                   # Componente raíz y control de sesión/rutas hash
│   ├── main.jsx                  # Punto de entrada de React y registro del SW
│   └── supabase.js               # Inicialización del cliente Supabase
├── supabase/
│   ├── functions/
│   │   └── enviar-push/          # Edge Function de envío de notificaciones
│   └── sql/                      # Scripts DDL/DML ordenados por dependencias
│       ├── 01_modelo_datos.sql
│       ├── 02_storage.sql
│       ├── 03_pedidos.sql
│       ├── 04_sin_registro.sql
│       ├── 05_push.sql
│       ├── 06_disparadores.sql
│       ├── 07_posiciones_calificaciones_metricas.sql
│       └── 99_diagnostico.sql
├── index.html                    # Plantilla HTML con metas PWA
├── package.json
└── vite.config.js
```

---

## ⚙️ Lógica de Negocio Central

1. **Ciclo de Sesión en `App.jsx`:**
   - La aplicación detecta el hash (`window.location.hash`). Si la ruta no es de vendedor o admin, activa `signInAnonymously()`.
   - Si el usuario navega a un área con cuenta (`#vendedor` o `#admin`), cierra la sesión anónima para permitir la autenticación de credenciales reales sin conflictos de tokens.
2. **Turnos vs. En Línea:**
   - Un vendedor no solo debe tener un turno programado en la tabla `turnos`, sino que debe activar su sesión en `sesiones_en_linea` mediante `EstoyEnLinea.jsx`.
   - Solo los vendedores con sesión abierta (`fin_real IS NULL`) dentro de su franja horaria aparecen en la lista de disponibles del comprador.
3. **Flujo de Notificaciones Web Push:**
   - Al aceptar notificaciones, el navegador genera una suscripción Web Push que se almacena en la tabla `suscripciones_push` vinculada al `user_id`.
   - Disparadores en PostgreSQL (`06_disparadores.sql`) invocan la Edge Function `enviar-push` mediante webhooks HTTP cuando se crea un pedido o un vendedor inicia sesión.

---

## 💻 Configuración y Puesta en Marcha

### Prerrequisitos
- Node.js 18+ instalado.
- Cuenta de [Supabase](https://supabase.com).


###  Variables de Entorno
Crea un archivo `.env.local` en la raíz del proyecto basándote en el siguiente esquema:

```env
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu-anon-key-de-supabase
VITE_VAPID_PUBLIC_KEY=tu-clave-publica-vapid-para-push
```

###  Ejecución Local
```bash
npm run dev
```
Abre en tu navegador `http://localhost:5173`.

---

## 🗄 Base de Datos y Supabase

Los esquemas SQL se encuentran en `supabase/sql/`. Deben ejecutarse en orden ascendente en el **SQL Editor** de Supabase:

1. `01_modelo_datos.sql`: Esquema base de tablas, constraints, enums y RLS.
2. `02_storage.sql`: Políticas de acceso para los buckets de Storage de imágenes.
3. `03_pedidos.sql`: Procedimientos almacenados para la creación y transición de estados de pedidos.
4. `04_sin_registro.sql`: Políticas de RLS para lectura y pedido por usuarios anónimos.
5. `05_push.sql`: Estructura para registrar suscripciones push por dispositivo.
6. `06_disparadores.sql`: Triggers que notifican a la Edge Function (reemplaza `TU-SECRETO` por tu webhook secret configurado).
7. `07_posiciones_calificaciones_metricas.sql`: Vistas y funciones para el cálculo de métricas del panel administrativo.
8. `99_diagnostico.sql`: Consultas de utilidad para verificar consistencia y permisos.

---

## 🔔 Notificaciones Push y PWA

- **Edge Function:**
  Despliega la función `enviar-push` con el CLI de Supabase:
  ```bash
  supabase functions deploy enviar-push --no-verify-jwt
  ```
  Configura en Supabase los siguientes secretos:
  `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (email de contacto) y `WEBHOOK_SECRET`.

- **Instalación PWA:**
  La aplicación cumple con todos los estándares modernos de PWA:
  - Archivo `manifest.webmanifest` con `display: standalone` y esquema de íconos adaptativos.
  - Service Worker registrado al iniciar la app (`main.jsx`).
  - Compatible con modo offline básico y recepción de eventos push en segundo plano.

---

## 📜 Scripts Disponibles

- `npm run dev`: Inicia el servidor de desarrollo Vite con Hot Module Replacement (HMR).
- `npm run build`: Genera el bundle de producción optimizado en la carpeta `dist/`.
- `npm run preview`: Levanta un servidor local para inspeccionar la versión de producción antes de desplegar.
- `npm run lint`: Ejecuta el linter ultrarrápido [oxlint](https://oxc.rs/) para validar buenas prácticas y detectar errores.
