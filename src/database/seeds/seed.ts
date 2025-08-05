import { DataSource } from 'typeorm';
import { User, UserRole, UserStatus } from '../../users/entities/user.entity';
import * as bcrypt from 'bcrypt';
import { databaseConfig } from '../../config/database.config';

async function seed() {
  const dataSource = new DataSource(databaseConfig);

  try {
    await dataSource.initialize();
    console.log('Database connection established for seeding');

    const userRepository = dataSource.getRepository(User);

    // Check if admin user already exists
    const existingAdmin = await userRepository.findOne({
      where: { email: 'admin@ordertracker.com' },
    });

    if (existingAdmin) {
      console.log('Admin user already exists, skipping seed');
      return;
    }

    // Create default admin user
    const hashedPassword = await bcrypt.hash('admin123', 10);

    const adminUser = userRepository.create({
      email: 'admin@ordertracker.com',
      name: 'System Administrator',
      password: hashedPassword,
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
    });

    await userRepository.save(adminUser);
    console.log('Default admin user created successfully');
    console.log('Email: admin@ordertracker.com');
    console.log('Password: admin123');
    console.log('Please change the default password after first login');
  } catch (error) {
    console.error('Error during seeding:', error);
  } finally {
    await dataSource.destroy();
  }
}

seed();
