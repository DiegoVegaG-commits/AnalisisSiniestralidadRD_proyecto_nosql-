// roles_y_usuarios.js
// Modelo de seguridad de tres roles: admin_riesgo, analista_vial, consulta_publica.
// Requiere ejecutarse con una identidad que tenga privilegios para crear roles/usuarios.
// Importante: no contiene contraseñas en texto plano. mongosh solicitará cada contraseña.


db = db.getSiblingDB("proyecto_accidentes_db");

// 1. RolAdminRiesgo: lectura y mantenimiento de DOCUMENTOS.
//    No se atribuyen permisos de administración de índices/validadores que aquí no existen.
db.createRole({
  role: "RolAdminRiesgo",
  privileges: [{
    resource: { db: "proyecto_accidentes_db", collection: "accidentes" },
    actions: ["find", "insert", "update", "remove"]
  }],
  roles: []
});

db.createUser({
  user: "admin_riesgo",
  pwd: passwordPrompt(),
  roles: [{ role: "RolAdminRiesgo", db: "proyecto_accidentes_db" }]
});

// 2. RolAnalistaLectura: lectura sobre la colección fuente.
//    En este proyecto los pipelines de aggregate son de solo lectura y se apoyan en find.
db.createRole({
  role: "RolAnalistaLectura",
  privileges: [{
    resource: { db: "proyecto_accidentes_db", collection: "accidentes" },
    actions: ["find"]
  }],
  roles: []
});

db.createUser({
  user: "analista_vial",
  pwd: passwordPrompt(),
  roles: [{ role: "RolAnalistaLectura", db: "proyecto_accidentes_db" }]
});

// 3. RolConsultaPublica: solo lectura sobre la vista minimizada.
db.createRole({
  role: "RolConsultaPublica",
  privileges: [{
    resource: { db: "proyecto_accidentes_db", collection: "vista_accidentes_segura" },
    actions: ["find"]
  }],
  roles: []
});

db.createUser({
  user: "consulta_publica",
  pwd: passwordPrompt(),
  roles: [{ role: "RolConsultaPublica", db: "proyecto_accidentes_db" }]
});

print("Roles y usuarios creados sin contraseñas hardcodeadas.");
print("Nota: la denegación efectiva requiere control de acceso habilitado en MongoDB.");
