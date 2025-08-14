# Consolidated Database Migration Documentation

## Overview

This document describes the consolidated database migration that merges all existing migrations into a single comprehensive schema with standardized snake_case naming conventions.

## Migration Files Created

### 1. `1703000000020-ConsolidatedSchema.ts`
- **Purpose**: Creates all database tables with standardized snake_case column names
- **Tables Created**: `users`, `orders`, `order_items`, `deliveries`, `delivery_items`
- **Features**: All indexes, foreign keys, constraints, and checks included

### 2. `1703000000021-ConsolidatedTriggers.ts`
- **Purpose**: Creates all database triggers for quantity management
- **Triggers Created**: 6 comprehensive triggers for data integrity
- **Features**: Automatic quantity calculations, validation, and protection

## Schema Standardization

### Naming Convention Changes

All database columns now use **snake_case** naming consistently:

| Entity Property | Old DB Column | New DB Column | Status |
|----------------|---------------|---------------|---------|
| `orderId` | `orderId` | `order_id` | ✅ Fixed |
| `totalItems` | `totalItems` | `total_items` | ✅ Fixed |
| `totalCost` | `totalCost` | `total_cost` | ✅ Fixed |
| `deliveredQuantity` | `deliveredQuantity` | `delivered_quantity` | ✅ Fixed |
| `remainingQuantity` | `remainingQuantity` | `remaining_quantity` | ✅ Fixed |
| `fileName` | `fileName` | `file_name` | ✅ Fixed |
| `isDeleted` | `isDeleted` | `is_deleted` | ✅ Fixed |
| `createdAt` | `createdAt` | `created_at` | ✅ Fixed |
| `updatedAt` | `updatedAt` | `updated_at` | ✅ Fixed |

### Entity Updates

All TypeORM entities have been updated with explicit column name mappings:

```typescript
// Example: Order entity
@Column({ name: 'order_id', unique: true })
orderId: string;

@Column({ name: 'total_items', type: 'int', default: 0 })
totalItems: number;

@CreateDateColumn({ name: 'created_at' })
createdAt: Date;
```

## Database Schema

### Tables Structure

#### Users Table
```sql
CREATE TABLE users (
  id VARCHAR(36) PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  password VARCHAR(255) NOT NULL,
  role ENUM('admin', 'uploader', 'viewer') NOT NULL,
  status ENUM('active', 'inactive') DEFAULT 'active',
  is_deleted BOOLEAN DEFAULT FALSE,
  last_login TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

#### Orders Table
```sql
CREATE TABLE orders (
  id VARCHAR(36) PRIMARY KEY,
  order_id VARCHAR(255) UNIQUE NOT NULL,
  status ENUM('pending', 'processing', 'completed', 'cancelled') DEFAULT 'pending',
  total_items INT DEFAULT 0,
  total_cost DECIMAL(10,2) DEFAULT 0,
  delivered_quantity INT DEFAULT 0,
  remaining_quantity INT DEFAULT 0,
  file_name VARCHAR(255) NULL,
  is_deleted BOOLEAN DEFAULT FALSE,
  created_by VARCHAR(36) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id)
);
```

#### Order Items Table
```sql
CREATE TABLE order_items (
  id VARCHAR(36) PRIMARY KEY,
  asin VARCHAR(255) NOT NULL,
  brand_name VARCHAR(255) NOT NULL,
  model_number VARCHAR(13) NOT NULL,
  title VARCHAR(255) NOT NULL,
  requesting_date DATE NOT NULL,
  quantity_requested INT NOT NULL,
  quantity_remaining INT DEFAULT 0,
  unit_cost DECIMAL(10,2) NOT NULL,
  total_cost DECIMAL(10,2) NOT NULL,
  order_id VARCHAR(36) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);
```

#### Deliveries Table
```sql
CREATE TABLE deliveries (
  id VARCHAR(36) PRIMARY KEY,
  delivery_id VARCHAR(20) UNIQUE NOT NULL,
  delivery_date DATE NOT NULL,
  status ENUM('pending', 'in-transit', 'delivered', 'cancelled') DEFAULT 'pending',
  order_id VARCHAR(36) NOT NULL,
  created_by VARCHAR(36) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);
```

#### Delivery Items Table
```sql
CREATE TABLE delivery_items (
  id VARCHAR(36) PRIMARY KEY,
  delivered_quantity INT NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  total_amount DECIMAL(10,2) NOT NULL,
  delivery_date DATE NULL,
  delivery_id VARCHAR(36) NOT NULL,
  order_item_id VARCHAR(36) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (delivery_id) REFERENCES deliveries(id) ON DELETE CASCADE,
  FOREIGN KEY (order_item_id) REFERENCES order_items(id),
  UNIQUE KEY (delivery_id, order_item_id)
);
```

## Database Triggers

### Quantity Management System

The consolidated migration includes 6 triggers for automatic quantity management:

1. **`prevent_direct_quantity_remaining_update`**: Prevents unauthorized direct updates to quantity_remaining
2. **`validate_delivery_quantity_before_insert`**: Validates delivery quantities before insertion
3. **`update_quantity_remaining_after_delivery_insert`**: Automatically updates quantities after delivery creation
4. **`update_quantity_remaining_after_delivery_update`**: Handles quantity adjustments on delivery updates
5. **`update_quantity_remaining_after_delivery_delete`**: Restores quantities when deliveries are deleted
6. **`validate_delivery_quantity_before_update`**: Validates delivery quantity updates

## Testing

### Test Script: `test-consolidated-migration.ts`

The test script validates:
- ✅ Fresh database creation with consolidated migrations
- ✅ All tables created with correct structure
- ✅ Snake_case column naming verification
- ✅ Entity CRUD operations functionality
- ✅ Database triggers working correctly
- ✅ Trigger protection mechanisms

### Running Tests

```bash
# Test the consolidated migration
npm run test:consolidated-migration

# Test all entity mappings
npm run test:all-entities
```

## Migration Strategy

### For New Deployments
1. Use only the consolidated migrations (`1703000000020` and `1703000000021`)
2. All old migrations can be ignored
3. Fresh database will have consistent snake_case naming

### For Existing Deployments
⚠️ **IMPORTANT**: This consolidation changes column names from camelCase to snake_case.

**Recommended approach for existing databases:**
1. **Backup your database** before applying changes
2. **Test in staging environment** first
3. **Consider data migration** if you have existing data with camelCase columns

## Benefits

### 1. **Consistency**
- All database columns use snake_case naming
- Eliminates entity-to-database mapping confusion
- Standardized across all tables

### 2. **Maintainability**
- Single source of truth for schema
- Simplified migration history
- Easier to understand and modify

### 3. **Performance**
- Optimized indexes and constraints
- Efficient trigger-based quantity management
- Proper foreign key relationships

### 4. **Data Integrity**
- Comprehensive validation triggers
- Automatic quantity calculations
- Protection against manual data corruption

## Files Modified

### Migration Files
- ✅ `src/database/migrations/1703000000020-ConsolidatedSchema.ts` (new)
- ✅ `src/database/migrations/1703000000021-ConsolidatedTriggers.ts` (new)

### Entity Files
- ✅ `src/users/entities/user.entity.ts` (updated column mappings)
- ✅ `src/orders/entities/order.entity.ts` (updated column mappings)
- ✅ `src/orders/entities/order-item.entity.ts` (updated column mappings)
- ✅ `src/deliveries/entities/delivery.entity.ts` (updated column mappings)
- ✅ `src/deliveries/entities/delivery-item.entity.ts` (updated column mappings)

### Test Files
- ✅ `scripts/test-consolidated-migration.ts` (new)
- ✅ `package.json` (added test script)

## Migration Strategy for Existing Databases

### ⚠️ IMPORTANT: Data Migration Required

The consolidated migration changes column names from camelCase to snake_case. **This requires data migration for existing databases.**

### Option 1: Fresh Database (Recommended for Development)
```bash
# Drop existing database and recreate with consolidated schema
npm run db:drop
npm run test:consolidated-migration
```

### Option 2: Data Migration Script (For Production)

Create a data migration script to safely transition existing data:

```sql
-- Example migration script (customize based on your data)
-- 1. Create backup tables
CREATE TABLE orders_backup AS SELECT * FROM orders;
CREATE TABLE order_items_backup AS SELECT * FROM order_items;

-- 2. Drop existing tables (after backup)
DROP TABLE delivery_items;
DROP TABLE deliveries;
DROP TABLE order_items;
DROP TABLE orders;

-- 3. Run consolidated migrations
-- (Use TypeORM migration runner)

-- 4. Migrate data from backup tables
INSERT INTO orders (id, order_id, status, total_items, total_cost, ...)
SELECT id, orderId, status, totalItems, totalCost, ... FROM orders_backup;

-- 5. Verify data integrity
-- 6. Drop backup tables
```

### Option 3: Blue-Green Deployment
1. Set up new database with consolidated schema
2. Migrate data using ETL process
3. Switch application to new database
4. Verify functionality
5. Decommission old database

## Testing Results

### ✅ Consolidated Migration Test Results
```
🔧 Testing consolidated migration with fresh database...
✅ Database connection established
✅ Consolidated migrations executed successfully
✅ All expected tables exist: users, orders, order_items, deliveries, delivery_items
✅ Orders table has correct snake_case columns
✅ User entity CRUD working
✅ Order entity CRUD working
✅ OrderItem entity CRUD working
✅ Delivery entity CRUD working
✅ DeliveryItem entity CRUD working
✅ Quantity management triggers working correctly
✅ Trigger protection working correctly
🎉 All consolidated migration tests passed!
```

### ✅ Entity Mappings Test Results
```
🔧 Testing all entity column mappings...
✅ User entity query successful
✅ Order entity query successful
✅ OrderItem entity query successful
✅ Delivery entity query successful
✅ DeliveryItem entity query successful
✅ Complex join query successful
🎉 All entity column mapping tests passed!
```

## Conclusion

The consolidated migration provides a clean, consistent, and maintainable database schema with standardized snake_case naming conventions. All entity mappings have been updated to match the new schema, ensuring seamless TypeORM operations without column name conflicts.

**Key Achievements:**
- ✅ **Complete snake_case standardization** across all database columns
- ✅ **Consolidated migration history** into 2 comprehensive files
- ✅ **Updated entity mappings** to match database schema perfectly
- ✅ **Comprehensive testing** validates all functionality
- ✅ **Database triggers preserved** for data integrity
- ✅ **Zero "Unknown column" errors** in TypeORM queries

The migration is thoroughly tested and ready for deployment in new environments. For existing deployments, follow the data migration strategy outlined above.
