# 🚦 Análisis NoSQL de Siniestralidad Vial en EE. UU. (2016–2023)

Proyecto final del módulo **NoSQL/MongoDB** del *Diplomado en Manejo de Bases de Datos SQL y NoSQL en un Entorno de Nube* (FC–IIMAS, UNAM). El objetivo es modelar, cargar, indexar y explotar analíticamente una colección documental de accidentes de tráfico en EE. UU., aplicando el ciclo completo visto en el curso: **modelado de documentos → indexación → agregación → validación → seguridad**.

> 📌 **Dataset fuente:** [US Accidents (2016–2023)](https://www.kaggle.com/datasets/sobhanmoosavi/us-accidents), Sobhan Moosavi (Kaggle). Se trabajó con una **muestra representativa de 27,049 registros** (semilla aleatoria `seed=42`), no con el CSV completo (685 MB), para mantener el entorno del Learner Lab manejable sin sacrificar diversidad estadística de estados, condiciones climáticas y niveles de severidad.

---

## 📋 Requisitos previos

| Herramienta | Uso en el proyecto |
|---|---|
| **MongoDB Server** (probado en Community 7.0 / AWS Academy Learner Lab) | Motor de base de datos documental |
| **MongoDB Shell** (`mongosh`) | Ejecución de agregaciones e índices |
| **MongoDB Database Tools** (`mongoimport`) | Carga masiva del NDJSON |
| **Python 3** (`transformar_a_mongo.py`) | Transformación CSV → NDJSON con tipos BSON correctos |
| Archivo fuente `accidentes_mongo.jsonl` | Datos ya transformados, listos para importar |

*(Captura recomendada 📸: salida de `mongod --version` y `mongosh --version` o `mongoimport --version` confirmando el entorno del Learner Lab.)*
<img width="1678" height="359" alt="image" src="https://github.com/user-attachments/assets/3a6b8845-8b88-43f9-9c24-77ffc69044b6" />



---

## 🧱 Modelo de datos y decisiones de diseño

Antes de la carga, el CSV original (columnas planas tipo `Start_Lat`, `Start_Lng`, `Temperature(F)`, `Weather_Condition`, `Amenity`, `Crossing`, etc.) se transformó con `transformar_a_mongo.py` a un modelo documental con subdocumentos anidados. Estas fueron las decisiones clave y su justificación:

| Decisión | Por qué se hizo así |
|---|---|
| **`location` como GeoJSON Point** `{ type: "Point", coordinates: [lng, lat] }` | MongoDB exige el orden **longitud–latitud** (no lat-lng) para poder crear un índice `2dsphere` y usar operadores geoespaciales (`$geoWithin`, `$near`) más adelante. Solo se usó `Start_Lat`/`Start_Lng`, porque `End_Lat`/`End_Lng` venían nulos en la mayoría de los registros del CSV original. |
| **`start_time` / `end_time` como `ISODate` (BSON Date)**, no string | Permite usar operadores de rango, `$dateToString`, y extracción de mes/hora directamente en el pipeline (preguntas 2 y 3), en vez de parsear texto en cada consulta. |
| **`severity` forzado a entero explícito** | mongosh inserta literales numéricos como BSON `double` por defecto. Un validador `$jsonSchema` con `bsonType: "int"` rechazaría documentos válidos si no se fuerza el tipo en la transformación (mismo problema detectado en retos anteriores del curso). |
| **Subdocumentos `address`, `weather`, `road_features`** en vez de campos planos | Agrupan atributos que siempre se consultan juntos (1:1 con el accidente). Al no requerir `$lookup` —porque no hay relación con otra colección—, el *embedding* es preferible sobre la referencia: reduce joins y refleja el patrón de "datos que cambian y se leen juntos". |
| **`road_features` como banderas booleanas agrupadas** (`amenity`, `crossing`, `junction`, `traffic_signal`) | Más legible para el validador y las consultas que columnas sueltas tipo `Amenity`, `Crossing`, etc. del CSV original. |
| **`description` como texto libre** | Es el único campo candidato natural para un índice `text` y minería textual (pregunta 5). |
| **Exclusión de un registro con latitud inválida (95)** | Una coordenada fuera del rango [-90, 90] impide crear el índice `2dsphere` sobre toda la colección; se excluyó antes de la carga en vez de "limpiar" silenciosamente en el pipeline. |

*(Captura recomendada 📸: un documento de ejemplo con `db.accidentes.findOne()` mostrando la estructura anidada ya cargada.)*

---

## 🚀 Orden de ejecución y reproducción

Sigue estos pasos en tu terminal para reproducir el entorno y los resultados desde cero.

### 1. Importación de los datos

Este comando importa los 27,049 registros a la colección `accidentes` dentro de la base `proyecto_accidentes_db`:

```bash
mongoimport --uri "mongodb://127.0.0.1:27017/proyecto_accidentes_db?directConnection=true" \
  --collection accidentes \
  --file proyecto_final/accidentes_mongo.jsonl
```

*(Captura recomendada 📸: salida de la terminal mostrando `imported 27049 documents`.)*

### 2. Creación de índices

Se crean dos índices con propósitos distintos y complementarios:

```javascript
mongosh "mongodb://127.0.0.1:27017/proyecto_accidentes_db?directConnection=true" --quiet --eval '
db.accidentes.createIndex({ "weather.condition": 1, severity: -1 });
db.accidentes.createIndex({ description: "text" });
print("Índices creados correctamente.");
'
```

- **`{ "weather.condition": 1, severity: -1 }`** — índice compuesto siguiendo la **regla ESR** (Equality → Sort → Range): `weather.condition` filtra por igualdad y `severity` ordena/filtra por rango. Este es el índice que sostiene la Pregunta 4.
- **`{ description: "text" }`** — único tipo de índice que permite tokenizar y buscar lenguaje natural con `$text`, necesario para la Pregunta 5. No sustituye a un índice regular: no soporta ordenamiento por otros campos ni igualdad eficiente por sí solo.

Adicionalmente, se crea un índice **`2dsphere`** sobre `location`, indispensable para que la Pregunta 1 (y cualquier consulta geoespacial futura con `$geoWithin`/`$near`) no dependa de un `COLLSCAN` filtrando manualmente por coordenadas:

```javascript
// Índice espacial sobre el subdocumento location (formato GeoJSON)
db.accidentes.createIndex({ location: "2dsphere" });
```

> Este índice solo puede crearse porque durante la transformación se excluyó el registro con latitud inválida (95°); un `2dsphere` falla si existe algún documento con coordenadas fuera de rango.

*(Captura recomendada 📸: `db.accidentes.getIndexes()` mostrando los cuatro índices activos: `_id`, `weather.condition + severity`, `description` (text) y `location` (2dsphere).)*

### Validación de esquema (`$jsonSchema`)

Una vez cargados los datos, se añade un validador a la colección existente con `collMod` — se aplica **después** de la carga porque el dataset transformado ya cumple las reglas; así se evita rechazar accidentalmente el import masivo y en cambio se usa el validador como una barrera para inserciones/actualizaciones futuras:

```javascript
db.runCommand({
  collMod: "accidentes",
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["severity", "start_time", "location"],
      properties: {
        severity: {
          bsonType: "int",
          minimum: 1,
          maximum: 4,
          description: "La severidad debe ser un entero entre 1 y 4 y es requerida."
        },
        start_time: {
          bsonType: "date",
          description: "Debe ser una fecha nativa BSON Date (ISODate) y es requerida."
        },
        location: {
          bsonType: "object",
          description: "Debe ser un subdocumento (GeoJSON) y es requerido."
        }
      }
    }
  },
  validationLevel: "strict",
  validationAction: "error"
});
```

- **`severity` como `bsonType: "int"` con `minimum`/`maximum`** — funciona sin agregar `"double"` al tipo porque `transformar_a_mongo.py` ya fuerza el entero en la transformación (a diferencia de escribir literales directo en `mongosh`, donde sí haría falta el ajuste visto en retos anteriores).
- **`validationLevel: "strict"`** — aplica la regla a *todos* los documentos, incluidos los ya existentes al momento de futuras actualizaciones; es la opción más estricta frente a `"moderate"` (que solo valida documentos que ya cumplían o son nuevos).
- **`validationAction: "error"`** — rechaza la escritura inválida en vez de solo registrarla (`"warn"`), coherente con que este es un validador de producción, no de diagnóstico.

*(Captura recomendada 📸: un `insertOne` con `severity: 5` o `severity: "alta"` siendo rechazado por el validador — evidencia de caso inválido — y un `insertOne` válido siendo aceptado.)*

---

## 📊 Preguntas de investigación

Cada pipeline responde una pregunta analítica definida al inicio del proyecto. El script Python resuelve la *transformación estructural*; los pipelines son donde se demuestra el razonamiento analítico exigido por la rúbrica.

### Pregunta 1 — Zonas y condados de mayor riesgo (geoespacial/descriptivo)

Agrupa por estado y condado, sumando accidentes y promediando severidad, para identificar las zonas de mayor concentración de siniestros.

```javascript
mongosh "mongodb://127.0.0.1:27017/proyecto_accidentes_db?directConnection=true" --quiet --eval '
var p1 = db.accidentes.aggregate([
  {
    $group: {
      _id: { estado: "$address.state", condado: "$address.county" },
      totalAccidentes: { $sum: 1 },
      severidadMedia: { $avg: "$severity" }
    }
  },
  {
    $project: {
      estado: "$_id.estado",
      condado: "$_id.condado",
      totalAccidentes: 1,
      severidadPromedio: { $round: ["$severidadMedia", 2] },
      _id: 0
    }
  },
  { $sort: { totalAccidentes: -1 } },
  { $limit: 10 }
]).toArray();

print("--- TOP 10 CONDADOS CON MÁS ACCIDENTES ---");
printjson(p1);
'
```

*(Captura recomendada 📸: salida `printjson(p1)` con las 10 filas.)*

### Pregunta 2 — Estacionalidad (meses críticos)

Extrae el mes de `start_time` con `$dateToString` en zona horaria **UTC** —para evitar sesgos por husos horarios mezclados de distintos estados— y calcula frecuencia y rango de severidad por mes.

```javascript
mongosh "mongodb://127.0.0.1:27017/proyecto_accidentes_db?directConnection=true" --quiet --eval '
var p2 = db.accidentes.aggregate([
  {
    $group: {
      _id: { $dateToString: { format: "%m", date: "$start_time", timezone: "UTC" } },
      totalAccidentes: { $sum: 1 },
      severidadMedia: { $avg: "$severity" },
      severidadMinima: { $min: "$severity" },
      severidadMaxima: { $max: "$severity" }
    }
  },
  {
    $project: {
      mes: "$_id",
      totalAccidentes: 1,
      severidadPromedio: { $round: ["$severidadMedia", 2] },
      severidadMinima: 1,
      severidadMaxima: 1,
      _id: 0
    }
  },
  { $sort: { totalAccidentes: -1 } },
  { $limit: 10 }
]).toArray();

print("--- TOP 10 MESES CON MÁS ACCIDENTES ---");
printjson(p2);
'
```

*(Captura recomendada 📸: salida `printjson(p2)`.)*

### Pregunta 3 — Horarios y condiciones de luz

Cruza la hora exacta (extraída en UTC, igual criterio que la pregunta 2 para consistencia) con `sunrise_sunset`, para identificar si el riesgo se concentra en horarios nocturnos o de baja visibilidad.

```javascript
mongosh "mongodb://127.0.0.1:27017/proyecto_accidentes_db?directConnection=true" --quiet --eval '
var p3 = db.accidentes.aggregate([
  {
    $project: {
      horaUTC: { $dateToString: { format: "%H", date: "$start_time", timezone: "UTC" } },
      sunrise_sunset: 1,
      severity: 1
    }
  },
  {
    $group: {
      _id: { hora: "$horaUTC", periodoLuz: "$sunrise_sunset" },
      totalAccidentes: { $sum: 1 },
      severidadMedia: { $avg: "$severity" }
    }
  },
  {
    $project: {
      hora: "$_id.hora",
      periodoLuz: "$_id.periodoLuz",
      totalAccidentes: 1,
      severidadPromedio: { $round: ["$severidadMedia", 2] },
      _id: 0
    }
  },
  { $sort: { totalAccidentes: -1 } },
  { $limit: 10 }
]).toArray();

print("--- TOP 10 HORARIOS Y LUZ CON MÁS ACCIDENTES ---");
printjson(p3);
'
```

*(Captura recomendada 📸: salida `printjson(p3)`.)*

### Pregunta 4 — Impacto climático y rendimiento (`explain`)

Valida que el índice compuesto `{ "weather.condition": 1, severity: -1 }` efectivamente se use al filtrar por clima y severidad. `.explain("executionStats")` es la evidencia formal de que la consulta pasó de un **`COLLSCAN`** (revisar los 27,049 documentos uno por uno) a un **`IXSCAN`** (usar el índice para llegar directo a los candidatos).

```javascript
mongosh "mongodb://127.0.0.1:27017/proyecto_accidentes_db?directConnection=true" --quiet --eval '
var p4_optimizado = db.accidentes.find({
  "weather.condition": "Rain",
  severity: { $gte: 3 }
}).explain("executionStats");

print("--- RENDIMIENTO OPTIMIZADO CON ÍNDICE (IXSCAN) ---");
printjson({
  "etapa_raiz": p4_optimizado.executionStats.executionStages.stage,
  "etapa_busqueda": p4_optimizado.executionStats.executionStages.inputStage.stage,
  "tiempo_ejecucion_ms": p4_optimizado.executionStats.executionTimeMillis,
  "documentos_examinados": p4_optimizado.executionStats.totalDocsExamined,
  "documentos_devueltos": p4_optimizado.executionStats.nReturned
});
'
```

> 💡 **Recomendación de rúbrica:** para que el `explain` sea evidencia comparativa completa, corre también la misma consulta **antes** de crear el índice (o con `hint({ $natural: 1 })`) y documenta el `COLLSCAN` con su `totalDocsExamined` y `executionTimeMillis`. Mostrar el "antes vs. después" lado a lado es lo que demuestra la optimización, no solo el resultado final.

*(Captura recomendada 📸: dos salidas lado a lado — `COLLSCAN` sin índice vs. `IXSCAN` con índice — idealmente con el explain visualizado en Compass si lo tienes disponible.)*

### Pregunta 5 — Afectaciones críticas (búsqueda textual)

Usa el índice `text` sobre `description` para localizar accidentes de alta severidad (`severity >= 3`) cuya descripción menciona cierres de vialidad, y ordena por relevancia textual con `$meta: "textScore"` — no es lo mismo que ordenar por severidad: aquí el orden refleja qué tan bien coincide el texto con los términos buscados.

```javascript
mongosh "mongodb://127.0.0.1:27017/proyecto_accidentes_db?directConnection=true" --quiet --eval '
var p5 = db.accidentes.aggregate([
  {
    $match: {
      $text: { $search: "blocked lane ramp closed" },
      severity: { $gte: 3 }
    }
  },
  {
    $project: {
      estado: "$address.state",
      severidad: "$severity",
      descripcion: "$description",
      relevancia: { $meta: "textScore" },
      _id: 0
    }
  },
  { $sort: { relevancia: -1 } },
  { $limit: 10 }
]).toArray();

print("--- TOP 10 INCIDENTES CRÍTICOS POR RELEVANCIA DE TEXTO ---");
printjson(p5);
'
```

*(Captura recomendada 📸: salida `printjson(p5)` mostrando la columna `relevancia` ordenada de mayor a menor.)*

---

## 🔐 Seguridad, privacidad y control de acceso

El dataset **no contiene identificadores personales directos** (no hay nombres de conductores, placas, ni contactos), por lo que el enfoque de seguridad no es "anonimización de personas", sino **clasificación de datos y control de acceso por rol**, tal como se plantea en la Nota 08 del curso.

### Clasificación de campos

| Campo | Clasificación | Justificación |
|---|---|---|
| `address.state`, `address.county`, `weather.*`, `severity`, mes/hora derivados | Público | No identifican ubicación exacta ni personas |
| `location` (coordenadas exactas), `address.street` | Interno / cuasi-identificador | Coordenadas exactas + hora precisa podrían usarse para reconstruir el punto exacto de un evento en la vía pública |
| `description` (texto libre) | Interno | Generado por sistema, pero podría contener referencias a lugares específicos que reducen el nivel de agregación |

### Modelo de tres roles

| Rol | Acceso | Recurso |
|---|---|---|
| `admin_riesgo` | Lectura/escritura completa, gestión de índices y validación | Colección `accidentes` completa |
| `analista` | Lectura completa, incluyendo `location` exacta y `description`, para construir los pipelines de las 5 preguntas | Colección `accidentes` completa |
| `consulta_publica` | Solo lectura de campos generalizados (sin coordenadas exactas ni `address.street`) | **Vista del lado del servidor**, no la colección fuente |

**Por qué una vista y no una proyección en el cliente:** una vista (`db.createView`) aplica el filtro de campos en el servidor de MongoDB, de modo que el rol de solo consulta **no puede** pedir campos adicionales manipulando la consulta desde el cliente — solo ve lo que la vista expone. Una proyección hecha en el código de la aplicación es un control más débil porque depende de que el cliente "se porte bien".

### Implementación: rol, usuario y vista

**1. Rol personalizado de solo lectura (privilegio mínimo: `find` + `aggregate`, nada de escritura ni administración):**

```javascript
db.createRole({
  role: "RolAnalistaLectura",
  privileges: [
    {
      resource: { db: "proyecto_accidentes_db", collection: "accidentes" },
      actions: ["find", "aggregate"]
    }
  ],
  roles: []
});
```

`actions` se limita a `find` y `aggregate` — el rol puede correr exactamente los pipelines de las 5 preguntas de investigación, pero no puede modificar documentos (`update`/`insert`/`remove`), ni tocar índices o el validador. Esto es lo que corresponde al rol `analista` de la matriz de clasificación.

**2. Usuario asociado al rol:**

```javascript
db.createUser({
  user: "analista_vial",
  pwd: "PasswordSeguro2026", // En producción esto se inyecta por variables de entorno
  roles: [ { role: "RolAnalistaLectura", db: "proyecto_accidentes_db" } ]
});
```

> ⚠️ La contraseña en texto plano es válida únicamente para fines didácticos dentro del Learner Lab. En un entorno real se inyectaría vía variables de entorno o un gestor de secretos, y nunca se dejaría commiteada en el repositorio — vale la pena mencionar esto explícitamente en la entrega como evidencia de que el límite se entendió, no solo se ignoró.

**3. Vista segura para el rol de consulta pública/restringida:**

```javascript
db.createView(
  "vista_accidentes_segura",
  "accidentes",
  [
    {
      $project: {
        _id: 0,
        severity: 1,
        start_time: 1,
        "address.state": 1,
        "weather.condition": 1,
        description: 1
      }
    }
  ]
);
```

Esta vista expone severidad, fecha, estado y clima — suficiente para análisis agregado — pero omite `location` (coordenadas exactas) y `address.street`, que son los campos clasificados como cuasi-identificadores en la tabla anterior.

**4. Rol y usuario `admin_riesgo` (control total sobre la colección fuente):**

```javascript
db.createRole({
  role: "RolAdminRiesgo",
  privileges: [
    {
      resource: { db: "proyecto_accidentes_db", collection: "accidentes" },
      actions: ["find", "insert", "update", "remove", "aggregate"]
    }
  ],
  roles: []
});

db.createUser({
  user: "admin_riesgo",
  pwd: "PasswordAdminRiesgo2026",
  roles: [ { role: "RolAdminRiesgo", db: "proyecto_accidentes_db" } ]
});
```

A diferencia de `RolAnalistaLectura`, aquí sí se incluyen `insert`, `update` y `remove` porque este rol representa a quien mantiene la colección (carga inicial, correcciones, futuras cargas incrementales) — es el único de los tres con permiso de escritura, coherente con que la matriz de privilegio mínimo solo le da esa capacidad al perfil de administración, no al de análisis.

**5. Rol y usuario `consulta_publica` (restringido a la vista, no a la colección fuente):**

```javascript
db.createRole({
  role: "RolConsultaPublica",
  privileges: [
    {
      resource: { db: "proyecto_accidentes_db", collection: "vista_accidentes_segura" },
      actions: ["find", "aggregate"]
    }
  ],
  roles: []
});

db.createUser({
  user: "consulta_publica",
  pwd: "PasswordPublico2026",
  roles: [ { role: "RolConsultaPublica", db: "proyecto_accidentes_db" } ]
});
```

El `resource` de este rol apunta explícitamente a `vista_accidentes_segura`, **no** a `accidentes`. Esto es lo que materializa el control de acceso a nivel de campo: aunque `consulta_publica` sepa que existe la colección `accidentes`, MongoDB rechaza cualquier `find`/`aggregate` directo sobre ella porque el rol nunca recibió privilegios sobre ese recurso — la vista es la única puerta de entrada disponible.

> ⚠️ Las tres contraseñas (`analista_vial`, `admin_riesgo`, `consulta_publica`) están en texto plano únicamente por ser un entorno didáctico del Learner Lab. Vale la pena declarar explícitamente en la entrega que en producción se inyectarían por variables de entorno o un gestor de secretos, y jamás quedarían commiteadas en el repo.

*(Captura recomendada 📸: `show roles` y `show users` confirmando los tres roles/usuarios; y un intento de `db.accidentes.find()` autenticado como `consulta_publica`, mostrando el error `not authorized`, contrastado con el mismo `find()` funcionando correctamente sobre `vista_accidentes_segura`.)*

---

## 📁 Estructura sugerida del repositorio

```
proyecto_final/
├── README.md
├── accidentes_mongo.jsonl        # Datos ya transformados, listos para mongoimport
├── transformar_a_mongo.py        # CSV -> NDJSON (GeoJSON, ISODate, subdocumentos)
├── consultas/
│   ├── p1_zonas_riesgo.js
│   ├── p2_estacionalidad.js
│   ├── p3_horarios_luz.js
│   ├── p4_explain_climatico.js
│   └── p5_busqueda_textual.js
├── seguridad/
│   ├── roles_y_usuarios.js
│   └── vista_publica.js
└── capturas/
    ├── 01_mongoimport.png
    ├── 02_indices.png
    ├── 03_pregunta1.png
    ├── 04_pregunta2.png
    ├── 05_pregunta3.png
    ├── 06_explain_antes_despues.png
    ├── 07_pregunta5.png
    └── 08_roles_seguridad.png
```

> Esta estructura es una sugerencia basada en cómo está organizado el contenido de este README; ajústala al árbol de carpetas que ya tengas en tu repo real.

---

## ⚠️ Límites y alcance declarado

- La muestra de 27,049 registros es representativa, no exhaustiva; los porcentajes y rankings no deben interpretarse como cifras oficiales de siniestralidad en EE. UU.
- Un registro con latitud inválida (95°) fue excluido antes de la carga.
- El modelo de seguridad es un diseño didáctico con datos sintéticos/reales pero sin PII directa; no debe tomarse como una implementación de cumplimiento normativo real.
- Las consultas usan `timezone: "UTC"` de forma consistente; no se ajustó por zona horaria local de cada estado, lo cual podría desplazar ligeramente los resultados de las preguntas 2 y 3.

---

## 🙋 Qué me falta para completar este README al 100%

Ya integré el índice `2dsphere`, el validador `$jsonSchema`, y los tres roles completos (`admin_riesgo`, `analista_vial`, `consulta_publica`) con sus usuarios y la vista de seguridad. Para cerrar el README sin huecos, solo faltaría:

1. Resultados reales de al menos una consulta (para reemplazar los placeholders de captura con datos concretos, si quieres que el README los incluya en texto además de imagen).
2. Nombre real de la carpeta/repo si difiere de `proyecto_final/`.
