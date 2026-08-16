# GzAccess

GzAccess es una plataforma SaaS para control de acceso en edificios residenciales.

La primera version apunta a operar con panel web, API central, app Android/iPhone, worker asincronico, servicio local Edge, PostgreSQL como fuente de verdad, Redis para colas/coordinacion, MinIO para archivos y un nucleo multimarca para dispositivos.

## Estado

Fase activa: **Fase 0 - Especificacion y base ejecutable**.

La integracion con hardware real queda condicionada a equipos, SDKs, credenciales y pruebas de laboratorio. El repositorio incluye contratos y simulador como base inicial verificable.

## Desarrollo local

1. Copiar `.env.example` a `.env` y ajustar valores si hace falta.
2. Ejecutar `pnpm install`.
3. Levantar servicios locales con `docker compose up -d`.
4. Generar Prisma con `pnpm db:generate`.
5. Ejecutar validaciones:

```powershell
pnpm format
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Apps y paquetes

- `apps/api`: API REST Fastify bajo `/api/v1`.
- `apps/web`: panel web React/Vite.
- `apps/mobile`: app React Native Expo.
- `apps/edge`: agente local GzAccess Edge.
- `apps/worker`: tareas asincronicas.
- `packages/database`: Prisma, esquema y cliente.
- `packages/auth`: autenticacion y permisos.
- `packages/contracts`: tipos compartidos.
- `packages/device-core`: contratos multimarca.
- `packages/device-simulator`: simulador de dispositivos.
- `packages/ui`: componentes compartidos.
