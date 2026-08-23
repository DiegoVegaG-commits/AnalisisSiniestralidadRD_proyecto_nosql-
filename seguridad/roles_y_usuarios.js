// roles_y_usuarios.js
// Modelo de seguridad de tres roles: admin_riesgo, analista_vial, consulta_publica
//
// Principio de privilegio mínimo: cada rol recibe únicamente las
// acciones y el recurso que necesita para su función, ni más ni menos.
// Requiere ejecutarse con una identidad que ya tenga privilegios de
// administración de usuarios y roles.

// -----------------------------------------------------------------
// 1. RolAdminRiesgo — control total sobre la colección fuente
//    (carga inicial, correcciones, mantenimiento de índices/validador)
// -----------------------------------------------------------------
db.createRole({
  role: "RolAdminRiesgo",
  privileges: [
    {
      resource: { db: "proyecto_accidentes_db", collection: "accidentes" },
      actions: ["find", "insert", "update", "remove", "aggregate"]
    }
  ],
  roles: []
});

db.createUser({
  user: "admin_riesgo",
  pwd: "CAMBIAR_ANTES_DE_EJECUTAR", // En producción se inyecta por variables de entorno / gestor de secretos
  roles: [ { role: "RolAdminRiesgo", db: "proyecto_accidentes_db" } ]
});

// -----------------------------------------------------------------
// 2. RolAnalistaLectura — solo lectura/agregación sobre la colección
//    completa (para correr los pipelines de las 5 preguntas)
// -----------------------------------------------------------------
db.createRole({
  role: "RolAnalistaLectura",
  privileges: [
    {
      resource: { db: "proyecto_accidentes_db", collection: "accidentes" },
      actions: ["find", "aggregate"]
    }
  ],
  roles: []
});

db.createUser({
  user: "analista_vial",
  pwd: "CAMBIAR_ANTES_DE_EJECUTAR", // En producción se inyecta por variables de entorno / gestor de secretos
  roles: [ { role: "RolAnalistaLectura", db: "proyecto_accidentes_db" } ]
});

// -----------------------------------------------------------------
// 3. RolConsultaPublica — restringido a la vista segura, nunca a la
//    colección fuente (control de acceso a nivel de campo)
// -----------------------------------------------------------------
db.createRole({
  role: "RolConsultaPublica",
  privileges: [
    {
      resource: { db: "proyecto_accidentes_db", collection: "vista_accidentes_segura" },
      actions: ["find", "aggregate"]
    }
  ],
  roles: []
});

db.createUser({
  user: "consulta_publica",
  pwd: "CAMBIAR_ANTES_DE_EJECUTAR", // En producción se inyecta por variables de entorno / gestor de secretos
  roles: [ { role: "RolConsultaPublica", db: "proyecto_accidentes_db" } ]
});

print("Roles y usuarios creados correctamente: admin_riesgo, analista_vial, consulta_publica.");
