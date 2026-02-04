// ============================================================================
// HAFSA PHARMACY & MIR MART POS - Google Apps Script Backend
// Version: 2.0 - FIXED VERSION
// ============================================================================
// This script handles all backend operations for the POS system
// IMPORTANT: After updating this code, you MUST redeploy the web app:
// 1. Click "Deploy" > "Manage deployments"
// 2. Click the edit icon (pencil) next to your active deployment
// 3. Under "Version", select "New version"
// 4. Click "Deploy"
// ============================================================================

// Configuration
const SPREADSHEET_ID = SpreadsheetApp.getActiveSpreadsheet().getId();
const SHEET_NAMES = {
  PRODUCTS: 'Products',
  SALES: 'Sales',
  SALE_ITEMS: 'SaleItems',
  LOGS: 'Logs',
  USERS: 'Users'
};

// Maximum rows allowed (to prevent performance issues)
const MAX_ROWS = 10000;

// ============================================================================
// MAIN ENTRY POINTS
// ============================================================================

/**
 * Handle POST requests from frontend
 * This is the main entry point for all API requests
 */
function doPost(e) {
  // Enable CORS
  const output = ContentService.createTextOutput();
  output.setMimeType(ContentService.MimeType.JSON);
  
  try {
    // Log request for debugging (optional, disable in production for performance)
    logRequest(e);
    
    // Parse JSON body
    if (!e || !e.postData || !e.postData.contents) {
      throw new Error('Invalid request: missing data');
    }
    
    const data = JSON.parse(e.postData.contents);
    const action = data.action;
    
    if (!action) {
      throw new Error('Invalid request: missing action parameter');
    }
    
    // Route to appropriate handler
    let result;
    switch(action) {
      // Product operations
      case 'addProduct':
        result = addProduct(data);
        break;
      case 'updateProduct':
        result = updateProduct(data);
        break;
      case 'deleteProduct':
        result = deleteProduct(data);
        break;
      case 'getProducts':
        result = getProducts();
        break;
      case 'checkDuplicateBarcode':
        result = checkDuplicateBarcode(data);
        break;
      
      // Capacity check
      case 'checkCapacity':
        result = checkSheetCapacity();
        break;
      
      // Sales operations
      case 'addSaleV2':
        result = addSaleV2(data);
        break;
      case 'addSaleItem':
        result = addSaleItem(data);
        break;
      case 'getSalesV2':
        result = getSalesV2();
        break;
      case 'getSaleItems':
        result = getSaleItems(data);
        break;
      
      // Legacy sales
      case 'getSales':
        result = getSales();
        break;
      case 'addSale':
        result = addSale(data);
        break;
      
      // Logs
      case 'getLogs':
        result = getLogs();
        break;
      case 'addLog':
        result = addLog(data);
        break;
      
      // Users
      case 'getUsers':
        result = getUsers();
        break;
      
      default:
        result = {
          success: false,
          error: 'UNKNOWN_ACTION',
          message: `Unknown action: ${action}`
        };
    }
    
    output.setContent(JSON.stringify(result));
    return output;
    
  } catch (error) {
    Logger.log('ERROR in doPost: ' + error.message);
    Logger.log('Stack trace: ' + error.stack);
    
    const errorResponse = {
      success: false,
      error: 'SERVER_ERROR',
      message: 'Server error occurred: ' + error.message
    };
    output.setContent(JSON.stringify(errorResponse));
    return output;
  }
}

/**
 * Handle GET requests (legacy support only - all new operations should use POST)
 */
function doGet(e) {
  Logger.log('WARNING: GET request received. All operations should use POST for better security and reliability.');
  
  // For read-only operations, we can still support GET
  const action = e.parameter.action;
  
  const output = ContentService.createTextOutput();
  output.setMimeType(ContentService.MimeType.JSON);
  
  try {
    let result;
    
    switch(action) {
      case 'getProducts':
        result = getProducts();
        break;
      case 'getSalesV2':
        result = getSalesV2();
        break;
      case 'getSales':
        result = getSales();
        break;
      case 'getLogs':
        result = getLogs();
        break;
      case 'getUsers':
        result = getUsers();
        break;
      case 'checkCapacity':
        result = checkSheetCapacity();
        break;
      default:
        result = {
          success: false,
          error: 'UNSUPPORTED_METHOD',
          message: 'This action requires POST request. Please update your frontend code.'
        };
    }
    
    output.setContent(JSON.stringify(result));
    return output;
    
  } catch (error) {
    const errorResponse = {
      success: false,
      error: 'SERVER_ERROR',
      message: error.message
    };
    output.setContent(JSON.stringify(errorResponse));
    return output;
  }
}

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

/**
 * Validate product data
 */
function validateProductData(data) {
  const errors = [];
  
  if (!data.product_name || data.product_name.trim() === '') {
    errors.push('Product name is required');
  }
  if (!data.category || data.category.trim() === '') {
    errors.push('Category is required');
  }
  if (data.purchase_price === undefined || data.purchase_price === null) {
    errors.push('Purchase price is required');
  }
  if (data.sale_price === undefined || data.sale_price === null) {
    errors.push('Sale price is required');
  }
  if (data.quantity === undefined || data.quantity === null) {
    errors.push('Quantity is required');
  }
  if (data.minimum_quantity === undefined || data.minimum_quantity === null) {
    errors.push('Minimum quantity is required');
  }
  
  return {
    valid: errors.length === 0,
    errors: errors
  };
}

/**
 * Validate sale data
 */
function validateSaleData(data) {
  const errors = [];
  
  if (!data.order_number || data.order_number.trim() === '') {
    errors.push('Order number is required');
  }
  if (data.total_items === undefined || data.total_items === null || data.total_items <= 0) {
    errors.push('Total items must be positive');
  }
  if (data.total_amount === undefined || data.total_amount === null || data.total_amount <= 0) {
    errors.push('Total amount must be positive');
  }
  if (!data.payment_method || data.payment_method.trim() === '') {
    errors.push('Payment method is required');
  }
  
  return {
    valid: errors.length === 0,
    errors: errors
  };
}

// ============================================================================
// PRODUCT OPERATIONS
// ============================================================================

/**
 * Add a new product to the sheet
 * Uses LockService to prevent race conditions
 */
function addProduct(data) {
  const lock = LockService.getScriptLock();
  
  try {
    // Validate input
    const validation = validateProductData(data);
    if (!validation.valid) {
      return {
        success: false,
        error: 'VALIDATION_ERROR',
        message: validation.errors.join(', ')
      };
    }
    
    // Wait up to 30 seconds for lock
    if (!lock.tryLock(30000)) {
      return {
        success: false,
        error: 'LOCK_TIMEOUT',
        message: 'System is busy. Please try again.'
      };
    }
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAMES.PRODUCTS);
    
    if (!sheet) {
      throw new Error('Products sheet not found');
    }
    
    // Check capacity
    const lastRow = sheet.getLastRow();
    if (lastRow >= MAX_ROWS) {
      return {
        success: false,
        error: 'CAPACITY_EXCEEDED',
        message: `Maximum ${MAX_ROWS} products allowed`
      };
    }
    
    // Generate IDs
    const productId = 'PROD' + Date.now() + Math.floor(Math.random() * 100);
    const barcode = '629' + Math.floor(Math.random() * 1000000000).toString().padStart(9, '0');
    const timestamp = new Date();
    
    // Prepare row data - adjust column order as per your sheet structure
    const rowData = [
      productId,
      data.product_name,
      data.category,
      data.purchase_price,
      data.sale_price,
      data.quantity,
      data.minimum_quantity,
      data.weight || '',
      data.unit || '',
      barcode,
      data.added_by || 'system',
      timestamp
    ];
    
    // Use appendRow for atomic insertion (thread-safe)
    sheet.appendRow(rowData);
    
    Logger.log(`Product added successfully: ${productId}`);
    
    return {
      success: true,
      productId: productId,
      barcode: barcode,
      message: 'Product added successfully'
    };
    
  } catch (error) {
    Logger.log('Error in addProduct: ' + error.message);
    return {
      success: false,
      error: 'ADD_FAILED',
      message: 'Failed to add product: ' + error.message
    };
  } finally {
    // Always release lock
    lock.releaseLock();
  }
}

/**
 * Update an existing product
 */
function updateProduct(data) {
  const lock = LockService.getScriptLock();
  
  try {
    // Validate input
    if (!data.product_id || data.product_id.trim() === '') {
      return {
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'Product ID is required'
      };
    }
    
    const validation = validateProductData(data);
    if (!validation.valid) {
      return {
        success: false,
        error: 'VALIDATION_ERROR',
        message: validation.errors.join(', ')
      };
    }
    
    if (!lock.tryLock(30000)) {
      return {
        success: false,
        error: 'LOCK_TIMEOUT',
        message: 'System is busy. Please try again.'
      };
    }
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAMES.PRODUCTS);
    
    if (!sheet) {
      throw new Error('Products sheet not found');
    }
    
    // Find the product row
    const dataRange = sheet.getDataRange();
    const values = dataRange.getValues();
    
    let rowIndex = -1;
    for (let i = 1; i < values.length; i++) { // Start from 1 to skip header
      if (values[i][0] === data.product_id) {
        rowIndex = i + 1; // +1 because sheet rows are 1-indexed
        break;
      }
    }
    
    if (rowIndex === -1) {
      return {
        success: false,
        error: 'NOT_FOUND',
        message: 'Product not found'
      };
    }
    
    // Check for barcode duplicate if barcode is provided
    if (data.barcode && data.barcode.trim() !== '') {
      for (let i = 1; i < values.length; i++) {
        // Column 9 is barcode (index 9), adjust if your structure is different
        if (i + 1 !== rowIndex && values[i][9] === data.barcode) {
          return {
            success: false,
            error: 'BARCODE_DUPLICATE',
            barcodeDuplicate: true,
            message: 'This barcode is already assigned to another product'
          };
        }
      }
    }
    
    // Update the row - adjust columns as per your sheet structure
    const timestamp = new Date();
    sheet.getRange(rowIndex, 2).setValue(data.product_name); // Column B
    sheet.getRange(rowIndex, 3).setValue(data.category); // Column C
    sheet.getRange(rowIndex, 4).setValue(data.purchase_price); // Column D
    sheet.getRange(rowIndex, 5).setValue(data.sale_price); // Column E
    sheet.getRange(rowIndex, 6).setValue(data.quantity); // Column F
    sheet.getRange(rowIndex, 7).setValue(data.minimum_quantity); // Column G
    sheet.getRange(rowIndex, 8).setValue(data.weight || ''); // Column H
    sheet.getRange(rowIndex, 9).setValue(data.unit || ''); // Column I
    if (data.barcode) {
      sheet.getRange(rowIndex, 10).setValue(data.barcode); // Column J
    }
    sheet.getRange(rowIndex, 11).setValue(data.updated_by || 'system'); // Column K
    sheet.getRange(rowIndex, 12).setValue(timestamp); // Column L
    
    Logger.log(`Product updated successfully: ${data.product_id}`);
    
    return {
      success: true,
      message: 'Product updated successfully'
    };
    
  } catch (error) {
    Logger.log('Error in updateProduct: ' + error.message);
    return {
      success: false,
      error: 'UPDATE_FAILED',
      message: 'Failed to update product: ' + error.message
    };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Delete a product
 */
function deleteProduct(data) {
  const lock = LockService.getScriptLock();
  
  try {
    if (!data.product_id || data.product_id.trim() === '') {
      return {
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'Product ID is required'
      };
    }
    
    if (!lock.tryLock(30000)) {
      return {
        success: false,
        error: 'LOCK_TIMEOUT',
        message: 'System is busy. Please try again.'
      };
    }
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAMES.PRODUCTS);
    
    if (!sheet) {
      throw new Error('Products sheet not found');
    }
    
    // Find the product row
    const dataRange = sheet.getDataRange();
    const values = dataRange.getValues();
    
    let rowIndex = -1;
    for (let i = 1; i < values.length; i++) {
      if (values[i][0] === data.product_id) {
        rowIndex = i + 1;
        break;
      }
    }
    
    if (rowIndex === -1) {
      return {
        success: false,
        error: 'NOT_FOUND',
        message: 'Product not found'
      };
    }
    
    // Delete the row
    sheet.deleteRow(rowIndex);
    
    Logger.log(`Product deleted successfully: ${data.product_id}`);
    
    return {
      success: true,
      message: 'Product deleted successfully'
    };
    
  } catch (error) {
    Logger.log('Error in deleteProduct: ' + error.message);
    return {
      success: false,
      error: 'DELETE_FAILED',
      message: 'Failed to delete product: ' + error.message
    };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Get all products
 */
function getProducts() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAMES.PRODUCTS);
    
    if (!sheet) {
      throw new Error('Products sheet not found');
    }
    
    const dataRange = sheet.getDataRange();
    const values = dataRange.getValues();
    
    // Convert to array of objects
    const headers = values[0];
    const products = [];
    
    for (let i = 1; i < values.length; i++) {
      const product = {};
      for (let j = 0; j < headers.length; j++) {
        product[headers[j]] = values[i][j];
      }
      products.push(product);
    }
    
    return {
      success: true,
      products: products
    };
    
  } catch (error) {
    Logger.log('Error in getProducts: ' + error.message);
    return {
      success: false,
      error: 'GET_FAILED',
      message: 'Failed to get products: ' + error.message,
      products: []
    };
  }
}

/**
 * Check if barcode is duplicate
 */
function checkDuplicateBarcode(data) {
  try {
    if (!data.barcode || data.barcode.trim() === '') {
      return {
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'Barcode is required'
      };
    }
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAMES.PRODUCTS);
    
    if (!sheet) {
      throw new Error('Products sheet not found');
    }
    
    const dataRange = sheet.getDataRange();
    const values = dataRange.getValues();
    
    // Check for duplicate barcode (column 10, index 9)
    for (let i = 1; i < values.length; i++) {
      const productId = values[i][0];
      const barcode = values[i][9];
      
      if (barcode === data.barcode && productId !== data.exclude_product_id) {
        return {
          success: true,
          isDuplicate: true,
          message: 'Barcode already exists'
        };
      }
    }
    
    return {
      success: true,
      isDuplicate: false,
      message: 'Barcode is unique'
    };
    
  } catch (error) {
    Logger.log('Error in checkDuplicateBarcode: ' + error.message);
    return {
      success: false,
      error: 'CHECK_FAILED',
      message: 'Failed to check barcode: ' + error.message
    };
  }
}

/**
 * Check sheet capacity
 */
function checkSheetCapacity() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAMES.PRODUCTS);
    
    if (!sheet) {
      throw new Error('Products sheet not found');
    }
    
    const maxRows = sheet.getMaxRows();
    const lastRow = sheet.getLastRow();
    const availableRows = maxRows - lastRow;
    
    return {
      success: true,
      available: availableRows > 10, // Keep buffer of 10 rows
      totalRows: maxRows,
      usedRows: lastRow,
      availableRows: availableRows,
      message: availableRows > 10 ? 'Capacity available' : 'Sheet nearly full. Please add more rows.'
    };
    
  } catch (error) {
    Logger.log('Error in checkSheetCapacity: ' + error.message);
    return {
      success: false,
      error: 'CHECK_FAILED',
      message: 'Failed to check capacity: ' + error.message,
      available: true // Default to available on error
    };
  }
}

// ============================================================================
// SALES OPERATIONS
// ============================================================================

/**
 * Add a new sale (version 2)
 */
function addSaleV2(data) {
  const lock = LockService.getScriptLock();
  
  try {
    const validation = validateSaleData(data);
    if (!validation.valid) {
      return {
        success: false,
        error: 'VALIDATION_ERROR',
        message: validation.errors.join(', ')
      };
    }
    
    if (!lock.tryLock(30000)) {
      return {
        success: false,
        error: 'LOCK_TIMEOUT',
        message: 'System is busy. Please try again.'
      };
    }
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAMES.SALES);
    
    if (!sheet) {
      throw new Error('Sales sheet not found');
    }
    
    const timestamp = new Date();
    
    const rowData = [
      data.order_number,
      data.customer_name || 'Walk-in Customer',
      data.total_items,
      data.total_amount,
      data.date,
      data.time,
      data.payment_method,
      data.amount_paid || 0,
      data.change || 0,
      data.tax || 0,
      data.sold_by || 'system',
      timestamp
    ];
    
    sheet.appendRow(rowData);
    
    Logger.log(`Sale added successfully: ${data.order_number}`);
    
    return {
      success: true,
      order_number: data.order_number,
      message: 'Sale recorded successfully'
    };
    
  } catch (error) {
    Logger.log('Error in addSaleV2: ' + error.message);
    return {
      success: false,
      error: 'SALE_FAILED',
      message: 'Failed to record sale: ' + error.message
    };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Add a sale item
 */
function addSaleItem(data) {
  const lock = LockService.getScriptLock();
  
  try {
    if (!data.order_number || !data.product_name) {
      return {
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'Order number and product name are required'
      };
    }
    
    if (!lock.tryLock(30000)) {
      return {
        success: false,
        error: 'LOCK_TIMEOUT',
        message: 'System is busy. Please try again.'
      };
    }
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAMES.SALE_ITEMS);
    
    if (!sheet) {
      throw new Error('SaleItems sheet not found');
    }
    
    const rowData = [
      data.order_number,
      data.product_name,
      data.quantity,
      data.category || '',
      data.weight || '',
      data.unit || '',
      data.price,
      data.line_total,
      data.product_id || ''
    ];
    
    sheet.appendRow(rowData);
    
    return {
      success: true,
      message: 'Sale item added successfully'
    };
    
  } catch (error) {
    Logger.log('Error in addSaleItem: ' + error.message);
    return {
      success: false,
      error: 'ITEM_ADD_FAILED',
      message: 'Failed to add sale item: ' + error.message
    };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Get all sales (version 2)
 */
function getSalesV2() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAMES.SALES);
    
    if (!sheet) {
      throw new Error('Sales sheet not found');
    }
    
    const dataRange = sheet.getDataRange();
    const values = dataRange.getValues();
    
    const headers = values[0];
    const sales = [];
    
    for (let i = 1; i < values.length; i++) {
      const sale = {};
      for (let j = 0; j < headers.length; j++) {
        sale[headers[j]] = values[i][j];
      }
      sales.push(sale);
    }
    
    return {
      success: true,
      sales: sales
    };
    
  } catch (error) {
    Logger.log('Error in getSalesV2: ' + error.message);
    return {
      success: false,
      error: 'GET_FAILED',
      message: 'Failed to get sales: ' + error.message,
      sales: []
    };
  }
}

/**
 * Get sale items for a specific order
 */
function getSaleItems(data) {
  try {
    if (!data.order_number) {
      return {
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'Order number is required'
      };
    }
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAMES.SALE_ITEMS);
    
    if (!sheet) {
      throw new Error('SaleItems sheet not found');
    }
    
    const dataRange = sheet.getDataRange();
    const values = dataRange.getValues();
    
    const headers = values[0];
    const items = [];
    
    for (let i = 1; i < values.length; i++) {
      // Assuming order_number is in the first column
      if (values[i][0] === data.order_number) {
        const item = {};
        for (let j = 0; j < headers.length; j++) {
          item[headers[j]] = values[i][j];
        }
        items.push(item);
      }
    }
    
    return {
      success: true,
      items: items
    };
    
  } catch (error) {
    Logger.log('Error in getSaleItems: ' + error.message);
    return {
      success: false,
      error: 'GET_FAILED',
      message: 'Failed to get sale items: ' + error.message,
      items: []
    };
  }
}

// ============================================================================
// LEGACY FUNCTIONS (for backward compatibility)
// ============================================================================

function getSales() {
  return getSalesV2();
}

function addSale(data) {
  // Legacy sale format - convert to new format if possible
  return {
    success: false,
    error: 'DEPRECATED',
    message: 'This function is deprecated. Please use addSaleV2 instead.'
  };
}

// ============================================================================
// LOGGING AND USERS
// ============================================================================

function getLogs() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAMES.LOGS);
    
    if (!sheet) {
      return { success: true, logs: [] };
    }
    
    const dataRange = sheet.getDataRange();
    const values = dataRange.getValues();
    
    const headers = values[0];
    const logs = [];
    
    for (let i = 1; i < values.length; i++) {
      const log = {};
      for (let j = 0; j < headers.length; j++) {
        log[headers[j]] = values[i][j];
      }
      logs.push(log);
    }
    
    return {
      success: true,
      logs: logs
    };
    
  } catch (error) {
    Logger.log('Error in getLogs: ' + error.message);
    return { success: true, logs: [] };
  }
}

function addLog(data) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(SHEET_NAMES.LOGS);
    
    // Create logs sheet if it doesn't exist
    if (!sheet) {
      sheet = ss.insertSheet(SHEET_NAMES.LOGS);
      sheet.appendRow(['User', 'Action', 'Timestamp']);
    }
    
    const timestamp = new Date();
    sheet.appendRow([data.user || 'system', data.log_action || data.action, timestamp]);
    
    return {
      success: true,
      message: 'Log added'
    };
    
  } catch (error) {
    // Silent fail for logs
    Logger.log('Error in addLog: ' + error.message);
    return { success: true };
  }
}

function getUsers() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAMES.USERS);
    
    if (!sheet) {
      // Return default users if sheet doesn't exist
      return {
        success: true,
        users: [
          { user_id: '1', username: 'admin', password: 'admin123', role: 'owner' },
          { user_id: '2', username: 'reception', password: 'reception123', role: 'reception' },
          { user_id: '3', username: 'inventory', password: 'inventory123', role: 'inventory' },
          { user_id: '4', username: 'customer', password: 'customer123', role: 'customer' }
        ]
      };
    }
    
    const dataRange = sheet.getDataRange();
    const values = dataRange.getValues();
    
    const headers = values[0];
    const users = [];
    
    for (let i = 1; i < values.length; i++) {
      const user = {};
      for (let j = 0; j < headers.length; j++) {
        user[headers[j]] = values[i][j];
      }
      users.push(user);
    }
    
    return {
      success: true,
      users: users
    };
    
  } catch (error) {
    Logger.log('Error in getUsers: ' + error.message);
    return {
      success: true,
      users: []
    };
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Log incoming requests for debugging
 * WARNING: Disable this in production for performance
 */
function logRequest(e) {
  try {
    if (e && e.postData) {
      Logger.log('Request received: ' + e.postData.contents);
    }
  } catch (error) {
    // Silent fail
  }
}

/**
 * Test function to verify deployment
 * Call this function from the script editor to test
 */
function testBackend() {
  const testProduct = {
    action: 'addProduct',
    product_name: 'Test Product',
    category: 'Test Category',
    purchase_price: 100,
    sale_price: 150,
    quantity: 10,
    minimum_quantity: 5,
    added_by: 'test'
  };
  
  const result = addProduct(testProduct);
  Logger.log('Test result: ' + JSON.stringify(result));
  
  return result;
}
