# Integración de solicitudes públicas

Este contrato permite que los formularios públicos mantenidos por Claude envíen fichas a WF Panel. El navegador nunca accede directamente a las tablas: utiliza únicamente esta API HTTPS.

## Orden de publicación

WF Panel debe desplegarse antes que cualquier formulario público que use este contrato. Primero se aplica la migración y se comprueba la API; después se publica cada formulario.

## Orígenes y plataformas

| Origen exacto | `platform` permitidas |
| --- | --- |
| `https://vivirenfuengirola.com` | `vivir-fuengirola`, `vivir-fuengirola-negocios` |
| `https://www.vivirenfuengirola.com` | `vivir-fuengirola`, `vivir-fuengirola-negocios` |
| `https://conocefuengirola.com` | `conoce-fuengirola` |
| `https://www.conocefuengirola.com` | `conoce-fuengirola` |

No se admiten comodines. `sourceUrl` debe pertenecer al mismo origen que hace la petición.

## Configuración de Turnstile

`GET /api/platform-requests/config` devuelve uno de estos cuerpos:

```json
{ "turnstileEnabled": true, "turnstileSiteKey": "site-key-publica" }
```

```json
{ "turnstileEnabled": false }
```

La segunda respuesta solo es válida en desarrollo. En producción, una configuración ausente o incompleta devuelve `503 requests_not_configured`. La clave privada nunca se entrega al navegador.

## Crear una solicitud

`POST /api/platform-requests` espera `Content-Type: application/json`:

```json
{
  "platform": "vivir-fuengirola",
  "requestType": "client",
  "name": "Nombre y apellidos",
  "email": "persona@example.com",
  "phone": "+34 600 000 000",
  "company": "Empresa opcional",
  "message": "Nota opcional",
  "profile": {
    "sector": "Hostelería"
  },
  "sourceUrl": "https://vivirenfuengirola.com/registro",
  "website": "",
  "token": "turnstile-token"
}
```

Valores de `requestType`:

- `client`: alta de cliente o ficha personal.
- `business`: alta de negocio.
- `subscription_interest`: interés en una suscripción; aprobar no activa ni cobra una suscripción.

`name` y `email` son obligatorios. `website` es el campo señuelo y debe permanecer vacío. `profile` es un objeto JSON para los campos propios de cada web.

Ejemplo de comprobación desde un origen autorizado:

```bash
curl 'https://admin.webfuengirola.com/api/platform-requests' \
  -X POST \
  -H 'Origin: https://vivirenfuengirola.com' \
  -H 'Content-Type: application/json' \
  --data '{"platform":"vivir-fuengirola","requestType":"client","name":"Prueba","email":"prueba@example.com","profile":{},"sourceUrl":"https://vivirenfuengirola.com/registro","website":"","token":"turnstile-token"}'
```

## Respuestas

- `201 { "success": true, "outcome": "created" }`: solicitud nueva guardada.
- `200 { "success": true, "outcome": "existing" }`: reintento de una solicitud pendiente ya guardada.
- `400 invalid_payload`: cuerpo, URL, límites o token ausente no válidos.
- `400 turnstile_failed`: Turnstile rechazó el token o devolvió otro hostname.
- `403 forbidden_origin`: origen no autorizado.
- `403 platform_not_allowed`: el origen no puede escribir en esa plataforma.
- `503 requests_not_configured`: protección pública incompleta en producción.
- `500 server_error`: fallo interno sin detalles de infraestructura.

Una respuesta correcta no crea una cuenta, contraseña, factura, pack ni suscripción. La ficha aparece en la bandeja de su plataforma y un administrador decide si la incorpora al CRM.
