// p4_explain_climatico.js
// Pregunta 4: ¿Cómo se relacionan las condiciones climáticas con la severidad?
// Además, comprueba el rendimiento del índice compuesto clima + severidad.

// A. Análisis de negocio: compara condiciones climáticas.
var impactoClimatico = db.accidentes.aggregate([
  { $match: { "weather.condition": { $type: "string", $ne: "" } } },
  {
    $group: {
      _id: "$weather.condition",
      totalAccidentes: { $sum: 1 },
      severidadMedia: { $avg: "$severity" },
      accidentesAltaSeveridad: {
        $sum: { $cond: [{ $gte: ["$severity", 3] }, 1, 0] }
      }
    }
  },
  {
    $project: {
      condicionClimatica: "$_id",
      totalAccidentes: 1,
      severidadPromedio: { $round: ["$severidadMedia", 2] },
      accidentesAltaSeveridad: 1,
      porcentajeAltaSeveridad: {
        $round: [
          { $multiply: [{ $divide: ["$accidentesAltaSeveridad", "$totalAccidentes"] }, 100] },
          2
        ]
      },
      _id: 0
    }
  },
  { $sort: { accidentesAltaSeveridad: -1, totalAccidentes: -1 } },
  { $limit: 15 }
]).toArray();

print("--- IMPACTO CLIMÁTICO: TOP 15 POR ACCIDENTES DE ALTA SEVERIDAD ---");
printjson(impactoClimatico);

// B. Evidencia reproducible de rendimiento con la misma consulta.
var filtro = {
  "weather.condition": "Rain",
  severity: { $gte: 3 }
};

// Fuerza el escaneo natural para obtener una línea base comparable aun cuando el índice ya exista.
var sinIndice = db.accidentes.find(filtro)
  .hint({ $natural: 1 })
  .explain("executionStats");

// Fuerza el índice compuesto creado en 00_indices_y_validacion.js.
var conIndice = db.accidentes.find(filtro)
  .hint("idx_clima_severidad")
  .explain("executionStats");

print("--- EXPLAIN: ANTES (COLLSCAN FORZADO) VS DESPUÉS (ÍNDICE COMPUESTO) ---");
printjson({
  sinIndice: {
    documentosExaminados: sinIndice.executionStats.totalDocsExamined,
    llavesExaminadas: sinIndice.executionStats.totalKeysExamined,
    documentosDevueltos: sinIndice.executionStats.nReturned,
    tiempoMs: sinIndice.executionStats.executionTimeMillis,
    planGanador: sinIndice.queryPlanner.winningPlan
  },
  conIndice: {
    documentosExaminados: conIndice.executionStats.totalDocsExamined,
    llavesExaminadas: conIndice.executionStats.totalKeysExamined,
    documentosDevueltos: conIndice.executionStats.nReturned,
    tiempoMs: conIndice.executionStats.executionTimeMillis,
    planGanador: conIndice.queryPlanner.winningPlan
  }
});
