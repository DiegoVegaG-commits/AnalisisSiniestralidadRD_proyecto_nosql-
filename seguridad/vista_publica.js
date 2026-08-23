// vista_publica.js
// Vista de servidor "vista_accidentes_segura"
//
// Se ejecuta ANTES de roles_y_usuarios.js, porque RolConsultaPublica
// otorga privilegios sobre esta vista y no puede apuntar a un recurso
// que todavía no existe.
//
// Por qué una vista y no una proyección en el cliente: db.createView
// aplica el filtro de campos en el servidor de MongoDB, así que el
// rol de consulta pública no puede pedir campos adicionales
// manipulando la consulta desde el cliente — solo ve lo que la vista
// expone. Se omiten "location" (coordenadas exactas) y
// "address.street", clasificados como cuasi-identificadores.

db.createView(
  "vista_accidentes_segura",
  "accidentes",
  [
    {
      $project: {
        _id: 0,
        severity: 1,
        start_time: 1,
        "address.state": 1,
        "weather.condition": 1,
        description: 1
      }
    }
  ]
);

print("Vista 'vista_accidentes_segura' creada correctamente.");
