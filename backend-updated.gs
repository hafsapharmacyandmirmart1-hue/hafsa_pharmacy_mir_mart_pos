// Google Apps Script Backend for Hafsa Pharmacy & Mir Mart POS - FULLY UPDATED WITH POST FIX

// ============================================================================
// MAIN ENTRY POINTS
// ============================================================================

// Handle GET requests (legacy support)
function doGet(e) {
  return handleRequest(e, 'GET');
}

// Handle POST requests (preferred method)
function doPost(e) {
  return handleRequest(e, 'POST');
}

// ============================================================================
// REQUEST HANDLER WITH POST JSON PARSING
// ============================================================================

function handleRequest(e, method) {
  try {
    let params = {};
    let action = '';
    
    // Parse parameters based on request method
    if (method === 'POST') {
      // For POST requests, parse JSON body
      try {
        if (e && e.postData && e.postData.contents) {
          const postData = JSON.parse(e.postData.contents);
          params = postData;
          action = postData.action;
          
          Logger.log('POST Request - Action: ' + action);
          Logger.log('POST Data: ' + JSON.stringify(postData));
        } else {
          throw new Error('Missing POST data');
        }
      } catch (parseError) {
        Logger.log('POST Parse Error: ' + parseError.message);
        return createResponse({
          success: false,
          error: 'Invalid POST data',
          message: 'Failed to parse POST request: ' + parseError.message
        });
      }
    } else {
      // For GET requests, use parameters
      params = e.parameter || {};
      action = params.action;
      Logger.log('GET Request - Action: ' + action);
    }
    
    // Validate action
    if (!action) {
      return createResponse({
        success: false,
        error: 'Missing action',
        message: 'No action specified in request'
      });
    }
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let result;
    
    // Route to appropriate handler
    switch(action) {
      case 'login':
        result = loginUser(params, ss);
        break;
      case 'getProducts':
        result = getProducts(ss);
        break;
      case 'addProduct':
        result = addProduct(ss, params);
        break;
      case 'updateProduct':
        result = updateProduct(ss, params);
        break;
      case 'deleteProduct':
        result = deleteProduct(ss, params);
        break;
      case 'addSale':
        result = addSale(ss, params);
        break;
      case 'addSaleV2':
        result = addSaleV2(ss, params);
        break;
      case 'addSaleItem':
        result = addSaleItem(ss, params);
        break;
      case 'getSales':
        result = getSales(ss);
        break;
      case 'getSalesV2':
        result = getSalesV2(ss);
        break;
      case 'getSaleItems':
        result = getSaleItems(ss, params);
        break;
      case 'getLogs':
        result = getLogs(ss);
        break;
      case 'addLog':
        result = addLog(ss, params);
        break;
      case 'getUsers':
        result = getUsers(ss);
        break;
      case 'getDashboardStats':
        result = getDashboardStats(ss);
        break;
      case 'test':
        result = testConnection();
        break;
      case 'initializeSheets':
        result = initializeSheets(ss);
        break;
      case 'checkCapacity':
        result = checkCapacity(ss);
        break;
      case 'checkDuplicateBarcode':
        result = checkDuplicateBarcode(ss, params);
        break;
      default:
        result = {
          success: false,
          error: 'Unknown action',
          message: 'Invalid action: ' + action
        };
    }
    
    return createResponse(result);
    
  } catch (error) {
    Logger.log('❌ ERROR in handleRequest: ' + error.message);
    Logger.log('Stack trace: ' + error.stack);
    
    return createResponse({
      success: false,
      error: 'Server error',
      message: 'Server error occurred: ' + error.message
    }, 500);
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

// Test connection
function testConnection() {
  return {
    success: true,
    message: 'Google Apps Script is working!',
    timestamp: new Date().toISOString()
  };
}

// Create JSON response
function createResponse(data, statusCode = 200) {
  const jsonData = JSON.stringify(data);
  
  return ContentService
    .createTextOutput(jsonData)
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================================================
// CAPACITY AND VALIDATION CHECKS
// ============================================================================

// Check sheet capacity for row limits
function checkCapacity(ss) {
  try {
    const sheet = ss.getSheetByName('Products');
    if (!sheet) {
      return {
        success: true,
        available: true,
        message: 'Products sheet not found. Assuming available.',
        totalRows: 1000,
        usedRows: 0,
        availableRows: 1000
      };
    }
    
    const lastRow = sheet.getLastRow();
    const maxRows = sheet.getMaxRows();
    const availableRows = maxRows - lastRow;
    
    return {
      success: true,
      available: availableRows > 0,
      totalRows: maxRows,
      usedRows: lastRow,
      availableRows: availableRows,
      warning: availableRows < 50,
      message: availableRows > 0 ? 
        `${availableRows} rows available (${lastRow}/${maxRows} used)` : 
        'No rows available. Please add more rows in Google Sheets.'
    };
  } catch (error) {
    Logger.log('Error checking capacity: ' + error.message);
    return {
      success: false,
      error: error.toString(),
      available: true,
      message: 'Error checking capacity. Assuming available.'
    };
  }
}

// Check for duplicate barcode
function checkDuplicateBarcode(ss, params) {
  try {
    const sheet = ss.getSheetByName('Products');
    if (!sheet) {
      return {
        success: true,
        isDuplicate: false,
        message: 'Products sheet not found'
      };
    }
    
    const barcode = params.barcode;
    const excludeProductId = params.exclude_product_id || '';
    
    if (!barcode) {
      return {
        success: true,
        isDuplicate: false,
        message: 'No barcode provided'
      };
    }
    
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) {
      return {
        success: true,
        isDuplicate: false,
        message: 'No products found'
      };
    }
    
    const headers = data[0];
    const barcodeIndex = headers.indexOf('barcode');
    const productIdIndex = headers.indexOf('product_id');
    
    if (barcodeIndex === -1) {
      return {
        success: false,
        error: 'Barcode column not found'
      };
    }
    
    let isDuplicate = false;
    let duplicateProductId = '';
    let duplicateProductName = '';
    
    for (let i = 1; i < data.length; i++) {
      const rowBarcode = data[i][barcodeIndex];
      const rowProductId = productIdIndex !== -1 ? data[i][productIdIndex] : '';
      
      // Skip if it's the same product we're editing
      if (excludeProductId && rowProductId == excludeProductId) {
        continue;
      }
      
      if (rowBarcode && rowBarcode.toString() === barcode.toString()) {
        isDuplicate = true;
        duplicateProductId = rowProductId;
        
        // Try to get product name
        const productNameIndex = headers.indexOf('product_name');
        if (productNameIndex !== -1) {
          duplicateProductName = data[i][productNameIndex];
        }
        break;
      }
    }
    
    return {
      success: true,
      isDuplicate: isDuplicate,
      duplicateProductId: duplicateProductId,
      duplicateProductName: duplicateProductName,
      message: isDuplicate ? 
        `Barcode already exists for product: ${duplicateProductName || duplicateProductId}` : 
        'Barcode is available'
    };
  } catch (error) {
    Logger.log('Error checking duplicate barcode: ' + error.message);
    return {
      success: false,
      error: error.toString(),
      isDuplicate: false,
      message: 'Error checking barcode'
    };
  }
}

// ============================================================================
// PRODUCT OPERATIONS WITH LOCK SERVICE
// ============================================================================

// Add new product with capacity check and locking
function addProduct(ss, params) {
  const lock = LockService.getScriptLock();
  
  try {
    // Try to acquire lock (wait up to 30 seconds)
    if (!lock.tryLock(30000)) {
      return {
        success: false,
        error: 'System is busy. Please try again.',
        message: 'System is processing another request. Please wait and try again.'
      };
    }
    
    // Check capacity before adding
    const capacity = checkCapacity(ss);
    if (!capacity.available) {
      return {
        success: false,
        error: 'No rows available in Google Sheets. Please add more rows.',
        rowLimit: true,
        message: 'Sheet is full. Please add more rows.'
      };
    }
    
    // Check if barcode already exists (for new products)
    if (params.barcode) {
      const duplicateCheck = checkDuplicateBarcode(ss, {
        barcode: params.barcode,
        exclude_product_id: ''
      });
      
      if (duplicateCheck.success && duplicateCheck.isDuplicate) {
        return {
          success: false,
          error: 'Barcode already exists! ' + duplicateCheck.message,
          barcodeDuplicate: true,
          message: 'This barcode is already assigned to another product'
        };
      }
    }
    
    let sheet = ss.getSheetByName('Products');
    if (!sheet) {
      sheet = ss.insertSheet('Products');
      sheet.appendRow([
        'product_id', 'product_name', 'category', 'purchase_price',
        'sale_price', 'quantity', 'minimum_quantity', 'weight', 'unit', 'barcode',
        'last_updated', 'barcode_image'
      ]);
    }
    
    const timestamp = new Date().toISOString();
    const lastRow = sheet.getLastRow();
    const productId = 'PROD' + (1000 + lastRow);
    
    // Use provided barcode or generate new one
    const barcode = params.barcode || generateBarcodeNumber();
    
    const rowData = [
      productId,
      params.product_name || '',
      params.category || 'Others',
      parseFloat(params.purchase_price) || 0,
      parseFloat(params.sale_price) || 0,
      parseInt(params.quantity) || 0,
      parseInt(params.minimum_quantity) || 10,
      params.weight || '',
      params.unit || '',
      barcode,
      timestamp,
      params.barcode_image || ''
    ];
    
    // Use appendRow for atomic operation
    sheet.appendRow(rowData);
    
    Logger.log('✅ Product added successfully: ' + productId);
    
    addLog(ss, {
      user: params.added_by || 'system',
      action: `Added product: ${params.product_name} (ID: ${productId})`
    });
    
    return {
      success: true,
      productId: productId,
      barcode: barcode,
      message: 'Product added successfully'
    };
    
  } catch (error) {
    Logger.log('❌ Error adding product: ' + error.message);
    return {
      success: false,
      error: 'Failed to add product: ' + error.message
    };
  } finally {
    // Always release lock
    lock.releaseLock();
  }
}

// Update product with barcode duplicate check and locking
function updateProduct(ss, params) {
  const lock = LockService.getScriptLock();
  
  try {
    if (!lock.tryLock(30000)) {
      return {
        success: false,
        error: 'System is busy. Please try again.',
        message: 'System is processing another request. Please wait and try again.'
      };
    }
    
    const sheet = ss.getSheetByName('Products');
    if (!sheet) {
      return {error: 'Products sheet not found'};
    }
    
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const productIdIndex = headers.indexOf('product_id');
    
    if (productIdIndex === -1) {
      return {error: 'product_id column not found'};
    }
    
    let found = false;
    let currentBarcode = '';
    
    // First find the product and get current barcode
    for (let i = 1; i < data.length; i++) {
      if (data[i][productIdIndex] == params.product_id) {
        found = true;
        const barcodeIndex = headers.indexOf('barcode');
        if (barcodeIndex !== -1) {
          currentBarcode = data[i][barcodeIndex];
        }
        break;
      }
    }
    
    if (!found) {
      return {error: 'Product not found'};
    }
    
    // Check if barcode is being changed and if new barcode already exists
    const newBarcode = params.barcode || currentBarcode;
    if (newBarcode && newBarcode !== currentBarcode) {
      const duplicateCheck = checkDuplicateBarcode(ss, {
        barcode: newBarcode,
        exclude_product_id: params.product_id
      });
      
      if (duplicateCheck.success && duplicateCheck.isDuplicate) {
        return {
          success: false,
          error: 'Barcode already exists! ' + duplicateCheck.message,
          barcodeDuplicate: true,
          message: 'This barcode is already assigned to another product'
        };
      }
    }
    
    // Now update the product
    for (let i = 1; i < data.length; i++) {
      if (data[i][productIdIndex] == params.product_id) {
        const timestamp = new Date().toISOString();
        
        const updateData = [
          params.product_id,
          params.product_name || data[i][headers.indexOf('product_name')],
          params.category || data[i][headers.indexOf('category')],
          parseFloat(params.purchase_price) || data[i][headers.indexOf('purchase_price')],
          parseFloat(params.sale_price) || data[i][headers.indexOf('sale_price')],
          parseInt(params.quantity) || data[i][headers.indexOf('quantity')],
          parseInt(params.minimum_quantity) || data[i][headers.indexOf('minimum_quantity')] || 10,
          params.weight || data[i][headers.indexOf('weight')],
          params.unit || data[i][headers.indexOf('unit')],
          newBarcode || data[i][headers.indexOf('barcode')],
          timestamp,
          params.barcode_image || data[i][headers.indexOf('barcode_image')] || ''
        ];
        
        for (let j = 0; j < updateData.length; j++) {
          sheet.getRange(i + 1, j + 1).setValue(updateData[j]);
        }
        
        Logger.log('✅ Product updated successfully: ' + params.product_id);
        
        addLog(ss, {
          user: params.updated_by || 'system',
          action: `Updated product: ${params.product_name} (ID: ${params.product_id})`
        });
        
        break;
      }
    }
    
    return {
      success: true,
      message: 'Product updated successfully'
    };
    
  } catch (error) {
    Logger.log('❌ Error updating product: ' + error.message);
    return {
      success: false,
      error: 'Failed to update product: ' + error.message
    };
  } finally {
    lock.releaseLock();
  }
}

// Delete product with locking
function deleteProduct(ss, params) {
  const lock = LockService.getScriptLock();
  
  try {
    if (!lock.tryLock(30000)) {
      return {
        success: false,
        error: 'System is busy. Please try again.',
        message: 'System is processing another request. Please wait and try again.'
      };
    }
    
    const sheet = ss.getSheetByName('Products');
    if (!sheet) {
      return {error: 'Products sheet not found'};
    }
    
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const productIdIndex = headers.indexOf('product_id');
    
    if (productIdIndex === -1) {
      return {error: 'product_id column not found'};
    }
    
    let found = false;
    let productName = '';
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][productIdIndex] == params.product_id) {
        found = true;
        productName = data[i][headers.indexOf('product_name')] || params.product_id;
        sheet.deleteRow(i + 1);
        
        Logger.log('✅ Product deleted successfully: ' + params.product_id);
        
        addLog(ss, {
          user: params.deleted_by || 'system',
          action: `Deleted product: ${productName} (ID: ${params.product_id})`
        });
        
        break;
      }
    }
    
    if (!found) {
      return {error: 'Product not found'};
    }
    
    return {
      success: true,
      message: 'Product deleted successfully'
    };
    
  } catch (error) {
    Logger.log('❌ Error deleting product: ' + error.message);
    return {
      success: false,
      error: 'Failed to delete product: ' + error.message
    };
  } finally {
    lock.releaseLock();
  }
}

// Get all products
function getProducts(ss) {
  try {
    const sheet = ss.getSheetByName('Products');
    if (!sheet) {
      return {products: []};
    }
    
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) {
      return {products: []};
    }
    
    const headers = data[0];
    const products = [];
    
    for (let i = 1; i < data.length; i++) {
      const product = {};
      for (let j = 0; j < headers.length; j++) {
        product[headers[j]] = data[i][j];
      }
      
      if (!product.product_id) {
        product.product_id = 'PROD' + (1000 + i);
      }
      
      products.push(product);
    }
    
    return {products: products};
  } catch (error) {
    Logger.log('Error getting products: ' + error.message);
    return {products: []};
  }
}

// Generate barcode number
function generateBarcodeNumber() {
  let barcode = '629';
  for (let i = 0; i < 9; i++) {
    barcode += Math.floor(Math.random() * 10);
  }
  
  const digits = barcode.split('').map(Number);
  let sum = 0;
  
  for (let i = 0; i < digits.length; i++) {
    sum += digits[i] * ((i % 2 === 0) ? 1 : 3);
  }
  
  const checkDigit = (10 - (sum % 10)) % 10;
  return barcode + checkDigit;
}

// ============================================================================
// USER AUTHENTICATION
// ============================================================================

function loginUser(params, ss) {
  try {
    const usersSheet = ss.getSheetByName('Users');
    if (!usersSheet) {
      return {error: 'Users sheet not found'};
    }
    
    const data = usersSheet.getDataRange().getValues();
    if (data.length <= 1) {
      return {error: 'No users found'};
    }
    
    const headers = data[0];
    const usernameIndex = headers.indexOf('username');
    const passwordIndex = headers.indexOf('password');
    const roleIndex = headers.indexOf('role');
    
    const userCol = usernameIndex !== -1 ? usernameIndex : 1;
    const passCol = passwordIndex !== -1 ? passwordIndex : 2;
    const roleCol = roleIndex !== -1 ? roleIndex : 3;
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][userCol] === params.username && data[i][passCol] === params.password) {
        addLog(ss, {
          user: params.username,
          action: `User logged in`
        });
        
        return {
          success: true,
          user: {
            username: params.username,
            role: data[i][roleCol] || 'customer'
          }
        };
      }
    }
    
    return {error: 'Invalid username or password'};
  } catch (error) {
    Logger.log('Login error: ' + error.message);
    return {error: 'Login failed: ' + error.message};
  }
}

// ============================================================================
// SALES OPERATIONS WITH LOCK SERVICE
// ============================================================================

// Add sale to Sales sheet
function addSaleV2(ss, params) {
  const lock = LockService.getScriptLock();
  
  try {
    if (!lock.tryLock(30000)) {
      return {
        success: false,
        error: 'System is busy. Please try again.'
      };
    }
    
    let sheet = ss.getSheetByName('Sales');
    if (!sheet) {
      sheet = ss.insertSheet('Sales');
      sheet.appendRow([
        'order_number', 'customer_name', 'total_items', 'total_amount',
        'date', 'time', 'payment_method', 'amount_paid', 'change', 'tax', 'sold_by'
      ]);
    }
    
    // Generate order number if not provided
    let orderNumber = params.order_number;
    if (!orderNumber) {
      const lastRow = sheet.getLastRow();
      if (lastRow > 1) {
        const lastOrderNumber = sheet.getRange(lastRow, 1).getValue();
        orderNumber = (parseInt(lastOrderNumber) || 50000000000) + 1;
      } else {
        orderNumber = 50000000000;
      }
    }
    
    const currentDate = params.date || new Date().toISOString().split('T')[0];
    const currentTime = params.time || new Date().toLocaleTimeString();
    
    const rowData = [
      orderNumber,
      params.customer_name || 'Walk-in Customer',
      parseInt(params.total_items) || 0,
      parseFloat(params.total_amount) || 0,
      currentDate,
      currentTime,
      params.payment_method || 'Cash',
      parseFloat(params.amount_paid) || 0,
      parseFloat(params.change) || 0,
      parseFloat(params.tax) || 0,
      params.sold_by || 'system'
    ];
    
    sheet.appendRow(rowData);
    
    Logger.log('✅ Sale added successfully: ' + orderNumber);
    
    addLog(ss, {
      user: params.sold_by || 'system',
      action: `New sale recorded: Order #${orderNumber}, Total: Rs. ${params.total_amount || 0}`
    });
    
    return {
      success: true,
      order_number: orderNumber,
      message: 'Sale recorded successfully'
    };
    
  } catch (error) {
    Logger.log('❌ Error adding sale V2: ' + error.message);
    return {
      success: false,
      error: 'Failed to record sale: ' + error.message
    };
  } finally {
    lock.releaseLock();
  }
}

// Add sale item to Sale_Items sheet
function addSaleItem(ss, params) {
  const lock = LockService.getScriptLock();
  
  try {
    if (!lock.tryLock(30000)) {
      return {
        success: false,
        error: 'System is busy. Please try again.'
      };
    }
    
    let sheet = ss.getSheetByName('Sale_Items');
    if (!sheet) {
      sheet = ss.insertSheet('Sale_Items');
      sheet.appendRow([
        'order_number', 'product_name', 'quantity', 'category',
        'weight', 'unit', 'price', 'line_total', 'date'
      ]);
    }
    
    const currentDate = new Date().toISOString().split('T')[0];
    
    const rowData = [
      params.order_number || '',
      params.product_name || '',
      parseInt(params.quantity) || 0,
      params.category || '',
      params.weight || '',
      params.unit || '',
      parseFloat(params.price) || 0,
      parseFloat(params.line_total) || 0,
      currentDate
    ];
    
    sheet.appendRow(rowData);
    
    // Update product quantity if product_id is provided
    if (params.product_id) {
      updateProductQuantity(ss, params.product_id, params.quantity);
    }
    
    return {
      success: true,
      message: 'Sale item added successfully'
    };
    
  } catch (error) {
    Logger.log('❌ Error adding sale item: ' + error.message);
    return {
      success: false,
      error: 'Failed to add sale item: ' + error.message
    };
  } finally {
    lock.releaseLock();
  }
}

// Get sales from Sales sheet
function getSalesV2(ss) {
  try {
    const sheet = ss.getSheetByName('Sales');
    if (!sheet) {
      return {sales: []};
    }
    
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) {
      return {sales: []};
    }
    
    const data = sheet.getRange(1, 1, lastRow, sheet.getLastColumn()).getValues();
    const headers = data[0];
    const sales = [];
    
    for (let i = 1; i < data.length; i++) {
      const sale = {};
      
      for (let j = 0; j < headers.length; j++) {
        const header = headers[j];
        let value = data[i][j];
        
        if (value instanceof Date) {
          if (header === 'date') {
            value = Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
          } else if (header === 'time') {
            value = Utilities.formatDate(value, Session.getScriptTimeZone(), 'HH:mm:ss');
          }
        }
        
        sale[header] = value;
      }
      
      if (!sale.order_number) sale.order_number = '';
      if (!sale.customer_name) sale.customer_name = 'Walk-in Customer';
      if (!sale.date) sale.date = '';
      if (!sale.time) sale.time = '';
      if (!sale.total_amount) sale.total_amount = 0;
      if (!sale.total_items) sale.total_items = 0;
      if (!sale.payment_method) sale.payment_method = 'Cash';
      if (!sale.sold_by) sale.sold_by = 'system';
      
      sales.push(sale);
    }
    
    // Sort by date and time (newest first)
    sales.sort((a, b) => {
      try {
        const dateA = new Date(a.date + ' ' + a.time);
        const dateB = new Date(b.date + ' ' + b.time);
        return dateB - dateA;
      } catch (e) {
        return 0;
      }
    });
    
    return {sales: sales};
  } catch (error) {
    Logger.log('Error in getSalesV2: ' + error.message);
    return {sales: []};
  }
}

// Get sale items for a specific order
function getSaleItems(ss, params) {
  try {
    const sheet = ss.getSheetByName('Sale_Items');
    if (!sheet) {
      return {items: []};
    }
    
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) {
      return {items: []};
    }
    
    const headers = data[0];
    const items = [];
    const orderNumber = params.order_number;
    
    for (let i = 1; i < data.length; i++) {
      if (orderNumber && data[i][0] != orderNumber) {
        continue;
      }
      
      const item = {};
      for (let j = 0; j < headers.length; j++) {
        item[headers[j]] = data[i][j];
      }
      items.push(item);
    }
    
    return {items: items};
  } catch (error) {
    Logger.log('Error getting sale items: ' + error.message);
    return {items: []};
  }
}

// Update product quantity after sale
function updateProductQuantity(ss, productId, quantitySold) {
  try {
    const sheet = ss.getSheetByName('Products');
    if (!sheet) return;
    
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const productIdIndex = headers.indexOf('product_id');
    const quantityIndex = headers.indexOf('quantity');
    
    if (productIdIndex === -1 || quantityIndex === -1) return;
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][productIdIndex] == productId) {
        const currentQty = parseFloat(data[i][quantityIndex]) || 0;
        const soldQty = parseFloat(quantitySold) || 0;
        const newQty = Math.max(0, currentQty - soldQty);
        
        sheet.getRange(i + 1, quantityIndex + 1).setValue(newQty);
        
        const lastUpdatedIndex = headers.indexOf('last_updated');
        if (lastUpdatedIndex !== -1) {
          sheet.getRange(i + 1, lastUpdatedIndex + 1).setValue(new Date().toISOString());
        }
        
        break;
      }
    }
  } catch (error) {
    Logger.log('Error updating product quantity: ' + error.message);
  }
}

// ============================================================================
// LEGACY FUNCTIONS (for backward compatibility)
// ============================================================================

function addSale(ss, params) {
  try {
    let sheet = ss.getSheetByName('Sales_Legacy');
    if (!sheet) {
      sheet = ss.insertSheet('Sales_Legacy');
      sheet.appendRow([
        'sale_id', 'product_id', 'product_name', 'quantity_sold',
        'total_price', 'sold_by', 'date_time'
      ]);
    }
    
    const timestamp = new Date().toISOString();
    const saleId = 'SALE' + new Date().getTime();
    
    const rowData = [
      saleId,
      params.product_id || '',
      params.product_name || '',
      parseFloat(params.quantity_sold) || 0,
      parseFloat(params.total_price) || 0,
      params.sold_by || 'system',
      timestamp
    ];
    
    sheet.appendRow(rowData);
    
    if (params.product_id) {
      updateProductQuantity(ss, params.product_id, params.quantity_sold);
    }
    
    addLog(ss, {
      user: params.sold_by || 'system',
      action: `Legacy Sale: ${params.product_name || 'Product'} x${params.quantity_sold || 0} for Rs. ${params.total_price || 0}`
    });
    
    return {
      success: true,
      saleId: saleId,
      message: 'Sale recorded successfully'
    };
  } catch (error) {
    Logger.log('Error adding sale: ' + error.message);
    return {
      success: false,
      error: 'Failed to record sale: ' + error.message
    };
  }
}

function getSales(ss) {
  try {
    const sheet = ss.getSheetByName('Sales_Legacy');
    if (!sheet) {
      return {sales: []};
    }
    
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) {
      return {sales: []};
    }
    
    const headers = data[0];
    const sales = [];
    
    for (let i = 1; i < data.length; i++) {
      const sale = {};
      for (let j = 0; j < headers.length; j++) {
        sale[headers[j]] = data[i][j];
      }
      sales.push(sale);
    }
    
    return {sales: sales};
  } catch (error) {
    Logger.log('Error getting sales: ' + error.message);
    return {sales: []};
  }
}

// ============================================================================
// LOGS, USERS, AND DASHBOARD
// ============================================================================

// Get logs
function getLogs(ss) {
  try {
    let sheet = ss.getSheetByName('Logs');
    if (!sheet) {
      sheet = ss.insertSheet('Logs');
      sheet.appendRow(['log_id', 'user', 'action', 'timestamp']);
      return {logs: []};
    }
    
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) {
      return {logs: []};
    }
    
    const headers = data[0];
    const logs = [];
    
    for (let i = 1; i < data.length; i++) {
      const log = {};
      for (let j = 0; j < headers.length; j++) {
        log[headers[j]] = data[i][j];
      }
      logs.push(log);
    }
    
    return {logs: logs};
  } catch (error) {
    Logger.log('Error getting logs: ' + error.message);
    return {logs: []};
  }
}

// Add log
function addLog(ss, params) {
  try {
    let sheet = ss.getSheetByName('Logs');
    if (!sheet) {
      sheet = ss.insertSheet('Logs');
      sheet.appendRow(['log_id', 'user', 'action', 'timestamp']);
    }
    
    const logId = 'LOG' + new Date().getTime();
    const timestamp = new Date().toISOString();
    
    sheet.appendRow([
      logId,
      params.user || 'system',
      params.action || params.log_action || 'No action specified',
      timestamp
    ]);
    
    // Keep only last 1000 logs
    const maxLogs = 1000;
    const lastRow = sheet.getLastRow();
    if (lastRow > maxLogs + 1) {
      sheet.deleteRows(2, lastRow - maxLogs - 1);
    }
    
    return {success: true};
  } catch (error) {
    Logger.log('Error adding log: ' + error.message);
    return {success: false, error: error.message};
  }
}

// Get users
function getUsers(ss) {
  try {
    const sheet = ss.getSheetByName('Users');
    if (!sheet) {
      const newSheet = ss.insertSheet('Users');
      newSheet.appendRow(['user_id', 'username', 'password', 'role']);
      
      const defaultUsers = [
        ['1', 'admin', 'admin123', 'owner'],
        ['2', 'reception', 'reception123', 'reception'],
        ['3', 'inventory', 'inventory123', 'inventory'],
        ['4', 'customer', 'customer123', 'customer']
      ];
      
      defaultUsers.forEach(user => newSheet.appendRow(user));
      
      return {users: defaultUsers.map(user => ({
        user_id: user[0],
        username: user[1],
        password: user[2],
        role: user[3]
      }))};
    }
    
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) {
      return {users: []};
    }
    
    const headers = data[0];
    const users = [];
    
    for (let i = 1; i < data.length; i++) {
      const user = {};
      for (let j = 0; j < headers.length; j++) {
        user[headers[j]] = data[i][j];
      }
      users.push(user);
    }
    
    return {users: users};
  } catch (error) {
    Logger.log('Error getting users: ' + error.message);
    return {users: []};
  }
}

// Get dashboard statistics
function getDashboardStats(ss) {
  try {
    const products = getProducts(ss).products || [];
    const sales = getSalesV2(ss).sales || [];
    
    const totalProducts = products.length;
    
    const today = new Date().toISOString().split('T')[0];
    const todaySales = sales.filter(s => s.date === today);
    const todayTotal = todaySales.reduce((sum, sale) => 
      sum + (parseFloat(sale.total_amount) || 0), 0
    );
    
    const lowStockCount = products.filter(p => 
      (parseInt(p.quantity) || 0) < (parseInt(p.minimum_quantity) || 10)
    ).length;
    
    const totalSalesValue = sales.reduce((sum, sale) => 
      sum + (parseFloat(sale.total_amount) || 0), 0
    );
    
    const recentSales = sales.slice(-5).reverse();
    const recentProducts = products.slice(-5).reverse();
    
    const outOfStockCount = products.filter(p => 
      (parseInt(p.quantity) || 0) <= 0
    ).length;
    
    return {
      stats: {
        totalProducts,
        todayTotal,
        lowStockCount,
        totalSalesValue,
        outOfStockCount,
        todaySalesCount: todaySales.length
      },
      recentSales,
      recentProducts
    };
  } catch (error) {
    Logger.log('Error getting dashboard stats: ' + error.message);
    return {
      stats: {
        totalProducts: 0,
        todayTotal: 0,
        lowStockCount: 0,
        totalSalesValue: 0,
        outOfStockCount: 0,
        todaySalesCount: 0
      },
      recentSales: [],
      recentProducts: []
    };
  }
}

// Initialize sheets on first run
function initializeSheets(ss) {
  const requiredSheets = [
    'Users', 
    'Products', 
    'Sales', 
    'Sale_Items',
    'Logs'
  ];
  
  requiredSheets.forEach(sheetName => {
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      
      switch(sheetName) {
        case 'Users':
          sheet.appendRow(['user_id', 'username', 'password', 'role']);
          const defaultUsers = [
            ['1', 'admin', 'admin123', 'owner'],
            ['2', 'reception', 'reception123', 'reception'],
            ['3', 'inventory', 'inventory123', 'inventory'],
            ['4', 'customer', 'customer123', 'customer']
          ];
          defaultUsers.forEach(user => sheet.appendRow(user));
          break;
          
        case 'Products':
          sheet.appendRow([
            'product_id', 'product_name', 'category', 'purchase_price',
            'sale_price', 'quantity', 'minimum_quantity', 'weight', 'unit', 'barcode',
            'last_updated', 'barcode_image'
          ]);
          break;
          
        case 'Sales':
          sheet.appendRow([
            'order_number', 'customer_name', 'total_items', 'total_amount',
            'date', 'time', 'payment_method', 'amount_paid', 'change', 'tax', 'sold_by'
          ]);
          break;
          
        case 'Sale_Items':
          sheet.appendRow([
            'order_number', 'product_name', 'quantity', 'category',
            'weight', 'unit', 'price', 'line_total', 'date'
          ]);
          break;
          
        case 'Logs':
          sheet.appendRow(['log_id', 'user', 'action', 'timestamp']);
          break;
      }
      
      const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn());
      headers.setFontWeight('bold');
      headers.setBackground('#4CAF50');
      headers.setFontColor('white');
    }
  });
  
  requiredSheets.forEach(sheetName => {
    const sheet = ss.getSheetByName(sheetName);
    if (sheet) {
      sheet.setFrozenRows(1);
      sheet.setColumnWidths(1, sheet.getLastColumn(), 120);
    }
  });
  
  Logger.log('Sheets initialized successfully');
  return {
    success: true,
    message: 'Sheets initialized successfully'
  };
}
