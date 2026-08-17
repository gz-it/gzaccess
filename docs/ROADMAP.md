# Roadmap GzAccess Edificios

## Criterio de estado

- `pendiente`: no iniciado.
- `en curso`: fase activa.
- `bloqueado`: requiere dato, cuenta, hardware o decision externa.
- `validada`: migraciones, compilacion, pruebas, documentacion y limitaciones verificadas.

## Fases

| Fase                                 | Estado    | Resultado esperado                                         |
| ------------------------------------ | --------- | ---------------------------------------------------------- |
| 0 - Especificacion y base ejecutable | validada  | Proyecto completo ejecutable en desarrollo.                |
| 1 - Identidad, organizaciones y RBAC | en curso  | Cuentas reales y seguras para cada rol.                    |
| 2 - Edificio y residentes            | en curso  | Un edificio administra su poblacion completa.              |
| 3 - App, rostros y vehiculos         | pendiente | Residentes autogestionan rostro y vehiculos.               |
| 4 - Permisos y simulador             | pendiente | Recorrido completo validado sin hardware.                  |
| 5 - GzAccess Edge                    | pendiente | Nube y red local se comunican de forma segura.             |
| 6 - Visitantes                       | pendiente | Ciclo de visita completo con simulador.                    |
| 7 - Primer conector real             | pendiente | Primer equipo real validado o bloqueo externo documentado. |
| 8 - Seguridad, eventos y reportes    | pendiente | Operacion diaria completa del edificio.                    |
| 9 - Escala y resiliencia             | pendiente | Evidencia tecnica para capacidad objetivo.                 |
| 10 - Piloto real                     | pendiente | Candidato a version comercial.                             |
| 11 - Version comercial 1.0           | pendiente | Producto vendible con limites reales declarados.           |

## Fase 0 checklist

- [x] Repositorio exclusivo verificado.
- [x] `AGENTS.md`, README y roadmap creados.
- [x] Decisiones tecnicas iniciales registradas.
- [x] Monorepo pnpm configurado.
- [x] Docker Compose con PostgreSQL, Redis y MinIO.
- [x] Prisma y esquema inicial.
- [x] Migracion SQL inicial generada.
- [x] API health.
- [x] Frontend web iniciado.
- [ ] Mobile Expo iniciado. Base TypeScript creada; instalacion Expo pendiente por bloqueo del instalador local.
- [x] Edge y worker iniciados.
- [x] Pruebas base creadas.
- [x] Formatter, lint, typecheck, test y build ejecutados.

## Bloqueos externos conocidos

- Hardware, SDKs y credenciales de fabricantes: no disponibles todavia.
- Dominio, proveedor de email, push, cuentas Google Play/App Store: no configurados todavia.
- Revision legal de privacidad/biometria: pendiente antes de produccion.
- Instalacion completa de dependencias Expo/React Native: pendiente. La Fase 0 conserva base TypeScript mobile; Expo real debe reincorporarse antes de validar Fase 3.
- Docker local: no instalado en esta maquina; falta aplicar migraciones contra PostgreSQL local.

## Fase 1 checklist

- [x] Hash seguro de passwords con `scrypt`.
- [x] Tokens opacos de activacion, access y refresh hasheados internamente.
- [x] Bootstrap de administrador de plataforma para desarrollo/test.
- [x] Activacion de cuenta con token de un solo uso.
- [x] Login, refresh y `/api/v1/auth/me`.
- [x] RBAC compartido con pruebas unitarias.
- [x] Helpers de autorizacion por permiso y organizacion.
- [x] Persistencia real de auth con Prisma/PostgreSQL.
- [x] Recuperacion de password.
- [ ] MFA configurable para roles administrativos.
- [x] Auditoria inicial de bootstrap, activacion, login y reset.
- [x] UI web para login, activacion y recuperacion.
- [ ] UI mobile para login/activacion.

## Fase 2 checklist

- [x] API protegida para crear edificios.
- [x] API protegida para listar edificios por organizacion.
- [x] API protegida para crear unidades.
- [x] API protegida para listar unidades por edificio.
- [x] API protegida para registrar residentes individualmente.
- [x] API protegida para listar residentes por edificio.
- [x] API protegida para crear y listar pisos por edificio.
- [x] Bloqueo probado contra acceso cruzado entre organizaciones.
- [x] Pisos completos para asociar unidades.
- [x] Cocheras base completas para asociar a edificio, piso y unidad.
- [ ] Invitacion real por email para residentes.
- [x] Importacion validada de residentes.
- [x] Panel web inicial de administracion de edificios, unidades y residentes.
- [x] Panel web con recarga real de unidades y poblacion por edificio.
- [x] Panel web para crear pisos y asignarlos a unidades.
- [x] Panel web para crear y listar cocheras.
- [x] Panel web para importar residentes por CSV.
