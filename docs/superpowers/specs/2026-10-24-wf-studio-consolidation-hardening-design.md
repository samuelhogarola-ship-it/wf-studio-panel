# Consolidación, seguridad y profesionalización de WF Studio

Fecha: 24 de octubre de 2026

## Objetivo

Consolidar todo el trabajo válido de WF Studio sobre `main`, eliminar ramas y PR obsoletos, cerrar vulnerabilidades críticas y dejar una base estable para seguir incorporando clientes, proyectos y herramientas. El resultado debe conservar las funciones existentes, incorporar Pagos/Facturas y soporte de cliente, mejorar la experiencia móvil y accesible, y reducir las principales fuentes de deuda estructural sin hacer una reescritura total.

## Principios de entrega

- Ningún PR se mergeará solo porque esté abierto: debe aportar comportamiento vigente, pasar CI y no haber sido sustituido.
- Los cambios se dividirán en PR pequeños por riesgo y responsabilidad.
- Seguridad crítica y corrupción de datos bloquean UI y refactors.
- Cada comportamiento nuevo se implementará con TDD.
- Las migraciones serán aditivas, idempotentes y verificadas en una base efímera.
- `main` deberá quedar protegido por test, lint, typecheck, build y auditoría de dependencias.
- No se usarán claves del usuario ni se modificarán servicios de producción mediante navegador durante la consolidación.

## Estado de ramas y PR

### PR 21

`Complete Sport Massage Blogger handoff` es mergeable, tiene CI verde y constituye la base vigente de Blogger 2.0. Se integrará primero en `main`.

### PR 7

El planificador mensual embebido con `setInterval` no es durable ni seguro en un despliegue con reinicios o varias réplicas. El sistema actual ya expone una ruta cron autenticada y persistencia idempotente. El PR se cerrará como sustituido, documentando que la planificación debe vivir en el scheduler de infraestructura.

### PR 10

El fallback sin Turnstile ya está implementado y probado en la base vigente. El limitador en memoria propuesto no funciona de manera consistente entre réplicas y puede crecer sin limpieza global. El PR se cerrará como sustituido; una limitación distribuida podrá añadirse posteriormente en infraestructura si se necesita.

### Trabajo local

Se integrarán, en este orden:

1. La rama de soporte de cliente en modo solo lectura y auditado.
2. La normalización visible de `Agama` y su migración exacta.
3. Los diseños aprobados de Pagos y Facturación.
4. La implementación y endurecimiento descritos en este documento.

## Fase 1: seguridad bloqueante

### Dependencias

- Actualizar Next.js a una versión 15.5.x corregida, como mínimo 15.5.28.
- Actualizar `sharp` a 0.35.5 o superior.
- Actualizar `source-map-js` a una versión corregida.
- Migrar Zod a una versión corregida y adaptar explícitamente incompatibilidades de la versión mayor.
- La entrega no admitirá vulnerabilidades críticas o altas en dependencias de producción sin una excepción escrita y una mitigación comprobada.

### Blogger y XSS persistente

- Sanear HTML en el servidor antes de guardarlo y antes de publicarlo.
- Utilizar una lista cerrada de etiquetas, atributos y protocolos compatibles con artículos.
- Rechazar eventos, SVG ejecutable, `javascript:`, estilos peligrosos y marcado malformado.
- Aislar las vistas previas HTML en un iframe sandboxed sin acceso al origen de Studio.
- Añadir cabeceras de seguridad compatibles con Next.js y con el editor.

### Rutas privilegiadas

- El cron de recordatorios aceptará únicamente POST con `Authorization: Bearer`, fallará cerrado si falta configuración y comparará el secreto en tiempo constante.
- Se eliminarán secretos en query strings y mutaciones por GET.
- Recuperación de contraseña y callbacks usarán orígenes canónicos del servidor; no confiarán en campos ocultos ni hosts reenviados no permitidos.
- Login, magic link y recuperación devolverán respuestas públicas uniformes para evitar enumeración de cuentas.
- Diagnósticos de autenticación quedarán limitados a administradores o deshabilitados en producción.
- Logout validará mismo origen.

### Mensajería y RLS

- Los clientes solo podrán insertar mensajes con dirección y tipos permitidos.
- Se eliminará el update amplio de mensajes por clientes.
- Una RPC limitada permitirá únicamente marcar como leído un mensaje administrativo propio.
- `reply_to_id` deberá pertenecer al mismo cliente.

## Fase 2: Pagos y Facturación

Se implementará la especificación `2026-10-24-client-payments-and-invoicing-design.md`, incluida su ampliación de integridad:

- Pagos manuales asociados a clientes y enlaces HTTPS de Stripe validados.
- Facturas para clientes registrados o destinatarios externos.
- Datos fiscales congelados en la factura.
- Numeración, emisión y vinculación transaccionales.
- Estados de anulación en lugar de borrado físico.
- Auditoría financiera append-only.
- Vista cliente protegida, imprimible y guardable como PDF.
- Soporte administrativo en modo solo lectura sin claves del cliente.

La corrección de la factura de Agama por 31.000 € seguirá siendo una operación de datos separada: no se cambiará hasta identificar su número y el importe correcto o confirmar su anulación.

## Fase 3: UIX y accesibilidad

### Navegación y estructura

- Todas las rutas protegidas, incluida Samuel Coach Premium, utilizarán el shell correspondiente.
- La navegación móvil administrativa y cliente pasará a un menú compacto y accesible, manteniendo visible el destino actual.
- Se añadirá “Saltar al contenido”, objetivos táctiles mínimos de 44 px, foco visible y `aria-current`.
- Cada página tendrá un único H1.

### Formularios y estados

- Todos los controles tendrán label programático, ID estable y nombre accesible.
- Los errores usarán alertas anunciadas, `aria-invalid` y `aria-describedby`; los éxitos usarán regiones de estado polite.
- Las acciones destructivas requerirán confirmación accesible y recuperarán el foco.
- Los tabs implementarán Arrow Left/Right, Home/End, roving tabindex y relaciones tab/tabpanel.
- Cliente y administrador tendrán estados branded de loading, error, not-found y vacío.

### Idiomas

- Todo texto visible para clientes pasará por i18n; no se permitirá una pantalla parcialmente en inglés y español.
- Fechas y números respetarán el locale activo.

## Fase 4: estructura y código mantenible

Esta fase se dividirá en PR independientes para conservar revisión y rollback:

1. Extraer `actions/admin.ts` en módulos de clientes, packs, actividades, servicios y mensajería, manteniendo reexports temporales.
2. Convertir escrituras compuestas críticas a RPC/transacciones; el correo se enviará solo tras commit.
3. Crear un manifiesto canónico tipado para sitios y generar desde él identidades cerradas, seeds y aliases.
4. Unificar transporte, autenticación, caché y modelo de Umami; Superentrenador será una proyección del núcleo común.
5. Sustituir los pares `.mjs`/`.d.ts` activos por TypeScript empezando por seguridad, Blogger y analytics; generar tipos Supabase en CI.
6. Parametrizar las páginas de clientes y suscripciones duplicadas.
7. Separar Blogger en codec, repositorio de posts, repositorio de medios e importador legacy.
8. Introducir paginación y filtrado en base de datos para clientes, servicios y proyectos.
9. Separar catálogo de servicios de servicios contratados.
10. Retirar `portal_mode` y exports de compatibilidad solo después de comprobar uso en producción.

Los puntos 3–10 no bloquearán el release seguro de Pagos, pero no se mezclarán en un único PR. Se entregarán y mergearán secuencialmente con equivalencia funcional comprobada.

## Verificación

### Automatizada

- `npm test` completo.
- Pruebas PostgreSQL/Supabase para migraciones, RLS y concurrencia financiera.
- `npm run lint`.
- `npm run typecheck`.
- `npm run build`.
- `npm audit --omit=dev` sin critical/high no aceptadas.
- Pruebas de regresión XSS y rutas cron/auth.
- Pruebas de accesibilidad y teclado.
- Pruebas responsive en 320, 375, 430, 768 y escritorio.

### Funcional

- Administrador: login, navegación, proyectos, soporte cliente, estadísticas, Blogger, pagos y facturas.
- Cliente: login/password/magic link, Inicio, Webs, estadísticas, Blogger autorizado, pagos, facturas, informes y bonos.
- Aislamiento: Agama/TodoPlástico, Sport Massage y usuarios no asignados no pueden cruzar datos.
- Error paths: configuración ausente, enlace Stripe inválido, escritura fallida, pago duplicado, factura concurrente, sesión de soporte expirada.

## Criterio de finalización

El trabajo estará terminado cuando todos los PR de la consolidación estén mergeados en `main`, las ramas/PR obsoletos estén cerrados con explicación, la suite completa y el build estén verdes, no queden vulnerabilidades críticas/altas sin decisión explícita y exista un informe final con commits, migraciones, pruebas, riesgos residuales y pasos de despliegue.
