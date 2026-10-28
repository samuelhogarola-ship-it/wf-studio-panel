# CRM de clientes y Bill-in

## Objetivo

Convertir WF Panel en una herramienta local y persistente donde el CRM de clientes forme parte del panel y la contabilidad viva en un módulo integrado llamado **Bill-in**.

## Navegación

- **CRM**: Dashboard, Clientes, Mensajes, Bonos, Servicios, Historial e Informes.
- **Bill-in**: Facturas y Gastos.
- Los demás productos conservan su navegación actual.

## Ficha del cliente

El listado de clientes solo sirve para buscar, crear y elegir un cliente. “Ver” y “Editar” abren la misma ruta `/paneladmin/clientes/:id`; nunca muestran el resto de clientes debajo.

La ficha ofrece:

- volver a Clientes;
- editar los datos generales en la propia ficha;
- acciones rápidas para crear factura, gasto, servicio, bono o dominio y enviar mensaje;
- secciones navegables para resumen, dominios, servicios, facturas, mensajes e historial;
- dominios ordenados por próxima caducidad y búsqueda por nombre;
- enlaces a los gestores completos cuando haga falta una operación avanzada.

Los dominios siguen siendo contratos `packs` de tipo `domain`, porque un cliente puede tener muchos y cada uno necesita precio, alta, caducidad, pago, factura, estado y notas.

## Bill-in

Bill-in reutiliza el CRM y Supabase:

- Facturas: destinatario registrado o externo, historial, estado y pago.
- Gastos: proveedor, concepto, categoría, importe, fecha, método de pago, estado, notas y cliente opcional.
- La siguiente ampliación añade `propuesta` como tipo de documento y datos visibles para transferencia, sin duplicar clientes.
- Clases se contabilizarán como una categoría/área separada dentro del libro contable, con filtros y totales propios.

## Seguridad y persistencia

- Todas las mutaciones requieren administrador.
- RLS limita CRM y contabilidad al administrador; los clientes solo ven sus documentos permitidos.
- El entorno local usa Supabase aislado y la misma estructura se puede conectar al Supabase cloud para conservar el historial.

