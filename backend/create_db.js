const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function createDatabase() {
    try {
        console.log("Conectando a Contabo...");
        const conn = await mysql.createConnection({
            host: '89.117.56.39',
            port: 3308,
            user: 'pos_user',
            password: 'Pap3l3r!4#S3cur3_2026',
            multipleStatements: true
        });

        console.log("Creando base de datos papeleria_dangedav...");
        await conn.query('CREATE DATABASE IF NOT EXISTS papeleria_dangedav DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;');
        
        console.log("Leyendo schema.sql...");
        const schemaPath = path.join(__dirname, '..', 'schema.sql');
        const schema = fs.readFileSync(schemaPath, 'utf8');

        console.log("Ejecutando schema.sql...");
        await conn.query(schema);

        console.log("¡Base de datos y tablas creadas exitosamente!");
        await conn.end();
    } catch (e) {
        console.error("Error:", e.message);
    }
}

createDatabase();
