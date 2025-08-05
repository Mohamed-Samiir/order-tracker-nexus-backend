import { plainToInstance, Transform } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, IsString, validateSync } from 'class-validator';

enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

export class EnvironmentVariables {
  @IsEnum(Environment)
  @IsOptional()
  NODE_ENV: Environment = Environment.Development;

  @IsNumber()
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  PORT: number = 3001;

  // Database Configuration
  @IsString()
  @IsOptional()
  DB_HOST: string = 'localhost';

  @IsNumber()
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  DB_PORT: number = 3306;

  @IsString()
  @IsOptional()
  DB_USERNAME: string = 'root';

  @IsString()
  @IsOptional()
  DB_PASSWORD: string = '12345678';

  @IsString()
  @IsOptional()
  DB_NAME: string = 'order_tracker';

  @IsNumber()
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  DB_CONNECTION_LIMIT: number = 20;

  @IsNumber()
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  DB_TIMEOUT: number = 60000;

  // JWT Configuration
  @IsString()
  JWT_SECRET: string;

  @IsString()
  @IsOptional()
  JWT_EXPIRES_IN: string = '24h';

  // Throttling Configuration
  @IsNumber()
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  THROTTLE_TTL: number = 60;

  @IsNumber()
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  THROTTLE_LIMIT: number = 100;
}

export function validate(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    throw new Error(errors.toString());
  }
  return validatedConfig;
}
