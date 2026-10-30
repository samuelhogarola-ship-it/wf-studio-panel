# Reconciliación segura de Fichero Fuengirola

Este proceso enlaza las filas ya publicadas de Vivir y Conoce Fuengirola con la ficha canónica de Fichero sin publicar, retirar ni borrar negocios.

## Orden de coincidencia

1. `canonical_profile_id` existente.
2. CIF/NIF normalizado.
3. Dominio web o email exacto, siempre con nombre compatible.
4. Slug público existente dentro del mismo canal.
5. Revisión manual.

Si dos identificadores fuertes apuntan a fichas distintas, el resultado es `conflict`. Si una regla devuelve varias fichas, el resultado es `ambiguous`. El proceso nunca elige la primera fila.

## Dry run obligatorio

```bash
node scripts/reconcile-fuengirola-directory.mjs \
  --dry-run \
  --output /tmp/fichero-fuengirola-report.json
```

El informe contiene solo IDs, slugs, nombres y señales redactadas. No registra CIF, email ni teléfono completos. Si faltan credenciales, termina sin cambios y deja `configuration_missing` en `invalid`.

Para ensayar con una exportación controlada puede añadirse `--input dataset.json`. El fichero debe contener `canonicalProfiles`, `vivirBusinesses` y `conoceBusinesses`.

## Aplicación explícita

No ejecutar hasta que una persona haya revisado el informe. El modo de escritura exige simultáneamente `--apply` y `--decisions`:

```bash
node scripts/reconcile-fuengirola-directory.mjs \
  --apply \
  --decisions decisiones.json \
  --output /tmp/fichero-fuengirola-aplicado.json
```

Formato mínimo:

```json
{
  "decisions": [
    {
      "channelKey": "vivir-fuengirola",
      "rowId": "vivir-fuengirola:academia-sol",
      "profileId": "10000000-0000-4000-8000-000000000001"
    }
  ]
}
```

Para una empresa realmente nueva, una decisión puede sustituir `profileId` por `createProfile`. La ficha se crea en estado `draft`, conserva el slug actual del canal y no se publica automáticamente.

El modo apply:

- enlaza filas deterministas y decisiones humanas;
- crea enlaces `directory_profile_channels` conservando cada slug;
- escribe `canonical_profile_id` en la proyección existente;
- no borra filas, no retira contenido y no ejecuta publicación;
- falla por completo si queda un `ambiguous` o `conflict` sin decisión.

Cada salida usa creación exclusiva: no sobrescribe un informe anterior. Utilice un nombre nuevo por ejecución y conserve el resultado como evidencia de auditoría.
