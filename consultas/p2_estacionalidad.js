// p2_estacionalidad.js
// Pregunta 2: Estacionalidad (meses críticos)
//
// Extrae el mes del campo start_time (BSON Date nativo) ajustado a
// zona horaria UTC, para analizar la temporalidad anual de forma
// consistente sin mezclar husos horarios de distintos estados.

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
