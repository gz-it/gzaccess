# GzAccess Agent Guide

Este repositorio es exclusivo para GzAccess Edificios.

## Reglas de trabajo

- No mezclar codigo ni configuracion de otros productos GzIT.
- Mantener TypeScript estricto en apps y packages.
- No registrar secretos, tokens, passwords, imagenes biometricas ni templates en logs.
- Documentar cualquier bloqueo externo relacionado con hardware, SDKs, dominios, email, push o tiendas.
- Validar cada fase antes de marcarla como validada en `docs/ROADMAP.md`.

## Comandos principales

- `pnpm install`
- `pnpm format`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm build`
- `pnpm db:generate`
- `pnpm dev`
