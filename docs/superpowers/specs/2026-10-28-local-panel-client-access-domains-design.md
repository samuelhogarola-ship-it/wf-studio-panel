# Local Panel, Client Access and Domains Design

## Intent

Dejar WF Panel preparado para trabajo local seguro y corregir dos fricciones administrativas: el alta de clientes con contraseña y la asignación de dominios desde la ficha del cliente.

## Goals

- Mantener `WF-Panel` como única fuente oficial y no modificar las copias legacy.
- Poder instalar, validar, compilar y arrancar el panel localmente con un Supabase aislado.
- Hacer que el alta directa con contraseña funcione en todos los espacios admitidos por la interfaz.
- Permitir iniciar el alta de un dominio desde un cliente, preseleccionando ese cliente y conservando precio, fechas, pago y estado.
- Mantener operativo el generador de facturas existente.

## Non-goals

- No migrar ni borrar datos de las copias legacy.
- No conectar el entorno local a producción.
- No duplicar dominio, precio o caducidad como columnas de `clients`.
- No rediseñar facturación ni la navegación completa del panel.

## Constraints

- El entorno local debe usar credenciales locales y datos desechables.
- Las credenciales no se versionan.
- Los cambios de comportamiento se implementan con pruebas primero.
- La creación de clientes seguirá requiriendo una sesión administradora.

## Approaches

1. Añadir `domain`, `domain_expires_at` y `domain_price` a `clients`. Es sencillo para un único dominio, pero duplica el modelo existente y no admite varios dominios correctamente.
2. Reutilizar `packs` con `pack_type = 'domain'` y enlazar el formulario desde la ficha del cliente. Es la opción elegida porque el modelo ya guarda nombre, precio, compra, renovación, pago, factura, estado y notas, y admite varios dominios.
3. Mover los dominios a una tabla nueva. Sería más explícito, pero añade migración y lógica paralela sin aportar valor inmediato frente al contrato existente.

## Design

- Añadir una migración aditiva que sincronice `clients_project_check` con los cuatro valores admitidos por la aplicación.
- Extraer la coordinación de alta directa a una función comprobable: normalizar email, crear Auth, insertar el cliente y eliminar el usuario Auth si la inserción falla.
- Traducir errores de duplicado y configuración a mensajes seguros y útiles sin filtrar detalles internos.
- Añadir `client` a los parámetros de `/paneladmin/bonos`; `PackForm` lo usará como selección inicial solo al crear.
- Añadir una acción visible “Añadir dominio” en la ficha del cliente que abra el formulario de dominio con ese cliente seleccionado.
- Preparar un bootstrap local para Supabase/Colima y documentar que facturas requiere las migraciones completas.

## Success

- Lint, TypeScript, tests y build pasan.
- La migración admite `vivir-fuengirola-negocios`.
- Un alta directa normaliza el email y limpia Auth si falla la fila de cliente.
- La ficha de cliente abre un nuevo dominio con el cliente ya seleccionado.
- El panel local arranca sin usar la base de producción y muestra las rutas de clientes, dominios y facturas.
