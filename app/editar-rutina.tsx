import { router, useLocalSearchParams } from 'expo-router'
import { useEffect } from 'react'
import { Button, Spinner, Text, YStack } from 'tamagui'

import { FormularioRutina, type DatosRutinaGuardar } from '../src/components/rutinas/FormularioRutina'
import { useRutinasStore } from '../src/store/rutinas.store'

function volverARutinas() {
  if (router.canGoBack()) {
    router.back()
  } else {
    router.navigate('/rutinas')
  }
}

/**
 * Pantalla dedicada de edición completa de una rutina existente:
 * permite modificar nombre, descripción, días y ejercicios en rutina.
 * Reutiliza `FormularioRutina` y delega en `guardarRutinaExistente` del store.
 */
export default function EditarRutinaScreen() {
  const params = useLocalSearchParams<{ id?: string }>()
  const id = typeof params.id === 'string' ? params.id : undefined

  const seleccionarRutina = useRutinasStore((s) => s.seleccionarRutina)
  const rutinaSeleccionada = useRutinasStore((s) => s.rutinaSeleccionada)
  const cargando = useRutinasStore((s) => s.cargando)
  const error = useRutinasStore((s) => s.error)
  const guardarRutinaExistente = useRutinasStore((s) => s.guardarRutinaExistente)

  useEffect(() => {
    if (id && rutinaSeleccionada?.id !== id) {
      void seleccionarRutina(id)
    }
  }, [id, rutinaSeleccionada?.id, seleccionarRutina])

  const guardar = async (datos: DatosRutinaGuardar) => {
    if (!id) {
      return
    }

    const guardada = await guardarRutinaExistente(id, {
      nombre: datos.nombre,
      descripcion: datos.descripcion,
      dias: datos.dias.map((d, ordenDia) => ({
        id: d.id,
        nombre_dia: d.nombre_dia,
        orden: ordenDia + 1,
        notas: d.notas ?? null,
        ejercicios: d.ejercicios.map((e, ordenEj) => ({
          id: e.id,
          ejercicio_id: e.ejercicio_id,
          orden: ordenEj + 1,
          series_objetivo: e.series_objetivo,
          reps_objetivo_min: e.reps_objetivo_min,
          reps_objetivo_max: e.reps_objetivo_max,
          peso_objetivo: e.peso_objetivo,
          descanso_segundos: e.descanso_segundos,
        })),
      })),
    })

    if (guardada) {
      volverARutinas()
    }
  }

  if (!id) {
    return (
      <YStack
        flex={1}
        backgroundColor="$background"
        justifyContent="center"
        alignItems="center"
        padding="$4"
        gap="$3"
      >
        <Text color="$red11" fontSize="$4" fontWeight="bold">
          ID de rutina no especificado
        </Text>
        <Button size="$3" onPress={volverARutinas}>
          Volver a rutinas
        </Button>
      </YStack>
    )
  }

  if (cargando && (!rutinaSeleccionada || rutinaSeleccionada.id !== id)) {
    return (
      <YStack
        flex={1}
        backgroundColor="$background"
        justifyContent="center"
        alignItems="center"
        gap="$4"
      >
        <Spinner size="large" color="$color" />
        <Text color="$gray10">Cargando rutina…</Text>
      </YStack>
    )
  }

  if (!rutinaSeleccionada || rutinaSeleccionada.id !== id) {
    return (
      <YStack
        flex={1}
        backgroundColor="$background"
        justifyContent="center"
        alignItems="center"
        padding="$4"
        gap="$3"
      >
        <Text color="$red11" fontSize="$4" fontWeight="bold">
          No se encontró la rutina
        </Text>
        {error ? (
          <Text color="$gray10" textAlign="center">
            {error}
          </Text>
        ) : null}
        <Button size="$3" onPress={volverARutinas}>
          Volver a rutinas
        </Button>
      </YStack>
    )
  }

  return (
    <FormularioRutina
      key={rutinaSeleccionada.id}
      titulo="Editar rutina"
      textoBotonGuardar="Guardar cambios"
      valoresIniciales={rutinaSeleccionada}
      ocupado={cargando}
      error={error}
      onGuardar={guardar}
      onVolver={volverARutinas}
    />
  )
}
