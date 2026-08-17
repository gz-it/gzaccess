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
| 1 - Identidad, organizaciones y RBAC | validada  | Cuentas reales y seguras para cada rol.                    |
| 2 - Edificio y residentes            | en curso  | Un edificio administra su poblacion completa.              |
| 3 - App, rostros y vehiculos         | en curso  | Residentes autogestionan rostro y vehiculos.               |
| 4 - Permisos y simulador             | en curso  | Recorrido completo validado sin hardware.                  |
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
- [x] Mobile Expo iniciado para Android/iPhone.
- [x] Edge y worker iniciados.
- [x] Pruebas base creadas.
- [x] Formatter, lint, typecheck, test y build ejecutados.

## Bloqueos externos conocidos

- Hardware, SDKs y credenciales de fabricantes: no disponibles todavia.
- Dominio, proveedor de email, push, cuentas Google Play/App Store: no configurados todavia.
- Revision legal de privacidad/biometria: pendiente antes de produccion.
- Builds firmados Android/iPhone: pendientes de cuentas Google Play/App Store, certificados y pipeline EAS/Xcode.
- Push mobile, camara/biometria y permisos runtime: pendientes para Fase 3.
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
- [x] MFA TOTP configurable para roles administrativos.
- [x] Auditoria inicial de bootstrap, activacion, login y reset.
- [x] UI web para login, activacion y recuperacion.
- [x] UI web para configurar MFA administrativo.
- [x] UI mobile para login/activacion.
- [x] UI mobile para reset de password.
- [x] Sesion mobile persistida en secure storage.
- [x] Dashboard mobile inicial de acceso, perfil y edificios.

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
- [x] Outbox local de invitaciones por email para residentes.
- [ ] Invitacion real por email para residentes.
- [x] Importacion validada de residentes.
- [x] Panel web inicial de administracion de edificios, unidades y residentes.
- [x] Panel web con recarga real de unidades y poblacion por edificio.
- [x] Panel web para crear pisos y asignarlos a unidades.
- [x] Panel web para crear y listar cocheras.
- [x] Panel web para importar residentes por CSV.

## Fase 3 checklist

- [x] Modelo base de vehiculos versionado en Prisma.
- [x] API protegida para crear vehiculos de residentes.
- [x] API protegida para listar vehiculos por edificio.
- [x] Normalizacion de patente y bloqueo de duplicados por edificio.
- [x] Bloqueo probado contra acceso cruzado entre organizaciones.
- [x] Panel web para cargar y listar vehiculos.
- [x] App mobile para autogestion de vehiculos.
- [x] API mobile de perfil residencial propio.
- [x] Captura de rostro y consentimiento biometrico local en app.
- [ ] Carga de imagenes/archivos con storage real.
- [ ] Push mobile.

## Fase 4 checklist

- [x] Motor puro de decision de acceso por credencial, permiso y punto de acceso.
- [x] Simulador local de intentos permitidos y denegados.
- [x] API de zonas y puntos de acceso.
- [x] API de politicas de acceso por residente y punto.
- [ ] Panel web para configurar permisos.
- [ ] Recorrido completo mobile/API/simulador sin hardware.
