# Decisiones tecnicas

## 2026-08-16 - Monorepo modular

Se usa un monorepo con pnpm workspaces para mantener API, web, mobile, edge, worker y packages compartidos en una unica base, evitando microservicios prematuros.

## 2026-08-16 - Stack base

Se adopta TypeScript estricto, Fastify, React/Vite, Expo, Prisma, PostgreSQL, Redis, MinIO, Vitest y Docker Compose segun el prompt maestro.

## 2026-08-16 - Dispositivos multimarca

El nucleo define contratos genericos en `packages/device-core`. Las marcas reales deben implementarse como adaptadores del Edge y validarse con hardware o SDK disponible. Mientras tanto, el simulador es la referencia verificable.

## 2026-08-16 - Datos sensibles

Passwords, tokens, secretos, imagenes biometricas y templates no deben imprimirse en logs ni persistirse en texto plano. La Fase 0 deja la politica documentada; el cifrado operativo se implementara al incorporar archivos y credenciales reales.
