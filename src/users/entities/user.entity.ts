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

  @Column({ type: 'boolean', default: false })
  @Index('IDX_USER_IS_DELETED')
  isDeleted: boolean;

  @Column({ type: 'timestamp', nullable: true })
  lastLogin: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => Order, (order) => order.createdBy)
  orders: Order[];

  @OneToMany(() => Delivery, (delivery) => delivery.createdBy)
  deliveries: Delivery[];
}
