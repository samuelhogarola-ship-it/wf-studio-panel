# Bill-in: periodo, cabecera y navegación ágil

## Intención

Hacer Bill-in más cómodo para consultar periodos y más agradable al entrar, sin convertirlo en una aplicación visualmente separada ni rediseñar WF-Studio.

## Alcance

- Sustituir la cabecera H1 plana de Bill-in por una presentación compacta y más colorida, con un pequeño símbolo vectorial propio, título y subtítulo.
- Mantener sin cambios estructurales la barra lateral, las tablas, las tarjetas y el resto del panel.
- Añadir un selector reutilizable de periodo a Bill-in, facturas y gastos: todo el histórico, mes actual/anterior, trimestre actual/anterior, año actual y rango personalizado.
- Conservar el periodo en la URL y mantener compatibilidad con los enlaces existentes que usan `month`.
- Hacer que el periodo elegido controle un resumen contable limpio con facturado, cobrado, pendiente de cobro, gastos pagados, resultado neto, recuento de facturas/propuestas y desgloses por actividad y cuenta.
- Adaptar el título del resumen al periodo seleccionado: mensual, trimestral, anual, personalizado o histórico.
- Reducir el retraso de navegación eliminando validaciones de administrador duplicadas entre layout y página, sin rebajar la seguridad del middleware ni de las páginas protegidas.

## Enfoques considerados

1. **Aplicación Bill-in con identidad completa.** Rechazado: cambia demasiado la interfaz para lo solicitado.
2. **Rediseño completo de WF-Studio.** Rechazado: amplía el trabajo sin aportar valor directo a esta mejora.
3. **Cabecera H1 destacada y cambios funcionales acotados.** Elegido: aporta color y personalidad sin alterar la navegación conocida.

## Límites

- No se genera un logotipo raster ni una nueva marca completa; el símbolo será SVG nativo, nítido y coherente con los iconos existentes.
- No se cambian datos, numeración, permisos ni reglas contables.
- Las propuestas no se contabilizan como ingreso y los documentos anulados no se incluyen en totales monetarios.
- No se añaden gráficas, tendencias ni comparaciones con periodos anteriores.
- No se elimina ninguna validación de autorización; solo se deduplica dentro de una misma petición.
- El histórico seguirá paginado y sus filtros actuales continuarán funcionando.

## Validación

- Pruebas del selector, parámetros de URL, compatibilidad mensual y deduplicación de identidad.
- Verificación de navegación protegida, lint, tipos, pruebas completas y build.
- Medición antes/después en navegación local caliente para confirmar la mejora.
