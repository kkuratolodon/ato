// This file now serves as an integration point for all mapping tests
// Individual test files have been organized by functionality:
// - coreMappingBasics.test.js: Basic mapping functionality
// - currencyHandling.test.js: Currency-specific handling
// - fieldParsing.test.js: Field parsing functionality

// Each test file has its own imports and setup
// You can run all tests together or each file separately

// Import specific tests if needed
require('./coreMappingBasics.test.js');
require('./currencyHandling.test.js');
require('./fieldParsing.test.js');

// You can add integration tests that span multiple components here