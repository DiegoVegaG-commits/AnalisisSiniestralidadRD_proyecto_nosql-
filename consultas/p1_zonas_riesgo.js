// p1_zonas_riesgo.js
// Pregunta 1: Zonas y condados con mayor riesgo (geoespacial/descriptivo)
//
// Agrupa los incidentes por estado y condado, sumando el total de
// accidentes y calculando la severidad promedio, para identificar
// las zonas de mayor concentracion de siniestros.

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

print("--- TOP 10 ESTADOS CON MÁS ACCIDENTES ---");
printjson(p1);
