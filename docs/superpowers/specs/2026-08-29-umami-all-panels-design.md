# Umami en todos los paneles — diseño

## Objetivo

Todos los paneles de WF Studio mostrarán estadísticas Umami reales de los últimos 30 días comparadas con los 30 días anteriores. Las webs que todavía no envíen tráfico a Umami incorporarán seguimiento cookieless desde la primera visita.

## Infraestructura

Se mantienen dos instancias independientes:

- `personal`: `https://analytics.187.124.55.36.sslip.io`, para Web Fuengirola y proyectos personales.
- `agama`: `https://analytics.2.24.10.239.sslip.io`, exclusivamente para Agama y TodoPlástico.

WF Studio accederá a ambas instancias solo desde el servidor. Las credenciales de API nunca se expondrán al navegador. TodoPlástico conservará su implementación actual, que ya incluye script, API, panel de empresa y panel administrador con métricas Umami.

## Asignación de paneles y sitios

| Panel de WF Studio | Sitios Umami | Instancia |
| --- | --- | --- |
| WF-Studio | Web Fuengirola | personal |
| Vivir en Fuengirola | Vivir en Fuengirola | personal |
| Conoce Fuengirola | Conoce Fuengirola | personal |
| Samuel Coach | Samuel Coach de Alemán | personal |
| Vokabel-World | VokabelLab, imKontext y Der Die Das | personal |
| Superentrenador | Superentrenador y Coach Studio | personal |
| TodoPlástico | TodoPlástico | agama |

Top Fuengirola, Viking Fitness, Personal Trainer Fuengirola y Gimnasio Nuevo Estilo también se instrumentarán en la instancia personal. Seguirán disponibles en el informe general aunque no tengan panel operativo propio en WF Studio.

## Seguimiento en las webs

Cada web cargará el script Umami mediante configuración de entorno con URL e identificador de sitio. El seguimiento será cookieless, anónimo y se iniciará en la primera visita; no dependerá del consentimiento del banner porque no usará cookies ni identificadores personales.

Cada sitio tendrá un registro independiente en Umami. No se compartirán identificadores entre dominios. Se verificará en producción que el script responde, que el `websiteId` coincide con el sitio configurado y que aparece una visita de prueba.

## Lectura en WF Studio

Se creará un módulo servidor reutilizable con:

- registro tipado de sitios y asignación de instancia;
- autenticación independiente contra cada Umami;
- consulta de `stats`, `pageviews` y `metrics`;
- rango por defecto de 30 días y comparación con los 30 anteriores;
- caché de cinco minutos;
- errores aislados por sitio.

Las variables privadas se separarán por instancia:

- `UMAMI_PERSONAL_URL`, `UMAMI_PERSONAL_USERNAME`, `UMAMI_PERSONAL_PASSWORD`;
- `UMAMI_AGAMA_URL`, `UMAMI_AGAMA_USERNAME`, `UMAMI_AGAMA_PASSWORD`.

Los identificadores se configurarán por sitio con variables `UMAMI_WEBSITE_ID_*`. Las variables existentes de informes mensuales se migrarán de forma compatible para no interrumpir el cron durante el despliegue.

## Interfaz

Cada panel mostrará el bloque después de sus indicadores operativos principales. El bloque común incluirá:

- visitantes;
- visitas;
- páginas vistas;
- tasa de rebote;
- duración media;
- variación frente al periodo anterior;
- serie diaria;
- páginas principales;
- referidos principales;
- enlace a la instancia Umami correspondiente.

Los paneles con varios sitios mostrarán un total combinado y permitirán cambiar de sitio. Un fallo de Umami mostrará un estado de conexión localizado y nunca impedirá usar el resto del panel.

## Informes mensuales

El generador mensual aceptará sitios procedentes de ambas instancias. Mantendrá una sola fila por mes en Supabase y reflejará el estado individual de cada sitio. La ausencia o fallo de un sitio no impedirá guardar el informe del resto.

## Despliegue por repositorio

Los cambios se ejecutarán en fases y un repositorio cada vez:

1. WF Studio: cliente dual, componente visual, integración en paneles e informe mensual.
2. Web Fuengirola: cambiar del VPS Agama al personal y retirar la dependencia del consentimiento para Umami.
3. Sitios personales con repositorio local: añadir script/configuración y verificar cada despliegue.
4. Vokabel-World y Superentrenador: instrumentar sus aplicaciones y subdominios.
5. TodoPlástico: solo verificar producción y conectar su lectura desde WF Studio; no reimplementar su analítica.
6. Coolify: configurar secretos, tareas programadas y desplegar WF Studio.

Antes de editar cada repositorio se comprobarán rama, cambios locales y divergencia con el remoto. Cada fase tendrá pruebas, commit y push propios antes de pasar al siguiente proyecto.

## Verificación

La entrega se considerará completa cuando:

- cada web cargue el script desde la instancia correcta con su propio ID;
- cada sitio registre una visita de prueba;
- cada panel muestre datos o un estado de conexión explícito;
- TodoPlástico conserve su panel estadístico actual;
- el informe mensual agregue ambas instancias sin duplicar envíos;
- las credenciales permanezcan únicamente en servidor;
- las suites, lint, tipos y builds de cada repositorio modificado pasen;
- cada repositorio quede limpio y sincronizado con su remoto.

## Fuera de alcance

- sustituir Umami por otro proveedor;
- unificar las bases de datos de las dos instancias;
- copiar históricos completos a Supabase;
- añadir identificación de usuarios o seguimiento con datos personales;
- rediseñar las funciones operativas existentes de los paneles.
