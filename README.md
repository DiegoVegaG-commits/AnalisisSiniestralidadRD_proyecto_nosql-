# Análisis de Base de Datos de Siniestralidad Vial en EE. UU. (2016–2023)

Proyecto final del módulo **6** del *Diplomado en Manejo de Bases de Datos SQL y NoSQL en un Entorno de Nube* (FC–IIMAS, UNAM).

El objetivo es modelar, cargar, indexar y explotar analíticamente una colección documental de accidentes de tráfico en EE. UU., aplicando el ciclo completo visto en el curso: **modelado de documentos → indexación → agregación → validación → análisis especializado → seguridad**.

> **Dataset fuente:** US Accidents (2016–2023), Sobhan Moosavi (Kaggle). Se trabajó con una muestra de aproximadamente **27,049 registros**, no con el CSV completo. Los resultados corresponden a esta muestra y no deben interpretarse como cifras oficiales de todos los accidentes de EE. UU.

---

## Requisitos previos

| Herramienta | Uso en el proyecto |
|---|---|
| MongoDB Server | Motor documental |
| MongoDB Shell (`mongosh`) | Consultas, agregaciones, índices y validación |
| MongoDB Database Tools (`mongoimport`) | Importación del JSONL |
| Python 3 + pandas | Transformación de CSV a JSONL |
| `accidentes_mongo.jsonl` | Datos transformados listos para importar |

La carga de referencia utilizada en el proyecto contiene **27,049 documentos**.

<img width="1680" height="327" alt="Carga en Learner Lab" src="https://github.com/user-attachments/assets/ec092be9-8785-479d-bc28-6132bee5c1ec" />

---

## Problema, personas usuarias y preguntas

Los datos de accidentes en bruto no permiten ver con claridad dónde, cuándo y bajo qué condiciones se concentra el riesgo. El proyecto está dirigido a analistas de vialidad, dependencias de tránsito y equipos de respuesta a emergencias.

Preguntas de negocio:

1. ¿Cuáles son las zonas con mayor frecuencia y severidad promedio de accidentes?
2. ¿Cuáles son los meses del año que concentran más accidentes y mayor severidad?
3. ¿En qué horarios del día y condiciones de luz ocurren más accidentes?
4. ¿Cómo se relacionan las diferentes condiciones climáticas con la severidad de los accidentes?
5. ¿Qué accidentes de alta severidad son más relevantes para términos asociados con bloqueos y cierres viales?

> La Pregunta 5 es una **búsqueda por relevancia textual**, no un conteo de frecuencia de palabras ni una búsqueda semántica/vectorial.

---

## Modelo de datos y decisiones de diseño

Antes de la carga, el CSV original se transforma con `transformar_a_mongo.py` a un modelo documental con subdocumentos anidados.

| Decisión | Justificación |
|---|---|
| `location` como GeoJSON `Point` con `[lng, lat]` | Es el formato correcto para un índice `2dsphere` y futuras consultas con `$geoWithin`/`$near`. |
| `start_time` / `end_time` como BSON Date | Permite rangos temporales y operadores como `$dateToString` sin parsear texto en cada consulta. |
| `severity` como entero | Es coherente con el validador `$jsonSchema` y con las métricas estadísticas. |
| `address`, `weather`, `road_features` embebidos | Son atributos 1:1 que se leen con el accidente; evita `$lookup` innecesarios. |
| `description` como texto libre | Permite búsqueda con índice `text` y `$text`. |
| Coordenadas inválidas excluidas antes de carga | Evita fallos al crear el índice `2dsphere`. |

### Nota sobre fechas y zona horaria

El CSV fuente no aporta una zona horaria explícita por registro en el flujo de transformación utilizado. Para mantener una representación uniforme, las fechas se guardan con sufijo `Z` y las consultas temporales se procesan en UTC. **Esto no equivale a haber convertido desde la hora local real de cada estado a UTC**, por lo que los resultados horarios deben interpretarse como resultados de la representación temporal almacenada.

---

## Orden de ejecución y reproducción

Los scripts están preparados para ejecutarse desde un estado conocido.

| # | Archivo / comando | Función |
|---|---|---|
| 1 | `transformar_a_mongo.py` | Convierte el CSV a `accidentes_mongo.jsonl`. |
| 2 | `mongoimport` | Carga la colección `accidentes`. |
| 3 | `consultas/00_indices_y_validacion.js` | Crea cuatro índices, muestra `getIndexes()`, aplica el validador y ejecuta un caso válido y uno inválido. |
| 4 | `seguridad/vista_publica.js` | Crea la vista minimizada. |
| 5 | `seguridad/roles_y_usuarios.js` | Crea roles y usuarios sin contraseñas hardcodeadas. |
| 6 | `consultas/p1_zonas_riesgo.js` a `p5_busqueda_textual.js` | Ejecuta los análisis principales. |

### 1. Transformación

Renombra el CSV de la muestra a un nombre que describa su tamaño o pasa la ruta directamente:

```bash
python transformar_a_mongo.py us_accidents_sample_27049.csv
```

El script informa cuántas filas leyó, cuántos documentos escribió y cuántos omitió por coordenadas inválidas.

### 2. Importación

Desde la raíz del repositorio:

```bash
mongoimport --uri "mongodb://127.0.0.1:27017/proyecto_accidentes_db?directConnection=true" \
  --collection accidentes \
  --file accidentes_mongo.jsonl
```

### 3. Índices, `getIndexes()` y validación

```bash
./.tools/bin/mongosh \
  "mongodb://127.0.0.1:27017/proyecto_accidentes_db?directConnection=true" \
  consultas/00_indices_y_validacion.js
```

Se crean los siguientes índices:

```javascript
{ "weather.condition": 1, severity: -1 } // idx_clima_severidad
{ description: "text" }                 // idx_description_text
{ location: "2dsphere" }                // idx_location_2dsphere
{ start_time: 1 }                        // idx_start_time
```

- El compuesto clima + severidad se usa en la Pregunta 4.
- El índice `text` es requerido por `$text` en la Pregunta 5.
- El índice temporal corresponde a consultas de intervalo sobre `start_time`.
- El índice `2dsphere` queda disponible para análisis geoespaciales futuros; **la Pregunta 1 actual no lo usa**, porque agrupa por estado y condado.

El mismo script ejecuta:

```javascript
printjson(db.accidentes.getIndexes());
```

para demostrar qué índices existen realmente.

### 4. Validación de esquema

El validador exige:

- `severity`: BSON `int`, de 1 a 4.
- `start_time`: BSON `date`.
- `location`: objeto GeoJSON `Point` con `coordinates`.

Además, el script ejecuta dos pruebas reproducibles:

- **Caso válido:** documento temporal con `NumberInt(3)`, `ISODate(...)` y GeoJSON válido. Debe ser aceptado.
- **Caso inválido:** `severity: "Alta"` y fecha como texto. Debe ser rechazado por `Document failed validation` / código 121.

Los documentos de prueba se eliminan para no contaminar la muestra.

> Reemplazar la evidencia visual anterior por una captura nueva donde se vea: `getIndexes()`, el caso válido aceptado y el caso inválido rechazado.

---

## Pregunta 1 — Zonas con mayor frecuencia y severidad promedio

`consultas/p1_zonas_riesgo.js` agrupa por `address.state` y `address.county`, cuenta accidentes y calcula severidad promedio.

Este análisis es **geográfico/descriptivo**, no geoespacial: no utiliza `location`, `$near`, `$geoNear`, `$geoWithin` ni `2dsphere`.

<img width="867" height="819" alt="Pregunta 1" src="https://github.com/user-attachments/assets/268ede95-52ee-491e-a54d-07afdcb655e1" />

---

## Pregunta 2 — Estacionalidad y prueba temporal por intervalo

`consultas/p2_estacionalidad.js` contiene dos partes.

### A. Intervalo temporal conocido `[inicio, fin)`

```javascript
start_time: {
  $gte: ISODate("2022-01-01T00:00:00Z"),
  $lt: ISODate("2022-02-01T00:00:00Z")
}
```

El intervalo incluye el inicio de enero y excluye el inicio de febrero. La consulta usa `idx_start_time` y muestra `explain("executionStats")` para documentar documentos, llaves examinadas y plan ganador.

### B. Pipeline mensual

Agrupa por mes con `$dateToString` y calcula total, severidad media, mínima y máxima. El resultado permite identificar los periodos con mayor volumen en la muestra.

> La interpretación horaria/temporal se refiere a la representación UTC almacenada y no a una reconstrucción de la hora local original de cada accidente.

---

## Pregunta 3 — Horarios y condiciones de luz

`consultas/p3_horarios_luz.js` cruza la hora derivada de `start_time` con `sunrise_sunset` y calcula volumen y severidad promedio.

La consulta permite identificar concentraciones temporales, pero se declara como limitación que no se reconstruyó la zona horaria local de cada estado.

---

## Pregunta 4 — Impacto climático + rendimiento

`consultas/p4_explain_climatico.js` responde primero la pregunta de negocio y después demuestra rendimiento.

### A. Comparación de condiciones climáticas

Agrupa por `weather.condition` y calcula:

- total de accidentes;
- severidad promedio;
- accidentes con severidad `>= 3`;
- porcentaje de alta severidad.

Así la pregunta ya no se limita a una sola condición (`Rain`) y sí compara el comportamiento entre climas.

### B. `COLLSCAN` vs `IXSCAN`

La misma consulta:

```javascript
{ "weather.condition": "Rain", severity: { $gte: 3 } }
```

se ejecuta de dos formas:

1. `hint({ $natural: 1 })` para forzar una línea base por escaneo natural.
2. `hint("idx_clima_severidad")` para usar el índice compuesto.

El resultado muestra el plan ganador, documentos examinados, llaves examinadas, documentos devueltos y tiempo de ejecución.

> En lugar de afirmar “100 % de eficiencia”, se reportan los valores medidos. En la ejecución anterior se observaron 27,049 documentos examinados sin índice frente a 73 documentos examinados para 73 resultados con el índice; estos valores deberán volver a confirmarse al reejecutar.

<img width="1680" height="466" alt="Explain anterior" src="https://github.com/user-attachments/assets/4e294b67-f6a5-4824-b9c5-4ca875cf5c9b" />

---

## Pregunta 5 — Afectaciones críticas por relevancia textual

`consultas/p5_busqueda_textual.js` busca:

```javascript
$text: { $search: "blocked lane ramp closed" }
```

junto con `severity >= 3`, proyecta `$meta: "textScore"` y ordena por **relevancia textual**.

La búsqueda no exige la frase completa ni calcula la frecuencia global de cada palabra. Tampoco es una búsqueda semántica/vectorial.

¿Por qué no `$regex`? Para esta necesidad de lenguaje libre se prefirió `$text`, que trabaja sobre un índice de texto. Un `$regex` no anclado puede obligar a revisar una gran parte de la colección y no resuelve la misma necesidad de ranking por `textScore`.

<img width="1175" height="739" alt="Pregunta 5" src="https://github.com/user-attachments/assets/c9adf7f1-1ba6-49f1-9693-cf05a3b3623e" />

---

## Componente geoespacial descartado como análisis principal

El modelo conserva `location` como GeoJSON y un índice `2dsphere`, pero no se forzó una consulta geoespacial solo para “usar” la técnica. El proyecto prioriza el análisis temporal y textual porque responden mejor a las preguntas elegidas.

Las agrupaciones por estado/condado son geográficas por atributo. Un análisis con `$geoIntersects`, `$near` o `$geoWithin` sería una extensión futura.

---

## Seguridad, privacidad y control de acceso

### Clasificación

| Campo | Nivel | Justificación |
|---|---|---|
| `address.state`, `address.county`, `weather.*`, `severity` | Público | Información agregable que no revela por sí sola un punto exacto. |
| `location`, `address.street` | Interno / cuasi-identificador | Puede ubicar con precisión el lugar del evento. |
| `description` | Interno | Texto libre que puede contener referencias muy específicas. |

### Minimización

La vista `vista_accidentes_segura` omite `location` y `address.street` y solo expone los campos requeridos para consulta general.

### Matriz de roles

| Rol | Acciones | Recurso |
|---|---|---|
| `RolAdminRiesgo` / `admin_riesgo` | `find`, `insert`, `update`, `remove` | `accidentes` |
| `RolAnalistaLectura` / `analista_vial` | `find` | `accidentes` |
| `RolConsultaPublica` / `consulta_publica` | `find` | `vista_accidentes_segura` |

`RolAdminRiesgo` administra **documentos**, no se afirma que tenga permisos de gestión de índices/validadores porque esas acciones no forman parte de su privilegio definido.

### Credenciales

**No hay contraseñas, llaves ni cadenas de conexión con secretos dentro de los scripts.** `roles_y_usuarios.js` utiliza:

```javascript
pwd: passwordPrompt()
```

para que mongosh solicite cada contraseña durante la ejecución.

> Las contraseñas que alguna vez estuvieron versionadas deben considerarse expuestas y no deben reutilizarse.

### Limitación del Learner Lab

En las capturas anteriores el servidor mostró el aviso de que **el control de acceso no estaba habilitado**. En ese contexto:

- la matriz de roles y los usuarios demuestran un **diseño de privilegio mínimo**;
- la vista demuestra **minimización de campos**;
- **no debe afirmarse que se comprobó una denegación real de acceso** a la colección fuente.

Con autenticación/control de acceso habilitado, `RolConsultaPublica` puede restringirse a la vista segura conforme al diseño.

> La nueva captura de seguridad debe evitar mostrar contraseñas y debe conservar visible el aviso del entorno si la autenticación continúa deshabilitada; el reporte lo explicará como limitación comprobada.

---

## Resultados, límites y mejora

### Resultados interpretados

En la muestra analizada se observaron concentraciones relevantes por periodo, hora y condición vial. La indexación redujo de forma importante los documentos examinados en la consulta climática evaluada. Los valores exactos deberán citarse a partir de la nueva ejecución.

### Límites

- La base utiliza una muestra estática de aproximadamente 27,049 registros.
- Los resultados son descriptivos, no una predicción en tiempo real.
- La representación temporal UTC usada en el proyecto no reconstruye la zona horaria local original por estado.
- El índice geoespacial está preparado, pero las cinco preguntas actuales no ejecutan un operador geoespacial especializado.
- En el Learner Lab usado para las capturas, el control de acceso podía estar deshabilitado; por tanto, los roles representan un diseño de seguridad y no una denegación efectiva comprobada mientras esa condición se mantenga.

### Mejora propuesta

Migrar la ingesta a colecciones **Time Series** de MongoDB, conservar o incorporar la zona horaria de origen de cada evento e integrar la base con una herramienta de BI para monitoreo dinámico.

---

## Evidencias que deben actualizarse al reejecutar

Para la entrega final se recomienda conservar **cinco capturas**, todas legibles y recortadas al área relevante:

1. **Consulta principal:** salida de `p1_zonas_riesgo.js`.
2. **Índices + validación:** `getIndexes()` mostrando los cuatro índices y las dos pruebas del validador.
3. **Temporal:** intervalo `[2022-01-01, 2022-02-01)` con `idx_start_time` y resultado mensual.
4. **Especializado textual:** salida de `p5_busqueda_textual.js` con `textScore`.
5. **Seguridad:** creación de vista/roles sin contraseñas; aclarar si el control de acceso está deshabilitado.

El `COLLSCAN` vs `IXSCAN` puede integrarse en la captura 2 o 3 si se requiere mantener el máximo de cinco capturas.
