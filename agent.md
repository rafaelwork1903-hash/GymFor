# Prompt Maestro para Agente de IA: App de Registro y Progreso Fitness

## FASE 1: PLANIFICACIÓN (OBLIGATORIA ANTES DE ESCRIBIR CÓDIGO)

### 🎯 Objetivo del Proyecto

Crear una aplicación móvil multiplataforma (Android/iOS) para llevar el registro completo del progreso en el gimnasio, basada en principios científicos de sobrecarga progresiva y métricas reales de entrenamiento de fuerza.

### 🛠️ Stack Tecnológico Requerido

**Requisito crítico del usuario:** Sin SDK pesado para compilar localmente. Debe usar build en la nube.

| Componente | Tecnología | Justificación |
|------------|------------|---------------|
| **Framework** | React Native + Expo (recomendado) | Build en la nube con EAS Build |
| **Build** | EAS Build (Expo Application Services) | Compilación en la nube sin SDK local |
| **Lenguaje** | TypeScript (strict mode) | Tipado fuerte, menos errores en producción |
| **Almacenamiento Local** | SQLite (expo-sqlite) o WatermelonDB | Datos offline-first, privacidad total |
| **Estado Global** | Zustand con slices modulares | Ligero, TypeScript-friendly |
| **UI** | React Native Paper o Tamagui | Componentes nativos, buen rendimiento |

**Alternativa:** Kotlin Multiplatform + Compose, pero **NO cumple** el requisito de "sin SDK pesado". Expo es la única opción que permite compilar iOS/Android sin instalar Android SDK/Java localmente.

### 📊 Modelo de Datos (Basado en Ciencia del Fitness)

#### Entidades Principales

```
Usuario
├── id, nombre, fecha_nacimiento, sexo, peso_inicial
├── objetivo: "hipertrofia" | "fuerza" | "resistencia" | "perdida_grasa"
├── nivel: "principiante" | "intermedio" | "avanzado"
└── configuracion_entrenamiento

Rutina
├── id, usuario_id, nombre, descripcion, activa (bool)
├── fecha_creacion, fecha_modificacion
└── dias: [DiaRutina]

DiaRutina
├── id, rutina_id, nombre_dia (ej: "Tren Superior - Empuje")
├── orden, notas
└── ejercicios: [EjercicioEnRutina]

EjercicioEnRutina
├── id, dia_id, ejercicio_id (FK), orden
├── series_objetivo, reps_objetivo_min, reps_objetivo_max
├── peso_objetivo (opcional, se ajusta dinámicamente)
└── descanso_segundos

Ejercicio (Catálogo Maestro)
├── id, nombre, grupo_muscular_primario
├── grupos_musculares_secundarios: [string]
├── equipamiento: "barra" | "mancuernas" | "maquina" | "peso_corporal"
├── es_compuesto (bool)
├── factor_fraccional: 1.0 (directo) | 0.5 (indirecto)
└── instrucciones, video_url (opcional)

SesionEntrenamiento (Una sesión real ejecutada)
├── id, usuario_id, dia_rutina_id, fecha
├── duracion_minutos, notas, rpe_sesion (1-10)
└── registros: [RegistroEjercicio]

RegistroEjercicio (Ejercicio dentro de una sesión)
├── id, sesion_id, ejercicio_id
├── series_completadas: [SerieReal]
└── rpe_ejercicio (1-10)

SerieReal (Serie individual ejecutada)
├── id, registro_id, numero_serie
├── peso_levantado, reps_realizadas
├── rpe_serie (1-10) o rir (repeticiones en reserva)
├── completada (bool)
└── notas

MetricaProgreso (Calculada automáticamente)
├── id, usuario_id, ejercicio_id, fecha
├── volumen_total (peso × reps × series)
├── 1rm_estimado (Epley: peso × (1 + 0.0333 × reps))
├── series_efectivas_semana (con factor fraccional)
└── tendencia: "subiendo" | "estancado" | "bajando"
```

### 🧪 Principios Científicos a Implementar

1. **Sobrecarga Progresiva:** El sistema debe sugerir incrementos de peso/reps basados en el rendimiento previo.
2. **Volumen Semanal:** Rastrear series efectivas por grupo muscular. Objetivo: 10-20 series para hipertrofia. Usar factor fraccional: series indirectas cuentan como 0.5.
3. **RPE/RIR:** Permitir registrar el esfuerzo percibido por serie para auto-regular la carga.
4. **1RM Estimado:** Calcular automáticamente con fórmula de Epley para monitorear fuerza.
5. **Detección de Estancamiento:** Alertar si un ejercicio no progresa en 2-3 sesiones consecutivas.

### 📱 Funcionalidades Mínimas Viables (MVP)

#### Pantallas Principales

1. **Dashboard:** Volumen semanal, racha de entrenamientos, próximo entrenamiento programado.
2. **Mis Rutinas:** Lista de rutinas, crear/editar/duplicar/eliminar.
3. **Editor de Rutina:** Añadir días, ejercicios desde catálogo, definir series/reps/descanso.
4. **Sesión Activa:** Vista durante el entrenamiento con registro de peso/reps por serie.
5. **Historial:** Sesiones pasadas con métricas y comparativas.
6. **Progreso:** Gráficos de volumen por ejercicio, evolución de 1RM, series semanales por grupo muscular.
7. **Catálogo de Ejercicios:** Buscador con filtros por grupo muscular/equipamiento.

#### Flujo Crítico: Registrar una Serie

```
[Usuario] Toca "Sesión Activa"
    ↓
[Muestra] Ejercicio 1: Sentadilla
    ↓
[Usuario] Selecciona serie 1, ingresa: peso=60kg, reps=10
    ↓
[Sistema] Guarda SerieReal, calcula volumen acumulado
    ↓
[Usuario] Marca RPE=8 (RIR=2)
    ↓
[Sistema] Al completar sesión:
    - Calcula volumen total
    - Compara con sesión anterior
    - Sugiere ajuste para próxima sesión
```

### 🏋️ Rutinas Iniciales Precargadas

El sistema debe incluir las **dos rutinas completas** que ya proporcionaste:

#### Rutina 1: Gimnasio (5 días)

**Día 1: Tren Superior - Empuje**
- Press de banca con mancuernas: 3x10-12
- Press de hombros con mancuernas: 3x10-12
- Elevaciones laterales: 3x12-15
- Fondos en banca (tríceps): 3x12-15
- Plancha frontal: 3x30-60 seg

**Día 2: Tren Inferior - Glúteos/Isquios**
- Peso muerto rumano: 3x10-12
- Hip Thrust: 3x10-12
- Sentadilla búlgara: 3x10-12 por pierna
- Curl de isquiotibiales en máquina: 3x12-15
- Puente de pelvis en suelo: 3x15-20

**Día 3: Tren Superior - Tirón**
- Remo con mancuerna a una mano: 3x10-12 por lado
- Jalón al pecho en polea: 3x10-12
- Remo sentado en polea: 3x10-12
- Curl de bíceps con mancuernas: 3x12-15
- Face pulls: 3x15-20

**Día 4: Tren Inferior - Cuádriceps/Glúteos**
- Sentadilla (barra o mancuerna): 3x10-12
- Prensa de piernas: 3x12-15
- Zancadas estáticas o caminando: 3x10-12 por pierna
- Extensiones de pierna en máquina: 3x12-15
- Elevaciones de piernas en máquina: 3x15

**Día 5: Cuerpo Completo - Metabólico**
- Peso muerto convencional: 3x8-10
- Sentadilla con salto o saltos al cajón: 3x8-10
- Remo vertical: 3x10-12
- Press de hombros con mancuernas: 3x10-12
- Plancha con elevación de piernas: 3x10-12 por lado

#### Rutina 2: Casa (5 días)

**Día 1: Tren Superior y Core**
- Flexiones de pecho: 3x8-12
- Fondos de tríceps en silla: 3x10-15
- Plancha frontal: 3x30-60 seg
- Plancha con elevación de piernas: 3x10-12 por lado

**Día 2: Cardio y Resistencia**
- Saltos de tijera: 3x45 seg
- Rodillas al pecho: 3x45 seg
- Escaladores (Mountain Climbers): 3x45 seg
- Boxeo en sombra: 3x45 seg

**Día 3: Piernas y Glúteos**
- Sentadillas: 3x15-20
- Zancadas alternando piernas: 3x12-15 por pierna
- Puente de glúteos en el suelo: 3x15-20
- Sentadilla búlgara (pie en silla): 3x10-12 por pierna

**Día 4: Core y Cuerpo Completo**
- Burpees: 3x8-12
- Escaladores (Mountain Climbers): 3x45 seg
- Russian Twists (giros rusos): 3x15-20 por lado
- Elevaciones de piernas en el suelo: 3x15-20

**Día 5: Recuperación Activa**
- Estiramientos de todo el cuerpo: 10-15 min
- Rutina suave de yoga o movilidad: 10-15 min

Cada ejercicio debe mapearse al catálogo maestro con grupo muscular correcto y factor fraccional.

### ☁️ Configuración de EAS Build (Sin SDK Local)

**Pasos para el agente:**

1. Crear proyecto: `npx create-expo-app@latest --template blank-typescript`
2. Instalar dependencias: `npx expo install expo-dev-client expo-sqlite zustand`
3. Configurar `eas.json` con perfiles:
   - `development`: developmentClient true, distribution internal
   - `preview`: distribution internal, para testing en dispositivos
   - `production`: para App Store/Play Store
4. El usuario solo necesita:
   - Node.js instalado
   - Cuenta Expo (gratuita)
   - Comando: `eas build --platform android --profile preview`
   - **NO requiere Android SDK, Java, Xcode**

### 📈 Métricas de Éxito para el MVP

| Métrica | Objetivo |
|---------|----------|
| Registro de serie | < 3 taps desde pantalla activa |
| Tiempo de carga inicial | < 2 segundos |
| Funcionamiento offline | 100% de funciones core |
| Tamaño de app | < 50MB instalada |
| Cálculo de volumen | Actualización en tiempo real |

### ✅ Checklist de Planificación (Agente debe completar antes de codificar)

- [ ] Definir esquema completo de base de datos (SQLite)
- [ ] Mapear las 2 rutinas iniciales al catálogo de ejercicios
- [ ] Diseñar sistema de navegación (React Navigation o Expo Router)
- [ ] Especificar paleta de colores y componentes UI
- [ ] Definir lógica de cálculo de sobrecarga progresiva
- [ ] Configurar EAS Build profiles
- [ ] Crear sistema de seed para rutinas iniciales

---

## Instrucciones para el Agente

**Paso 1:** Lee completamente esta planificación.

**Paso 2:** Antes de escribir código, presenta al usuario:
- Diagrama de entidades de base de datos
- Wireframe textual de las 7 pantallas principales
- Estructura de carpetas propuesta

**Paso 3:** Solo después de aprobación del usuario, procede a:
- Inicializar proyecto Expo + TypeScript
- Implementar capa de datos (SQLite + repositorios)
- Implementar lógica de dominio (cálculos de volumen, progresión)
- Implementar UI pantalla por pantalla
- Configurar EAS Build

**Paso 4:** Al finalizar MVP, proporciona al usuario:
- Comando exacto para build: `eas build --platform android --profile preview`
- Instrucciones para instalar el APK en su dispositivo
- Documentación de cómo crear/modificar rutinas

---

## Fórmulas y Lógica de Dominio

### 1RM Estimado (Fórmula de Epley)
```
1RM = peso × (1 + 0.0333 × reps)
```

### Volumen Total de Entrenamiento
```
volumen = Σ (peso × reps) por cada serie completada
```

### Series Efectivas Semanales por Grupo Muscular
```
series_efectivas = series_directas × 1.0 + series_indirectas × 0.5
```

### Sugerencia de Sobrecarga Progresiva
```
SI el usuario completó todas las series al tope del rango de reps
  Y RPE promedio ≤ 8
ENTONCES sugerir +2.5kg (tren superior) o +5kg (tren inferior)

SI el usuario no alcanzó el mínimo de reps en 2 sesiones consecutivas
ENTONCES sugerir reducir peso en 5-10%
```

### Detección de Estancamiento
```
SI 1RM_estimado no incrementa en 3 sesiones consecutivas del mismo ejercicio
ENTONCES marcar como "estancado" y sugerir variación
```

---

## Estructura de Carpetas Propuesta

```
app-fitness/
├── app/                          # Expo Router
│   ├── (tabs)/
│   │   ├── index.tsx            # Dashboard
│   │   ├── routines.tsx         # Mis Rutinas
│   │   ├── session.tsx          # Sesión Activa
│   │   ├── history.tsx          # Historial
│   │   └── progress.tsx         # Progreso
│   ├── routine/
│   │   ├── [id].tsx             # Ver/Editar rutina
│   │   └── new.tsx              # Crear rutina
│   └── exercise/
│       └── catalog.tsx          # Catálogo de ejercicios
├── src/
│   ├── db/
│   │   ├── schema.ts            # Definición SQLite
│   │   ├── migrations.ts
│   │   ├── seed.ts              # Rutinas iniciales
│   │   └── repositories/        # Acceso a datos por entidad
│   ├── domain/
│   │   ├── metrics.ts           # Cálculos (1RM, volumen, etc.)
│   │   ├── progression.ts       # Lógica de sobrecarga progresiva
│   │   └── types.ts             # Tipos de dominio
│   ├── store/
│   │   ├── useUserStore.ts
│   │   ├── useRoutineStore.ts
│   │   └── useSessionStore.ts
│   ├── components/
│   │   ├── ui/                  # Botones, inputs, cards
│   │   └── domain/              # Componentes específicos
│   └── utils/
│       ├── dates.ts
│       └── formatters.ts
├── assets/
├── app.json
├── eas.json
├── tsconfig.json
└── package.json
```

---

## Notas Finales para el Agente

- **Prioriza funcionamiento offline**: Todos los datos deben persistir localmente en SQLite.
- **Sincronización en la nube**: Fuera del alcance del MVP, pero dejar la arquitectura preparada (IDs UUID, timestamps, flag `synced`).
- **Accesibilidad**: Contraste adecuado, tamaños de toque ≥44px, soporte para modo oscuro.
- **Internacionalización**: Preparar estructura para i18n (español inicial).
- **Testing**: Al menos tests unitarios para `domain/metrics.ts` y `domain/progression.ts`.