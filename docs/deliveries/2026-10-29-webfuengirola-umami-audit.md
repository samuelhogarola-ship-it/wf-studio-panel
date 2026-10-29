# Auditoría Umami de Web Fuengirola — 2026-10-29

## Resultado

WF-Panel incorpora un único total de Umami para Web Fuengirola y una segmentación, sobre la misma propiedad, por rutas de mercado:

| Vista | Filtro Umami |
| --- | --- |
| Total | Sin filtro |
| España / resto | `path nre.^/mexico(?:/|$)`, `path1 nre.^/usa(?:/|$)`, `path2 nre.^/brasil(?:/|$)`, `match=all` |
| México | `path re.^/mexico(?:/|$)` |
| USA | `path re.^/usa(?:/|$)` |
| Brasil | `path re.^/brasil(?:/|$)` |

Los filtros se aplican de forma coherente a visitas, páginas vistas, fuentes, páginas, países, navegadores, sistemas operativos, dispositivos, idiomas, eventos/conversiones y sesiones. No se crean propiedades Umami independientes por mercado.

## Evidencia pública comprobada

- `https://webfuengirola.com/`, `/mexico/`, `/mexico/en/`, `/usa/`, `/usa/es/` y `/brasil/` responden con HTTP 200.
- Todas esas rutas cargan `/umami-analytics-core.js`.
- `/umami-config.json` contiene una URL de instancia y un identificador de sitio no vacío. El identificador se omite de este documento.
- La instancia pública de Umami responde correctamente a `/api/heartbeat`.
- Los formularios públicos intentan registrar `form_start`, `form_submit`, `audit_request` y `form_error`, además de eventos de interacción como cambios de idioma y clics de contacto.

## Comprobación en Coolify

El recurso activo de WF-Panel está en ejecución y contiene las cuatro variables necesarias, sin exponer sus valores:

1. `UMAMI_PERSONAL_URL`.
2. `UMAMI_PERSONAL_USERNAME`.
3. `UMAMI_PERSONAL_PASSWORD`.
4. `UMAMI_WEBSITE_ID_WEBFUENGIROLA`.

También existe un recurso antiguo llamado `webfuengirola-PANEL`, pero está detenido y no es el despliegue activo. El recurso en ejecución aparece sin `healthcheck`, por lo que Coolify solo confirma que el contenedor está levantado; no acredita por sí solo que la lectura completa de Umami funcione. La sesión del panel había caducado durante la comprobación y no se inició una sesión nueva sin autorización expresa.

## Cobertura de contenido

WF-Panel solicita hasta 500 rutas registradas por Umami y permite desplegar la lista completa cargada. El panel muestra el recuento y la cuota porcentual de páginas, referencias, canales y dispositivos, además del tiempo medio por visita, tiempo total, entradas, salidas y sesiones anónimas. Así se puede comparar directamente, por ejemplo, `/` con un artículo, una landing o una página de servicios.

El panel incorpora además un perfil analítico reutilizable y versionado. Para Web Fuengirola clasifica las rutas por:

- Sección de negocio: Inicio, Servicios, Portfolio, Blog y Web solidaria.
- Idioma del contenido: español, inglés, alemán y finés.
- Mercado: Total, España/resto, México, USA y Brasil.

La vista profesional permite combinar mercado, sección, idioma del contenido, dispositivo, fuente y evento. Esas selecciones se resuelven en el servidor contra listas aprobadas; el navegador no puede enviar expresiones regulares ni elegir propiedades Umami. Los resúmenes por sección e idioma muestran páginas vistas, cuota, visitantes, páginas por visita y tiempo medio. Un fallo opcional de un desglose se presenta como «No disponible» sin ocultar el resto del informe.

Los eventos se separan entre acciones comerciales y hitos de permanencia de 15, 30, 60 y 120 segundos. Esos hitos indican que una visita alcanzó el umbral, no el instante exacto de salida. El idioma del contenido se infiere de la ruta publicada y se muestra separado del idioma del navegador que comunica Umami.

El runtime compartido ya publica tanto `window.UmamiAnalyticsCore` como el alias compatible `window.WFAnalytics`, por lo que las páginas vistas SPA, formularios, cambios de idioma/mercado, clics de contacto, solicitudes de auditoría y permanencia utilizan una única cola de eventos sin duplicar listeners. El Área cliente y su enlace permanecen fuera de esta instrumentación y no se han modificado.

## Límites conocidos

- Umami aporta analítica agregada y sesiones anónimas; no identifica personas ni reconstruye recorridos personales.
- El tiempo medio depende de la información que la versión instalada de Umami exponga en `totaltime` y de que haya más de una interacción medible.
- Los desgloses de idioma de contenido y sección dependen de que las rutas nuevas se incorporen al perfil versionado.
- Las fuentes se filtran por valores de dominio acotados; no se aceptan filtros libres o expresiones regulares desde el navegador.

## Verificación local

- `core-general`: 39 pruebas correctas, 1 omitida; importación, ESLint y auditoría de dependencias correctas.
- Web Fuengirola: 142 pruebas unitarias y 85 pruebas Playwright correctas; sintaxis, ESLint, Gitleaks y auditoría de dependencias correctas.
- WF-Panel: 713 pruebas correctas, 2 omitidas; TypeScript, ESLint, build de producción y `git diff --check` correctos.
- El perfil serializado de WF-Panel coincide con el perfil versionado de Web Fuengirola.

Los `format:check` globales de `core-general` y Web Fuengirola siguen señalando respectivamente 14 y 409 archivos históricos no tocados por esta entrega. Los archivos funcionales modificados se comprobaron de forma dirigida para no convertir esta implantación en un reformateo masivo.

La comprobación controlada contra Umami de producción queda deliberadamente pendiente hasta aprobar y desplegar los PR en orden. No se afirma que los eventos nuevos ya estén acumulando datos históricos: Umami solo podrá registrar visitas posteriores al despliegue y no puede reconstruir eventos que faltaron en el pasado.
