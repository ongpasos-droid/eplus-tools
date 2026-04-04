# TASKS — eplus-tools dev-vps

> Última actualización: 2026-04-03
> Regla: máx 3-4 acciones por bloque. Hacer push al terminar cada bloque. Al retomar, leer este archivo primero.

---

## TAREA 3 — Registro controlado (invitación / aprobación)

**Objetivo:** Los nuevos usuarios no pueden registrarse libremente. Solo pueden entrar por invitación de un admin o tras aprobación manual.

### Bloque 3.1 — Migración DB [ ]
- Crear `021_user_invitations.sql`: tabla `user_invitations` (id, email, token, used, created_by, created_at, expires_at)
- Añadir columna `status` a tabla `users`: enum('pending','active','disabled'), default 'active' para existentes
- Push inmediato

### Bloque 3.2 — Backend invitaciones [ ]
- Crear `node/src/modules/auth/invitations.js`: generar token, enviar email (o devolver link), marcar usado
- Añadir rutas en auth/routes.js: `POST /v1/auth/invite` (solo admin), `GET /v1/auth/register/:token`
- Push inmediato

### Bloque 3.3 — Frontend registro por token [ ]
- Modificar `public/index.html`: añadir vista "register" con form (nombre, password) que lee token de URL
- Modificar `public/js/app.js`: manejar ruta `/register?token=XXX`, llamar API, redirigir al login
- Push inmediato

### Bloque 3.4 — Panel admin: gestión usuarios [ ]
- Añadir sección "Usuarios" en admin panel (listar, cambiar status, generar invitación)
- Añadir rutas en admin/routes.js: `GET /v1/admin/users`, `PATCH /v1/admin/users/:id/status`, `POST /v1/admin/users/invite`
- Push inmediato

---

## TAREA 4 — Dashboard con datos reales

**Objetivo:** El dashboard muestra contadores y actividad real del usuario desde la DB, no placeholders.

### Bloque 4.1 — Endpoint stats [ ]
- Crear `node/src/modules/dashboard/model.js`: queries para contar proyectos, socios, actividades del usuario
- Crear `node/src/modules/dashboard/routes.js`: `GET /v1/dashboard/stats`
- Registrar en server.js
- Push inmediato

### Bloque 4.2 — Frontend stats [ ]
- Modificar `public/js/app.js`: en `navigate('dashboard')`, llamar `/v1/dashboard/stats` y pintar datos
- Actualizar cards del dashboard en HTML con ids para poder inyectar datos
- Push inmediato

### Bloque 4.3 — Actividad reciente [ ]
- Añadir query de actividad reciente (últimas 5 acciones: proyectos/socios creados/modificados)
- Renderizar lista de actividad en dashboard
- Push inmediato

---

## TAREA 5 — Editor inline en Data E+ (admin panel)

**Objetivo:** Las secciones de Data E+ (países, per diem, categorías personal) permiten editar directamente en la tabla, sin modales separados.

### Bloque 5.1 — Inline edit países [ ]
- En `public/js/admin.js`, sección countries: al clicar celda → `contenteditable=true`, guardar con blur/Enter
- Conectar con `PATCH /v1/admin/countries/:id`
- Push inmediato

### Bloque 5.2 — Inline edit per diem y categorías [ ]
- Mismo patrón para `perdiem` y `workers` sections
- Extraer helper `makeInlineEditable(cell, saveCallback)` para reutilizar
- Push inmediato

### Bloque 5.3 — Inline edit convocatorias (programs) [ ]
- Mismo patrón para programs (campos: nombre, año, activo)
- Eliminar el texto "Próximamente" del panel
- Push inmediato

---

## URGENTE (antes de las tareas de arriba)

### Bloque U.1 — Credenciales DB y Docker socket [ ]
- Añadir en Coolify env vars del bot: DB_HOST, DB_PORT, DB_USER, DB_PASS, DB_NAME
- Añadir `/var/run/docker.sock:/var/run/docker.sock` en compose volumes
- (Requiere acción manual de Oscar en Coolify UI)

### Bloque U.2 — Migración y rol admin [ ]
- Ejecutar `020_admin_ref_tables.sql` en MySQL
- `UPDATE users SET role='admin' WHERE email='oscarargumosa@gmail.com'`
- Verificar panel admin visible en intake.eufundingschool.com
- (Requiere acceso MySQL — pendiente de credenciales)

### Bloque U.3 — Merge dev-vps → main [ ]
- Claude PC hace merge de dev-vps a main
- Coolify auto-deploy al push en main
- (Pendiente de configurar webhook en Coolify)

---

## COMPLETADAS

- [DONE] Resumen matutino (morning-summary-v2.cjs + scheduler.js)
- [DONE] Fix container Docker (node:22 image)
- [DONE] Panel admin Data E+ — estructura base (convocatorias, países, per diem, personal)
- [DONE] Fix bugs admin panel (uuid, API.del, Toast, titles)
- [DONE] Credenciales Coolify y GitHub en .env y memoria
