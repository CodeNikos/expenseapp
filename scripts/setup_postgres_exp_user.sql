-- Ejecutar conectado como superusuario (por ejemplo rol "postgres") en pgAdmin o psql.
--
-- Error tipico sin esto: role "exp_user_db" is not permitted to log in

ALTER ROLE exp_user_db WITH LOGIN;

-- Si la base aun no existe, descomenta y ejecuta (requiere superusuario):
-- CREATE DATABASE expenseapp OWNER exp_user_db;

-- Otorgar privilegios (ajusta el nombre de la base si usas otro):
GRANT ALL PRIVILEGES ON DATABASE expenseapp TO exp_user_db;
