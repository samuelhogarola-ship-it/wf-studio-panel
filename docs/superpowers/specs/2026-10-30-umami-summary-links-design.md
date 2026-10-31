# Umami como panel analítico principal

## Intención

WF Panel debe mostrar una lectura rápida y consistente de cada web, pero no intentar reproducir el explorador profesional que Umami ya ofrece. El administrador podrá pasar del resumen a la propiedad exacta de Umami con un clic. El acceso futuro de clientes se habilitará mediante una URL de solo lectura independiente, nunca mediante las credenciales administrativas.

## Alcance

- Mostrar para todas las webs configuradas un resumen homogéneo: visitantes, visitas, páginas vistas, rebote, duración, evolución, páginas y referencias principales.
- Añadir en las superficies administrativas un enlace directo a la propiedad exacta dentro de su instancia Umami (`personal` o `agama`).
- Sustituir los exploradores avanzados duplicados del panel administrativo por este patrón de resumen y enlace.
- Mantener el resumen interno actual para clientes, sin enlace externo por ahora.
- Preparar la configuración para admitir más adelante una Share URL específica por web y cliente.

## Seguridad y límites

- Las URL administrativas de Umami solo aparecen ante usuarios administradores autenticados.
- No se exponen usuario, contraseña, token, identificador interno ni diagnósticos de conexión en respuestas de cliente.
- WF Panel abre Umami mediante navegación normal en una pestaña nueva y deja que cada instancia conserve su propia sesión mediante sus cookies. No transporta ni autocompleta contraseñas, tokens o sesiones.
- La futura Share URL será de solo lectura, revocable y distinta del enlace administrativo.
- Esta fase no crea usuarios, equipos ni Share URLs en Umami y no cambia la instrumentación de las webs.

## Enfoques considerados

1. **Seleccionado: resumen en WF Panel + enlace administrativo directo + Share URL futura.** Reduce mantenimiento, conserva una lectura inmediata y delega la exploración avanzada a Umami.
2. **Equipos Umami y usuarios `View Only`.** Más control de identidad, pero añade cuentas, invitaciones y soporte; queda como alternativa futura para clientes que necesiten acceso nominal.
3. **Umami incrustado mediante iframe.** Mantiene todo en WF Panel, pero duplica navegación, exige configuración adicional de frames y no aporta valor frente al enlace directo.

## Comportamiento esperado

Cada bloque analítico administrativo resolverá la instancia y el sitio desde el registro canónico. El botón `Abrir Umami` apuntará a `/websites/{websiteId}` en la instancia correspondiente. Si el identificador no está configurado o no puede resolverse, el resumen degradará de forma aislada y no mostrará un enlace inventado. Las páginas administrativas que ahora renderizan además el explorador avanzado dejarán de duplicarlo.

Las instancias `personal` y `agama` mantienen sesiones independientes porque usan orígenes distintos. Después del primer inicio de sesión en cada una, el navegador reutilizará la cookie vigente y el enlace será de un clic hasta que Umami cierre o caduque esa sesión. Si caduca, Umami mostrará su login y el navegador podrá ofrecer la contraseña guardada; WF Panel no debe intentar implementar un inicio de sesión automático.

Cuando se habilite el acceso del cliente, el registro admitirá una Share URL por web. El portal mostrará ese enlace solo al cliente autorizado para el proyecto, conservando el resumen interno como vista inicial.

## Verificación

- Pruebas de resolución de instancia y enlace exacto para webs `personal` y `agama`.
- Pruebas de que el enlace administrativo no aparece en superficies de cliente.
- Pruebas de las rutas administrativas principales y de proyectos sin el explorador duplicado.
- Suite completa, tipos, lint y build antes de integración.
