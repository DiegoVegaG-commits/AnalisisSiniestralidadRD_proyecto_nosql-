// p1_zonas_riesgo.js
// Pregunta 1: ¿Qué zonas presentan mayor frecuencia y severidad promedio?
//
// Este análisis es geográfico/descriptivo porque agrupa por estado y condado.
// No usa operadores geoespaciales sobre location ni requiere el índice 2dsphere.
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

print("--- TOP 10 ZONAS CON MÁS ACCIDENTES ---");
printjson(p1);
