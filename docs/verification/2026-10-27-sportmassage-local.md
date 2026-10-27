# Sport Massage Blogger: verificación local del 27/10/2026

Código comprobado: `4c3e2bb27300c77ef3e99d388de83ec97a5074fb`, rama `codex/sportmassage-continuation-20261027`. Node `26.12.0`, npm `11.20.0`; CI utiliza Node 22. No se modificó código funcional durante esta comprobación.

## Aislamiento y resultados

Se exportó el commit con `git archive` a un directorio de pruebas sin `.env.local`. Los comandos eliminaron del entorno `DEEPL_AUTH_KEY`, `DEEPL_API_URL` y `BLOGGER_GITHUB_TOKEN`. No se usó la clave real ni se hicieron solicitudes autenticadas a DeepL, GitHub, Supabase o bases de producción.

| Comprobación | Resultado |
| --- | --- |
| `npm test` | 556 pruebas: 554 aprobadas, 2 omitidas, 0 fallos |
| `npm run lint` | Aprobado |
| `npm run typecheck` | Aprobado |
| `npm run build`, después de typecheck | Aprobado |
| Navegador real, escritorio de 1440 px | Sin desbordamiento horizontal |
| Navegador real, 390 × 844 y 360 × 800 | Ancho de página de 390 y 360 px respectivamente, sin desbordamiento horizontal |
| Original finés y versiones manuales inglesa/española | Títulos y textos conservados al cambiar de pestaña, guardar y recargar |
| Consola del navegador local | Cero errores y avisos registrados |
| Registro del servidor local | 1 borrador en memoria, 1 guardado, 0 solicitudes de publicación y 0 de traducción |

Las dos omisiones son las pruebas PostgreSQL de concurrencia de pagos y de propiedad/caducidad/auditoría de sesiones de soporte. Requieren una base de pruebas configurada y no se habilitaron contra producción. La suite emitió 17 advertencias existentes de Node sobre el tipo de módulo; no fueron fallos de pruebas.

## Qué acreditan las pruebas

`blogger-translation-editor.test.mjs` ejecuta el editor real en JSDOM con API simulada: conservación de versiones FI/EN/ES, generación explícita, edición, guardado, aprobación y publicación simuladas; conservación del texto durante actualización de imágenes y bloqueo de navegación durante guardado.

`blogger-translations.test.mjs` comprueba las funciones reales de saneado, huellas e invalidación de aprobaciones, rechazo de versiones obsoletas/incompletas y selección exacta de textos aprobados. `blogger-publishing-roundtrip.test.mjs` comprueba el publisher con GitHub en memoria y DeepL simulado: borradores, imágenes y metadatos, publicación atómica, errores de cuota y cambios concurrentes. `blogger-translation-routes.test.mjs` comprueba las acciones generar/aprobar y los rechazos de origen/sesión mediante dependencias simuladas.

`blogger-publisher.test.mjs` intercepta solicitudes y comprueba FI→EN-GB con una clave ficticia `:fx` y EN→FI con parámetros HTML. Estas respuestas prefabricadas no demuestran calidad lingüística ni conservación de HTML por el proveedor real.

La comprobación adicional en navegador integrado sirvió los HTML/CSS/JS reales del editor mediante un servidor en `127.0.0.1`, con un único borrador sintético en RAM. Se guardaron las tres versiones, se recargó la página y se verificaron sus textos. El proveedor estaba deshabilitado y `/api/build` rechazaba cualquier publicación. Esta comprobación no utiliza Supabase ni credenciales de cliente y no constituye una prueba de autenticación real.

## DeepL y límites de la entrega

En una fase anterior se observó en la interfaz del titular **API Developer**, **Active**, **Free**, un cupo de plan de 1.000.000 de caracteres y una clave activa. La clave permanece únicamente en el `.env.local` privado del checkout de trabajo, ignorado por Git, con permisos `0600`. Su endpoint se seleccionó según la clave como `https://api-free.deepl.com/v2/translate`. Los ejemplos dejan `DEEPL_API_URL` vacío para conservar la autodetección.

No se ha comprobado una traducción real FI→EN/ES, la cuota restante ni la calidad del proveedor. Tampoco se ha verificado mediante esta ejecución la sesión real de Supabase, una subida de fotos a producción, la entrega de artículos a Hostinger, un dispositivo móvil físico o el flujo completo de copiar/pegar y subir imágenes en móvil. Los ensayos de publicación de la suite solo usan repositorios simulados; en navegador no se pulsó Publicar.

La etapa externa pendiente es autorizar y configurar la clave en `DEEPL_AUTH_KEY` del entorno de ejecución de `wf-studio-panel` en Coolify (UUID `osmlaapxv7bkkrpgpzvkat4k`), comprobar previamente un canal cifrado, aplicar el entorno y verificar la traducción real sin publicar artículos. La revisión automática bloqueó la transferencia por requerir autorización específica del destino. No se ha modificado Coolify, desplegado, fusionado ni publicado contenido durante esta verificación local.

## Evidencias y cierre

Los logs, `browser-evidence.json`, `backend-evidence.json`, capturas de escritorio/móvil y el servidor temporal se conservan localmente en `.local-verification/2026-10-27/`. Son artefactos generados excluidos de Git: no se sincronizan al cambiar de ordenador. Este informe versionado conserva resultados y límites. Las pruebas automatizadas se pueden repetir desde Git instalando las dependencias y ejecutando los comandos indicados, sin cargar el entorno privado. Para repetir la comprobación adicional en navegador hay que recuperar `server.mjs` de las evidencias locales o reconstruir ese servidor temporal: no se recupera solo con Git. Con el servidor recuperado, exportar el mismo commit a una subcarpeta `source/` e instalar allí las dependencias antes de iniciarlo.

Se cerraron las tres pestañas DeepL de la tarea y la pestaña de navegador local. Se restableció el viewport y se detuvo el servidor de pruebas, descartando el borrador en RAM. Las pestañas ajenas y las sesiones globales se conservaron.
