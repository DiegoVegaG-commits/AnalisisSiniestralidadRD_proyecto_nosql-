// p2_estacionalidad.js
// Pregunta 2: ¿Qué meses concentran más accidentes y mayor severidad?
// Incluye la evidencia temporal solicitada por la rúbrica:
//   1) BSON Date,
//   2) consulta por intervalo [inicio, fin),
//   3) índice start_time,
//   4) pipeline por periodo y prueba con fechas conocidas.

// A. Prueba por intervalo conocido: enero de 2022.
// [inicio, fin) incluye 2022-01-01 y excluye 2022-02-01.
var inicio = ISODate("2022-01-01T00:00:00Z");
var fin = ISODate("2022-02-01T00:00:00Z");

var temporalExplain = db.accidentes.find({
  start_time: { $gte: inicio, $lt: fin }
}).hint("idx_fecha_inicio").explain("executionStats");

print("--- PRUEBA TEMPORAL [2022-01-01, 2022-02-01) ---");
printjson({
  intervalo: "[2022-01-01T00:00:00Z, 2022-02-01T00:00:00Z)",
  documentosDevueltos: temporalExplain.executionStats.nReturned,
  documentosExaminados: temporalExplain.executionStats.totalDocsExamined,
  llavesExaminadas: temporalExplain.executionStats.totalKeysExamined,
  planGanador: temporalExplain.queryPlanner.winningPlan
});

// B. Pipeline por mes.
// Las fechas del proyecto fueron almacenadas con sufijo Z y aquí se agrupan bajo esa
// representación temporal. No se reconstruyó la zona horaria local de cada accidente.
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
  { $limit: 12 }
]).toArray();

print("--- MESES ORDENADOS POR TOTAL DE ACCIDENTES ---");
printjson(p2);
