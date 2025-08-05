export interface DeliveryItemData {
  asin: string;
  brandName: string;
  modelNumber: string;
  title: string;
  deliveredQuantity: number;
  unitPrice: number;
  remainingQuantity?: number;
  isQuantityExceeded?: boolean;
  hasValidationError?: boolean;
  validationError?: string;
  rowNumber?: number;
  orderItemId?: string;
}

export interface ExcelRowData {
  'ASIN': string;
  'Brand Name': string;
  'Model Number': string;
  'Title': string;
  'Delivered Quantity': number;
  'Unit Price': number;
}

export interface DeliveryPreviewResult {
  orderId: string;
  orderInfo: {
    id: string;
    orderId: string;
    totalItems: number;
    totalValue: number;
    totalCost: number;
    remainingQuantity: number;
  };
  orderItems: any[];
  deliveryItems: DeliveryItemData[];
  validItems: DeliveryItemData[];
  invalidItems: DeliveryItemData[];
  totalItems: number;
  validItemsCount: number;
  invalidItemsCount: number;
  hasErrors: boolean;
  hasQuantityErrors: boolean;
  totalDeliveryQuantity: number;
  totalDeliveryValue: number;
  errors: string[];
  summary: {
    canProceed: boolean;
    quantityErrorsCount: number;
    validationErrorsCount: number;
  };
}
