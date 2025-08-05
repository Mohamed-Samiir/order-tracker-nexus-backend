// Test script to verify validation works correctly
const { validate } = require('class-validator');
const { plainToClass } = require('class-transformer');

// Mock the ExcelImportDto for testing
class TestExcelImportDto {
  orderId;
}

// Test cases
const testCases = [
  { name: 'Empty object', data: {} },
  { name: 'Undefined orderId', data: { orderId: undefined } },
  { name: 'Null orderId', data: { orderId: null } },
  { name: 'Empty string orderId', data: { orderId: '' } },
  { name: 'String "undefined"', data: { orderId: 'undefined' } },
  { name: 'Valid orderId', data: { orderId: 'ORD-2024-001' } },
];

console.log('🧪 Testing validation scenarios...\n');

testCases.forEach(async (testCase, index) => {
  console.log(`${index + 1}. ${testCase.name}:`, JSON.stringify(testCase.data));
  
  const dto = plainToClass(TestExcelImportDto, testCase.data);
  console.log('   Transformed:', JSON.stringify(dto));
  
  try {
    const errors = await validate(dto);
    if (errors.length === 0) {
      console.log('   ✅ PASS - No validation errors\n');
    } else {
      console.log('   ❌ FAIL - Validation errors:', errors.map(e => e.constraints));
      console.log('');
    }
  } catch (error) {
    console.log('   ❌ ERROR:', error.message);
    console.log('');
  }
});

console.log('🎉 Validation test complete!');
