// 00_indices_y_validacion.js
// Índices, comprobación de índices y validación de esquema de "accidentes".
// Ejecutar DESPUÉS de mongoimport y antes de las consultas analíticas.

// 1) Índice compuesto para la Pregunta 4: igualdad por clima + rango por severidad.
db.accidentes.createIndex(
  { "weather.condition": 1, severity: -1 },
  { name: "idx_clima_severidad" }
);

// 2) Índice de texto requerido por $text en la Pregunta 5.
db.accidentes.createIndex(
  { description: "text" },
  { name: "idx_description_text" }
);

// 3) Índice geoespacial. El proyecto conserva GeoJSON para consultas espaciales futuras;
//    las preguntas actuales agrupan geográficamente por estado/condado y no usan 2dsphere.
db.accidentes.createIndex(
  { location: "2dsphere" },
  { name: "idx_location_2dsphere" }
);

// 4) Índice temporal acorde con las consultas de intervalo [inicio, fin).
db.accidentes.createIndex(
  { start_time: 1 },
  { name: "idx_start_time" }
);

print("\n--- ÍNDICES DISPONIBLES (getIndexes) ---");
printjson(db.accidentes.getIndexes());

// 5) Validador de esquema con $jsonSchema.
var resultadoValidador = db.runCommand({
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
          description: "Debe ser una fecha nativa BSON Date y es requerida."
        },
        location: {
          bsonType: "object",
          required: ["type", "coordinates"],
          properties: {
            type: { enum: ["Point"] },
            coordinates: {
              bsonType: "array",
              minItems: 2,
              maxItems: 2
            }
          },
          description: "Debe ser un GeoJSON Point con arreglo [longitud, latitud]."
        }
      }
    }
  },
  validationLevel: "strict",
  validationAction: "error"
});
print("\n--- VALIDADOR APLICADO ---");
printjson(resultadoValidador);

// 6) Pruebas reproducibles del validador.
// Se usan _id temporales y se eliminan al terminar para no alterar el dataset.
print("\n--- PRUEBA DE VALIDACIÓN: CASO VÁLIDO ---");
var idValido = "__prueba_validador_valida__";
db.accidentes.deleteOne({ _id: idValido });
try {
  db.accidentes.insertOne({
    _id: idValido,
    severity: NumberInt(3),
    start_time: ISODate("2022-04-15T08:30:00Z"),
    location: { type: "Point", coordinates: [-99.1332, 19.4326] },
    description: "Documento temporal para probar el validador."
  });
  print("OK: el documento válido fue aceptado.");
} catch (e) {
  print("ERROR inesperado en el caso válido:");
  printjson(e);
} finally {
  db.accidentes.deleteOne({ _id: idValido });
}

print("\n--- PRUEBA DE VALIDACIÓN: CASO INVÁLIDO ---");
var idInvalido = "__prueba_validador_invalida__";
db.accidentes.deleteOne({ _id: idInvalido });
try {
  db.accidentes.insertOne({
    _id: idInvalido,
    severity: "Alta",
    start_time: "15-04-2022",
    location: { type: "Point", coordinates: [-99.1332, 19.4326] }
  });
  print("ERROR: el documento inválido fue aceptado y no debía serlo.");
  db.accidentes.deleteOne({ _id: idInvalido });
} catch (e) {
  print("OK: el documento inválido fue rechazado por el validador.");
  print("Código esperado de validación: " + (e.code || "ver detalle del error"));
}

print("\nConfiguración de índices y validación terminada.");
