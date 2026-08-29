# Panel de estadísticas de Superentrenador en WF-Panel

## Objetivo

Incorporar en el área administrativa de WF-Panel un panel nativo y protegido que muestre las métricas de Umami correspondientes a Superentrenador. El panel sustituye la necesidad de entrar en la interfaz de Umami y mantiene todas las credenciales en el servidor.

## Alcance

- Nueva ruta protegida `/paneladmin/superentrenador/estadisticas`.
- La entrada `Superentrenador` del menú lateral apuntará a Estadísticas, que actuará como portada de la sección.
- La sección ofrecerá navegación entre Estadísticas, Entrenadores y Usuarios.
- Periodos seleccionables de 7, 30 y 90 días mediante el parámetro `days` de la URL.
- Métricas principales: visitantes, visitas, páginas vistas, tasa de rebote y tiempo medio por visita.
- Comparación de las métricas disponibles con el periodo inmediatamente anterior de igual duración.
- Serie temporal diaria de páginas vistas y visitas.
- Embudo de eventos: `contacto-iniciar-sesion`, `contacto-crear-cuenta`, `mensaje-enviado`, `entrenador-publicar-anuncio` y `premium-cta`.
- Listados de páginas principales, referentes, países y dispositivos.
- Estados explícitos para configuración ausente, respuesta inválida o fallo temporal de Umami.

No se incrustará la interfaz de Umami, no se expondrán credenciales al navegador y no se añadirá una dependencia de gráficos.

## Arquitectura

### Cliente Umami del servidor

Un módulo específico en `src/lib/data/umami.ts` será responsable de:

1. Validar `UMAMI_URL`, `UMAMI_USERNAME`, `UMAMI_PASSWORD` y `UMAMI_SUPERENTRENADOR_WEBSITE_ID`.
2. Autenticarse mediante `POST /api/auth/login`.
3. Consultar en paralelo `/stats`, `/pageviews` y las métricas `url`, `referrer`, `country`, `device` y `event`.
4. Normalizar las variantes numéricas de Umami (`number` o `{ value, prev }`).
5. Devolver un resultado discriminado: datos, no configurado o error.

El módulo solo será importable desde servidor. Las peticiones usarán una caché de cinco minutos y nunca registrarán contraseña ni token.

### Página administrativa

La página será un Server Component dinámico. Ejecutará `requireAdmin()` antes de consultar Umami, validará `days` contra `7 | 30 | 90` y usará 30 días por defecto. Los cambios de periodo serán enlaces normales para conservar una interfaz funcional sin JavaScript cliente.

La presentación reutilizará `AdminShell`, `Card`, colores y tipografía de WF-Panel. El gráfico será SVG accesible y las listas serán HTML semántico. En móvil, las tarjetas y tablas se apilarán o permitirán desplazamiento horizontal sin desbordar la página.

### Navegación de Superentrenador

Un componente pequeño y compartido mostrará pestañas para Estadísticas, Entrenadores y Usuarios. Se añadirá a las tres páginas para que la sección no dependa únicamente del menú lateral. La entrada principal del menú apuntará a `/paneladmin/superentrenador/estadisticas` y seguirá marcada como activa en sus subrutas.

## Flujo de datos y seguridad

```text
Administrador autenticado
  -> Server Component protegido
  -> cliente Umami en servidor
  -> instancia Umami
  -> datos normalizados
  -> HTML del panel
```

Las cuatro variables de Umami serán exclusivamente de servidor y se documentarán en `.env.example` y `README.md`. No habrá ruta API pública propia. La contraseña se usará únicamente para obtener el token de Umami.

## Interfaz

La cabecera incluirá el selector 7/30/90 días y la indicación de la última actualización. Debajo aparecerán:

1. Cinco tarjetas de resumen con valor y tendencia.
2. Un gráfico diario de páginas vistas y visitas.
3. El embudo de conversiones con recuentos por evento.
4. Páginas principales y fuentes de tráfico.
5. Países y reparto por dispositivo.

Si no hay tráfico, los bloques mostrarán cero o un mensaje vacío, no un error. Si faltan variables, se mostrará qué nombres deben configurarse sin revelar valores. Si Umami falla, se conservará la navegación y aparecerá un aviso para reintentar recargando.

## Pruebas y verificación

- Pruebas unitarias de validación del periodo, normalización, tendencias, rebote y duración media.
- Prueba del cliente con `fetch` simulado para verificar autenticación, endpoints, parámetros y cabeceras.
- Pruebas estáticas de navegación, protección administrativa y ausencia de variables públicas.
- `npm test`, `npm run lint`, `npm run typecheck` y `npm run build` en WF-Panel.
- Verificación visual de los estados configurado, vacío, no configurado y error cuando el entorno permita ejecutar el panel.

## Configuración operativa

```dotenv
UMAMI_URL=https://analytics.example.com
UMAMI_USERNAME=admin
UMAMI_PASSWORD=
UMAMI_SUPERENTRENADOR_WEBSITE_ID=
```

El despliegue requerirá añadir estos valores en Coolify y volver a desplegar WF-Panel. La implementación quedará funcional y mostrará el estado de configuración pendiente hasta que las credenciales reales estén disponibles.
