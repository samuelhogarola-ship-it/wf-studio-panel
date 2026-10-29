# Acceso administrado y navegación de la ficha de cliente

## Intención

WF Studio debe controlar quién puede entrar al portal de clientes y ofrecer una ficha clara para operar con cada cliente. Ninguna persona podrá darse de alta públicamente. El administrador crea el cliente, genera su primera contraseña y puede sustituirla posteriormente cuando el cliente no pueda recuperar el acceso por sí mismo.

## Objetivos

- Eliminar el registro público del portal y cualquier enlace que lo anuncie.
- Exigir una contraseña administrada al crear un cliente con acceso al portal.
- Permitir crear acceso para clientes ya existentes que todavía no tengan usuario, como EPU.
- Permitir reemplazar la contraseña de cualquier cliente desde su ficha y copiarla una sola vez.
- Mantener la recuperación por email como alternativa para clientes que sepan utilizarla.
- Mostrar una notificación interna en el panel cuando el propio cliente cambie o restablezca su contraseña; no enviar correo al administrador.
- Activar la vista de soporte existente, con token opaco de 30 minutos y solo lectura, sin conocer ni cambiar la contraseña del cliente.
- Reorganizar la ficha para que una sección seleccionada sea el foco principal y no se duplique información.

## No objetivos

- Guardar contraseñas en `clients`, Supabase, logs, historial o almacenamiento del navegador.
- Mostrar o recuperar una contraseña anterior.
- Usar la contraseña del cliente para la vista de soporte.
- Mantener una cola de solicitudes de alta pública.
- Rediseñar el menú global del panel ni los módulos completos de Bill-in.

## Decisiones de acceso

### Alta administrada

La ruta pública `/cliente/registro` dejará de aceptar altas y redirigirá al login con un mensaje para contactar con WF Studio. El login no mostrará “Solicitar acceso”. La acción de registro pública también rechazará llamadas directas para que ocultar la pantalla no sea la única protección.

El alta de cliente desde el panel tendrá un único flujo operativo. Nombre y email serán obligatorios y la acción de alta generará en servidor una contraseña inicial mediante un generador criptográficamente seguro. El cliente solo se considerará creado cuando su cuenta Auth y su ficha hayan quedado enlazadas correctamente. La contraseña resultante se mostrará una sola vez después del alta para copiarla.

### Cliente existente sin usuario

La ficha consultará si existe un usuario Auth para el email del cliente. Si no existe, la sección `Acceso` mostrará `Crear acceso y contraseña`. La acción creará el usuario Auth confirmado con rol de cliente, sin duplicar ni sustituir la fila existente de `clients`, ya que el portal relaciona la identidad con el cliente por email y proyecto.

### Sustitución de contraseña

Cuando ya exista el usuario, la misma sección mostrará `Generar nueva contraseña`. La acción comprobará otra vez, en servidor, que el administrador está autenticado, que el cliente pertenece a `wf-studio` y que el usuario Auth coincide por email; después reemplazará su contraseña.

La contraseña:

- se genera en servidor con entropía suficiente y caracteres fáciles de comunicar;
- se devuelve únicamente como resultado inmediato de la acción;
- aparece en un campo de solo lectura con `Copiar` y aviso de una sola visualización;
- no se persiste ni se incluye en URL, revalidaciones, logs o auditoría;
- invalida de forma explícita la contraseña anterior.

Al abandonar, recargar o cerrar el resultado, la contraseña deja de estar disponible para el administrador. Si el cliente la olvida, puede solicitar el restablecimiento normal por email o el administrador puede generar otra desde la ficha. No se mantiene una bóveda reversible ni una copia cifrada recuperable.

Cuando el cliente completa el cambio desde el portal, el sistema registra un evento administrativo sin contraseña y muestra una notificación interna con el cliente y la fecha. La notificación confirma únicamente el cambio; no intenta conservar, recuperar ni comparar la nueva contraseña. No se envía correo al administrador.

La interfaz pedirá confirmación antes de reemplazar una contraseña existente, porque la operación puede cerrar el acceso que el cliente estaba usando.

### Vista de soporte

`Ver como cliente` permanece separado de `Acceso`. Usa la implementación existente de sesión de soporte: token aleatorio, hash en base de datos, cookie segura, duración máxima de 30 minutos, auditoría y permisos de solo lectura. Se habilitará `WF_SUPPORT_PREVIEW_ENABLED` únicamente después de comprobar que la migración de soporte está aplicada y realizar el recorrido de entrada, navegación y salida en producción.

## Navegación de la ficha

Se mantiene el menú global de WF Studio. Dentro de `/paneladmin/clientes/:id` se añade una barra contextual secundaria y fija en escritorio con:

- Resumen
- Perfil
- Acceso
- Bonos
- Dominios
- Hosting
- Servicios
- Facturas
- Gastos
- Mensajes
- Historial

La cabecera mostrará `Clientes / nombre del cliente`, estado y acciones principales. La sección activa tendrá contraste visual y contador cuando corresponda.

En escritorio, la barra contextual ocupa una columna estrecha y el contenido seleccionado usa el resto del ancho. En móvil se convierte en un selector desplegable. Solo se renderiza como bloque visual principal la sección elegida; seleccionar `Resumen` o volver a pulsar la sección activa recupera la vista general. El actual “Menú de servicios del cliente” y los resúmenes laterales duplicados desaparecen.

Dominios, hosting, servicios y documentos conservan sus datos y acciones actuales, pero se muestran dentro de su sección. Los enlaces para crear factura, gasto, servicio, bono, dominio o mensaje permanecen visibles en el contexto correspondiente y en el resumen.

## Seguridad y errores

- Toda creación o cambio de contraseña requiere `requireAdmin()`.
- El cliente se vuelve a cargar por ID y proyecto antes de operar.
- La búsqueda del usuario Auth se hace en servidor; nunca se envía una lista de usuarios al navegador.
- Si el email está asociado a una identidad incompatible o duplicada, no se modifica nada y se muestra un error seguro.
- Crear acceso es idempotente respecto a la existencia del usuario: si ya existe, la interfaz pasa al flujo de reemplazo y no crea un segundo usuario.
- Los errores de Supabase se registran sin contraseña y la interfaz recibe mensajes no sensibles.
- El restablecimiento por email continúa disponible, pero no crea cuentas para emails que no correspondan a clientes activos.

## Enfoques considerados

1. **Acordeones en la página actual.** Requiere pocos cambios, pero mantiene la ficha larga y no soluciona la jerarquía plana.
2. **Barra contextual secundaria y una sección enfocada.** Elegido: aprovecha la pantalla grande, mantiene el contexto del cliente y elimina duplicación sin mezclar el listado general.
3. **Lista de clientes fija junto a la ficha.** Facilita saltar entre clientes, pero consume ancho, distrae del cliente activo y contradice la decisión previa de separar listado y ficha.

## Pruebas y aceptación

- `/cliente/registro` no permite crear usuarios y el login no ofrece alta pública.
- Una llamada directa a la antigua acción de registro tampoco crea Auth ni `clients`.
- El alta administrada crea cliente, usuario y perfil coherentes o revierte el usuario si falla la fila del cliente.
- Un cliente existente sin usuario recibe acceso sin duplicar su fila ni perder relaciones.
- Un cliente con usuario recibe una contraseña nueva; la anterior deja de autenticar y la nueva sí funciona.
- La contraseña solo aparece en la respuesta inmediata y no queda en HTML posterior, logs ni base de datos legible.
- Recargar la ficha elimina la contraseña mostrada; un nuevo acceso requiere generar otra o usar la recuperación por email.
- Un cambio completado por el cliente crea una notificación interna sin material de credencial y no envía email al administrador.
- La vista de soporte crea y termina una sesión temporal sin modificar la contraseña.
- La barra contextual marca la sección activa, muestra únicamente el contenido elegido y conserva enlaces y contadores.
- Las pruebas de autenticación, soporte, CRM, TypeScript, lint y build pasan antes del despliegue.
