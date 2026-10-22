# Panel cliente unificado con Webs y capacidades

## Objetivo

WF Studio tendrá un único panel cliente. Todos los clientes activos conservarán las rutas y datos actuales y recibirán dos superficies comunes: una portada más útil y una sección `Webs`. Las herramientas de cada web se mostrarán únicamente cuando el administrador las active y su configuración haya sido validada.

El primer caso completo será Ángel Palma, con aGama y TodoPlástico en la misma cuenta.

## Decisiones aprobadas

- No existirán dos experiencias visibles llamadas panel antiguo y panel dinámico.
- Las rutas existentes siguen funcionando y permanecen en la navegación.
- `Inicio` será siempre `/cliente/dashboard` y nunca redirigirá automáticamente a una web.
- `Webs` será siempre `/cliente/proyectos`, incluso si todavía no hay proyectos asignados.
- Cada proyecto muestra su producto contratado: `Lite`, `Express` o `Pro`.
- Las capacidades `Estadísticas` y `Blogger` se activan de forma independiente por proyecto.
- Una capacidad inactiva, no validada o mal configurada no aparece al cliente.
- El administrador conserva acceso a todos los proyectos y herramientas desde WF Studio.
- Una cuenta inactiva no obtiene acceso por el mero hecho de existir.

## Modelo de navegación

La navegación cliente parte de un bloque base común:

1. Inicio.
2. Webs.
3. Informes.
4. Actualizaciones.
5. Fotografías.
6. Servicios.
7. Pendientes.
8. Facturas.
9. Historial.
10. Mensajería.

Las rutas de bonos y packs se conservan con sus reglas actuales. Blogger y Estadísticas dejan de aparecer como enlaces sueltos de primer nivel con el nombre de cada proyecto: se agrupan dentro de `Webs` para evitar una navegación que crece sin control.

El campo histórico `clients.portal_mode` se mantiene temporalmente para compatibilidad de base de datos, pero deja de decidir qué panel recibe el cliente. Una migración futura podrá retirarlo cuando no queden consumidores externos.

## Inicio

La portada combina la información existente con una jerarquía más compacta:

- H1 de bienvenida.
- Novedades y actividad reciente.
- Una tarjeta de estadísticas que rota automáticamente entre métricas disponibles de las webs asignadas.
- Resumen y acceso a mensajes internos.
- Resumen y acceso a informes.
- Alertas, servicios, facturas y bonos existentes sin pérdida de funcionalidad.

La tarjeta rotatoria solo consulta proyectos con Analítica activa y válida. Si no hay ninguno, no muestra un error ni promete estadísticas; presenta un estado informativo. Si una fuente falla, la portada sigue funcionando y enlaza a las estadísticas de las demás webs disponibles.

La rotación es progresiva y accesible: respeta `prefers-reduced-motion`, permite control manual y no cambia contenido mientras el usuario mantiene el foco sobre la tarjeta.

## Webs

`/cliente/proyectos` muestra tarjetas de todas las webs activas asignadas al cliente. Cada tarjeta contiene:

- nombre y dominio;
- etiqueta del producto contratado (`Lite`, `Express` o `Pro`);
- estado de Estadísticas;
- estado de Blogger;
- acceso al espacio de trabajo de la web.

Una cuenta sin webs conserva el panel completo y ve un estado vacío claro en `Webs`.

El espacio `/cliente/proyectos/[slug]` muestra solo las herramientas activas de esa web. Estadísticas y Blogger usan rutas protegidas internas de Studio. El cliente nunca recibe credenciales de Umami, rutas de servidor, secretos de publicación ni acceso a otra web.

## Producto contratado

`client_projects.product_tier` será nullable y aceptará exclusivamente:

- `lite` → Lite;
- `express` → Express;
- `pro` → Pro.

Un valor nulo se presenta como `Plan por confirmar` y nunca bloquea el acceso al proyecto. El administrador podrá editarlo desde la ficha del proyecto. aGama y TodoPlástico se clasificarán como `pro`, de acuerdo con la clasificación aprobada del portfolio.

## Capacidades y monetización

La disponibilidad comercial y el acceso técnico son conceptos separados:

- `unavailable`: la herramienta no está preparada para esa web;
- `available`: puede contratarse o prepararse, pero el cliente no accede;
- `active`: está contratada o concedida, configurada y visible.

Esto permite incluir Estadísticas en un plan, ofrecerla como extra o retirarla sin reconstruir el panel. La activación continúa requiriendo un sitio Umami del mismo dominio y una conexión de servidor válida.

Blogger requiere además registro de sitio, almacenamiento/adaptador, publicación, URL pública y validación. Activar el botón no puede sustituir esas condiciones.

## Caso Ángel Palma

La cuenta activa `547@agama.com.mx` recibirá:

- aGama, plan Pro;
- TodoPlástico, plan Pro;
- acceso cliente habilitado en ambos proyectos;
- Estadísticas activas en ambos proyectos;
- Blogger activo en aGama;
- Blogger en TodoPlástico únicamente después de verificar su adaptador específico de artículos.

La cuenta conservará informes, bonos, mensajes, facturas y todas las rutas existentes.

## TodoPlástico Blogger

TodoPlástico no es una web estática genérica: es la aplicación `agama-marketplace` y ya dispone de un modelo propio de artículos. Su integración se implementará en ese repositorio mediante un adaptador protegido, no copiando archivos directamente desde Studio.

Studio será la interfaz de edición y autorización. El adaptador de TodoPlástico será responsable de validar, guardar, previsualizar, publicar y retirar artículos usando el modelo de la aplicación. La capacidad se mantendrá en `available` hasta que las pruebas de extremo a extremo demuestren edición, publicación y lectura pública.

## Seguridad y permisos

- Las consultas cliente continúan sometidas a RLS y a la sesión autenticada.
- `client_projects.client_id`, estado activo y `client_access_enabled` determinan la visibilidad.
- Las capacidades deben estar activas y pasar su validación de configuración.
- Las métricas de portada se obtienen en servidor o mediante endpoints autorizados; no se exponen credenciales Umami.
- Cambiar de cliente desactiva el acceso hasta una confirmación administrativa explícita.
- Las mutaciones de capacidades conservan su auditoría.

## Despliegue seguro

1. Integrar primero el PR de espacios de proyecto y acceso directo a Blogger.
2. Aplicar la migración de producto contratado.
3. Desplegar navegación, Inicio y Webs unificados sin asignar proyectos automáticamente.
4. Verificar una cuenta activa sin proyectos y la cuenta ya configurada de Sofía.
5. Asignar aGama y TodoPlástico a Ángel y comprobar aislamiento de sesión.
6. Activar aGama Blogger y ambas estadísticas.
7. Integrar y verificar el adaptador de TodoPlástico en su repositorio.
8. Activar TodoPlástico Blogger solo tras superar la prueba completa.

## Criterios de aceptación

- Todos los clientes activos llegan a Inicio y ven Webs en la navegación.
- Ninguna ruta existente queda eliminada o inaccesible.
- Un cliente sin proyectos puede usar el resto del panel.
- Ángel ve exactamente aGama y TodoPlástico.
- Las dos webs muestran `Pro`.
- Ángel puede abrir las estadísticas de ambas sin conocer credenciales Umami.
- Ángel puede abrir Blogger de aGama cuando esté activo.
- TodoPlástico Blogger no se muestra antes de que su adaptador esté validado.
- El administrador ve y gestiona ambos proyectos.
- Otro cliente no puede leer las webs, métricas o Blogger de Ángel manipulando la URL.
- El panel sigue siendo utilizable cuando Umami o un publicador no responde.
