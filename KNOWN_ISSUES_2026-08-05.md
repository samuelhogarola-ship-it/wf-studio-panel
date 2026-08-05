# Incidencias conocidas del panel

Registro de los problemas detectados durante la migración a `wf-studio-panel` y la estabilización de producción.

## Corregidas

- **Proxy sirviendo la app antigua:** tras crear la nueva app en Coolify, `admin.webfuengirola.com` llegó a servir el contenedor legacy. El dominio debe apuntar solo a `wf-studio-panel`; si las rutas quedan antiguas, reiniciar el proxy regenera la configuración.
- **Despliegue correcto pero build antiguo en el dominio:** comprobar siempre el SHA `Importing ... commit sha ...` y verificar que el dominio muestra la revisión nueva.
- **Error `Expected string, received null` al crear bonos:** campos opcionales ausentes en `FormData` rompían la validación. Corregido en `7237ce4`.
- **Error al guardar registros de actividad:** el campo opcional `Detalle` llegaba como `null`. Corregido en `30bf7e4`.
- **Excepción cliente tras un redeploy:** una pestaña podía conservar HTML/chunks de una revisión anterior y mostrar `Application error` o `ChunkLoadError`. Recargar cerrando la pestaña o con `Cmd + Shift + R` fuerza la revisión actual.
- **Navegación ambigua:** la entrada visible `Horas` se renombró a `Bonos` en `36a4f53`.

## Pendientes

- **Servicios mal separados:** `/paneladmin/servicios` registra servicios contratados por cliente, aunque la pantalla se presenta como catálogo general. Debe separarse un catálogo general de servicios de las asignaciones a clientes.
- **Agama Marketplace:** la pantalla necesita `TODO_PLASTICO_URL` y `TODO_PLASTICO_SERVICE_KEY` para mostrar datos reales.
- **Superentrenador:** usuarios/PT dependen de `SUPERENTRENADOR_URL` y `SUPERENTRENADOR_SERVICE_KEY`; sin esas credenciales la pantalla debe mostrar estado pendiente, no datos inventados.
- **Vokabel-World / imKontext:** la pantalla carga, pero el recuento de usuarios con acceso aparece a cero y requiere verificar fuente, permisos y consulta.
- **Clientes Vivir/Conoce Fuengirola:** las listas pueden aparecer vacías si no existen clientes con los valores de proyecto correspondientes.
- **Turnstile:** el formulario público requiere `NEXT_PUBLIC_TURNSTILE_SITE_KEY` y `TURNSTILE_SECRET_KEY` configuradas en producción.

## Procedimiento de diagnóstico

1. Confirmar el SHA importado por Coolify.
2. Comprobar que `admin.webfuengirola.com` apunta solo a `wf-studio-panel`.
3. Reiniciar el proxy si el dominio sirve otra revisión.
4. Probar en una pestaña nueva o hacer recarga forzada tras el despliegue.
5. Revisar logs del contenedor y consola del navegador antes de cambiar variables o datos.
