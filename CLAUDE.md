# E+ Tools — Reglas para Claude Code

## Protocolo de ramas

Este repo tiene dos Claudes trabajando en paralelo:

| Claude | Rama | Cuándo trabaja |
|---|---|---|
| Claude Local (PC) | `dev-local` | Día, sesiones presenciales |
| Claude VPS (Bot Telegram) | `dev-vps` | Noche, sesiones asíncronas |

### Reglas absolutas
1. **NUNCA** hacer push directo a `main`
2. **NUNCA** hacer push a la rama del otro Claude
3. **NUNCA** hacer force push en ninguna rama
4. **NUNCA** hacer rebase de ramas compartidas
5. **SIEMPRE** hacer pull antes de empezar a trabajar
6. **SIEMPRE** hacer merge de main en tu rama antes de empezar

### Antes de trabajar
```bash
git checkout <tu-rama>        # dev-local o dev-vps
git pull origin <tu-rama>
git merge origin/main         # incorporar cambios de producción
```

### Merge a main
- Solo **Claude Local** hace merge a `main`, cuando **Oscar lo indique**.
- Antes de fusionar, revisar si `dev-vps` tiene cambios pendientes que también deban entrar.
- Coolify despliega automáticamente cada push a `main`.

### Resolución de conflictos
- **Técnicos** (imports, config, estructura) → la mejor lógica gana.
- **Funcionales** (dos implementaciones del mismo feature) → la mejor solución gana. En empate, prevalece `dev-local`.
- **Negocio** (flujo de usuario, decisiones de producto) → siempre preguntar a Oscar.

## Stack técnico
- **Backend:** Node.js + Express, MySQL (mysql2), JWT auth
- **Frontend:** Vanilla JS (SPA), Tailwind CDN, Material Symbols
- **Deploy:** Coolify desde `main` → `intake.eufundingschool.com`
- **BD:** `eplus_tools` en MySQL del contenedor WordPress

## Estructura del proyecto
```
server.js                     → Entry point Express
node/src/modules/             → Módulos backend (auth, intake, calculator)
node/src/middleware/           → Auth middleware (JWT)
node/src/utils/               → DB connection, UUID helper
public/                       → SPA frontend
public/js/                    → api.js, auth.js, app.js, intake.js
public/css/                   → main.css
migrations/                   → SQL migrations (ejecutar con node scripts/migrate.js)
```
