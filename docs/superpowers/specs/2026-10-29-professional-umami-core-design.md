# Core profesional de analítica Umami

Fecha: 2026-10-29

## Intención

Convertir la integración Umami de WF-Studio en una herramienta analítica reutilizable para webs profesionales. Debe explicar qué contenido funciona, en qué idioma se consume, desde qué dispositivo y fuente, y qué acciones comerciales ocurren. No basta con mostrar visitas globales.

Área cliente queda expresamente fuera de esta fase: no se modifica ni se registra su enlace o dominio.

## Estado auditado

- El `umami-analytics-core.js` publicado solo carga el tracker, mantiene una cola y expone `UmamiAnalyticsCore.init()`, `trackEvent()` y `trackPageview()`.
- Web Fuengirola llama a `window.WFAnalytics.trackEvent()`, pero el core no publica `WFAnalytics`; por tanto, los eventos comerciales actuales no llegan a Umami.
- La web ya define eventos valiosos: `language_switch`, `blog_to_landing`, `email_click`, `phone_click`, `form_start`, `form_submit`, `audit_request` y `form_error`, con contexto de idioma, mercado, sector, plan y moneda.
- `core-general` no tiene todavía un módulo de analítica. Su registro solo conserva la conexión Umami y compatibilidad del panel.
- WF-Panel ya lee vistas, visitantes, visitas, rebote, tiempo total y medio, rutas, entradas, salidas, fuentes, geografía, idiomas de navegador, dispositivos, eventos y sesiones. También admite filtros de mercado por ruta.

## Objetivos

1. Mantener una propiedad Umami por web y continuar con tracking anónimo y sin cookies.
2. Separar claramente idioma de contenido e idioma del navegador.
3. Agrupar URLs en secciones de negocio configurables: inicio, servicios, portfolio, blog, web solidaria u otras propias de cada cliente.
4. Registrar eventos comerciales con nombres y datos consistentes.
5. Aproximar permanencia en páginas de una sola vista mediante hitos de interacción.
6. Permitir cruces reales y combinables: sección × idioma de contenido × dispositivo × fuente × mercado.
7. Reutilizar el mismo contrato en futuras webs sin copiar lógica específica de Web Fuengirola.
8. Mantener secretos y credenciales Umami exclusivamente en servidor.

## No objetivos

- No tocar Área cliente, su dominio ni el enlace de salida.
- No identificar personas ni usar `distinctId` en esta fase.
- No consultar directamente la base de datos interna de Umami.
- No crear un almacén de datos paralelo ni sustituir Umami.
- No prometer permanencia exacta al segundo cuando el navegador cierra o suspende una pestaña.

## Alternativas consideradas

### 1. Ampliar únicamente WF-Panel

Permitiría más filtros sobre páginas vistas, pero no recuperaría los eventos perdidos ni mediría permanencia de una sola página. Se descarta porque mejora la presentación, no la calidad de origen.

### 2. Añadir scripts específicos en cada web

Resolvería Web Fuengirola rápidamente, pero repetiría nombres, reglas y errores en cada cliente. Se descarta porque no es sostenible ni comparable entre webs.

### 3. Core común, perfil por web y explorador bajo demanda — elegida

`core-general` define el runtime y el contrato; cada web declara sus idiomas, secciones y eventos; WF-Panel traduce selecciones seguras a filtros reales de Umami. Es la única opción que mejora origen, reutilización y lectura sin acoplarse al esquema interno de Umami.

## Arquitectura elegida

### A. `core-general`: runtime analítico reutilizable

Se añadirá un activo de navegador sin dependencias que:

- cargue el tracker oficial de Umami;
- conserve la cola previa a la carga;
- exponga `window.UmamiAnalyticsCore` y el alias compatible `window.WFAnalytics`;
- adjunte automáticamente contexto seguro a cada evento: versión de esquema, ruta, idioma de contenido, sección y los campos declarativos permitidos;
- normalice nombres y datos, limite longitudes y descarte claves no permitidas;
- registre hitos de interacción visibles de 15, 30, 60 y 120 segundos una sola vez por página;
- pause el reloj cuando la pestaña no esté visible;
- permita eventos explícitos desde formularios y elementos `data-analytics-event`;
- preserve pageviews automáticos del tracker y ofrezca pageview manual correcto para navegación dinámica;
- no registre Área cliente ni ningún destino excluido por el perfil.

Los hitos se llamarán `engagement_15s`, `engagement_30s`, `engagement_60s` y `engagement_120s`. Al ser eventos Umami normales heredan ruta, dispositivo, navegador, país y fuente, y se pueden cruzar con los demás filtros.

### B. Perfil analítico declarativo por web

El manifiesto canónico admitirá un perfil sin secretos con:

- versión del contrato;
- idiomas de contenido y sus reglas de ruta;
- secciones y sus reglas de ruta;
- eventos permitidos y objetivos comerciales;
- campos de contexto permitidos;
- destinos excluidos.

Web Fuengirola declarará español, inglés, alemán y finlandés. Sus secciones iniciales serán inicio, servicios, portfolio, blog y web solidaria. Las variantes traducidas se resolverán mediante reglas de ruta, no por el idioma del navegador.

El perfil se validará en `core-general` y viajará con el alta canónica de una web. No incluirá IDs, passwords ni URLs privadas.

### C. Web Fuengirola: adaptador fino

La web sustituirá el loader local por el activo canónico o una copia generada verificable. Mantendrá sus llamadas actuales a `WFAnalytics`, que pasarán a funcionar gracias al alias compatible. Solo se añadirán atributos o eventos donde falte intención comercial; no se tocará Área cliente.

La integración verificará expresamente:

- cambio de idioma;
- blog hacia landing comercial;
- email y teléfono;
- inicio, éxito y error de formularios;
- solicitud de auditoría;
- hitos de permanencia.

### D. WF-Panel: vista SEO y explorador cruzado

La vista general mostrará, para el periodo elegido:

- rendimiento por sección: vistas, visitantes, cuota de tráfico, rebote, páginas por visita y tiempo medio;
- idioma de contenido por ruta;
- idioma del navegador como dimensión separada;
- dispositivo, fuente y geografía;
- objetivos y eventos comerciales;
- cobertura de instrumentación y ausencia de datos claramente diferenciadas.

El explorador aplicará filtros allowlisted de forma acumulativa:

- mercado;
- sección;
- idioma de contenido;
- dispositivo;
- fuente/referrer;
- evento.

Ejemplo: `blog + fi + mobile` se traducirá a la regla de ruta finlandesa del blog y al filtro de dispositivo de Umami. El servidor nunca aceptará expresiones regulares ni claves de registro suministradas directamente por el navegador.

La carga general consultará en paralelo los totales de las secciones e idiomas configurados. Los cruces de alta cardinalidad se resolverán bajo demanda y se cachearán por combinación para evitar construir un cubo completo en cada visita.

## Contrato de eventos

Eventos base reutilizables:

- `language_switch`
- `blog_to_landing`
- `email_click`
- `phone_click`
- `form_start`
- `form_submit`
- `form_error`
- `audit_request`
- `engagement_15s`
- `engagement_30s`
- `engagement_60s`
- `engagement_120s`

Contexto común permitido:

- `schemaVersion`
- `contentLanguage`
- `section`
- `market`
- `sector`
- `plan`
- `currency`
- `targetLanguage`
- `targetSection`

No se enviarán nombres, emails, teléfonos, mensajes, URLs introducidas en formularios ni identificadores personales.

## Exactitud y límites honestos

- Las vistas, dispositivos, navegadores, fuentes y rutas proceden directamente de Umami.
- El idioma de contenido procede de reglas de ruta controladas; el idioma del navegador seguirá apareciendo por separado.
- La duración media estándar de Umami solo es completa cuando existen varios eventos. Los hitos mejoran la lectura de páginas únicas, pero expresan umbrales alcanzados, no una duración exacta de salida.
- Bloqueadores, JavaScript desactivado, pestañas suspendidas y cierres bruscos pueden impedir eventos.
- Los datos anteriores a la nueva instrumentación no podrán reconstruir eventos que nunca se enviaron.

## Privacidad y seguridad

- Sin cookies analíticas, PII ni `distinctId`.
- Configuración pública limitada al website ID y endpoints públicos del tracker.
- Credenciales API solo en WF-Panel/Coolify.
- Eventos y filtros validados mediante allowlists.
- El perfil no puede inyectar código ni expresiones del navegador sin validación.

## Verificación

- Tests unitarios del runtime en DOM simulado: cola, alias, eventos, contexto, visibilidad, hitos y exclusiones.
- Tests del perfil y del alta canónica en `core-general`.
- Tests de integración en Web Fuengirola para cada evento existente y ausencia de Área cliente.
- Tests de API de WF-Panel para combinación, allowlist, caché y aislamiento por proyecto.
- Tests de UI para resumen por sección, idiomas separados y explorador cruzado.
- Verificación manual en producción mediante solicitudes Umami y una visita controlada por idioma/dispositivo.

## Entrega por repositorio

1. `core-general`: contrato, runtime, perfil, documentación y tests.
2. `webfuengirola`: adopción del core, perfil real y pruebas de eventos, sin Área cliente.
3. `WF-Panel`: consumo del perfil, agregados de calidad y explorador cruzado.

Cada repositorio tendrá su propia rama, verificación, Pull Request y despliegue. El orden evita que WF-Panel prometa eventos que aún no puede producir la web.
