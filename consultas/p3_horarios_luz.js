// p3_horarios_luz.js
// Pregunta 3: ¿En qué horarios y condiciones de luz ocurren más accidentes?
//
// La hora se extrae de la representación BSON Date almacenada con sufijo Z.
// Esto permite consistencia técnica en la muestra, pero no equivale a reconstruir
// la hora local original de cada estado; esa es una limitación declarada.
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

print("--- TOP 10 HORARIOS Y CONDICIONES DE LUZ ---");
printjson(p3);
