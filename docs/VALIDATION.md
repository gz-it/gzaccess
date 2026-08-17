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
- No se ejecutaron migraciones contra PostgreSQL porque Docker no esta instalado en esta maquina.

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

## 2026-08-16 - Fase 1 recuperacion y auditoria inicial

Comandos ejecutados:

- `pnpm db:generate`: paso despues de agregar `PasswordResetToken`.
- `pnpm format`: paso.
- `pnpm lint`: paso.
- `pnpm typecheck`: paso.
- `pnpm test`: paso, 3 archivos y 10 tests.
- `pnpm build`: paso.

Alcance validado:

- Solicitud y consumo de token de recuperacion de password.
- Los tokens de recuperacion se guardan hasheados y vencen.
- Al completar recuperacion se revocan sesiones refresh anteriores.
- Auditoria inicial para bootstrap, activacion, login y recuperacion.

Limitaciones:

- Todavia falta proveedor real de email. En entornos no productivos el token de recuperacion puede devolverse en la respuesta para pruebas; en produccion no se devuelve.

## 2026-08-16 - Fase 1 RBAC y aislamiento

Comandos ejecutados:

- `pnpm format`: paso.
- `pnpm lint`: paso.
- `pnpm test`: paso, 3 archivos y 13 tests.

Alcance validado:

- Deduccion de permisos por roles.
- Verificacion explicita de permisos.
- Verificacion de acceso por organizacion asignada.
- Errores de autorizacion diferenciados.

## 2026-08-16 - Fase 1 UI web de autenticacion

Comandos ejecutados:

- `pnpm format`: paso.
- `pnpm lint`: paso.
- `pnpm typecheck`: paso.
- `pnpm test`: paso, 3 archivos y 13 tests.
- `pnpm build`: paso.

Alcance validado:

- Login web contra `/api/v1/auth/login`.
- Activacion web contra `/api/v1/auth/activation/complete`.
- Recuperacion web contra `/api/v1/auth/password-reset/request` y `/complete`.
- Restauracion de sesion con `/api/v1/auth/me`.

## 2026-08-16 - Migracion inicial

Comandos ejecutados:

- `prisma migrate diff --from-empty --to-schema-datamodel packages/database/prisma/schema.prisma --script`: paso.

Resultado:

- Migracion SQL inicial generada en `packages/database/prisma/migrations/20260816204000_initial_schema/migration.sql`.

Limitacion:

- Docker no esta disponible en esta maquina, por lo que `docker compose up` y `prisma migrate deploy` contra PostgreSQL local quedan pendientes.

## 2026-08-16 - Fase 2 API inicial de edificios y residentes

Comandos ejecutados:

- `pnpm format`: paso.
- `pnpm lint`: paso.
- `pnpm typecheck`: paso.
- `pnpm test`: paso, 3 archivos y 15 tests.
- `pnpm build`: paso.

Alcance validado:

- Creacion de edificio protegida por token.
- Listado de edificios filtrado por organizacion.
- Creacion de unidad dentro de edificio.
- Alta individual de residente con invitacion de activacion.
- Bloqueo de acceso cruzado entre organizaciones.

Limitaciones:

- Las pruebas usan stores en memoria. El store Prisma esta implementado, pero falta aplicar migraciones contra PostgreSQL real cuando haya VPS/Docker.

## 2026-08-16 - Fase 2 panel web inicial

Comandos ejecutados:

- `pnpm format`: paso.
- `pnpm lint`: paso.
- `pnpm typecheck`: paso.
- `pnpm test --config.strict-ssl=false`: paso, 3 archivos y 15 tests.
- `pnpm build --config.strict-ssl=false`: paso.

Alcance validado:

- Panel web autenticado para crear edificios.
- Panel web autenticado para crear unidades.
- Panel web autenticado para registrar residentes individuales.
- Carga inicial de edificios de la organizacion del usuario activo.

Limitaciones:

- En esta validacion inicial las unidades creadas se mantenian en estado local de la sesion web. Esto fue completado luego en la validacion de listados operativos.
- La invitacion real por email sigue pendiente hasta configurar proveedor de correo.

## 2026-08-16 - Fase 2 listados operativos

Comandos ejecutados:

- `pnpm format --config.strict-ssl=false`: paso.
- `pnpm lint --config.strict-ssl=false`: paso.
- `pnpm typecheck --config.strict-ssl=false`: paso.
- `pnpm test --config.strict-ssl=false`: paso, 3 archivos y 17 tests.
- `pnpm build --config.strict-ssl=false`: paso.

Alcance validado:

- API protegida para listar unidades por edificio.
- API protegida para listar residentes por edificio.
- Bloqueo de acceso cruzado para listados de unidades y residentes.
- Panel web recarga unidades y residentes al seleccionar edificio.
- Panel web actualiza la poblacion luego de registrar residente.

Limitaciones:

- Los listados usan stores en memoria en pruebas. La ejecucion contra PostgreSQL real queda pendiente hasta tener Docker/VPS.
- La invitacion real por email sigue pendiente hasta configurar proveedor de correo.

## 2026-08-16 - Fase 2 pisos

Comandos ejecutados:

- `prettier --write .`: paso con binario local.
- `prisma format --schema packages/database/prisma/schema.prisma`: paso con binario local.
- `prisma generate --schema packages/database/prisma/schema.prisma`: paso con binario local.
- `eslint .`: paso con binario local.
- `vitest run`: paso, 3 archivos y 18 tests.
- `tsc -p ...`: paso para packages y apps principales.
- `vite build`: paso desde `apps/web`.

Alcance validado:

- API protegida para crear pisos por edificio.
- API protegida para listar pisos por edificio.
- Unidades pueden asociarse a un piso existente del mismo edificio.
- Listado de unidades expone el nombre del piso asociado.
- Bloqueo de acceso cruzado para listado de pisos.
- Panel web permite crear pisos y asignarlos a unidades.
- Migracion incremental preparada para relacionar `Unit.floorId` con `Floor.id`.

Limitaciones:

- La migracion SQL esta versionada, pero no aplicada contra PostgreSQL real porque no hay Docker/VPS disponible en esta maquina.
- Cocheras quedan pendientes de asignacion directa a residentes o vehiculos cuando se implemente el modulo de vehiculos.

## 2026-08-16 - Fase 2 cocheras base

Comandos ejecutados:

- `prisma format --schema packages/database/prisma/schema.prisma`: paso con binario local.
- `prisma generate --schema packages/database/prisma/schema.prisma`: paso con binario local.
- `prettier --write ...`: paso con binario local para archivos modificados.
- `eslint .`: paso con binario local.
- `vitest run`: paso, 3 archivos y 19 tests.
- `tsc -p ...`: paso para packages y apps principales.
- `vite build`: paso desde `apps/web`.

Alcance validado:

- Modelo `ParkingSpace` agregado con relacion a edificio, piso opcional y unidad opcional.
- Migracion incremental SQL preparada para crear tabla, indices y claves foraneas.
- API protegida para crear cocheras.
- API protegida para listar cocheras por edificio.
- Bloqueo de acceso cruzado para listado de cocheras.
- Panel web permite crear cocheras y verlas por edificio.

Limitaciones:

- La migracion SQL esta versionada, pero no aplicada contra PostgreSQL real porque no hay Docker/VPS disponible en esta maquina.
- La asociacion de cocheras a vehiculos queda para el modulo de vehiculos de Fase 3.

## 2026-08-16 - Fase 2 importacion de residentes

Comandos ejecutados:

- `prettier --write ...`: paso con binario local para archivos modificados.
- `eslint .`: paso con binario local.
- `vitest run`: paso, 3 archivos y 20 tests.
- `tsc -p ...`: paso para packages y apps principales.
- `vite build`: paso desde `apps/web`.

Alcance validado:

- API protegida para importar residentes por lote.
- Validacion por fila y respuesta con importados/fallidos.
- Importacion puede asociar residentes a unidades existentes por `unitId`.
- Panel web permite pegar CSV e importar residentes del edificio activo.
- Panel web mapea la columna `unidad` contra las unidades cargadas del edificio.

Limitaciones:

- El parser CSV web cubre comas y comillas dobles; importaciones masivas complejas deberian migrarse luego a carga de archivo con previsualizacion.
- La invitacion real por email sigue pendiente hasta configurar proveedor de correo.
