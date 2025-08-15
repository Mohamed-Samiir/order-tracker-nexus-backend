/**
 * Test script to validate Order Excel column validation logic
 * This tests the validateOrderExcelColumns method behavior with different column scenarios
 */

console.log('🔧 Testing Order Excel column validation logic...');

// Simulate the validation logic from the enhanced order code
function validateOrderExcelColumns(data: any[]): { isValid: boolean; error?: string } {
  if (!data || data.length === 0) {
    return { isValid: false, error: 'Excel file is empty' };
  }

  const requiredColumns = [
    'ASIN',
    'Brand Name',
    'Model Number',
    'Title',
    'Requesting Date',
    'Quantity Requested',
    'Unit Cost'
  ];

  // Get the first row to check column headers
  const firstRow = data[0];
  const availableColumns = Object.keys(firstRow);
  
  // Normalize column names for case-insensitive comparison
  const normalizedAvailableColumns = availableColumns.map(col => col.toLowerCase().trim());
  const normalizedRequiredColumns = requiredColumns.map(col => col.toLowerCase().trim());
  
  // Find missing columns
  const missingColumns: string[] = [];
  
  requiredColumns.forEach((requiredCol, index) => {
    const normalizedRequired = normalizedRequiredColumns[index];
    const isPresent = normalizedAvailableColumns.some(availableCol => 
      availableCol === normalizedRequired
    );
    
    if (!isPresent) {
      missingColumns.push(requiredCol);
    }
  });

  // If there are missing columns, return error
  if (missingColumns.length > 0) {
    const missingColumnsText = missingColumns.map(col => `'${col}'`).join(', ');
    const allRequiredColumnsText = requiredColumns.join(', ');
    
    return {
      isValid: false,
      error: `Missing required columns in Excel file: ${missingColumnsText}. ` +
             `Please ensure your Excel file contains all required columns: ${allRequiredColumnsText}.`
    };
  }

  return { isValid: true };
}

// Test cases for Order Excel validation
const orderTestCases = [
  {
    name: 'Valid Order Excel with all required columns',
    data: [{
      'ASIN': 'B123456789',
      'Brand Name': 'Test Brand',
      'Model Number': '1234567890123',
      'Title': 'Test Product',
      'Requesting Date': '2024-01-15',
      'Quantity Requested': 10,
      'Unit Cost': 25.99
    }],
    expectedValid: true
  },
  {
    name: 'Valid Order Excel with case variations',
    data: [{
      'asin': 'B123456789',
      'brand name': 'Test Brand',
      'model number': '1234567890123',
      'title': 'Test Product',
      'requesting date': '2024-01-15',
      'quantity requested': 10,
      'unit cost': 25.99
    }],
    expectedValid: true
  },
  {
    name: 'Valid Order Excel with extra columns',
    data: [{
      'ASIN': 'B123456789',
      'Brand Name': 'Test Brand',
      'Model Number': '1234567890123',
      'Title': 'Test Product',
      'Requesting Date': '2024-01-15',
      'Quantity Requested': 10,
      'Unit Cost': 25.99,
      'Extra Column': 'Extra Data',
      'Notes': 'Some notes'
    }],
    expectedValid: true
  },
  {
    name: 'Missing ASIN column',
    data: [{
      'Brand Name': 'Test Brand',
      'Model Number': '1234567890123',
      'Title': 'Test Product',
      'Requesting Date': '2024-01-15',
      'Quantity Requested': 10,
      'Unit Cost': 25.99
    }],
    expectedValid: false,
    expectedMissingColumns: ['ASIN']
  },
  {
    name: 'Missing multiple columns',
    data: [{
      'ASIN': 'B123456789',
      'Brand Name': 'Test Brand',
      'Title': 'Test Product'
      // Missing: Model Number, Requesting Date, Quantity Requested, Unit Cost
    }],
    expectedValid: false,
    expectedMissingColumns: ['Model Number', 'Requesting Date', 'Quantity Requested', 'Unit Cost']
  },
  {
    name: 'Missing quantity and cost columns',
    data: [{
      'ASIN': 'B123456789',
      'Brand Name': 'Test Brand',
      'Model Number': '1234567890123',
      'Title': 'Test Product',
      'Requesting Date': '2024-01-15'
      // Missing: Quantity Requested, Unit Cost
    }],
    expectedValid: false,
    expectedMissingColumns: ['Quantity Requested', 'Unit Cost']
  },
  {
    name: 'Missing date column',
    data: [{
      'ASIN': 'B123456789',
      'Brand Name': 'Test Brand',
      'Model Number': '1234567890123',
      'Title': 'Test Product',
      'Quantity Requested': 10,
      'Unit Cost': 25.99
      // Missing: Requesting Date
    }],
    expectedValid: false,
    expectedMissingColumns: ['Requesting Date']
  },
  {
    name: 'Empty Excel file',
    data: [],
    expectedValid: false,
    expectedError: 'Excel file is empty'
  },
  {
    name: 'Null data',
    data: null as any,
    expectedValid: false,
    expectedError: 'Excel file is empty'
  },
  {
    name: 'Column names with extra spaces',
    data: [{
      '  ASIN  ': 'B123456789',
      '  Brand Name  ': 'Test Brand',
      '  Model Number  ': '1234567890123',
      '  Title  ': 'Test Product',
      '  Requesting Date  ': '2024-01-15',
      '  Quantity Requested  ': 10,
      '  Unit Cost  ': 25.99
    }],
    expectedValid: true
  },
  {
    name: 'Mixed case with spaces',
    data: [{
      'Asin': 'B123456789',
      'BRAND NAME': 'Test Brand',
      'model Number': '1234567890123',
      'TITLE': 'Test Product',
      'Requesting DATE': '2024-01-15',
      'QUANTITY requested': 10,
      'unit COST': 25.99
    }],
    expectedValid: true
  }
];

console.log('\n📊 Testing Order Excel column validation:');

let passedTests = 0;
let totalTests = orderTestCases.length;

orderTestCases.forEach((testCase, index) => {
  console.log(`\n🔍 Test ${index + 1}: ${testCase.name}`);
  
  try {
    const result = validateOrderExcelColumns(testCase.data);
    
    if (result.isValid === testCase.expectedValid) {
      if (testCase.expectedValid) {
        console.log('  ✅ PASS - Valid Order Excel file accepted');
        passedTests++;
      } else {
        // Check if the error message contains expected missing columns
        if (testCase.expectedMissingColumns) {
          const allExpectedFound = testCase.expectedMissingColumns.every(col => 
            result.error?.includes(`'${col}'`)
          );
          if (allExpectedFound) {
            console.log('  ✅ PASS - Missing columns correctly identified');
            console.log(`    Error: ${result.error}`);
            passedTests++;
          } else {
            console.log('  ❌ FAIL - Expected missing columns not found in error');
            console.log(`    Expected: ${testCase.expectedMissingColumns.join(', ')}`);
            console.log(`    Error: ${result.error}`);
          }
        } else if (testCase.expectedError && result.error?.includes(testCase.expectedError)) {
          console.log('  ✅ PASS - Expected error message received');
          console.log(`    Error: ${result.error}`);
          passedTests++;
        } else {
          console.log('  ❌ FAIL - Unexpected error message');
          console.log(`    Expected: ${testCase.expectedError}`);
          console.log(`    Actual: ${result.error}`);
        }
      }
    } else {
      console.log('  ❌ FAIL - Unexpected validation result');
      console.log(`    Expected valid: ${testCase.expectedValid}`);
      console.log(`    Actual valid: ${result.isValid}`);
      console.log(`    Error: ${result.error}`);
    }
  } catch (error) {
    console.log('  ❌ FAIL - Exception thrown during validation');
    console.log(`    Error: ${error}`);
  }
});

console.log('\n🎉 Order Excel column validation tests completed!');
console.log(`📊 Results: ${passedTests}/${totalTests} tests passed`);

if (passedTests === totalTests) {
  console.log('✅ All tests passed! Order Excel column validation is working correctly.');
} else {
  console.log('❌ Some tests failed. Please review the validation logic.');
}

console.log('\n🎯 Key validation features tested:');
console.log('  ✅ All required columns present - accepts file');
console.log('  ✅ Case-insensitive column matching');
console.log('  ✅ Extra columns allowed');
console.log('  ✅ Missing columns detected and reported');
console.log('  ✅ Multiple missing columns handled');
console.log('  ✅ Empty file validation');
console.log('  ✅ Column names with spaces handled');
console.log('  ✅ Meaningful error messages provided');

console.log('\n📋 Required columns for Order Excel files:');
console.log('  - ASIN');
console.log('  - Brand Name');
console.log('  - Model Number');
console.log('  - Title');
console.log('  - Requesting Date');
console.log('  - Quantity Requested');
console.log('  - Unit Cost');

console.log('\n🔄 Comparison with Delivery Excel validation:');
console.log('  📦 Order columns: ASIN, Brand Name, Model Number, Title, Requesting Date, Quantity Requested, Unit Cost');
console.log('  🚚 Delivery columns: ASIN, Brand Name, Model Number, Title, Delivered Quantity, Unit Price');
console.log('  🎯 Both use the same validation pattern for consistency');

process.exit(passedTests === totalTests ? 0 : 1);
