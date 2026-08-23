// p5_busqueda_textual.js
// Pregunta 5: Afectaciones críticas (búsqueda textual)
//
// Implementa mineria de datos sobre el campo de texto libre
// "description" utilizando el operador $text (requiere el indice
// { description: "text" }). Ordena los resultados con
// $meta: "textScore" para mostrar los accidentes mas relevantes que
// mencionan cierres totales de vialidades.

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

print("--- TOP 10 INCIDENTES CRÍTICOS POR RELEVANCIA DE TEXTO ---");
printjson(p5);
