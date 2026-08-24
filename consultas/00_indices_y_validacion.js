// 00_indices_y_validacion.js
// Índices y validación de esquema de la colección "accidentes"
//
// Se ejecuta DESPUÉS del mongoimport: los índices se construyen sobre
// datos ya cargados, y el validador con collMod se aplica sobre la
// colección existente (no bloquea el import masivo inicial).

// 1. Índice compuesto para la Pregunta 4
db.accidentes.createIndex({ "weather.condition": 1, severity: -1 });

// 2. Índice de texto sobre "description" para la Pregunta 5
db.accidentes.createIndex({ description: "text" });

// 3. Índice geoespacial 2dsphere sobre "location" para la Pregunta 1
//    y cualquier consulta futura con $geoWithin / $near.
//    Requiere que todas las coordenadas sean válidas (lat entre -90 y 90);
//    por eso se excluyó antes de la carga el registro con latitud 95.
db.accidentes.createIndex({ location: "2dsphere" });

print("Índices creados correctamente.");

// 4. Validador de esquema con $jsonSchema (aplicado con collMod porque
//    la colección ya tiene datos cargados que cumplen las reglas).
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

print("Validador de esquema aplicado correctamente.");
