const mysql = require('mysql2/promise');
require('dotenv').config();

async function testConnection() {
  try {
    console.log('Testing database connection...');
    console.log('Host:', process.env.DB_HOST || 'localhost');
    console.log('Port:', process.env.DB_PORT || 3306);
    console.log('Username:', process.env.DB_USERNAME || 'root');
    console.log('Database:', process.env.DB_NAME || 'order_tracker');

    // First, connect without specifying database to create it if it doesn't exist
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT) || 3306,
      user: process.env.DB_USERNAME || 'root',
      password: process.env.DB_PASSWORD || 'password',
    });

    console.log('✅ Connected to MySQL server');

    // Create database if it doesn't exist
    const dbName = process.env.DB_NAME || 'order_tracker';
    await connection.execute(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
    console.log(`✅ Database '${dbName}' created or already exists`);

    // Test connection to the specific database
    await connection.query(`USE \`${dbName}\``);
    console.log(`✅ Successfully connected to database '${dbName}'`);

    await connection.end();
    console.log('✅ Database connection test completed successfully');
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    console.error('\n🔧 Troubleshooting Steps:');
    console.error('1. Ensure MySQL service is running (it appears to be running)');
    console.error('2. Check if the root password is correct in .env file');
    console.error('3. Common passwords to try: "password", "root", "admin", "123456", or empty');
    console.error('4. If password is unknown, reset it using MySQL Installer');
    console.error('5. Update DB_PASSWORD in .env file with the correct password');
    console.error('\n💡 Current configuration:');
    console.error(`   Host: ${process.env.DB_HOST || 'localhost'}`);
    console.error(`   Port: ${process.env.DB_PORT || 3306}`);
    console.error(`   Username: ${process.env.DB_USERNAME || 'root'}`);
    console.error(`   Password: ${process.env.DB_PASSWORD ? '[SET]' : '[EMPTY]'}`);
    process.exit(1);
  }
}

testConnection();
