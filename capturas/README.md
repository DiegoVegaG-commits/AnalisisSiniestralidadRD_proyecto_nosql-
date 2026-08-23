# Capturas pendientes

Esta carpeta no puede generarse automáticamente porque son evidencias reales de tu Learner Lab. Agrega aquí, con estos nombres exactos (ya referenciados en el README principal), la captura de:

| Archivo | Qué debe mostrar |
|---|---|
| `01_mongoimport.png` | Salida de `mongoimport` con `imported 27049 documents` |
| `02_indices.png` | `db.accidentes.getIndexes()` con los 4 índices activos (`_id`, compuesto, text, 2dsphere) |
| `03_pregunta1.png` | Salida de `p1_zonas_riesgo.js` |
| `04_pregunta2.png` | Salida de `p2_estacionalidad.js` |
| `05_pregunta3.png` | Salida de `p3_horarios_luz.js` |
| `06_explain_antes_despues.png` | `explain()` con `COLLSCAN` (sin índice / `hint({$natural:1})`) vs. `IXSCAN` (con índice) lado a lado |
| `07_pregunta5.png` | Salida de `p5_busqueda_textual.js` con la columna `relevancia` ordenada |
| `08_roles_seguridad.png` | `show roles` / `show users`, y un `find()` fallido de `consulta_publica` sobre `accidentes` vs. exitoso sobre `vista_accidentes_segura` |

Borra este archivo (o déjalo como índice) una vez que subas las imágenes reales.
