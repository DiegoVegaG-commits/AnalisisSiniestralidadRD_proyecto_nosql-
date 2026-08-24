// roles_y_usuarios.js
// Modelo de seguridad de tres roles: admin_riesgo, analista_vial, consulta_publica
//
// Principio de privilegio mínimo: cada rol recibe únicamente las
// acciones y el recurso que necesita para su función, ni más ni menos.
// Requiere ejecutarse con una identidad que ya tenga privilegios de
// administración de usuarios y roles.

db = db.getSiblingDB('proyecto_accidentes_db');

// -----------------------------------------------------------------
// 1. RolAdminRiesgo — control total sobre la colección fuente
//    (carga inicial, correcciones, mantenimiento de índices/validador)
// -----------------------------------------------------------------
db.createRole({
  role: "RolAdminRiesgo",
  privileges: [
    {
      resource: { db: "proyecto_accidentes_db", collection: "accidentes" },
      actions: ["find", "insert", "update", "remove"]
    }
  ],
  roles: []
});

db.createUser({
  user: "admin_riesgo",
  pwd: "PasswordAdminRiesgo2026",
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
      actions: ["find"]
    }
  ],
  roles: []
});

db.createUser({
  user: "analista_vial",
  pwd: "PasswordAnalista2026",
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
      actions: ["find"]
    }
  ],
  roles: []
});

db.createUser({
  user: "consulta_publica",
  pwd: "PasswordPublico2026",
  roles: [ { role: "RolConsultaPublica", db: "proyecto_accidentes_db" } ]
});

print("Roles, usuarios y esquemas configurados exitosamente.");
