import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  BeforeInsert,
  BeforeUpdate,
  Check,
  Unique,
} from 'typeorm';
import { Delivery } from './delivery.entity';
import { OrderItem } from '../../orders/entities/order-item.entity';

@Entity('delivery_items')
@Check('CHK_delivered_quantity_positive', 'delivered_quantity > 0')
@Check('CHK_unit_price_non_negative', 'unit_price >= 0')
@Check('CHK_total_amount_non_negative', 'total_amount >= 0')
@Unique('UNQ_DELIVERY_ORDER_ITEM', ['delivery', 'orderItem'])
export class DeliveryItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'delivered_quantity', type: 'int' })
  deliveredQuantity: number;

  @Column({ name: 'unit_price', type: 'decimal', precision: 10, scale: 2 })
  unitPrice: number;

  @Column({ name: 'total_amount', type: 'decimal', precision: 10, scale: 2 })
  totalAmount: number;

  @Column({ type: 'date', nullable: true, name: 'delivery_date' })
  @Index('IDX_DELIVERY_ITEM_DELIVERY_DATE')
  deliveryDate: Date;

  @ManyToOne(() => Delivery, (delivery) => delivery.deliveryItems, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'delivery_id' })
  @Index('IDX_DELIVERY_ITEM_DELIVERY_ID')
  delivery: Delivery;

  @ManyToOne(() => OrderItem, (orderItem) => orderItem.deliveryItems, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'order_item_id' })
  @Index('IDX_DELIVERY_ITEM_ORDER_ITEM_ID')
  orderItem: OrderItem;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @BeforeInsert()
  @BeforeUpdate()
  calculateTotalAmount() {
    this.totalAmount = this.deliveredQuantity * this.unitPrice;
  }

  @BeforeInsert()
  @BeforeUpdate()
  setDeliveryDate() {
    // Set delivery date from parent delivery if not already set
    if (this.delivery && this.delivery.deliveryDate && !this.deliveryDate) {
      this.deliveryDate = this.delivery.deliveryDate;
    }
  }
}
