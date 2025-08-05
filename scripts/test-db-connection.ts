#!/usr/bin/env ts-node

import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { join } from 'path';

// Load environment variables
config({ path: join(__dirname, '../.env') });

async function testDatabaseConnection() {
  console.log('🔍 Testing database connection...');
  console.log('Configuration:');
  console.log(`  Host: ${process.env.DB_HOST || 'localhost'}`);
  console.log(`  Port: ${process.env.DB_PORT || '3306'}`);
  console.log(`  Username: ${process.env.DB_USERNAME || 'root'}`);
  console.log(`  Database: ${process.env.DB_NAME || 'order_tracker'}`);
  console.log('');

  const dataSource = new DataSource({
    type: 'mysql',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306'),
    username: process.env.DB_USERNAME || 'root',
    password: process.env.DB_PASSWORD || '12345678',
    database: process.env.DB_NAME || 'order_tracker',
    entities: [join(__dirname, '..', 'src', '**', '*.entity{.ts,.js}')],
    migrations: [join(__dirname, '..', 'src', 'database', 'migrations', '*{.ts,.js}')],
    synchronize: false,
    logging: true,
  });

  try {
    console.log('🔌 Attempting to connect to database...');
    await dataSource.initialize();
    console.log('✅ Database connection successful!');

    console.log('🔍 Testing basic query...');
    const result = await dataSource.query('SELECT 1 as test');
    console.log('✅ Basic query successful:', result);

    console.log('📊 Checking database info...');
    const dbInfo = await dataSource.query('SELECT DATABASE() as current_db, VERSION() as version');
    console.log('✅ Database info:', dbInfo[0]);

    console.log('📋 Checking existing tables...');
    const tables = await dataSource.query(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = DATABASE()
    `);
    console.log('📋 Existing tables:', tables.map(t => t.TABLE_NAME));

    console.log('🔍 Checking migrations table...');
    try {
      const migrations = await dataSource.query('SELECT * FROM migrations ORDER BY timestamp DESC LIMIT 5');
      console.log('✅ Recent migrations:', migrations);
    } catch (error) {
      console.log('⚠️  Migrations table not found - this is normal for a fresh database');
    }

  } catch (error) {
    console.error('❌ Database connection failed:');
    console.error('Error details:', error.message);
    
    if (error.code) {
      console.error('Error code:', error.code);
    }
    
    if (error.errno) {
      console.error('Error number:', error.errno);
    }

    // Provide helpful suggestions based on common errors
    if (error.code === 'ECONNREFUSED') {
      console.log('\n💡 Suggestions:');
      console.log('  - Make sure MySQL server is running');
      console.log('  - Check if the host and port are correct');
      console.log('  - Verify firewall settings');
    } else if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.log('\n💡 Suggestions:');
      console.log('  - Check username and password');
      console.log('  - Verify user has proper permissions');
      console.log('  - Make sure the user can connect from this host');
    } else if (error.code === 'ER_BAD_DB_ERROR') {
      console.log('\n💡 Suggestions:');
      console.log('  - Check if the database exists');
      console.log('  - Create the database if it doesn\'t exist');
      console.log('  - Verify database name spelling');
    }

    process.exit(1);
  } finally {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
      console.log('🔌 Database connection closed');
    }
  }
}

// Run the test
testDatabaseConnection()
  .then(() => {
    console.log('\n🎉 Database connection test completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Database connection test failed:', error);
    process.exit(1);
  });
