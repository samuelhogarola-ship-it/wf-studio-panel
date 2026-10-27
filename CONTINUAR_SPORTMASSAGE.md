# Retomar Sport Massage Blogger desde otro ordenador

Actualizado: 27/10/2026, Europe/Madrid. Este documento contiene el contexto necesario para continuar sin leer el chat anterior. No contiene contraseñas, claves API ni llaves SSH. El repositorio es público.

## Petición actual del usuario

Configurar en el Blogger la clave **gratuita** de DeepL ya disponible para `info@webfuengirola.com` y comprobar la traducción automática. Dejar el contexto recuperable solo con Git porque el usuario cambia de ordenador; los secretos permanecen fuera de Git.

Condiciones obligatorias:

- Usar el navegador integrado de Codex para DeepL y el resto de la navegación, en segundo plano salvo cuando el titular deba completar un acceso. El usuario autorizó una excepción concreta: **usar únicamente la sesión de Coolify que ya tiene abierta en Safari**. No revisar otras pestañas, no usar Firefox ni reabrir Chrome.
- **Nunca acceder a Proton Pass**, ni para buscar credenciales.
- No contratar planes de pago, introducir tarjetas ni activar pruebas de planes de pago.
- No publicar artículos de prueba. El usuario autorizó pruebas aisladas y borradores reversibles, pero hasta ahora no se han creado borradores en producción.
- No resolver ni eludir CAPTCHA. Si una comprobación humana bloquea el alta, comunicarlo y conservar el trabajo independiente.
- No reemplazar DeepL por otro proveedor sin autorización. No publicar secretos en este repositorio ni pegarlos en el chat.
- No confundir una prueba aislada con verificación de producción; no afirmar que la traducción automática ya está activada.

## Recuperación con Git

```sh
git clone --branch codex/sportmassage-continuation-20261027 https://github.com/samuelhogarola-ship-it/wf-studio-panel.git
cd wf-studio-panel
git fetch origin
git status --short --branch
```

Indicación para el agente del nuevo ordenador:

> Lee CONTINUAR_SPORTMASSAGE.md. Continúa con la obtención y configuración gratuita de DeepL, trabajando en segundo plano. No publiques artículos de prueba, no contrates pagos y no accedas a Proton Pass. Comprueba primero el estado actual de main y producción y conserva el contexto y las restricciones de esta guía.

Esta rama contiene el código de main comprobado más esta guía; no introduce cambios funcionales. Antes de cualquier trabajo posterior, revisar cambios nuevos en `origin/main`. Git recupera código y contexto, **no una sesión autenticada de Chrome ni credenciales del ordenador anterior**. El nuevo equipo debe tener los accesos habituales autorizados a las cuentas y al servidor. No copiar secretos a Git para resolver esa limitación.

## Repositorios y accesos

- Panel/editor que debe modificarse: <https://github.com/samuelhogarola-ship-it/wf-studio-panel>. Es un proyecto independiente. **No usar la copia antigua `apps/studio-panel` de otro repositorio** como fuente de verdad.
- Contenido/web de Sport Massage: <https://github.com/samuelhogarola-ship-it/sportmassage>.
- Editor externo: <https://admin.webfuengirola.com/acceso/blogger/sportmassagefuengirola>.
- Desde Área Cliente: <https://portal.webfuengirola.com/cliente/proyectos/sportmassagefuengirola/blogger>.
- Usuario de Blogger: `sportmassagefuengirola@gmail.com`. Contraseña excluida de Git.
- Cuenta elegida para DeepL: `info@webfuengirola.com`. Es una cuenta distinta del acceso de la clienta al Blogger.
- **Cuenta y API verificadas mediante sesión del titular el 27/10/2026:** `info@webfuengirola.com`. La suscripción muestra **API Developer**, **Active**, **Free**, 1.000.000 de caracteres y una clave API activa. El correo es solo el identificador de la cuenta, no una contraseña ni una clave API. No crear una cuenta ni una clave duplicada.

## Recomprobación en el nuevo ordenador — 27/10/2026

- Las referencias remotas siguen en `main=bad6f51` y `codex/sportmassage-continuation-20261027=0279a54` antes de esta actualización documental. No se han mezclado cambios del otro fork de facturación.
- La sesión de Coolify de Safari está autenticada en `http://srv1755854.hstgr.cloud:8000`. El acceso a la aplicación del Blogger es `/project/ne476syz0demj9ho5gqqohl6/environment/pkiafz0ad8tp582uecbbz23v/application/osmlaapxv7bkkrpgpzvkat4k`.
- El panel confirma `Running (no healthcheck)` y el despliegue satisfactorio `7rody2ac8fxcgxotj9gf6i0x` del commit `bad6f5132a30d774669876217413b1c876f5be0e`.
- La búsqueda `DEEPL` en las 80 variables del entorno devuelve cero coincidencias. La búsqueda `BLOGGER_GITHUB` confirma los nombres de las variables de repositorio, rama y token existentes, sin revelar sus valores. No se modificó ninguna variable ni se lanzó un despliegue.
- No se encontró una dirección HTTPS de administración de Coolify: el campo URL de sus ajustes generales está vacío. No presentar el acceso HTTP como cifrado ni pedir contraseñas allí. Confirmar un canal cifrado antes de introducir una clave nueva.
- El titular completó después el inicio de sesión y el registro del producto API en el navegador integrado. La ruta de claves ya muestra una clave activa. Se guardó únicamente una copia local en `.env.local`, ignorada por Git y con modo `0600`, junto con su endpoint. La carga local del entorno se validó sin red ni mostrar valores privados. Coolify sigue sin cambios. No extraer contraseñas del llavero ni pedir secretos por chat.
- En el checkout aislado se repitieron `npm test` (556 pruebas: 554 aprobadas, 2 omitidas, cero fallos), lint, typecheck, build y auditoría de producción (cero vulnerabilidades). Son comprobaciones locales; no equivalen a una traducción real ni a publicar en Hostinger.

### Producto API gratuito activo; configuración remota pendiente

La pestaña API de la web es una página comercial. Desde su tabla de planes se abrió **Sign up for free** para Developer en la cuenta ya autenticada, sin crear otra cuenta. El formulario mostraba **Your Developer plan is completely free**, **Total price free**, **Email verified** y **Start building for free**, sin pedir tarjeta. El titular completó después el registro. Se recomprobó la suscripción activa gratuita y la presencia de una clave, sin crear claves adicionales.

La clave de este Developer utiliza el endpoint `https://api-free.deepl.com/v2/translate`, seleccionado según su sufijo por el mismo criterio que el SDK oficial. **No asumir el endpoint estándar solo por el nombre Developer.** La copia local lo declara expresamente; los ejemplos dejan `DEEPL_API_URL` vacío para no anular la detección automática. No se ha realizado ninguna solicitud autenticada: ni cuota disponible ni traducción real están verificadas todavía.

La revisión automática rechazó la transferencia del secreto a Coolify por requerir autorización explícita del destino. El usuario autorizó como alternativa una copia local privada en el archivo de entorno de `wf-studio-panel`; se completó esa copia y no se trasladó el secreto al servidor. No efectuar llamadas autenticadas al proveedor ni modificar el entorno remoto en este alcance. Antes de la transferencia, obtener la aprobación específica para llevar la clave de esta cuenta a `DEEPL_AUTH_KEY` del entorno de ejecución de `wf-studio-panel` (UUID `osmlaapxv7bkkrpgpzvkat4k`), manteniendo oculto su valor y el resto de variables. La activación remota y la prueba real de traducción siguen pendientes.

## Estado de código y despliegue comprobado

- Main y producción: `bad6f5132a30d774669876217413b1c876f5be0e`.
- [PR 28 integrado](https://github.com/samuelhogarola-ship-it/wf-studio-panel/pull/28): traducciones editables, aprobación separada, publicación sin retraducción y restauración de botones de imágenes tras operaciones asíncronas.
- [CI del commit desplegado](https://github.com/samuelhogarola-ship-it/wf-studio-panel/actions/runs/40383953219): aprobado, incluidos lint, typecheck, tests, auditoría de producción, pruebas PostgreSQL de seguridad y build.
- Panel alojado en Coolify, repositorio `wf-studio-panel`, rama `main`, aplicación UUID `osmlaapxv7bkkrpgpzvkat4k`.
- Último despliegue comprobado: `7rody2ac8fxcgxotj9gf6i0x`, terminado para ese mismo commit.
- La conexión GitHub necesaria para leer/escribir contenido está configurada en el entorno de ejecución del servidor. No reconfigurar ni copiar su secreto innecesariamente.
- **No hay clave DeepL configurada en producción**: la última API autenticada devolvía `translationAvailable: false`. Hay una copia local privada; no implica activación remota del botón de generación.

Estos valores describen la última comprobación; volver a verificarlos antes de actuar. Guardar esta guía en una rama no implica desplegarla.

## Funciones implementadas y contrato acordado

1. Escribir el original en finés, idioma predeterminado. Inglés y español son opcionales.
2. Pulsar expresamente **Generate automatic translation from original** para generar los idiomas seleccionados.
3. Revisar, editar y guardar cada versión por separado.
4. Aprobar cada traducción mediante **Approve this translation for publishing** antes de publicarla.
5. Publicar utiliza exactamente los textos guardados y aprobados; **no llama a DeepL**.
6. Solo una regeneración explícita reemplaza las traducciones seleccionadas y revoca su aprobación. Publicar no debe borrar correcciones manuales.
7. Cambiar el original invalida las aprobaciones vinculadas a su versión, conservando los textos traducidos. Editar una traducción invalida su aprobación.
8. Un error o agotamiento de cuota del proveedor conserva los borradores. Las traducciones manuales funcionan sin clave.

El guardado usa `blog-posts/<slug>.md`, metadatos de imágenes y el archivo asociado `<slug>.translations.json`. La publicación genera las páginas mediante una actualización Git atómica. Las aprobaciones se vinculan mediante huellas del original y de cada traducción. La generación vuelve a comprobar cambios concurrentes antes de guardar para no sobrescribir correcciones de la autora.

## Evidencia y límites de la comprobación

Comprobado en producción con el usuario correcto:

- Acceso directo y desde Área Cliente: HTTP 200 y editor cargado.
- API de publicaciones autenticada: HTTP 200. Sin sesión: HTTP 401.
- Interfaz en inglés, original finés y pestañas finés/inglés/español.
- Edición en el navegador de original y versiones manuales: conserva los textos al cambiar de pestaña. Vista previa muestra el original escrito. No se guardaron esas pruebas.
- Escritorio de 1440 px y móvil de 390 px sin desbordamiento horizontal; sin errores de JavaScript ni respuestas de error de API durante esas pruebas.
- Lista de publicaciones: **cero**. El repositorio no contenía `blog-posts`; `blog` contenía solo `index.html`. No había artículos/fotografías existentes con que verificar carga.

No comprobado mediante escrituras en producción: persistencia real de borradores, subida de fotos, aprobación guardada, generación DeepL y entrega del artículo publicado a la web de Hostinger. Esos recorridos, salvo la entrega real a Hostinger y el proveedor real pendiente de clave, se prueban con proveedores/repositorios simulados.

Pruebas locales repetidas sobre código idéntico al árbol del commit desplegado:

- `npm run lint`, `npm run typecheck` y `npm run build`: aprobados.
- `npm test`: 556 pruebas, 554 aprobadas, 2 omitidas, cero fallos.
- `npm audit --omit=dev`: cero vulnerabilidades.
- Auditoría con dependencias de desarrollo: cuatro vulnerabilidades (dos altas, dos moderadas) en `baseline-browser-mapping`, `brace-expansion`, `browserslist` y `postcss-selector-parser`. No se corrigieron durante la auditoría.
- `npm run test:db` no pudo ejecutarse localmente porque Docker/Colima estaba apagado. Sí pasó en el CI del commit desplegado. El runner usa una base desechable; nunca apuntar estas pruebas a producción.
- CI usa Node 22; la última comprobación local usó Node 26. Preferir Node 22 para reproducir CI.

Ejecutar typecheck y build secuencialmente: Next regenera `.next/types` y una ejecución simultánea provocó antes un fallo ambiental que desapareció al repetir secuencialmente.

## DeepL y bloqueo actual

- [Plan oficial Developer](https://support.deepl.com/hc/en-us/articles/360021200939-DeepL-API-plans): **1.000.000 de caracteres en total**, sin renovación mensual. El antiguo API Free de 500.000/mes no admite altas nuevas.
- [Página oficial de desarrolladores](https://www.deepl.com/en/developers): alta gratuita sin tarjeta.
- [Registro Developer](https://www.deepl.com/en/signup?cta=checkout&is_api=true&productId=api-developer).
- [Claves de la cuenta](https://app.deepl.com/en/your-account/keys).
- [Instrucciones oficiales para crear una clave](https://support.deepl.com/hc/en-us/articles/360020695820-API-key-for-DeepL-API).

Historial del intento anterior: se intentó el formulario oficial con Developer seleccionado, el correo elegido y una contraseña aleatoria nueva. La petición quedó en `clearance.deepl.com`, con una comprobación humana. El usuario dijo que pulsarla no funcionaba. Ese intento no confirmó un alta ni produjo una clave. El titular ha accedido después a su cuenta existente; no repetir el alta. No asumir que la contraseña provisional del intento anterior es válida ni pedir acceso a Proton Pass.

También se probó la vía oficial alternativa: API Keys → `auth.deepl.com/login` → Crear una cuenta. Los campos cumplían la validación, pero el botón de crear cuenta permanecía deshabilitado y se cargaban comprobaciones de `clearance.deepl.com` y `challenges.cloudflare.com`. No se forzó el botón ni se resolvió/eludió el desafío. Esta vía tampoco produjo una clave.

La página ofrece acceso con Google o Apple; no debe presumirse que el correo elegido pertenece a Google Workspace. La sesión actual ya está autenticada por el titular: reutilizarla sin volver a pedir contraseña. No reabrir ventanas del usuario por iniciativa propia.

## Próximos pasos concretos

1. Verificar main, CI y el despliegue actual mediante lecturas, sin modificar servicios que ya funcionan.
2. Reutilizar la sesión de `info@webfuengirola.com` y la clave activa del Developer gratuito. No repetir el registro ni crear claves duplicadas. Si se trabaja en el mismo ordenador, la copia local está en `.env.local`, fuera de Git; si se cambia de ordenador, recuperar el secreto por un canal seguro autorizado. No comprar cuotas ni contratar planes.
3. Tras la aprobación específica del destino y la comprobación del canal cifrado, guardar la clave de forma segura en `DEEPL_AUTH_KEY` del entorno de ejecución de Coolify, cifrada y oculta; preservar las demás variables. No subirla a Git. No usar `DEEPL_API_KEY`: el editor consulta `DEEPL_AUTH_KEY`.
4. El código selecciona `https://api-free.deepl.com/v2/translate` para claves terminadas en `:fx`, incluida la clave Developer comprobada en esta cuenta, y `https://api.deepl.com/v2/translate` para las demás. `DEEPL_API_URL` permite un endpoint oficial explícito si corresponde; dejarlo vacío conserva la detección automática.
5. Aplicar la configuración mediante despliegue del panel cuando sea necesario. Verificar que `translationAvailable` es verdadero y que el botón queda habilitado.
6. Probar traducción real finés→inglés y finés→español con una frase genérica en memoria, sin crear ni publicar artículos. Confirmar también el manejo de errores y el respeto a las correcciones manuales con las pruebas aisladas.
7. Mantener como no verificada la entrega real de artículos a Hostinger hasta poder comprobarla sin violar la prohibición de publicar contenido de prueba.

## Verificación local final del 27/10/2026

Ver [el informe local](docs/verification/2026-10-27-sportmassage-local.md): suite completa (554 aprobadas, 2 omitidas, 0 fallos), lint, tipos y build aprobados. En navegador real se verificaron conservación de FI/EN/ES tras guardar/recargar y anchos de 1440, 390 y 360 px sin desbordamiento; el fixture no usa claves ni permite publicar. Se cerraron las pestañas de la tarea y el servidor temporal. El informe separa esos resultados de la API real y de la configuración remota aún bloqueada.

## Archivos relevantes para continuar

- `public/blogger/index.html`, `public/blogger/app.js`, `public/blogger/styles.css`: interfaz y estado del editor.
- `src/lib/blogger/publisher.mjs`: GitHub, borradores, imágenes, llamadas DeepL y publicación.
- `src/lib/blogger/translations.mjs`: normalización, huellas, aprobaciones y selección de versiones publicables.
- `src/app/api/posts/[slug]/translations/route.ts`: acciones explícitas generate/approve y autorización.
- `src/lib/blogger/authorize.ts`, `src/lib/blogger/legacy-authorize.ts`: autorización por usuario/proyecto.
- `tests/blogger-translation-editor.test.mjs`, `tests/blogger-translations.test.mjs`, `tests/blogger-translation-routes.test.mjs`: recorridos de edición y revisión.
- `tests/blogger-publishing-roundtrip.test.mjs`: simulación de guardar, cargar, imágenes, generar, editar, aprobar y publicar, incluida concurrencia y cuota.
- `docs/superpowers/specs/2026-10-26-reviewed-blogger-translations.md` y `docs/superpowers/plans/2026-10-26-reviewed-blogger-translations.md`: diseño y ejecución de la función ya integrada.
- `.github/workflows/ci.yml`, `package.json`, `scripts/test-support-postgres.mjs`: comprobaciones reproducibles.

## Qué no depende del ordenador anterior

Código, pruebas y diseño están en GitHub; el servicio y su conexión GitHub siguen en el servidor. Esta guía conserva el contexto sin necesitar el chat ni una Page externa. Los scripts temporales de auditoría, capturas y sesiones de navegador no se trasladan, pero sus resultados y límites están resumidos arriba y las pruebas versionadas permiten repetirlos.

La carpeta original del usuario dejó de existir en la ruta local durante el trabajo. No recrear rutas antiguas ni suponer que siguen disponibles archivos `.env`. Clonar el repositorio en una carpeta elegida en el nuevo equipo y recuperar cualquier secreto necesario por un canal seguro autorizado.
