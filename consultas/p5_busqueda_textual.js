// p5_busqueda_textual.js
// Pregunta 5: ¿Qué accidentes de alta severidad son más relevantes para
// términos asociados con bloqueos y cierres viales?
//
// $text trabaja con un índice de texto y textScore expresa relevancia textual.
var p5 = db.accidentes.aggregate([
  {
    $match: {
      $text: { $search: "blocked lane ramp closed" },
      severity: { $gte: 3 }
    }
  },
  {
    $project: {
      estado: "$address.state",
      severidad: "$severity",
      descripcion: "$description",
      relevancia: { $meta: "textScore" },
      _id: 0
    }
  },
  { $sort: { relevancia: -1 } },
  { $limit: 10 }
]).toArray();

print("--- TOP 10 INCIDENTES CRÍTICOS POR RELEVANCIA TEXTUAL ---");
printjson(p5);
