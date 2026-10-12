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

## Mapa del proyecto (contexto para agentes — evita leer todo el código)

**Stack**: Expo SDK 57 · bun · React 19.2.3 · RN 0.86.3 · Tamagui 2.7.7 (`@tamagui/config/v5`) · expo-router · expo-sqlite (web = WASM worker; `metro.config.js` añade `wasm` + cabeceras COOP/COEP) · zustand 5. Mobile-first; web es solo preview.

**Capas** (dependen hacia abajo, nunca al revés): `app/` (pantallas) → `src/store/` (zustand) → `src/db/repositories/` (reciben `db` como 1er argumento) · `src/domain/` = lógica pura sin I/O.

- `app/_layout.tsx`: raíz — `useFonts` (con fallback ante error), TamaguiProvider, ErrorBoundary + SQLiteProvider(`onInit=inicializarBD`). `app/(tabs)/`: `index` (Dashboard ✅), `rutinas` (✅), `sesion` (✅), `historial`, `progreso` = `PantallaPlaceholder`.
- `src/store/configuracion.store`: `usuarioActivo` (persistido), `tema` (`sistema`|`claro`|`oscuro`, persistido; cableado a `TamaguiProvider` con fallback al esquema del sistema), `cambiarTema`, `asegurarUsuario` (bootstrap en `app/_layout`: adopta el primer usuario de la BD o crea el inicial "Atleta" — sin él `sesiones.usuario_id NOT NULL` rompe `iniciarSesion`), `crearUsuarioInicial` (aún sin pantalla de onboarding). `rutinas.store`: `cargarRutinas`, `seleccionarRutina(id)` → `rutinaSeleccionada: RutinaDetalle` (días con ejercicios y objetivos), `crearRutinaNueva`, `activarRutinaSeleccionada(usuarioId)` (opera sobre `rutinaSeleccionada`), `eliminarRutinaPorId`. `sesion.store`: `sesionActual {sesion, registros[{registro_id, ejercicio_nombre, series}], rutina_nombre, nombre_dia}`; `iniciarSesion({rutinaId, diaRutinaId, usuarioId})` crea la sesión EN BD — los `registro_id` los genera el store y `crearSesion` los persiste tal cual (`NuevaSesion.registros[].id`), así los inserts de series (FK `series.registro_id`) apuntan a filas reales; `agregarSerie(registroId, Omit<SerieReal,'id'|'registro_id'>)` — el CALLER calcula `numero_serie`; `finalizarSesion({duracion_minutos, notas, rpe_sesion})`; `descartarSesion` (elimina la sesión en BD vía CASCADE, a diferencia de `cancelarSesion` que deja fila huérfana); `cargarHistorial` llena `sesiones` (SesionResumen) + `sesionesDetalle`. `selectores.ts`: `calcularVolumenTotalSesiones`, `calcularMejor1RMSesiones`. `utilidades.ts`: `ejecutarAccion` maneja `cargando`/`error` — ninguna acción lanza sin capturar; `mensajeDeError` también lee `.message` de errores que cruzan realms de VM (jest/workers).
- `src/db/`: `client.ts` (`obtenerBD()` singleton), `migrations.ts` (versionadas + `repararVersionInconsistente`), `seed.ts` (2 rutinas plantilla + catálogo de ejercicios), `repositories/sesion.repository.ts` (`crearSesion`, `agregarSerie`, `eliminarSesion`, `obtenerSesionDetalle`, `listarSesionesPorUsuario` → `SesionResumen`). FK del esquema: borrar una sesión hace CASCADE a registros y series.
- `src/domain/types.ts`: `SerieReal {numero_serie, peso_levantado, reps_realizadas, rpe_serie (1-10) | rir (0-10), completada, notas}`, `EjercicioEnRutinaDetalle {ejercicio_nombre, series_objetivo, reps_objetivo_min/max, peso_objetivo, descanso_segundos}`. `metrics.ts`: `calcular1RMEpley`, `calcularVolumenTotal`, `calcularVolumenSerie`. `progression.ts`: `sugerirProgresion`, `detectarEstancamiento`, `calcularTendencia`, `redondearCarga`.

**Convenciones UI**: `XStack`/`YStack` (NO existe `HStack`) · tokens `$gray1..12`, `$blue*`, `$red*` · el prop de fondo es `backgroundColor` (NO `background`: no es prop válido de RN/Tamagui y se descarta en runtime, dejando el fondo blanco de la ventana) · listados SIEMPRE en `ScrollView` · estados `cargando` (spinner) y `error` (tarjeta con Reintentar) · nunca `return null` sin fallback visible · confirmaciones: `window.confirm` en web (`Alert` es stub vacío en RNW) y `Alert.alert` en nativo · inputs numéricos con `keyboardType="numeric"` · JSDoc en español.

**Tests**: `__tests__/`, jest-expo. Tests de stores con repos mockeados (`jest.mock`) + **tests de integración** (`integracion.sesion.test.ts`): solo se mockea la CONEXIÓN (`src/db/client`) y el store/repos ejecutan SQL real sobre `node:sqlite` en memoria con `ESQUEMA_VERSION_1` y `PRAGMA foreign_keys = ON` — validan FKs, NOT NULL y CASCADE (los tipos de `node:sqlite` están declarados en `src/tipos/node-sqlite.d.ts`). Regla actual: 12 suites / 101 tests. Tests de RENDER con tamagui crashean en este entorno (falta ajustar `transformIgnorePatterns`) — probar lógica en stores/selectores, no renders.

**Gaps conocidos** (no arreglar de gratis, anotar en el checkpoint): `actualizarSerie`/`eliminarSerie` del sesion.store son SOLO locales (no persisten en BD) — no exponerlas en UI; `cancelarSesion` solo limpia el estado (deja la fila huérfana en BD); `Sheet` de Tamagui requiere migrar config a `v5-motion`; no hay onboarding de usuario.

## Git Workflow

- **1 tarea = 1 rama**: `feat/<descripcion>`, `fix/<descripcion>`, `chore/<descripcion>`
- Las ramas se crean desde `main`: `git checkout -b feat/nombre main`
- **Los agentes NO abren PRs**. Al terminar la tarea: verifican (`bunx tsc --noEmit`, `bunx expo lint`, `bun run test`), commitean, pushean la rama y **avisan al usuario únicamente con el nombre de la rama** (p. ej. "Terminado, rama: `feat/screens-sesion`")
- **Checkpoint obligatorio**: antes de pushear, añade tu entrada en `## Checkpoints de progreso` de este archivo (fecha — rama — qué hiciste, decisiones tomadas, verificación ejecutada). Solo documenta lo que realmente está en el diff
- El usuario asigna las tareas, revisa el diff de la rama, **crea el PR él mismo** y hace el merge. **Ningún agente hace merge con main**
- Commits con mensaje convencional recomendado: `feat:`, `fix:`, `chore:`
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

### 2026-10-08 — feat/screens-rutinas (issue #13)

- `app/(tabs)/rutinas.tsx`: pantalla de gestión sin `PantallaPlaceholder`. Listado de `Card`s con nombre/descripción; la rutina con `activa === 1` se resalta (borde `$blue8`, fondo `$blue2`) con badge "Activa"; botones **Activar** (via `seleccionarRutina` + `activarRutinaSeleccionada`, reflejo instantáneo en el Dashboard) y **Eliminar** (con confirmación multiplataforma); botón superior **Crear nueva rutina** fijo fuera del scroll; estados `cargando`/`error` con reintento y estado vacío.
- Listado envuelto en `ScrollView`: con varias rutinas las últimas tarjetas son alcanzables en móvil (el botón "Crear nueva rutina" y el banner de error quedan fijos fuera del scroll).
- Confirmación de borrado multiplataforma: `react-native-web` implementa `Alert.alert` como stub vacío → en web se usa `window.confirm(...)` y en nativo `Alert.alert(...)` con botón destructivo.
- Al activar, tras `seleccionarRutina` se verifica `useRutinasStore.getState().rutinaSeleccionada?.id === rutina.id` (y que no haya `error`) antes de llamar `activarRutinaSeleccionada`: si la selección falla, no se intenta activar y el banner muestra el error real en vez de "No hay rutina seleccionada para activar".
- Formulario de creación en `Modal` de React Native (Nombre + Descripción) → `crearRutinaNueva` (sin días aún); guarda/cierra al éxito y muestra el error inline al fallo. Con `KeyboardAvoidingView` (`padding` solo en iOS) para que el teclado no tape los campos; **pendiente de prueba en dispositivo**. No usa `Sheet` de Tamagui porque `@tamagui/config/v5` no define animation driver y `Sheet` lo exige en runtime — migrar a `@tamagui/config/v5-motion` (o `v5-reanimated`) queda propuesto como tarea aparte si se quiere Sheet/animaciones.
- Nota de datos: activar una rutina sin usuario logueado funciona (activa la plantilla con `usuarioId = ''`); al existir un usuario real, `activarRutina` solo desactiva sus propias rutinas (comportamiento preexistente del repositorio).
- Sin cambios en stores ni en dominio: la pantalla consume la API existente de `useRutinasStore`.
- Verificado: `tsc --noEmit` ✅, `eslint` 0 errores ✅ (0 warnings en archivos nuevos), `jest` 10/10 suites y 88/88 tests ✅.

### 2026-10-09 — feat/screens-sesion (issue #15)

- `app/(tabs)/sesion.tsx`: pantalla de Sesión operativa sin `PantallaPlaceholder`.
  - **Sin sesión**: sin rutina activa → CTA a `/rutinas`; con rutina activa → selector de día (nombre + nº de ejercicios) desde `rutinaSeleccionada.dias` y CTA **Iniciar entrenamiento** → `iniciarSesion({rutinaId, diaRutinaId, usuarioId})`; edge case de rutinas sin días (`dias: []`) con mensaje claro + CTA a Rutinas. El día elegido se deriva (`diaElegido`) para invalidar una selección de la rutina anterior sin setState en efecto (regla nueva de eslint).
  - **Con sesión**: header con `rutina_nombre`, `nombre_dia` y volumen en vivo (`calcularVolumenTotal` de `metrics.ts`); por registro: nombre, objetivo (`series_objetivo`, reps min-max, `peso_objetivo`, descanso) resuelto desde `rutinaSeleccionada` (con recuperación best-effort si la selección cambió), series registradas e input rápido de nueva serie (peso + reps, RPE opcional, `keyboardType="numeric"`) → `agregarSerie(..., {numero_serie: series.length + 1, rir: null, completada: 1, notas: null})`. NO se exponen `actualizarSerie`/`eliminarSerie` (gap documentado).
  - **Finalizar**: modal con RPE de sesión (1-10, opcional) + notas, `KeyboardAvoidingView` en iOS → `finalizarSesion({duracion_minutos: undefined, notas, rpe_sesion})`; estado de éxito con volumen de la sesión (capturado antes de finalizar) y CTAs al Dashboard / entrenar otro día. La sesión aparece en «Actividad reciente» del Dashboard porque `finalizarSesion` ya antepone el resumen en el store.
  - **Descartar**: confirmación multiplataforma (`window.confirm` web / `Alert` nativo) → `descartarSesion` (nueva).
  - Validación de inputs: `aNumero` acepta coma decimal y rechaza basura; reps enteras; RPE entero 1-10 o vacío; inputs vacíos no llaman al store.
- Única extensión de store permitida por el issue: `descartarSesion` en `sesion.store.ts` (limpia `sesionActual` tras `eliminarSesion` en BD) + `eliminarSesion` en `sesion.repository.ts` (`DELETE FROM sesiones`, FK CASCADE). Nada de dominio tocado.
- Tests: `descartarSesion` (éxito llama al repo con el id y limpia; sin sesión setea error; error del repo conserva la sesión) + `eliminarSesion` directo con db mock (éxito/error). Fix: `act` síncrono → `await act(async …)` en el test preexistente de `cancelarSesion` (venenaba el renderer de RNTL 14/React 19 para los tests posteriores). Suite: 11/11 suites, 93/93 tests.
- Notas: `finalizarSesion` tipa sus campos como opcionales, el `null` de la pantalla se traduce a `undefined` (el store aplica `?? null` al persistir). Duración automática desde `sesion.creado_en` queda como mejora futura.
- Verificado: `bunx tsc --noEmit` ✅, `bunx expo lint` 0 errores ✅ (warnings preexistentes intactos, van en `chore/eslint-warnings`), `bun run test` 11/11 suites y 93/93 tests ✅.
- **Adenda (mismo día, petición del usuario)**: configuración de modo claro/oscuro + fix del texto invisible en fondo claro.
  - **Causa raíz**: `background="$background"` no es un prop válido de RN/Tamagui (no está en los shorthands v4 ni en los estilos de RN) y se descarta en runtime → las pantallas quedaban transparentes y el fondo blanco de la ventana asomaba bajo el tema oscuro (texto claro invisible). Corregido en las 3 pantallas + `PantallaPlaceholder` usando `backgroundColor="$background"`; convención documentada en el Mapa.
  - `configuracion.store`: `Tema` pasa a `'sistema' | 'claro' | 'oscuro'` (antes solo claro/oscuro, sin UI que lo usara). Default `sistema` + `version: 2` con migración que resetea el `tema` viejo a `sistema` (v1 persistía 'claro' sin toggle real). Test nuevo del modo sistema.
  - `app/_layout.tsx`: `TamaguiProvider defaultTheme` ahora se resuelve desde el store (fallback a `useColorScheme`) — cambia en runtime al pulsar el toggle — y `StatusBar` de `expo-status-bar` se adapta (claro/oscuro).
  - Dashboard: botón circular junto al saludo que cicla sistema → claro → oscuro (iconos contrast/sunny/moon, con `aria-label` del estado actual).
  - Verificado de nuevo: `bunx tsc --noEmit` ✅, `eslint` 0 errores ✅, `bun run test` 11/11 suites y 94/94 tests ✅.
- **Adenda 2 (mismo día, bloqueos reportados en revisión)**: 4 fixes de integración.
  - **IDs de registro inconsistentes (bloqueante)**: `iniciarSesion` generaba `registro_id` locales pero `crearSesion` creaba OTROS en BD sin devolverlos → `agregarSerie` insertaba contra IDs inexistentes (FK). Contrato corregido: `NuevaSesion.registros[].id` — el store genera el ID, el repositorio lo persiste tal cual; store y BD comparten IDs.
  - **`usuarioId ?? ''` violaba `sesiones.usuario_id NOT NULL FK`** → `iniciarSesion` fallaba sin usuario logueado. Fix de raíz: `asegurarUsuario` en `configuracion.store` (adopta el primer usuario de la BD o crea el inicial "Atleta"; idempotente entre arranques — el usuario NO se persiste en nativo, la BD es la fuente de verdad) + bootstrap en `app/_layout`. La pantalla de sesión guarda `!usuarioId`, deshabilita el CTA y muestra "Preparando tu perfil…".
  - **Tests que solo mockean repos**: nueva suite de integración `integracion.sesion.test.ts` — solo se mockea la CONEXIÓN (`src/db/client`); store+repos ejecutan SQL real (`node:sqlite` en memoria, esquema real, `PRAGMA foreign_keys = ON`). Cubre: IDs de registro idénticos store↔BD + `agregarSerie` persiste (regresión del bloqueo 1), `usuarioId ''` rechazado por FK sin filas huérfanas (bloqueo 2), `finalizarSesion` persiste notas/RPE y antepone resumen, `descartarSesion` borra en CASCADE. Tipos de `node:sqlite` declarados en `src/tipos/node-sqlite.d.ts` (sin @types/node).
  - **Reintento y detalle con IDs locales**: el detalle prepended por `finalizarSesion` ahora usa IDs reales (fix 1); "Reintentar" de la pantalla es contextual: si falló `iniciarSesion` (día elegido, sin sesión) reintenta ESA operación, si no recarga rutinas y limpia el error.
  - Extra: `mensajeDeError` lee `.message` de errores que cruzan realms de VM (jest/workers) — sin esto los fallos de SQLite se mostraban como "Error desconocido".
  - Verificado: `bunx tsc --noEmit` ✅, `bunx expo lint` 0 errores ✅, `bun run test` 12/12 suites y 101/101 tests ✅.
