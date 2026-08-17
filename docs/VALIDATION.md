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

## 2026-08-16 - Fase 1 MFA administrativo

Comandos ejecutados:

- `prisma format --schema packages/database/prisma/schema.prisma`: paso con binario local.
- `prisma generate --schema packages/database/prisma/schema.prisma`: paso con binario local.
- `prettier --write ...`: paso con binario local para archivos modificados.
- `eslint .`: paso con binario local.
- `vitest run`: paso, 3 archivos y 22 tests.
- `tsc -p ...`: paso para packages y apps principales.
- `vite build`: paso desde `apps/web`.

Alcance validado:

- Generacion y verificacion TOTP de 6 digitos.
- API protegida para preparar, activar y desactivar MFA.
- MFA limitado a roles administrativos.
- Login exige `mfaCode` cuando MFA esta activo.
- Panel web permite preparar, activar y desactivar MFA.
- Migracion incremental SQL preparada para campos MFA en `User`.

Limitaciones:

- El secreto TOTP queda persistido para verificacion. Antes de produccion conviene cifrar ese campo con KMS o secreto de aplicacion dedicado.
- La migracion SQL esta versionada, pero no aplicada contra PostgreSQL real porque no hay Docker/VPS disponible en esta maquina.

## 2026-08-16 - Fase 2 outbox de invitaciones

Comandos ejecutados:

- `prisma format --schema packages/database/prisma/schema.prisma`: paso con binario local.
- `prisma generate --schema packages/database/prisma/schema.prisma`: paso con binario local.
- `prettier --write ...`: paso con binario local para archivos modificados.
- `eslint .`: paso con binario local.
- `vitest run`: paso, 3 archivos y 22 tests.
- `tsc -p ...`: paso para packages y apps principales.
- `vite build`: paso desde `apps/web`.

Alcance validado:

- Registro individual de residente con email deja una invitacion en `EmailOutbox`.
- Importacion de residentes deja invitaciones en cola para las filas con email.
- API protegida para consultar invitaciones por edificio.
- Panel web muestra invitaciones en cola del edificio activo.
- Migracion incremental SQL preparada para crear `EmailOutbox`.

Limitaciones:

- No hay envio real hasta configurar VPS y proveedor SMTP/API de email.
- El outbox contiene links de activacion sensibles; no deben registrarse en logs y deben consumirse/limpiarse con TTL cuando exista worker real.
- La migracion SQL esta versionada, pero no aplicada contra PostgreSQL real porque no hay Docker/VPS disponible en esta maquina.

## 2026-08-16 - Fase 1 app mobile Android/iPhone

Comandos ejecutados:

- `pnpm install --no-frozen-lockfile --config.strict-ssl=false`: paso despues de agregar dependencias Expo/React Native.
- `prisma generate --schema packages/database/prisma/schema.prisma`: paso con binario local despues de recrear `node_modules`.
- `tsc -p apps/mobile/tsconfig.json`: paso para app mobile.
- `prettier --write ...`: paso con binario local para archivos mobile y documentacion.
- `eslint .`: paso con binario local.
- `vitest run`: paso, 3 archivos y 22 tests.
- `tsc -p ...`: paso para packages y apps principales, incluyendo mobile.
- `vite build`: paso desde `apps/web`.
- `expo config --type public`: paso con `EXPO_NO_TELEMETRY=1`.
- `expo export --platform all --output-dir dist-export`: paso con bundles Android e iOS.

Alcance validado:

- App Expo configurada para iOS y Android con identificadores `com.gzit.gzaccess`.
- Pantallas mobile de login, activacion de cuenta y solicitud de reset.
- Integracion mobile contra `/auth/login`, `/auth/activation/complete`, `/auth/password-reset/request`, `/auth/me` y listado de edificios.
- Persistencia de access/refresh token con `expo-secure-store`.
- Dashboard mobile inicial con secciones Acceso, Perfil y Edificio.
- Bundle local generado para Android e iOS con Metro.
- Perfiles EAS preparados para builds internos y produccion.

Limitaciones:

- No se genero APK/IPA firmado porque faltan cuentas, certificados y pipeline de build.
- La credencial QR, rostro, vehiculos, push y permisos runtime quedan pendientes para Fase 3 y fases de permisos/sincronizacion.
- En emuladores/dispositivos reales se debe configurar `EXPO_PUBLIC_API_BASE_URL` apuntando al host accesible de la API; `localhost` solo sirve en ciertos entornos de desarrollo.

## 2026-08-17 - Fase 3 vehiculos base

Comandos ejecutados:

- `prettier --write ...`: paso con binario local para archivos modificados.
- `eslint .`: paso con binario local.
- `vitest run`: paso, 3 archivos y 23 tests.
- `tsc -p ...`: paso para packages y apps principales.
- `vite build`: paso desde `apps/web`.
- `expo export --platform all --output-dir dist-export`: paso con bundles Android e iOS.

Alcance validado:

- API protegida para crear vehiculos asociados a residentes del edificio.
- API protegida para listar vehiculos por edificio.
- Patentes normalizadas para comparacion y bloqueo de duplicados por edificio.
- Panel web permite cargar y listar vehiculos del edificio activo.
- App mobile permite listar y cargar vehiculos para el residente asociado al email de la sesion.
- Export mobile Android/iOS validado despues de incorporar la pantalla de vehiculos.

Limitaciones:

- Todavia no se sincronizan patentes con dispositivos edge ni hardware real.

## 2026-08-17 - Fase 3 consentimiento y captura facial mobile

Comandos ejecutados:

- `pnpm --filter @gzaccess/mobile add expo-image-picker@~16.0.6 --config.strict-ssl=false`: paso.
- `prettier --write ...`: paso con binario local para archivos modificados.
- `tsc -p ...`: paso para packages y apps principales.
- `eslint .`: paso con binario local.
- `vitest run`: paso, 3 archivos y 24 tests.
- `vite build`: paso desde `apps/web`.
- `expo export --platform all --output-dir dist-export`: paso con bundles Android e iOS.

Alcance validado:

- App mobile Android/iPhone incorpora pestaña `Rostro`.
- Consentimiento biometrico local persistido en secure storage por usuario.
- Captura de imagen facial con camara mediante `expo-image-picker`.
- Preview y eliminacion local de la imagen capturada.
- Permisos nativos configurados para camara/fotos en Expo.

Limitaciones:

- La imagen queda solo como referencia local hasta tener storage real y endpoint seguro de carga.
- No se genera ni almacena template biometrico; eso queda pendiente de proveedor/SDK y revision legal.

## 2026-08-17 - Fase 4 motor de acceso y simulador

Comandos ejecutados:

- `prettier --write ...`: paso con binario local para archivos modificados.
- `eslint .`: paso con binario local.
- `vitest run`: paso, 4 archivos y 30 tests.
- `tsc -p ...`: paso para packages y apps principales.

Alcance validado:

- Motor puro `evaluateAccessAttempt` para permitir/denegar por credencial activa, vigencia y permiso sobre punto de acceso.
- Simulador de dispositivo con credenciales enroladas, permisos configurables e intentos de acceso permitidos/denegados.
- Razon de denegacion segura para dispositivo offline.

Limitaciones:

- Todavia falta API y panel web para administrar puntos de acceso y politicas.
- Todavia no hay sincronizacion edge ni hardware real.

## 2026-08-17 - Fase 3 perfil residencial mobile

Comandos ejecutados:

- `prettier --write ...`: paso con binario local para archivos modificados.
- `eslint .`: paso con binario local.
- `vitest run`: paso, 3 archivos y 24 tests.
- `tsc -p ...`: paso para packages y apps principales.
- `vite build`: paso desde `apps/web`.
- `expo export --platform all --output-dir dist-export`: paso con bundles Android e iOS.

Alcance validado:

- API protegida `/api/v1/resident-profile` para que la app mobile obtenga solamente los perfiles residenciales de la sesion activa.
- App mobile Android/iPhone usa el perfil residencial propio para seleccionar residente y edificio al autogestionar vehiculos.
- Se elimina la dependencia mobile de listar toda la poblacion del edificio para encontrar al residente actual.

Limitaciones:

- Todavia no se sincronizan patentes con dispositivos edge ni hardware real.
