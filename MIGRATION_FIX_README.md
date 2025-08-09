# Database Migration Fix: isDeleted Column Issue

## Problem Description

When dropping the MySQL database and running migrations followed by seeding, an error occurred indicating that the "users" table was missing an "isDeleted" column. This happened because:

1. The User entity (`src/users/entities/user.entity.ts`) defines an `isDeleted` column
2. The initial migration (`1640000000001-CreateInitialTables.ts`) did NOT include this column
3. A separate migration (`1703000000002-AddIsDeletedToUsers.ts`) was supposed to add it later
4. The seeding script uses the User entity, which expects the `isDeleted` column to exist

## Root Cause

**Multiple Entity-Migration Mismatches**:

1. **User isDeleted Issue**: The User entity definition included the `isDeleted` column, but the initial table creation migration didn't include it. This created a timing issue where:
   - Fresh database → Run migrations → Run seeds
   - Seeds use User entity (expects `isDeleted`)
   - But `isDeleted` column might not exist yet depending on migration order

2. **Order taxId Issue**: The migration `1640000000005-RemoveTaxIdFromOrders.ts` was trying to drop a column named `taxId` (camelCase), but the initial migration created it as `tax_id` (snake_case). This caused a "Column not found" error.

3. **DeliveryItem Check Constraints Issue**: The migration `1703000000007-FixDeliveryItemConstraints.ts` was trying to create check constraints using camelCase column names (`deliveredQuantity`, `unitPrice`, `totalAmount`), but the actual database columns are snake_case (`delivered_quantity`, `unit_price`, `total_amount`).

4. **DeliveryItem Triggers Issue**: The migration `1703000000008-FixDeliveryTriggers.ts` was trying to create database triggers using camelCase column names (`NEW.deliveredQuantity`, `OLD.deliveredQuantity`), but the actual database columns are snake_case (`delivered_quantity`).

5. **DeliveryItem Trigger Context Issue**: The migration `1703000000009-FixTriggerContext.ts` had the same issue - using camelCase column names in database triggers instead of the actual snake_case database column names.

6. **Delivery Date Column Reference Issue**: The migration `1703000000010-AddDeliveryDateToDeliveryItems.ts` was trying to reference `d.deliveryDate` (camelCase) from the deliveries table, but the actual database column is `delivery_date` (snake_case).

7. **SQL Syntax Error in Trigger Messages**: Multiple migration files had SQL syntax errors in the `SIGNAL SQLSTATE` statements where `SET MESSAGE_TEXT` was on a separate line instead of the same line as required by MySQL syntax.

8. **Entity Column Name Mapping Issues**: Several entity properties were not explicitly mapped to their corresponding database column names, causing TypeORM to generate incorrect SQL queries during seeding.

## Solution Applied

### 1. Updated Initial Migration

**File**: `src/database/migrations/1640000000001-CreateInitialTables.ts`

Added the `isDeleted` column to the initial users table creation:

```typescript
{
  name: 'isDeleted',
  type: 'boolean',
  default: false,
  isNullable: false,
},
```

Also added the corresponding index:

```typescript
{ name: 'IDX_USER_IS_DELETED', columnNames: ['isDeleted'] },
```

### 2. Updated AddIsDeletedToUsers Migration

**File**: `src/database/migrations/1703000000002-AddIsDeletedToUsers.ts`

Modified to use `boolean` type instead of `tinyint` to match the entity definition:

```typescript
// Changed from: tinyint NOT NULL DEFAULT 0
// To: boolean NOT NULL DEFAULT false
```

This migration now serves as a safety net for existing databases that might not have the column.

### 3. Fixed RemoveTaxIdFromOrders Migration

**File**: `src/database/migrations/1640000000005-RemoveTaxIdFromOrders.ts`

Fixed the column name mismatch:

```typescript
// Before: Trying to drop 'taxId' (camelCase)
await queryRunner.dropColumn('orders', 'taxId');

// After: Correctly dropping 'tax_id' (snake_case) with existence check
const hasTaxIdColumn = table?.columns.find(column => column.name === 'tax_id');
if (hasTaxIdColumn) {
  await queryRunner.dropColumn('orders', 'tax_id');
}
```

Added safety checks to prevent errors if the column doesn't exist.

### 4. Fixed DeliveryItem Check Constraints

**Files**:
- `src/database/migrations/1703000000007-FixDeliveryItemConstraints.ts`
- `src/deliveries/entities/delivery-item.entity.ts`

Fixed the column name mismatch in check constraints:

```typescript
// Before: Using camelCase property names (incorrect)
CHECK (deliveredQuantity > 0)
CHECK (unitPrice >= 0)
CHECK (totalAmount >= 0)

// After: Using snake_case database column names (correct)
CHECK (delivered_quantity > 0)
CHECK (unit_price >= 0)
CHECK (total_amount >= 0)
```

Also updated the entity decorators to use the correct database column names.

### 5. Fixed DeliveryItem Database Triggers

**File**: `src/database/migrations/1703000000008-FixDeliveryTriggers.ts`

Fixed the column name mismatch in database triggers:

```sql
-- Before: Using camelCase property names (incorrect)
IF NEW.deliveredQuantity > quantity_remaining_var THEN
SET quantity_difference = NEW.deliveredQuantity - OLD.deliveredQuantity;

-- After: Using snake_case database column names (correct)
IF NEW.delivered_quantity > quantity_remaining_var THEN
SET quantity_difference = NEW.delivered_quantity - OLD.delivered_quantity;
```

Updated all trigger references to use the correct database column names.

### 6. Fixed DeliveryItem Trigger Context Migration

**File**: `src/database/migrations/1703000000009-FixTriggerContext.ts`

Fixed the same column name mismatch in trigger context migration:

```sql
-- Before: Using camelCase property names (incorrect)
SET quantity_remaining = quantity_remaining - NEW.deliveredQuantity
SET quantity_difference = NEW.deliveredQuantity - OLD.deliveredQuantity

-- After: Using snake_case database column names (correct)
SET quantity_remaining = quantity_remaining - NEW.delivered_quantity
SET quantity_difference = NEW.delivered_quantity - OLD.delivered_quantity
```

Updated both up and down migration methods to use correct database column names.

### 7. Fixed Delivery Date Column Reference

**File**: `src/database/migrations/1703000000010-AddDeliveryDateToDeliveryItems.ts`

Fixed the column name reference in the UPDATE query:

```sql
-- Before: Using camelCase property name (incorrect)
SET di.delivery_date = d.deliveryDate

-- After: Using snake_case database column name (correct)
SET di.delivery_date = d.delivery_date
```

This ensures the migration can properly copy delivery dates from the parent deliveries table.

### 8. Fixed SQL Syntax in Trigger Error Messages

**Files**:
- `src/database/migrations/1640000000004-CreateQuantityRemainingTriggers.ts`
- `src/database/migrations/1703000000008-FixDeliveryTriggers.ts`
- `src/database/migrations/1703000000011-FixQuantityCalculationTriggers.ts`

Fixed the SQL syntax errors in SIGNAL statements:

```sql
-- Before: Incorrect syntax (SET MESSAGE_TEXT on separate line)
SIGNAL SQLSTATE '45000'
SET MESSAGE_TEXT = CONCAT('Delivery quantity (', NEW.delivered_quantity, ') exceeds remaining quantity (', remaining_qty, ')');

-- After: Correct MySQL syntax (SET MESSAGE_TEXT on same line)
SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = CONCAT('Delivery quantity (', NEW.delivered_quantity, ') exceeds remaining quantity (', remaining_qty, ')');
```

Fixed all SIGNAL statements across multiple migrations to use proper MySQL syntax.

### 9. Fixed Entity Column Name Mappings

**Files**:
- `src/users/entities/user.entity.ts`
- `src/deliveries/entities/delivery.entity.ts`
- `src/deliveries/entities/delivery-item.entity.ts`

Fixed entity property to database column mappings:

```typescript
// User entity fixes
@Column({ name: 'last_login', type: 'timestamp', nullable: true })
lastLogin: Date;

@CreateDateColumn({ name: 'created_at' })
createdAt: Date;

@UpdateDateColumn({ name: 'updated_at' })
updatedAt: Date;

// DeliveryItem entity fixes
@Column({ name: 'delivered_quantity', type: 'int' })
deliveredQuantity: number;

@Column({ name: 'unit_price', type: 'decimal', precision: 10, scale: 2 })
unitPrice: number;

@Column({ name: 'total_amount', type: 'decimal', precision: 10, scale: 2 })
totalAmount: number;

// Delivery entity fixes
@Column({ name: 'delivery_date', type: 'date' })
deliveryDate: Date;
```

This ensures TypeORM generates correct SQL queries that match the actual database column names.

### 10. Updated Test Scripts

**Files**: 
- `scripts/test-order-deletion-validation.ts`
- `scripts/test-quantity-edge-cases.ts`

Updated raw SQL INSERT statements to include the `isDeleted` column:

```sql
-- Before
INSERT IGNORE INTO users (id, email, name, password, role, status, created_at, updated_at)

-- After  
INSERT IGNORE INTO users (id, email, name, password, role, status, isDeleted, created_at, updated_at)
```

### 11. Added Migration Test Script

**File**: `scripts/test-migration-fix.ts`

Created a comprehensive test script that:
- Drops the database
- Runs all migrations
- Verifies the `isDeleted` column exists
- Tests user creation (simulating seeding)
- Validates the column type and default value

## How to Test the Fix

### Option 1: Use the Test Script

```bash
npm run test:migration-fix
```

This will:
1. Drop your database
2. Run all migrations
3. Test user creation
4. Verify everything works

### Option 2: Manual Testing

```bash
# Drop database and recreate
npm run schema:drop

# Run migrations
npm run migration:run

# Run seeding
npm run seed
```

### Option 3: Full Database Setup

```bash
# Complete setup (migrations + seeding)
npm run db:setup
```

## Verification Steps

After running the fix, verify:

1. **Database Structure**: Check that users table has `isDeleted` column:
   ```sql
   DESCRIBE users;
   ```

2. **Column Type**: Ensure it's `tinyint(1)` (MySQL boolean) with default 0:
   ```sql
   SHOW CREATE TABLE users;
   ```

3. **Index Exists**: Verify the index was created:
   ```sql
   SHOW INDEX FROM users WHERE Key_name = 'IDX_USER_IS_DELETED';
   ```

4. **Seeding Works**: Confirm admin user is created:
   ```sql
   SELECT id, email, name, role, isDeleted FROM users;
   ```

## Prevention for Future

To prevent similar issues:

1. **Always include all entity columns in initial migrations**
2. **Keep entity definitions in sync with migration files**
3. **Use consistent data types between entities and migrations**
4. **Test the complete drop → migrate → seed process regularly**
5. **Use the test script before deploying migration changes**

## Files Modified

- ✅ `src/database/migrations/1640000000001-CreateInitialTables.ts`
- ✅ `src/database/migrations/1703000000002-AddIsDeletedToUsers.ts`
- ✅ `src/database/migrations/1640000000004-CreateQuantityRemainingTriggers.ts`
- ✅ `src/database/migrations/1640000000005-RemoveTaxIdFromOrders.ts`
- ✅ `src/database/migrations/1703000000007-FixDeliveryItemConstraints.ts`
- ✅ `src/database/migrations/1703000000008-FixDeliveryTriggers.ts`
- ✅ `src/database/migrations/1703000000009-FixTriggerContext.ts`
- ✅ `src/database/migrations/1703000000010-AddDeliveryDateToDeliveryItems.ts`
- ✅ `src/database/migrations/1703000000011-FixQuantityCalculationTriggers.ts`
- ✅ `src/database/migrations/1703000000012-AddDeliveryIdToDeliveries.ts`
- ✅ `src/users/entities/user.entity.ts`
- ✅ `src/deliveries/entities/delivery.entity.ts`
- ✅ `src/deliveries/entities/delivery-item.entity.ts`
- ✅ `scripts/test-order-deletion-validation.ts`
- ✅ `scripts/test-quantity-edge-cases.ts`
- ✅ `scripts/test-migration-fix.ts` (new)
- ✅ `package.json` (added test script)

## Next Steps

1. Run the test script to verify the fix works
2. Test your normal database recreation workflow
3. Consider running this test script in your CI/CD pipeline
4. Update any other scripts that might insert users directly via SQL
