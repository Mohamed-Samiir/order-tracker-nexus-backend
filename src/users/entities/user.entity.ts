import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { Order } from '../../orders/entities/order.entity';
import { Delivery } from '../../deliveries/entities/delivery.entity';

export enum UserRole {
  ADMIN = 'admin',
  UPLOADER = 'uploader',
  VIEWER = 'viewer',
}

export enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  @Index('IDX_USER_EMAIL')
  email: string;

  @Column()
  name: string;

  @Column()
  password: string;

  @Column({
    type: 'enum',
    enum: UserRole,
  })
  @Index('IDX_USER_ROLE')
  role: UserRole;

  @Column({
    type: 'enum',
    enum: UserStatus,
    default: UserStatus.ACTIVE,
  })
  @Index('IDX_USER_STATUS')
  status: UserStatus;

  @Column({ name: 'is_deleted', type: 'boolean', default: false })
  @Index('IDX_USER_IS_DELETED')
  isDeleted: boolean;

  @Column({ name: 'last_login', type: 'timestamp', nullable: true })
  lastLogin: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => Order, (order) => order.createdBy)
  orders: Order[];

  @OneToMany(() => Delivery, (delivery) => delivery.createdBy)
  deliveries: Delivery[];
}
