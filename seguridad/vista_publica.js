// vista_publica.js
// Vista de servidor "vista_accidentes_segura" para minimización de datos.
// Se ejecuta ANTES de roles_y_usuarios.js.
//
// La vista excluye location y address.street. Con control de acceso habilitado,
// RolConsultaPublica puede limitarse a esta vista y no a la colección fuente.
// En un Learner Lab sin autenticación, la vista demuestra minimización, pero no una
// denegación efectiva de acceso a la colección original.

db = db.getSiblingDB("proyecto_accidentes_db");

// Permite reejecutar el script desde un estado conocido.
if (db.getCollectionInfos({ name: "vista_accidentes_segura" }).length > 0) {
  db.vista_accidentes_segura.drop();
}

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
        "address.county": 1,
        "weather.condition": 1,
        description: 1
      }
    }
  ]
);

print("Vista 'vista_accidentes_segura' creada correctamente.");
print("Campos excluidos: location y address.street.");
