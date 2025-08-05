import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<User> {
    // Check if user already exists (including soft-deleted users)
    const existingUser = await this.userRepository.findOne({
      where: { email: createUserDto.email },
    });

    if (existingUser && !existingUser.isDeleted) {
      throw new ConflictException('User with this email already exists');
    }

    // If user exists but is soft-deleted, restore them with new data
    if (existingUser && existingUser.isDeleted) {
      const hashedPassword = await bcrypt.hash(createUserDto.password, 10);
      await this.userRepository.update(existingUser.id, {
        ...createUserDto,
        password: hashedPassword,
        isDeleted: false,
      });
      return this.findOne(existingUser.id);
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);

    // Create user
    const user = this.userRepository.create({
      ...createUserDto,
      password: hashedPassword,
    });

    const savedUser = await this.userRepository.save(user);

    // Remove password from response
    const { password, ...result } = savedUser;
    return result as User;
  }

  async findAll(): Promise<User[]> {
    const users = await this.userRepository.find({
      where: { isDeleted: false }, // Only return non-deleted users
      select: [
        'id',
        'email',
        'name',
        'role',
        'status',
        'lastLogin',
        'createdAt',
        'updatedAt',
      ],
      order: { createdAt: 'DESC' },
    });
    return users;
  }

  async findOne(id: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id, isDeleted: false }, // Only return non-deleted users
      select: [
        'id',
        'email',
        'name',
        'role',
        'status',
        'lastLogin',
        'createdAt',
        'updatedAt',
      ],
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async update(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    const user = await this.findOne(id);

    // If email is being updated, check for conflicts
    if (updateUserDto.email && updateUserDto.email !== user.email) {
      const existingUser = await this.userRepository.findOne({
        where: { email: updateUserDto.email, isDeleted: false },
      });

      if (existingUser) {
        throw new ConflictException('User with this email already exists');
      }
    }

    // If password is being updated, hash it
    if (updateUserDto.password) {
      updateUserDto.password = await bcrypt.hash(updateUserDto.password, 10);
    }

    await this.userRepository.update(id, updateUserDto);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    const user = await this.findOne(id);
    // Soft delete: set isDeleted to true instead of removing from database
    await this.userRepository.update(id, { isDeleted: true });
  }

  async changePassword(
    userId: string,
    changePasswordDto: ChangePasswordDto,
  ): Promise<void> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(
      changePasswordDto.currentPassword,
      user.password,
    );

    if (!isCurrentPasswordValid) {
      throw new BadRequestException('Current password is incorrect');
    }

    // Hash new password
    const hashedNewPassword = await bcrypt.hash(
      changePasswordDto.newPassword,
      10,
    );

    // Update password
    await this.userRepository.update(userId, {
      password: hashedNewPassword,
    });
  }
}
