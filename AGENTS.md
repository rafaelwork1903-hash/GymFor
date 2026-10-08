This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

This project uses **bun** as its package manager (`bun.lock` present). Always use `bun install` and `bunx` — never npm/yarn/pnpm.

```bash
bunx expo install <package>  # ALWAYS use instead of bun add — resolves SDK-compatible versions
bunx expo start              # start the dev server (use -c the first time with Tamagui)
bunx expo lint               # lint
bunx tsc --noEmit            # typecheck
bunx expo-doctor             # diagnose dependency and config issues
bunx expo install --fix      # fix incompatible package versions
```

If `bun install` resolves absurdly old package versions (e.g. expo 44 instead of 57), the bun cache packument is corrupt: fix with `bun pm cache rm`, delete `bun.lock`/`node_modules`, and reinstall.

Run lint and typecheck before declaring any task done.

## Navigation & Routing

- Use **Expo Router** for all navigation. Routes live in `app/` — every file there is a screen, `_layout.tsx` files define navigators. Keep non-route code (components, hooks, utils) outside `app/`.
- Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`.
- Docs: https://docs.expo.dev/router/introduction.md

## Building with EAS

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`) — no local Xcode or Android Studio required. Run EAS CLI as `bunx eas-cli <command>` in Bun projects, or `npx eas-cli@latest <command>` otherwise; substitute that for bare `eas` in docs examples.
Docs: https://docs.expo.dev/eas/index.md

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md

## Git Workflow

- **1 tarea = 1 rama** = 1 PR: `feat/<descripcion>`, `fix/<descripcion>`, `chore/<descripcion>`
- Las ramas se crean desde `main`: `git checkout -b feat/nombre main`
- El usuario asigna las tareas y revisa los PRs siempre
- **Ningún agente hace merge con main**. Solo el usuario tiene permiso para mergear después de revisar
- Commits con mensaje conveccional recomendado: `feat:`, `fix:`, `chore:`
- `main` siempre debe estar estable y probada en dispositivo
- Después del merge, `bun install` y verificar build expo

## Checkpoints de progreso

### 2026-10-08 — feat/screens-dashboard (issue #11)

- `app/(tabs)/index.tsx`: Dashboard operativo sin `PantallaPlaceholder`. Saludo + perfil desde `useConfiguracionStore`; tarjeta de rutina activa (`activa === 1`) con CTA **Iniciar Entrenamiento** → `/sesion` (o CTA *Ir a Rutinas* si no hay activa); indicadores (volumen reciente, mejor 1RM, sesiones) y últimas 5 sesiones con fecha, rutina y día. Manejo de `cargando`/`error` con reintento.
- `listarSesionesPorUsuario` ahora devuelve `SesionResumen` (`LEFT JOIN` a `dias_rutina`/`rutinas` para nombre de rutina y día).
- `useSesionStore`: `sesiones` pasa a `SesionResumen[]`; nuevo `sesionesDetalle` (detalle de las últimas 5 sesiones, para métricas); `iniciarSesion`/`finalizarSesion` propagan los nombres de rutina/día.
- `selectores.ts`: nuevos agregados puros `calcularVolumenTotalSesiones` y `calcularMejor1RMSesiones` (con tests).
- Bugs preexistentes arreglados para dejar la suite en verde (en main fallaban 6 tests, 8 errores de `tsc` y 2 suites ni compilaban):
  - `async` faltante en `sesion.store.test.ts` y `rutinas.store.test.ts`; `act` síncrono → `await act(async …)` en `configuracion.store.test.ts` (React 19 + RNTL 14).
  - `jest-setup.ts`: mock de `localStorage` con estado en memoria (el test de persistencia lo necesita) y `globalThis` en vez de `global` (sin @types/node).
  - `selectores.ts`: `obtenerHistorialEjercicio` ahora ordena cronológicamente (contracto de su docstring) y los aportes indirectos de `calcularSeriesEfectivasSemanales` vuelven a contar (0.5/serie).
  - Fixtures inconsistentes en `selectores.test.ts` (id del ejercicio y reps al tope para `subir_peso`); series incompletas en llamadas a `agregarSerie`.
- Notas: `HStack` no existe en Tamagui 2.7.7 — se usó `XStack`. Tests de render de componentes (tamagui) requieren ajustar `transformIgnorePatterns` de jest: propuesto como tarea aparte (el runner crashea en este entorno al transformar el ESM de tamagui).
- Verificado: `tsc --noEmit` ✅, `eslint` 0 errores ✅, `jest` 10/10 suites y 88/88 tests ✅.
