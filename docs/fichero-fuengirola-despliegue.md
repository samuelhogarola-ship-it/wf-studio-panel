# Fichero Fuengirola: despliegue y verificación

Fichero se gestiona en WF Studio Panel. Una solicitud crea un borrador; la publicación en Vivir y Conoce requiere revisión y confirmación humanas. Cada destino tiene su propia categoría y registra su propio resultado.

## Estado y precauciones

- Las ramas de Panel, Vivir y Conoce se revisan conjuntamente: el cambio de tablas y vistas debe coordinarse con la aplicación que las lee. No publicar primero las migraciones de las webs de forma aislada.
- El proyecto del Panel y el proyecto Fuengirola son bases diferentes. En Fuengirola, Vivir usa `public` y Conoce usa `conoce`.
- El historial remoto y local de migraciones del Panel no coincide. **No ejecutar `supabase db push` a ciegas**: comparar versiones y contenido y aplicar únicamente las migraciones verificadas con un plan de recuperación.
- Fuengirola no dispone de copias automáticas en su plan actual. Antes de alterar cualquiera de sus tablas o políticas, obtener un respaldo recuperable y ensayar la restauración y las migraciones en una base aislada. Comprobar la integridad de las fichas, slugs, categorías, reseñas y permisos existentes.
- Vivir ha usado archivos locales de solicitudes y métricas. Antes de redesplegar, verificar el almacenamiento activo y actualizar las copias de esos archivos; las copias anteriores son una instantánea que puede haber quedado obsoleta.
- La copia del Panel realizada el 30 de octubre está en `Documentos/ChatGPT/Respaldos Fichero/2026-10-30-panel/`. Incluye datos privados: mantener permisos restringidos y no subirla a GitHub. Las copias locales de Vivir están en la carpeta contigua `2026-10-30-vivir/`.

## Configuración

Mantener `FICHERO_PUBLISHING_ENABLED=false` hasta que se hayan verificado los destinos. En el entorno seguro del Panel configurar:

- `VIVIR_FUENGIROLA_SUPABASE_URL` y `VIVIR_FUENGIROLA_SUPABASE_SERVICE_ROLE_KEY`.
- `CONOCE_FUENGIROLA_SUPABASE_URL` y `CONOCE_FUENGIROLA_SUPABASE_SERVICE_ROLE_KEY`. Ambos canales pueden apuntar al mismo proyecto Fuengirola; sus esquemas son distintos.
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY` y `TURNSTILE_SECRET_KEY` con un widget válido para los dominios de ambos formularios. La API de solicitudes rechaza el servicio en producción si falta cualquiera de las dos claves.

No insertar claves administrativas en el código, la documentación ni variables públicas del navegador. Los formularios usan `https://admin.webfuengirola.com` por defecto; `NEXT_PUBLIC_FICHERO_REQUEST_ORIGIN` permite cambiar el origen si procede. Comprobar que ese origen corresponde al Panel desplegado y que los dominios de las webs coinciden con la lista de orígenes permitidos.

## Secuencia de verificación

1. Verificar y restaurar las copias en un entorno aislado. Ensayar allí las migraciones de Panel, Vivir y Conoce contra sus esquemas reales y contrastar los datos y permisos existentes.
2. Revisar las PR, los resultados de CI y las revisiones pendientes. Coordinar migraciones y despliegues; proteger la persistencia de Vivir y conservar la posibilidad de restauración. El cambio de Conoce sustituye el acceso público a la tabla de negocios por una vista limitada, por lo que su migración y aplicación deben desplegarse coordinadamente.
3. Con la publicación aún desactivada, comprobar desde cada dominio el formulario, el preflight CORS y la configuración de Turnstile. Una solicitud de prueba identificada debe aparecer una sola vez en el Panel y permanecer como borrador; comprobar también que la repetición no crea duplicados.
4. En el Panel, revisar el borrador y elegir una categoría válida para cada canal activo. Comprobar que aprobar sin publicar no modifica ningún destino. Activar la publicación solo después de verificar credenciales y destinos.
5. Confirmar expresamente la publicación de una ficha de prueba y verificar sus datos y visibilidad en cada web y en su base. Comprobar que datos internos como CIF y correo privado no se exponen a visitantes anónimos.
6. Editar la ficha, aprobar de nuevo y comprobar una nueva versión en ambos destinos. Simular un fallo controlado en uno de los canales y verificar que se registra por separado y que el reintento no duplica ni altera el otro. Comprobar las rutas públicas y el mapa web después de actualizar.
7. Reconciliar los registros antiguos solo después de revisar un informe sin escrituras, siguiendo [la guía de reconciliación](fichero-fuengirola-reconciliation.md). No adoptar ni sobrescribir coincidencias ambiguas automáticamente.

Las pruebas locales de SQL, navegador y PostgREST son útiles para detectar regresiones, pero no sustituyen esta comprobación conjunta sobre el despliegue y las bases de producción.
