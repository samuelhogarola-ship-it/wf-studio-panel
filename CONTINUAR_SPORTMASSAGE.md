# Retomar Sport Massage Blogger desde otro ordenador

Actualizado: 27/10/2026, Europe/Madrid. Este documento contiene el contexto necesario para continuar sin leer el chat anterior. No contiene contraseñas, claves API ni llaves SSH. El repositorio es público.

## Petición actual del usuario

Conseguir una clave **gratuita** de DeepL para `info@webfuengirola.com`, configurar el Blogger y comprobar la traducción automática. Dejar el contexto recuperable solo con Git porque el usuario cambia de ordenador.

Condiciones obligatorias:

- Trabajar en segundo plano. **No abrir, mover ni enfocar ventanas del usuario.** La autorización anterior para mostrar Chrome quedó revocada.
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

## Estado de código y despliegue comprobado

- Main y producción: `bad6f5132a30d774669876217413b1c876f5be0e`.
- [PR 28 integrado](https://github.com/samuelhogarola-ship-it/wf-studio-panel/pull/28): traducciones editables, aprobación separada, publicación sin retraducción y restauración de botones de imágenes tras operaciones asíncronas.
- [CI del commit desplegado](https://github.com/samuelhogarola-ship-it/wf-studio-panel/actions/runs/40383953219): aprobado, incluidos lint, typecheck, tests, auditoría de producción, pruebas PostgreSQL de seguridad y build.
- Panel alojado en Coolify, repositorio `wf-studio-panel`, rama `main`, aplicación UUID `osmlaapxv7bkkrpgpzvkat4k`.
- Último despliegue comprobado: `7rody2ac8fxcgxotj9gf6i0x`, terminado para ese mismo commit.
- La conexión GitHub necesaria para leer/escribir contenido está configurada en el entorno de ejecución del servidor. No reconfigurar ni copiar su secreto innecesariamente.
- **No hay clave DeepL configurada**: la API devuelve `translationAvailable: false` y el botón de generación aparece desactivado.

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

Se intentó el formulario oficial con Developer seleccionado, el correo elegido y una contraseña aleatoria nueva. La petición quedó en `clearance.deepl.com`, con una comprobación humana. El usuario dijo que pulsarla no funcionaba. **No se confirmó la creación de la cuenta y no se obtuvo clave**; una contraseña provisional generada localmente no demuestra que la cuenta exista. No asumir que esa contraseña es válida ni pedir acceso a Proton Pass.

También se probó la vía oficial alternativa: API Keys → `auth.deepl.com/login` → Crear una cuenta. Los campos cumplían la validación, pero el botón de crear cuenta permanecía deshabilitado y se cargaban comprobaciones de `clearance.deepl.com` y `challenges.cloudflare.com`. No se forzó el botón ni se resolvió/eludió el desafío. Esta vía tampoco produjo una clave.

La página ofrece acceso con Google o Apple. Solo puede completarse con una sesión autorizada del titular; no se ha probado ese acceso ni debe presumirse que el correo elegido pertenece a Google Workspace. Si el usuario completa el alta desde su nuevo equipo o aporta acceso seguro a la cuenta, continuar con la creación/configuración de la clave. No reabrir ventanas del usuario por iniciativa propia.

## Próximos pasos concretos

1. Verificar main, CI y el despliegue actual mediante lecturas, sin modificar servicios que ya funcionan.
2. Determinar si existe ya la cuenta elegida y obtener una clave del plan Developer gratuito mediante el acceso oficial autorizado. No comprar cuotas ni contratar planes para desbloquearla. Si continúa la comprobación humana, comunicar el bloqueo exacto.
3. Guardar la clave de forma segura en `DEEPL_AUTH_KEY` del entorno de ejecución de Coolify, cifrada y oculta; preservar las demás variables. No subirla a Git. No usar `DEEPL_API_KEY`: el editor consulta `DEEPL_AUTH_KEY`.
4. El código selecciona `https://api-free.deepl.com/v2/translate` para claves antiguas terminadas en `:fx`, y `https://api.deepl.com/v2/translate` para las actuales. Existe `DEEPL_API_URL` para indicar un endpoint oficial explícito si corresponde. Confirmar los datos oficiales del plan/clave real antes de configurar.
5. Aplicar la configuración mediante despliegue del panel cuando sea necesario. Verificar que `translationAvailable` es verdadero y que el botón queda habilitado.
6. Probar traducción real finés→inglés y finés→español con una frase genérica en memoria, sin crear ni publicar artículos. Confirmar también el manejo de errores y el respeto a las correcciones manuales con las pruebas aisladas.
7. Mantener como no verificada la entrega real de artículos a Hostinger hasta poder comprobarla sin violar la prohibición de publicar contenido de prueba.

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
