# Database Migration Fix: isDeleted Column Issue

## Problem Description

When dropping the MySQL database and running migrations followed by seeding, an error occurred indicating that the "users" table was missing an "isDeleted" column. This happened because:

1. The User entity (`src/users/entities/user.entity.ts`) defines an `isDeleted` column
2. The initial migration (`1640000000001-CreateInitialTables.ts`) did NOT include this column
3. A separate migration (`1703000000002-AddIsDeletedToUsers.ts`) was supposed to add it later
4. The seeding script uses the User entity, which expects the `isDeleted` column to exist

## Root Cause

**Entity-Migration Mismatch**: The User entity definition included the `isDeleted` column, but the initial table creation migration didn't include it. This created a timing issue where:

- Fresh database → Run migrations → Run seeds
- Seeds use User entity (expects `isDeleted`)
- But `isDeleted` column might not exist yet depending on migration order

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

### 3. Updated Test Scripts

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

### 4. Added Migration Test Script

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
- ✅ `scripts/test-order-deletion-validation.ts`
- ✅ `scripts/test-quantity-edge-cases.ts`
- ✅ `scripts/test-migration-fix.ts` (new)
- ✅ `package.json` (added test script)

## Next Steps

1. Run the test script to verify the fix works
2. Test your normal database recreation workflow
3. Consider running this test script in your CI/CD pipeline
4. Update any other scripts that might insert users directly via SQL
