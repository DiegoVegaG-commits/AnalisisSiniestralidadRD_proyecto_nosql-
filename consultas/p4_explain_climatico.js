// p4_explain_climatico.js
// Pregunta 4: Impacto climático y rendimiento (explain)
//
// Valida la eficiencia del indice compuesto { "weather.condition": 1,
// severity: -1 } (regla ESR: Equality -> Sort/Range). El uso de
// .explain("executionStats") demuestra la optimizacion de lectura,
// pasando de un escaneo total (COLLSCAN) a un escaneo por indice (IXSCAN).
//
// Recomendacion: correr primero esta misma consulta con
// .hint({ $natural: 1 }) ANTES de crear el indice, para documentar el
// COLLSCAN "antes" y comparar contra el IXSCAN "despues".

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
