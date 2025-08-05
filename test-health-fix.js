// Test script to verify the health controller fix works
const { HealthController } = require('./dist/health/health.controller');

// Mock the required dependencies
const mockHealthService = {};

// Create an instance of the health controller
const healthController = new HealthController(mockHealthService);

// Test the helper methods
console.log('Testing getActiveHandles()...');
try {
  const activeHandles = healthController.getActiveHandles();
  console.log('✅ getActiveHandles() returned:', activeHandles);
} catch (error) {
  console.log('❌ getActiveHandles() failed:', error.message);
}

console.log('\nTesting getActiveRequests()...');
try {
  const activeRequests = healthController.getActiveRequests();
  console.log('✅ getActiveRequests() returned:', activeRequests);
} catch (error) {
  console.log('❌ getActiveRequests() failed:', error.message);
}

console.log('\n🎉 Health controller fix verification complete!');
