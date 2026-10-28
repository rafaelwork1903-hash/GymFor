import { router } from 'expo-router'

import { FormularioRutina, type DatosRutinaGuardar } from '../src/components/rutinas/FormularioRutina'
import { useConfiguracionStore } from '../src/store/configuracion.store'
import { useRutinasStore } from '../src/store/rutinas.store'

function volverARutinas() {
  if (router.canGoBack()) {
    router.back()
  } else {
    router.navigate('/rutinas')
  }
}

/**
 * Pantalla dedicada de creación completa de rutinas: datos generales, días
 * (nombre + notas) y ejercicios del catálogo con series/reps/peso/descanso.
 * Reutiliza `FormularioRutina` y delega en `crearRutinaNueva` del store.
 */
export default function NuevaRutinaScreen() {
  const usuario = useConfiguracionStore((s) => s.usuarioActivo)
  const cargando = useRutinasStore((s) => s.cargando)
  const error = useRutinasStore((s) => s.error)
  const crearRutinaNueva = useRutinasStore((s) => s.crearRutinaNueva)

  const guardar = async (datos: DatosRutinaGuardar) => {
    const creada = await crearRutinaNueva({
      usuario_id: usuario?.id ?? null,
      nombre: datos.nombre,
      descripcion: datos.descripcion,
      dias: datos.dias.map((dia) => ({
        nombre_dia: dia.nombre_dia,
        notas: dia.notas,
        ejercicios: dia.ejercicios.map((ejercicio) => ({
          ejercicio_id: ejercicio.ejercicio_id,
          orden: ejercicio.orden,
          series_objetivo: ejercicio.series_objetivo,
          reps_objetivo_min: ejercicio.reps_objetivo_min,
          reps_objetivo_max: ejercicio.reps_objetivo_max,
          peso_objetivo: ejercicio.peso_objetivo,
          descanso_segundos: ejercicio.descanso_segundos,
        })),
      })),
    })

    if (creada) {
      volverARutinas()
    }
  }

  return (
    <FormularioRutina
      titulo="Nueva rutina"
      textoBotonGuardar="Guardar rutina"
      ocupado={cargando}
      error={error}
      onGuardar={guardar}
      onVolver={volverARutinas}
    />
  )
}
