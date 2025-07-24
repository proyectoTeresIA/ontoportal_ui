#!/bin/bash
set -e

# Usar variables de entorno o valores por defecto
DB_USER=${MYSQL_USER:-bp_user}

echo "Configurando bases de datos para el usuario: $DB_USER"

# Ejecutar comandos SQL usando mysql
mysql -u root -p"$MYSQL_ROOT_PASSWORD" <<-EOSQL
    -- Crear la base de datos de desarrollo
    CREATE DATABASE IF NOT EXISTS bioportal_ui_development;

    -- Otorgar permisos al usuario en la base de datos de desarrollo
    GRANT ALL PRIVILEGES ON bioportal_ui_development.* TO '$DB_USER'@'%';

    -- Crear la base de datos de test
    CREATE DATABASE IF NOT EXISTS bioportal_ui_test;

    -- Otorgar permisos al usuario en la base de datos de test
    GRANT ALL PRIVILEGES ON bioportal_ui_test.* TO '$DB_USER'@'%';

    -- Crear la base de datos de producción
    CREATE DATABASE IF NOT EXISTS bioportal_ui_production;

    -- Otorgar permisos al usuario en la base de datos de producción
    GRANT ALL PRIVILEGES ON bioportal_ui_production.* TO '$DB_USER'@'%';

    -- Aplicar los cambios
    FLUSH PRIVILEGES;
EOSQL

echo "Configuración de bases de datos completada para el usuario: $DB_USER"
