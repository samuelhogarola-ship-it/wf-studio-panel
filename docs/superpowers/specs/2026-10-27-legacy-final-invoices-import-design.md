# Importación de facturas finales existentes

## Intención

Incorporar al nuevo módulo de contabilidad las facturas finales que ya existen en el panel antiguo, sin importar propuestas ni crear documentos duplicados.

## Alcance confirmado

- Importar únicamente registros de `public.invoices` como facturas finales.
- Deben quedar incluidas, como mínimo, las facturas de Marisol / Gimnasio Nuevo Estilo, Miguel / Bionatura y SuVilla SL.
- Conservar número de factura, cliente, CIF/datos fiscales existentes, concepto, fecha, estado, forma de pago, notas e importe.
- Los importes verificados son dos facturas con base de 200 EUR e IVA del 21 % y una factura con base de 650 EUR e IVA del 21 %.
- Gimnasio Nuevo Estilo conserva la referencia `WF-2026-001`, fecha 20/07/2026, CIF `J29227907`, concepto `Página web`, base 200 EUR, IVA 42 EUR y total 242 EUR.
- SuVilla conserva la referencia `WF-2026-002` y su desglose conocido: 650 EUR de base, 136,50 EUR de IVA y total 786,50 EUR. El cliente confirma posteriormente que está completamente pagada y sin saldo pendiente.
- En local, Bionatura del Sur SL solo tiene una propuesta, no una factura final. Sus datos fiscales y económicos verificados son CIF `B92371301`, dirección `Calle Tórtolas 11, 29640 Fuengirola`, concepto `Página web Lite`, base 200 EUR, IVA 42 EUR y total 242 EUR. Para cumplir el alcance se creará expresamente como factura final nueva, sin importar la propuesta.
- No importar propuestas.

## Enfoque elegido

Migración automática, única e idempotente desde la tabla antigua `invoices` hacia `billing_documents`. Cada factura mantiene un vínculo técnico al registro de origen para impedir duplicados si la migración se ejecuta más de una vez. Tras importar el histórico, una reconciliación idempotente asegura las tres facturas finales confirmadas: `WF-2026-001` para Gimnasio Nuevo Estilo, `WF-2026-002` para SuVilla y una nueva referencia correlativa para Bionatura.

Alternativas descartadas:

- Suponer un IVA del 21 % para todos los importes antiguos: podría inventar un desglose que no estaba guardado.
- Importar solo PDFs encontrados en correo: dejaría fuera facturas válidas del panel.

## Evidencia local revisada

- La factura final original `WF-2026-001` de Marisol / Gimnasio Nuevo Estilo verifica el CIF `J29227907`, la fecha 20/07/2026, la base de 200 EUR, el IVA de 42 EUR y el total de 242 EUR.
- El documento original de Bionatura del Sur SL es una propuesta, no una factura final. Verifica el CIF `B92371301`, la dirección de Calle Tórtolas 11, la base de 200 EUR, el IVA de 42 EUR y el total de 242 EUR; se usa únicamente como evidencia para crear `WF-2026-003` como factura final nueva.
- La factura final original `WF-2026-002` de SuVilla SL verifica el CIF `B93154425`, la base de 650 EUR, el IVA de 136,50 EUR y el total de 786,50 EUR. El cliente confirmó después que está pagada completamente, con saldo 0 EUR.
- Las tres facturas finales se registran como completamente pagadas, sin saldo pendiente.
- El correo a la gestora se excluye expresamente como prueba de cliente, CIF, referencia, desglose o estado de pago.
- Para cualquier otra factura histórica, los datos de cliente, concepto, fecha, forma de pago, notas, estado e importe se obtienen exclusivamente de `public.invoices` durante la migración; si el número ya existe con una identidad fiscal incompatible, la migración se detiene sin sobrescribirlo.

## Comprobación de la importación

La prueba PostgreSQL desechable carga facturas antiguas en los cuatro estados admitidos, ejecuta toda la historia de migraciones y vuelve a ejecutar la importación. Comprueba las tres referencias confirmadas, los totales y pagos completos, la conservación literal de CIF/direcciones multilínea, el mapeo de estados, la reserva de secuencias y la ausencia de documentos, líneas o pagos duplicados.

## Tratamiento de importes históricos

El sistema antiguo solo guarda un importe final y no separa base e IVA. Las facturas antiguas se importarán con su total intacto y una marca visible de “desglose fiscal pendiente de revisar”. No se atribuirá automáticamente IVA, exención o no sujeción. Las facturas cuyo desglose esté verificado, como SuVilla, podrán recibir el desglose exacto mediante una corrección explícita en la propia migración.

## Seguridad y compatibilidad

- La tabla antigua no se modifica ni se elimina.
- La importación usa `on conflict`/vínculo único para ser idempotente.
- Los números existentes se reservan en la secuencia nueva para evitar futuras colisiones.
- Los clientes siguen viendo solamente sus propias facturas mediante las políticas existentes.
- Una prueba de migración verificará que solo se importan facturas finales, que no se duplican y que se conservan las tres referencias esperadas cuando están presentes en origen.
