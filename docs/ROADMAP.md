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
| 1 - Identidad, organizaciones y RBAC | pendiente | Cuentas reales y seguras para cada rol.                    |
| 2 - Edificio y residentes            | pendiente | Un edificio administra su poblacion completa.              |
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
