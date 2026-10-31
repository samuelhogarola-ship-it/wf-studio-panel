# Fichero Fuengirola — Diseño de la primera fase

## Intención

Crear **Fichero** como aplicación administrativa de primer nivel dentro de WF Panel para gestionar directorios de empresas y profesionales. La primera entrega debe completar el catálogo Fuengirola y sustituir los flujos parciales y duplicados que hoy viven en Vivir en Fuengirola y en la PR #69.

Fichero será la fuente administrativa desde la que una persona autorizada crea o recibe una ficha, la revisa, la corrige y pulsa **Aprobar y publicar**. Esa aprobación humana debe publicar inmediatamente la ficha en producción y dejar un registro verificable del resultado.

El producto debe poder crecer después hacia Superentrenador, TodoPlástico y otros directorios, pero esos proyectos no se migrarán en esta fase. El orden confirmado es: completar Fuengirola, abordar Superentrenador como siguiente integración y auditar TodoPlástico antes de decidir su migración.

## Decisiones confirmadas

- Fichero vive inicialmente dentro de **WF Panel**, con identidad y navegación propias.
- **Fuengirola** es un único catálogo con dos canales de publicación: **Vivir en Fuengirola** y **Conoce Fuengirola**.
- Vivir y Conoce comparten las mismas empresas y el mismo número de fichas base; los planes controlan la visibilidad adicional, no crean catálogos duplicados.
- Solo un administrador maestro puede revisar, crear, editar, rechazar, aprobar, retirar o republicar fichas.
- **Aprobar y publicar** envía la versión revisada a producción. No crea un borrador intermedio pendiente de una segunda aprobación.
- La revisión es exclusivamente humana en esta fase. No se instala ni se invoca ningún modelo de IA.
- La arquitectura conservará trazabilidad suficiente para incorporar revisión asistida por IA en el futuro sin rediseñar el flujo.
- Superentrenador será la siguiente integración después de Fuengirola, previsiblemente en las próximas semanas.
- TodoPlástico es estratégico, pero antes de integrarlo se realizará una auditoría separada de su producto, datos, panel externo, flujos, seguridad y trabajo pendiente. No se asumirá que la vista actual de WF Panel representa todo lo que ya existe.

## Objetivos

1. Unificar solicitud, revisión, creación y publicación de fichas de Fuengirola.
2. Dar al administrador una bandeja de solicitudes y un editor completo de fichas.
3. Permitir crear fichas manualmente sin que exista una solicitud previa.
4. Aplicar un único modelo comercial: Gratis, Pro y Premium.
5. Publicar el mismo perfil canónico en uno o ambos canales sin duplicar los datos de empresa.
6. Hacer que el resultado público de `/negocios`, categorías, buscador y Conoce Fuengirola proceda del mismo catálogo publicado.
7. Sustituir el alta por email por el formulario funcional **Publica tu negocio**.
8. Corregir los problemas de seguridad, persistencia y coherencia encontrados en la PR #69.
9. Eliminar vulnerabilidades críticas y altas solucionables antes del despliegue, con verificación completa.
10. Dejar una interfaz de adaptadores para añadir nuevos directorios en fases posteriores.

## No objetivos de esta fase

- Migrar Superentrenador, TodoPlástico u otros directorios a Fichero.
- Rediseñar TodoPlástico sin haber inventariado antes su sistema real y sus brechas.
- Automatizar revisiones con IA o permitir autoaprobación.
- Cobrar suscripciones o integrar una pasarela de pago.
- Crear automáticamente un cliente del CRM por cada ficha gratuita.
- Reescribir todo WF Panel o todo el frontend público de Fuengirola.
- Construir un editor universal capaz de modelar desde ahora todos los futuros directorios.

## Antiobjetivos

- Mantener un generador de fichas distinto dentro de cada web pública.
- Usar el filesystem local o JSON como persistencia reconocida en producción.
- Dar acceso a datos de solicitudes a clientes normales del portal.
- Confundir una solicitud, una ficha de directorio y un cliente comercial del CRM.
- Marcar una publicación como correcta si algún canal obligatorio no la ha recibido.
- Duplicar una empresa para representar cada canal o plan.
- Ejecutar `npm audit fix` sin revisar el cambio de dependencias y la compatibilidad.

## Situación actual

### Vivir en Fuengirola

- `/mi-cuenta/negocio` contiene un creador de fichas orientado a que cada usuario edite su propio negocio.
- La PR #69 añade un formulario de tres planes y una bandeja de solicitudes separada.
- Aprobar una solicitud en esa PR solo cambia el estado del lead; no crea ni publica una fila en `businesses`.
- El código usa `normal` para solicitudes y `gratis` para empresas.
- No existe la migración de Supabase necesaria para los campos y estados nuevos.
- El fallback a JSON puede perder solicitudes y ocultarlas cuando Supabase vuelve a responder.
- El panel de solicitudes usa autorización de cliente, no autorización administrativa, y expone datos sensibles.
- Pro se anuncia con capacidades que las reglas públicas actuales reservan a Premium.

### WF Panel

- Ya dispone de autenticación administrativa sólida, navegación por proyectos y `platform_requests` para recibir solicitudes públicas.
- Ya existen secciones para Vivir en Fuengirola, Conoce Fuengirola, TodoPlástico y Superentrenador.
- Aprobar una `platform_request` convierte actualmente la solicitud en cliente de CRM; no crea una ficha de directorio.
- La integración visible de TodoPlástico permite consultar y moderar empresas/anuncios en una base externa, lo que demuestra el patrón de adaptadores entre proyectos. Esa integración es solo evidencia parcial: deberá contrastarse con el panel externo y el modelo real antes de reutilizarla o sustituirla.

### Repositorios y despliegues de la primera fase

- WF Panel: repositorio local `WF-Panel`, responsable de Fichero, autenticación administrativa, revisión, auditoría y coordinación de publicaciones.
- Vivir en Fuengirola: `samuelhogarola-ship-it/vivir-en-fuengirola`, responsable del formulario público y de su proyección pública del catálogo.
- Conoce Fuengirola: `samuelhogarola-ship-it/conoce-fuengirola`, responsable de su proyección pública del mismo catálogo.

Cada aplicación conserva su despliegue y su base/proyección pública. WF Panel es la fuente canónica administrativa y publica a cada canal mediante un adaptador independiente. No se exige que Vivir y Conoce compartan físicamente una base, pero sí que sus proyecciones procedan de la misma versión aprobada de cada ficha.

## Enfoques considerados

### 1. Mantener el generador dentro de cada web pública

Cada proyecto conservaría su tabla, formulario, panel y lógica de publicación. Es el camino más corto para una sola web, pero ya ha producido modelos incompatibles, permisos incorrectos y código duplicado. No escala a varios directorios.

**Descartado.**

### 2. Crear Fichero como módulo de WF Panel con adaptadores de publicación

WF Panel mantiene la ficha canónica, la revisión y la auditoría. Cada canal tiene un adaptador servidor-a-servidor que publica o retira la versión aprobada en su destino. El panel reaprovecha autenticación, navegación y patrones ya existentes.

**Elegido.** Reduce duplicación, mantiene una sola identidad administrativa y permite añadir directorios gradualmente.

### 3. Crear Fichero como servicio y repositorio independientes

Ofrece aislamiento completo, pero obliga ahora a duplicar autenticación, despliegue, observabilidad e integración con WF Panel. Podrá evaluarse cuando Fichero tenga suficiente volumen o equipo propio.

**Pospuesto.**

## Modelo conceptual

### Catálogo

Agrupa perfiles que comparten una taxonomía y un modelo comercial. La primera fila lógica es `fuengirola`.

### Canal

Es un destino público dentro de un catálogo. Fuengirola comienza con:

- `vivir-en-fuengirola`
- `conoce-fuengirola`

Un canal no contiene una copia independiente de la empresa; contiene el estado y resultado de publicar la ficha canónica en ese destino.

En Fuengirola, ambos canales son obligatorios para toda ficha publicada. La selección de canales se mantiene en el modelo para futuros catálogos, pero la interfaz de esta primera fase preseleccionará y bloqueará Vivir y Conoce. Las colocaciones Premium dentro de guías concretas sí serán opcionales y editoriales.

### Solicitud

Datos enviados desde un formulario público. Es material de entrada no confiable, no una ficha publicada y no un cliente del CRM.

### Ficha canónica

Versión administrativa completa y revisada de una empresa. Contiene identidad, categoría, barrios, contacto, contenido, imágenes, plan y metadatos editoriales.

### Publicación

Relación entre una ficha y un canal. Registra slug/identificador remoto, estado, versión publicada, fecha, último error y última respuesta del adaptador.

### Revisión

Registro inmutable de quién revisó qué versión, qué decisión tomó y cuándo. En esta fase el autor siempre será humano, aunque el campo de origen admitirá en el futuro `human`, `ai` o `system`.

## Datos de la primera fase

WF Panel añadirá entidades equivalentes a:

- `directory_catalogs`: catálogos disponibles y estado.
- `directory_channels`: canales, catálogo, adaptador y configuración no secreta.
- `directory_profiles`: ficha canónica, plan, estado editorial, versión y datos comunes de Fuengirola.
- `directory_profile_channels`: destinos elegidos y estado real de publicación por canal.
- `directory_reviews`: decisiones, actor, versión revisada, notas y resultado.
- `directory_publication_events`: intentos, respuesta, error seguro y fecha.

Las solicitudes existentes seguirán entrando por `platform_requests`. Una solicitud de tipo `business` se convertirá en ficha de Fichero, no automáticamente en cliente del CRM. La relación con CRM será opcional y explícita.

La primera fase no añadirá una acción para crear o enlazar clientes del CRM desde Fichero. Mantendrá separadas ambas entidades y dejará la relación preparada para una fase posterior.

Los campos sensibles de contacto y fiscalidad no se expondrán en las consultas públicas. La base pública recibirá únicamente los campos necesarios para renderizar la ficha y medir sus acciones.

## Estados

### Solicitud

- `pending`
- `approved`
- `rejected`

### Ficha

- `draft`: creada o importada, aún no publicada.
- `published`: la versión aprobada está publicada en todos los canales obligatorios seleccionados.
- `publish_failed`: la aprobación existe, pero al menos un canal obligatorio falló.
- `inactive`: retirada de los canales públicos.

### Canal de ficha

- `not_selected`
- `pending_publish`
- `published`
- `failed`
- `withdrawn`

No se mostrará éxito global si existe un canal seleccionado en estado `failed`. El panel permitirá reintentar solo los canales fallidos sin duplicar la ficha.

La decisión humana y el resultado técnico se registran por separado. Al pulsar aprobar, la solicitud pasa a `approved` aunque una publicación falle; la ficha queda entonces `publish_failed` y muestra claramente qué canal necesita reintento.

## Planes y derechos de visibilidad

El valor canónico será `gratis | pro | premium` en solicitudes, fichas y publicaciones.

### Gratis — 0 €

- Aparece en el directorio y en el buscador común.
- Nombre, categoría, barrio y descripción breve.
- No obtiene posición preferente ni miniweb propia.

### Pro — 5 €/mes

- Todo lo incluido en Gratis.
- Posición preferente dentro del directorio.
- Elegible para el bloque de empresas Pro/recomendadas.
- Contacto visible conforme a las reglas públicas del canal.
- Estadísticas básicas.

### Premium — 19 €/mes

- Todo lo incluido en Pro.
- Miniweb o ficha editorial extensa dentro de la plataforma.
- Contenido SEO optimizado y galería ampliada.
- Estadísticas avanzadas.
- Elegible para inserciones editoriales en guías y superficies destacadas de Vivir y Conoce.

El plan concede elegibilidad, pero no obliga a insertar automáticamente una empresa en una guía editorial concreta. Esas ubicaciones se seleccionarán desde Fichero para evitar recomendaciones sin criterio.

Las capacidades prometidas por cada plan deben ser funcionales en esta fase, no simples etiquetas almacenadas:

- Gratis tendrá presencia real en directorio, filtros y buscador.
- Pro tendrá orden preferente, contacto visible, bloque Pro/recomendadas y métricas básicas de vistas y acciones.
- Premium tendrá miniweb extensa, galería ampliada, campos SEO, métricas desglosadas y colocaciones editoriales configurables.

Se reaprovecharán las métricas y componentes públicos existentes cuando cumplan estas reglas; no se construirá un sistema analítico externo nuevo.

## Experiencia administrativa

La navegación principal de WF Panel añadirá **Fichero** como aplicación de primer nivel. Dentro de ella:

1. Selector de catálogo.
2. Resumen con pendientes, publicadas, fallidas e inactivas.
3. Solicitudes.
4. Fichas.
5. Nueva ficha.
6. Historial de publicaciones.

La pantalla de revisión mostrará en una sola vista:

- Datos recibidos y origen.
- Editor de la ficha canónica.
- Plan.
- Canales seleccionados.
- Vista previa por nivel.
- Validaciones bloqueantes y avisos.
- Historial de cambios.
- Acciones `Rechazar`, `Guardar borrador` y `Aprobar y publicar`.

`Aprobar y publicar` estará deshabilitado mientras falte un campo obligatorio, haya un slug duplicado, no exista categoría válida o la ficha no tenga al menos un canal seleccionado.

WF Panel ya distingue `role = admin` y `requireAdmin()` bloquea cualquier otro rol. Fichero utilizará esa frontera y repetirá la comprobación en RLS/funciones SQL. No se introduce una jerarquía adicional de administradores en esta fase.

La creación manual utilizará el mismo editor y el mismo proceso de publicación, sin necesidad de fabricar una solicitud falsa.

## Flujo público

1. El usuario pulsa **Publica tu negocio**.
2. El formulario muestra Gratis, Pro y Premium con precios y prestaciones coherentes.
3. El navegador envía la solicitud a la API pública protegida de WF Panel.
4. WF Panel valida origen exacto, Turnstile, límites, tipos y campos.
5. La solicitud aparece en Fichero bajo Fuengirola.
6. No se publica nada hasta la revisión humana.

Se eliminarán los caminos de “solicitar alta por email” en las superficies donde Fichero sea el flujo oficial.

## Aprobación y publicación

1. El administrador abre la solicitud o ficha.
2. Corrige y completa los campos necesarios.
3. Selecciona plan y canales.
4. El sistema genera una versión inmutable del contenido que se va a publicar.
5. Se registra la revisión humana.
6. Se ejecuta el adaptador de cada canal seleccionado con una clave idempotente formada por ficha, versión y canal.
7. Cada adaptador crea o actualiza la ficha remota y devuelve su identificador/URL.
8. El panel revalida las rutas públicas pertinentes.
9. Si todos los canales obligatorios terminan correctamente, la ficha queda `published`.
10. Si alguno falla, queda `publish_failed`, conserva los éxitos alcanzados y permite reintentar el fallo.

El adaptador de Fuengirola se ejecutará exclusivamente en servidor con credenciales de servicio. Ninguna clave administrativa llegará al navegador.

La acción realizará el primer intento de publicación de forma síncrona para que el administrador reciba un resultado inmediato. Antes de contactar los canales guardará la versión aprobada y los eventos `pending_publish`; si el proceso se interrumpe o un canal falla, el estado persistido permitirá reintentar de forma idempotente. Esta fase no depende de una cola externa ni de un worker permanente.

Todos los canales de Fuengirola son obligatorios para el éxito global. Una publicación parcial se conserva, se muestra como `publish_failed` y no se revierte automáticamente; el reintento actúa solo sobre los canales pendientes o fallidos.

## Superficies públicas de Fuengirola

- `/negocios` será el directorio principal y mostrará primero la búsqueda y las fichas publicadas.
- Los bloques editoriales fijos que actualmente mezclan Samuel, idiomas y otros ejemplos se sustituirán por selecciones derivadas del plan y de colocaciones editoriales explícitas.
- Los accesos rápidos mostrarán categorías publicadas con contenido real, más cualquier categoría editorial fijada; no todas las categorías vacías.
- Las páginas de categoría usarán la misma consulta canónica del directorio.
- Conoce Fuengirola consumirá el mismo catálogo y podrá mostrar búsqueda, categorías y selecciones Premium sin duplicar negocios.
- El número base de negocios publicados será coherente entre ambos canales.
- Las miniwebs Premium y las colocaciones editoriales se generarán a partir de la misma ficha, con contenido adicional propio del plan.

Las URLs y slugs públicos existentes se conservarán siempre que representen la misma empresa. Si una corrección obliga a cambiar un slug, el adaptador registrará el anterior y el canal deberá crear una redirección permanente. Ninguna migración eliminará URLs indexadas sin mapa de redirecciones.

## Reconciliación de datos existentes

La migración inicial inventariará fichas publicadas, solicitudes pendientes y perfiles creados por propietarios. La coincidencia se hará por este orden:

1. identificador externo previamente registrado;
2. CIF/NIF normalizado cuando exista y pueda utilizarse legalmente;
3. dominio web o contacto normalizado combinado con nombre;
4. slug existente;
5. revisión manual para cualquier caso ambiguo.

No se fusionarán automáticamente coincidencias dudosas. Ante conflicto, la versión pública actualmente indexada conserva slug y URL, mientras el administrador elige los campos canónicos. Los valores históricos `normal`, `destacado` y `gratis` se normalizarán a `gratis`, `pro` o `premium` mediante una migración explícita y auditable.

## Seguridad y privacidad

- Todas las pantallas y mutaciones de Fichero exigirán `requireAdmin()` de WF Panel.
- Los clientes normales no podrán listar solicitudes ni datos fiscales/contactos privados.
- RLS y/o funciones SQL comprobarán también el rol administrativo; la protección no dependerá solo de ocultar enlaces.
- Las acciones de publicación serán idempotentes y validarán catálogo, canal, ficha, versión y transición de estado.
- Los logs no incluirán claves, CIF completo ni datos sensibles innecesarios.
- Las acciones destructivas o de retirada exigirán confirmación y quedarán auditadas.
- El formulario público tendrá límites de tamaño, validación de tipos, protección anti-bot y deduplicación segura.

## Preparación para IA, sin IA en esta fase

El sistema reservará estructura para:

- origen de revisión (`human | ai | system`);
- versión revisada;
- hallazgos estructurados por campo;
- gravedad;
- evidencia/fuente;
- puntuación de confianza;
- recomendación;
- cambios propuestos y cambios aceptados.

No habrá proveedor, modelo, prompt, tarea automática ni botón de autoaprobación en la primera entrega. Toda decisión y toda publicación requerirán una acción humana autenticada.

## Tratamiento de la PR #69

La PR no se fusionará tal como está. Se reaprovecharán únicamente las partes válidas, como copy de planes, elementos visuales y ampliaciones de taxonomía verificadas.

El lado de Vivir en Fuengirola se reorientará a:

- formulario público que envía a WF Panel;
- presentación coherente de planes;
- directorio y reglas de visibilidad comunes;
- eliminación del panel inseguro de solicitudes y del fallback JSON;
- eliminación de los tipos duplicados `LeadPlan`/`BusinessPlan`;
- pruebas del formulario y de las superficies públicas.

El panel maestro, la revisión, la persistencia administrativa y la publicación vivirán en WF Panel.

## Dependencias y build

Antes de desplegar:

- actualizar Next.js y su configuración asociada a una versión segura y compatible;
- resolver o documentar explícitamente todas las alertas críticas y altas;
- mantener Capacitor en una versión compatible si forma parte del producto desplegado;
- verificar por separado dependencias de producción y herramientas de desarrollo;
- investigar la causa del fallo local de `next/font` y conseguir un build reproducible;
- no introducir actualizaciones mayores no relacionadas salvo que sean necesarias para cerrar una vulnerabilidad sin parche.

## Pruebas y aceptación

La implementación seguirá TDD para reglas, seguridad y publicación. Como mínimo:

- una solicitud válida llega a la bandeja correcta;
- un origen, tipo o payload inválido se rechaza;
- un cliente normal no puede leer ni mutar Fichero;
- el administrador puede crear una ficha manual;
- Gratis, Pro y Premium producen los derechos esperados;
- aprobar publica inmediatamente en los canales seleccionados;
- un reintento no crea duplicados;
- un fallo parcial queda visible y se puede reintentar;
- retirar elimina la visibilidad pública sin borrar la auditoría;
- Vivir y Conoce leen el mismo conjunto base de empresas;
- categorías vacías no saturan los accesos rápidos;
- la ficha gratuita, Pro y Premium se representan correctamente;
- lint, typecheck, unitarias, build y pruebas de navegador requeridas pasan;
- `npm audit` no deja vulnerabilidades críticas o altas sin una decisión documentada.

## Despliegue

1. Implementar y migrar Fichero en WF Panel.
2. Configurar el adaptador y credenciales de Fuengirola.
3. Probar publicación contra un entorno controlado.
4. Desplegar WF Panel y comprobar bandeja, editor y publicación.
5. Adaptar y desplegar el formulario público de Vivir en Fuengirola.
6. Activar el canal Conoce Fuengirola cuando su adaptador esté verificado.
7. Migrar o reconciliar las fichas existentes sin duplicarlas.
8. Retirar los paneles y endpoints duplicados de la PR #69.

El orden es obligatorio: el receptor y publicador de WF Panel debe estar operativo antes de dirigir formularios públicos hacia él.

## Fases posteriores

### Segunda integración: Superentrenador

- Incorporar su revisión de perfiles a Fichero respetando campos, estados y permisos específicos.
- Mantener la publicación directa tras aprobación humana.
- Reutilizar el núcleo de auditoría y adaptadores creado para Fuengirola sin forzar a los entrenadores al esquema de empresa local.

### Auditoría previa de TodoPlástico

Antes de planificar su integración se documentará:

- repositorios, paneles y bases de datos que forman el producto real;
- modelo de empresas, usuarios, anuncios, categorías, planes y verificación;
- flujo completo desde alta hasta publicación o rechazo;
- capacidades del panel externo que todavía no aparecen en WF Panel;
- controles de seguridad, trazabilidad, duplicados y calidad de datos;
- preparación existente para revisión asistida por IA;
- diferencias entre lo construido y el modelo maduro deseado;
- estrategia de migración o conexión sin pérdida de funciones.

Solo después de esa auditoría se decidirá si TodoPlástico se migra al núcleo común, conserva un motor especializado conectado mediante adaptador o aporta componentes reutilizables a Fichero.

### Directorios adicionales

- Nuevos directorios de limpiadoras, niñeras, inmobiliarias y otros verticales.
- Asistencia de IA para comprobar, enriquecer y proponer correcciones.
- Decisión separada sobre autoaprobación, que no queda autorizada por este diseño.
