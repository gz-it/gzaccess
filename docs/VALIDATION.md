# Validaciones

## 2026-08-16 - Fase 0

Comandos ejecutados:

- `pnpm install --no-frozen-lockfile --config.strict-ssl=false`: paso despues de limpiar `node_modules` parcial y reducir mobile a base TypeScript. El entorno requirio desactivar strict SSL por certificados del registry.
- `pnpm db:generate`: paso. Prisma Client generado.
- `pnpm format`: paso despues de agregar `.prettierignore`.
- `pnpm lint`: paso.
- `pnpm typecheck`: paso.
- `pnpm test`: paso, 3 archivos y 5 tests.
- `pnpm build`: paso para API, web, worker, edge, mobile base y packages.

Bloqueos o limitaciones:

- La falla de Vitest/Vite por carga de `vitest.config.*` y `vite.config.*` fue resuelta quitando configuraciones innecesarias para Fase 0.
- `apps/mobile` queda como base TypeScript documentada. La instalacion completa Expo/React Native se pospone hasta estabilizar el instalador local y evitar rutas largas/parciales en Windows.
- No se ejecutaron migraciones contra PostgreSQL porque Docker no fue levantado en esta corrida.

## 2026-08-16 - Fase 1 inicial

Comandos ejecutados:

- `pnpm install --no-frozen-lockfile --config.strict-ssl=false`: paso.
- `pnpm db:generate`: paso despues de ampliar el esquema con `ActivationToken` y `Session.refreshTokenHash`.
- `pnpm format`: paso.
- `pnpm lint`: paso.
- `pnpm typecheck`: paso.
- `pnpm test`: paso, 3 archivos y 9 tests.
- `pnpm build`: paso.

Alcance validado:

- Hash y verificacion de passwords sin guardar texto plano.
- Tokens opacos hasheados.
- Bootstrap de administrador de plataforma en entorno no productivo.
- Activacion de cuenta, login, consulta `/api/v1/auth/me` y refresh token.

Limitaciones:

- La API usa `PrismaAuthStore` por defecto y `InMemoryAuthStore` solamente en tests. Las migraciones contra una base PostgreSQL real siguen pendientes de ejecutarse porque Docker/PostgreSQL no se levanto en esta corrida.

## 2026-08-16 - Fase 1 persistencia Prisma

Comandos ejecutados:

- `pnpm install --no-frozen-lockfile --config.strict-ssl=false`: paso.
- `pnpm format`: paso.
- `pnpm lint`: paso.
- `pnpm typecheck`: paso.
- `pnpm test`: paso, 3 archivos y 9 tests.
- `pnpm build`: paso.

Alcance validado:

- `PrismaAuthStore` implementado como store por defecto fuera de tests.
- Refresh tokens persistidos como hashes en `Session.refreshTokenHash`.
- Access tokens firmados con HMAC y verificables sin persistencia en memoria.
- `InMemoryAuthStore` reservado para pruebas rapidas y deterministicas.
