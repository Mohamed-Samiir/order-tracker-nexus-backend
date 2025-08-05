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
  BeforeInsert,
  Check,
} from 'typeorm';
import { Order } from './order.entity';
import { DeliveryItem } from '../../deliveries/entities/delivery-item.entity';

@Entity('order_items')
@Check('CHK_quantity_remaining_non_negative', 'quantity_remaining >= 0')
@Check(
  'CHK_quantity_remaining_not_exceed_requested',
  'quantity_remaining <= quantity_requested',
)
export class OrderItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  asin: string;

  @Column({ name: 'brand_name' })
  brandName: string;

  @Column({ name: 'model_number', length: 13 })
  @Index('IDX_ORDER_ITEM_MODEL_NUMBER')
  modelNumber: string;

  @Column({ length: 255 })
  title: string;

  @Column({ name: 'requesting_date', type: 'date' })
  requestingDate: Date;

  @Column({ name: 'quantity_requested', type: 'int' })
  quantityRequested: number;

  @Column({ name: 'quantity_remaining', type: 'int', default: 0 })
  @Index('IDX_ORDER_ITEM_QUANTITY_REMAINING')
  quantityRemaining: number;

  @Column({ name: 'unit_cost', type: 'decimal', precision: 10, scale: 2 })
  unitCost: number;

  @Column({ name: 'total_cost', type: 'decimal', precision: 10, scale: 2 })
  totalCost: number;

  @ManyToOne(() => Order, (order) => order.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  @Index('IDX_ORDER_ITEM_ORDER_ID')
  order: Order;

  @OneToMany(() => DeliveryItem, (deliveryItem) => deliveryItem.orderItem)
  deliveryItems: DeliveryItem[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @BeforeInsert()
  setInitialQuantityRemaining() {
    if (this.quantityRemaining === 0) {
      this.quantityRemaining = this.quantityRequested;
    }
  }
}
