# Pagos y facturación flexible en WF Studio

Fecha: 24 de octubre de 2026

## Objetivo

WF Studio incorporará un área de pagos para que cada cliente registrado consulte los cobros que tiene pendientes y acceda al enlace de Stripe proporcionado por el administrador. El administrador seguirá controlando manualmente la creación y el estado de los cobros; esta primera versión no utilizará la API ni los webhooks de Stripe.

La herramienta actual de facturación se ampliará para trabajar tanto con clientes registrados como con destinatarios externos. Una factura podrá crearse directamente o a partir de un pago, en el momento que decida el administrador. Las facturas asociadas a clientes registrados permanecerán disponibles en su panel.

## Alcance

### Incluido

- Nueva sección administrativa `/paneladmin/pagos`.
- Nueva sección cliente `/cliente/pagos`.
- Creación, edición lógica de estado y retirada de pagos por el administrador.
- Enlaces de pago alojados en Stripe y configurados manualmente.
- Estados de pago `pending`, `paid` y `cancelled`.
- Generación opcional de una factura desde un pago.
- Facturas directas para clientes registrados o destinatarios externos.
- Datos fiscales congelados dentro de cada factura.
- Consulta e impresión/guardado como PDF de las facturas propias desde el panel cliente.
- Conservación y migración segura de las facturas existentes.

### No incluido

- Creación automática de sesiones de Stripe Checkout.
- Uso de claves privadas, API o webhooks de Stripe.
- Confirmación automática del pago desde Stripe.
- Almacenamiento de PDFs binarios; la factura se conserva como datos estructurados y se ofrece una vista imprimible que el navegador puede guardar como PDF.
- Creación de cuentas de cliente ficticias para destinatarios externos.
- Envío automático de facturas por correo en esta fase.

## Modelo de datos

### Pagos

Se añadirá `payments` con estos campos principales:

- `id`: UUID.
- `client_id`: cliente registrado propietario del pago; obligatorio.
- `invoice_id`: factura generada desde el pago; opcional y único.
- `concept`: descripción visible del cobro.
- `amount`: importe positivo.
- `currency`: `EUR` por defecto.
- `payment_url`: enlace HTTPS de Stripe.
- `status`: `pending`, `paid` o `cancelled`.
- `due_at`: vencimiento opcional.
- `paid_at`: fecha de confirmación manual opcional.
- `notes`: notas administrativas opcionales; nunca se mostrarán en el panel cliente.
- `created_at` y `updated_at`.

Solo se aceptarán enlaces HTTPS pertenecientes a `stripe.com` o a un subdominio real de `stripe.com`, sin credenciales ni puertos personalizados. Esto cubre Payment Links, Checkout e invoices alojadas por Stripe sin convertir el campo en un enlace externo arbitrario.

Un pago solo podrá apuntar a una factura. Generar dos veces la factura del mismo pago devolverá la factura ya vinculada en lugar de crear duplicados.

### Facturas

`invoices.client_id` pasará a ser opcional. Se añadirán datos fiscales propios de la factura:

- `billing_name`: nombre o razón social; obligatorio.
- `billing_company`: empresa o nombre comercial opcional.
- `billing_email`: correo opcional.
- `billing_tax_id`: NIF/CIF/VAT opcional.
- `billing_address`: dirección fiscal multilínea opcional.

Para un cliente registrado, el formulario tomará sus datos actuales como punto de partida y los copiará a estos campos. El administrador podrá corregirlos antes de emitir. Después de crear la factura, cambios posteriores en el perfil del cliente no modificarán el documento histórico.

Para un destinatario externo, `client_id` será nulo y los datos fiscales se introducirán manualmente. Esa factura nunca aparecerá en un panel cliente.

La migración rellenará los campos fiscales de las facturas existentes a partir del cliente actualmente asociado antes de exigir `billing_name`. No modificará números, importes, conceptos, estados ni fechas existentes.

## Autorización y privacidad

- Todas las mutaciones de pagos y facturas exigirán un administrador autenticado.
- Un cliente autenticado solo podrá leer pagos cuyo `client_id` corresponda a su identidad de portal.
- Un cliente solo podrá leer una factura cuando su `client_id` coincida con su identidad de portal.
- Las facturas externas quedarán fuera de cualquier política de lectura cliente.
- El acceso de soporte en modo solo lectura podrá inspeccionar pagos y facturas del cliente seleccionado, sin crear, editar, marcar ni eliminar datos.
- No se expondrán claves, configuración interna de Stripe ni identificadores de otros clientes.

## Experiencia administrativa

### Pagos

`/paneladmin/pagos` ofrecerá:

- Formulario con cliente, concepto, importe, enlace Stripe, vencimiento y notas.
- Listado filtrable por cliente y estado.
- Acciones para abrir el enlace, marcar como pagado, cancelar y generar factura.
- Enlace a la factura vinculada cuando exista.
- Confirmación visible cuando una acción falle; una escritura fallida nunca se presentará como correcta.

El administrador podrá cambiar un pago entre pendiente, pagado y cancelado. `paid_at` tendrá valor únicamente mientras el estado sea `paid`; cualquier otro estado lo limpiará. Cancelar no borrará el historial.

### Facturas

La herramienta existente `/paneladmin/facturas` incorporará un selector de destinatario:

1. Cliente registrado: selecciona un cliente y precarga sus datos fiscales.
2. Destinatario externo: muestra los campos fiscales manuales sin crear una cuenta.

El generador conservará numeración, concepto, importe, método de pago, fecha, notas, estado e impresión actuales. Desde un pago, abrirá el mismo flujo con cliente, concepto e importe precargados; la emisión seguirá requiriendo una acción explícita del administrador.

## Experiencia cliente

La navegación universal añadirá **Pagos** cerca de **Facturas**.

`/cliente/pagos` mostrará:

- Resumen del total pendiente.
- Tarjetas o tabla adaptada a móvil con concepto, importe, vencimiento y estado.
- Botón **Pagar con Stripe** únicamente para pagos pendientes con enlace válido.
- Acceso a la factura vinculada cuando exista.
- Historial de pagos completados y cancelados claramente diferenciado.

El botón de Stripe abrirá una nueva pestaña segura. Abrir el enlace no cambiará el estado del pago; el administrador lo confirmará manualmente.

`/cliente/facturas` conservará el listado actual y añadirá una acción para abrir una vista protegida de cada factura. Esa vista reutilizará el diseño imprimible y permitirá imprimir o guardar como PDF. No aceptará un identificador de factura perteneciente a otro cliente.

## Flujo de generación desde un pago

1. El administrador crea un pago para un cliente registrado.
2. El cliente abre Stripe desde su panel y realiza el pago.
3. El administrador confirma el cobro y marca el pago como pagado cuando corresponda.
4. En cualquier momento, antes o después del cobro, el administrador pulsa **Generar factura**.
5. El formulario de factura se abre con cliente, concepto e importe precargados.
6. El administrador revisa los datos fiscales y emite la factura.
7. La factura queda vinculada al pago y disponible en el panel del cliente.

La factura no marcará automáticamente el pago como pagado y el pago no emitirá automáticamente una factura.

## Errores e integridad

- Los importes deberán ser finitos y mayores que cero.
- El servidor validará de nuevo todos los campos; no se confiará en la validación del navegador.
- Los enlaces Stripe inválidos no podrán guardarse ni activarse.
- La generación desde pago comprobará nuevamente propiedad, estado del cliente y ausencia de una factura ya vinculada.
- La asignación `payment.invoice_id` ocurrirá únicamente después de crear correctamente la factura.
- Las acciones se diseñarán para evitar duplicados ante reintentos.
- Las eliminaciones físicas se reservarán para errores administrativos explícitos; el flujo normal utilizará estados y conservará trazabilidad.

## Compatibilidad y migración

- Las facturas actuales seguirán vinculadas a sus clientes y conservarán toda su información económica.
- La nueva migración será idempotente y limitará sus cambios a las tablas de pagos y facturas.
- Los tipos de Supabase se actualizarán para reflejar campos fiscales, relación opcional con clientes y la tabla de pagos.
- Las rutas y el generador de facturas existentes seguirán funcionando durante la transición.

## Verificación

La implementación incluirá pruebas para:

- Validación estricta de enlaces Stripe.
- Aislamiento de pagos y facturas por cliente mediante RLS y consultas de sesión.
- Facturas externas sin cuenta ni visibilidad en el portal.
- Copia estable de datos fiscales para clientes registrados.
- Creación directa y creación desde un pago.
- Idempotencia al generar una factura desde el mismo pago.
- Imposibilidad de marcar o modificar datos en modo soporte.
- Navegación administrativa, navegación cliente y diseño móvil.
- Acceso protegido a la vista imprimible de factura.
- Conservación de las facturas existentes tras la migración.

Antes de entregar se ejecutarán las pruebas completas, el typecheck, el lint y una compilación de producción.
