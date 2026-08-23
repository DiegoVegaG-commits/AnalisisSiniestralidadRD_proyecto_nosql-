// p3_horarios_luz.js
// Pregunta 3: Horarios y condiciones de luz
//
// Cruza la hora exacta del dia (extraida en UTC, mismo criterio que
// la pregunta 2 para mantener consistencia) con el periodo de luz
// solar (sunrise_sunset), para ubicar los horarios de mayor
// siniestralidad y si se concentran en condiciones de baja visibilidad.

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
