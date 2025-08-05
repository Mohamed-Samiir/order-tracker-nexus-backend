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
import { Order } from '../../orders/entities/order.entity';
import { User } from '../../users/entities/user.entity';
import { DeliveryItem } from './delivery-item.entity';

export enum DeliveryStatus {
  PENDING = 'pending',
  IN_TRANSIT = 'in-transit',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled',
}

@Entity('deliveries')
export class Delivery {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'varchar',
    length: 20,
    unique: true,
    name: 'delivery_id',
    comment: 'Human-readable delivery identifier (e.g., DEL-000001)'
  })
  @Index('IDX_DELIVERY_DELIVERY_ID')
  deliveryId: string;

  @Column({ type: 'date' })
  @Index('IDX_DELIVERY_DATE')
  deliveryDate: Date;

  @Column({
    type: 'enum',
    enum: DeliveryStatus,
    default: DeliveryStatus.PENDING,
  })
  @Index('IDX_DELIVERY_STATUS')
  status: DeliveryStatus;

  @ManyToOne(() => Order, (order) => order.deliveries)
  @JoinColumn({ name: 'order_id' })
  @Index('IDX_DELIVERY_ORDER_ID')
  order: Order;

  @ManyToOne(() => User, (user) => user.deliveries)
  @JoinColumn({ name: 'created_by' })
  @Index('IDX_DELIVERY_CREATED_BY')
  createdBy: User;

  @OneToMany(() => DeliveryItem, (deliveryItem) => deliveryItem.delivery, {
    cascade: true,
  })
  deliveryItems: DeliveryItem[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
