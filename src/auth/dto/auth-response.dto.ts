import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '../../users/entities/user.entity';

export class AuthResponseDto {
  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    description: 'JWT access token',
  })
  accessToken: string;

  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    description: 'JWT refresh token',
  })
  refreshToken: string;

  @ApiProperty({
    example: {
      id: 'uuid',
      email: 'admin@ordertracker.com',
      name: 'System Administrator',
      role: 'admin',
    },
    description: 'User information',
  })
  user: {
    id: string;
    email: string;
    name: string;
    role: UserRole;
  };
}
