# Plan de implementación: CRM de clientes y Bill-in

1. Unificar “Ver” y “Editar” en la ficha y mover el formulario editable a esa ruta.
2. Añadir navegación y acciones rápidas de ficha con filtros/prefill por cliente.
3. Añadir búsqueda y orden de dominios por próxima caducidad.
4. Crear la bandeja global de Mensajes con filtro y envío por cliente.
5. Reagrupar la barra lateral en CRM y Bill-in.
6. Crear Gastos persistentes en Supabase con RLS, formulario, filtros e historial.
7. Añadir propuesta/factura y datos de transferencia al modelo documental.
8. Verificar localmente login → cliente → dominio/servicio/mensaje → factura/gasto → historial.
9. Contrastar las tres facturas enviadas por email con el historial cuando exista acceso al buzón correspondiente.

Cada tarea se implementa con prueba roja, cambio mínimo, pruebas completas y commit atómico.
