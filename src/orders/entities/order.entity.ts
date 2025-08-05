import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { OrderItem } from './order-item.entity';
import { Delivery } from '../../deliveries/entities/delivery.entity';

export enum OrderStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  @Index('IDX_ORDER_ID')
  orderId: string;

  @Column({
    type: 'enum',
    enum: OrderStatus,
    default: OrderStatus.PENDING,
  })
  @Index('IDX_ORDER_STATUS')
  status: OrderStatus;

  @Column({ type: 'int', default: 0 })
  totalItems: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  totalCost: number;

  @Column({ type: 'int', default: 0 })
  deliveredQuantity: number;

  @Column({ type: 'int', default: 0 })
  remainingQuantity: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  fileName: string | null;

  @Column({ type: 'boolean', default: false })
  @Index('IDX_ORDER_IS_DELETED')
  isDeleted: boolean;

  @ManyToOne(() => User, (user) => user.orders)
  @JoinColumn({ name: 'created_by' })
  @Index('IDX_ORDER_CREATED_BY')
  createdBy: User;

  @OneToMany(() => OrderItem, (orderItem) => orderItem.order, { cascade: true })
  items: OrderItem[];

  @OneToMany(() => Delivery, (delivery) => delivery.order)
  deliveries: Delivery[];

  @CreateDateColumn()
  @Index('IDX_ORDER_CREATED_AT')
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
