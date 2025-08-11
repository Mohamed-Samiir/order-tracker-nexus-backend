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

  @Column({ name: 'orderId', unique: true })
  @Index('IDX_ORDER_ID')
  orderId: string;

  @Column({
    name: 'status',
    type: 'enum',
    enum: OrderStatus,
    default: OrderStatus.PENDING,
  })
  @Index('IDX_ORDER_STATUS')
  status: OrderStatus;

  @Column({ name: 'totalItems', type: 'int', default: 0 })
  totalItems: number;

  @Column({ name: 'totalCost', type: 'decimal', precision: 10, scale: 2, default: 0 })
  totalCost: number;

  @Column({ name: 'deliveredQuantity', type: 'int', default: 0 })
  deliveredQuantity: number;

  @Column({ name: 'remainingQuantity', type: 'int', default: 0 })
  remainingQuantity: number;

  @Column({ name: 'fileName', type: 'varchar', length: 255, nullable: true })
  fileName: string | null;

  @Column({ name: 'isDeleted', type: 'boolean', default: false })
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

  @CreateDateColumn({ name: 'createdAt' })
  @Index('IDX_ORDER_CREATED_AT')
  createdAt: Date;

  @UpdateDateColumn({ name: 'updatedAt' })
  updatedAt: Date;
}
