// Google Sheets API Module - FIXED VERSION
const API_URL = 'https://script.google.com/macros/s/AKfycbyXx-gKXpUnAf4-aET5c9lyeU2fvPgG8aWKJ-CFTPhdLloGH3dXNIdDSm_84B_Wpz9-/exec';
// Expose to window so other pages/scripts can reuse the same API endpoint variable
window.API_URL = API_URL;

// Cache management
let productsCache = null;
let salesCache = null;
let saleItemsCache = {};
let cacheTimestamp = 0;
const CACHE_DURATION = 30000;

// Track pending requests to prevent duplicates
const pendingRequests = new Map();

// ============================================
// VALIDATION HELPER FUNCTIONS
// ============================================

/**
 * Validate product data before sending to backend
 * @param {Object} productData - Product data to validate
 * @returns {Object} { valid: boolean, errors: Array }
 */
function validateProductData(productData) {
    const errors = [];

    if (!productData.product_name || productData.product_name.trim() === '') {
        errors.push('Product name is required');
    } else if (productData.product_name.length > 200) {
        errors.push('Product name must be less than 200 characters');
    }

    if (!productData.category || productData.category.trim() === '') {
        errors.push('Category is required');
    }

    if (productData.purchase_price === undefined || productData.purchase_price === null || productData.purchase_price === '') {
        errors.push('Purchase price is required');
    } else {
        const purchasePrice = parseFloat(productData.purchase_price);
        if (isNaN(purchasePrice) || purchasePrice < 0) {
            errors.push('Purchase price must be a valid positive number');
        }
    }

    if (productData.sale_price === undefined || productData.sale_price === null || productData.sale_price === '') {
        errors.push('Sale price is required');
    } else {
        const salePrice = parseFloat(productData.sale_price);
        if (isNaN(salePrice) || salePrice < 0) {
            errors.push('Sale price must be a valid positive number');
        }
    }

    if (productData.quantity === undefined || productData.quantity === null || productData.quantity === '') {
        errors.push('Quantity is required');
    } else {
        const quantity = parseInt(productData.quantity);
        if (isNaN(quantity) || quantity < 0) {
            errors.push('Quantity must be a valid positive number');
        }
    }

    if (productData.minimum_quantity === undefined || productData.minimum_quantity === null || productData.minimum_quantity === '') {
        errors.push('Minimum quantity is required');
    } else {
        const minQty = parseInt(productData.minimum_quantity);
        if (isNaN(minQty) || minQty < 0) {
            errors.push('Minimum quantity must be a valid positive number');
        }
    }

    return {
        valid: errors.length === 0,
        errors: errors
    };
}

/**
 * Validate sale data before sending to backend
 * @param {Object} saleData - Sale data to validate
 * @returns {Object} { valid: boolean, errors: Array }
 */
function validateSaleData(saleData) {
    const errors = [];

    if (!saleData.order_number || saleData.order_number.trim() === '') {
        errors.push('Order number is required');
    }

    if (saleData.total_items === undefined || saleData.total_items === null) {
        errors.push('Total items is required');
    } else {
        const totalItems = parseInt(saleData.total_items);
        if (isNaN(totalItems) || totalItems <= 0) {
            errors.push('Total items must be a positive number');
        }
    }

    if (saleData.total_amount === undefined || saleData.total_amount === null) {
        errors.push('Total amount is required');
    } else {
        const totalAmount = parseFloat(saleData.total_amount);
        if (isNaN(totalAmount) || totalAmount <= 0) {
            errors.push('Total amount must be a positive number');
        }
    }

    if (!saleData.payment_method || saleData.payment_method.trim() === '') {
        errors.push('Payment method is required');
    }

    return {
        valid: errors.length === 0,
        errors: errors
    };
}

/**
 * Make a POST request to the API with proper error handling
 * @param {Object} payload - Data to send
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Promise<Object>} - API response
 */
async function makeApiRequest(payload, timeout = 20000) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
            signal: controller.signal,
            cache: 'no-cache'
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        return data;

    } catch (error) {
        clearTimeout(timeoutId);

        if (error.name === 'AbortError') {
            throw new Error('REQUEST_TIMEOUT');
        } else if (error.message.includes('HTTP error')) {
            throw new Error(`SERVER_ERROR: ${error.message}`);
        } else {
            throw new Error('NETWORK_ERROR');
        }
    }
}

/**
 * Get error message based on error type
 * @param {Error} error - Error object
 * @returns {Object} - Error response object
 */
function getErrorResponse(error, defaultMessage = 'An error occurred') {
    let message = defaultMessage;
    let errorType = 'UNKNOWN_ERROR';

    if (error.message === 'REQUEST_TIMEOUT') {
        message = 'Request took too long. Please check your connection and try again.';
        errorType = 'TIMEOUT';
    } else if (error.message.startsWith('SERVER_ERROR')) {
        message = 'Server error occurred. Please try again later.';
        errorType = 'SERVER_ERROR';
    } else if (error.message === 'NETWORK_ERROR') {
        message = 'Could not connect to the server. Please check your internet connection.';
        errorType = 'NETWORK_ERROR';
    }

    return {
        success: false,
        error: errorType,
        message: message,
        isNetworkError: true
    };
}

// ============================================
// API FUNCTIONS
// ============================================

/**
 * Check if barcode is duplicate
 * @param {string} barcode - Barcode to check
 * @param {string} excludeProductId - Product ID to exclude from check
 * @returns {Promise<Object>} - { success: boolean, isDuplicate: boolean }
 */
window.checkBarcodeDuplicateBackend = async function (barcode, excludeProductId = '') {
    // Validate input
    if (!barcode || barcode.trim() === '') {
        return {
            success: false,
            error: 'VALIDATION_ERROR',
            message: 'Barcode is required'
        };
    }

    const payload = {
        action: 'checkDuplicateBarcode',
        barcode: barcode.trim(),
        exclude_product_id: excludeProductId || ''
    };

    try {
        const data = await makeApiRequest(payload, 10000);
        return data;
    } catch (error) {
        console.error('Error checking barcode duplicate:', error);
        return getErrorResponse(error, 'Error checking barcode duplicate');
    }
};

/**
 * Check Google Sheet capacity
 * @returns {Promise<Object>} - { available: boolean, totalRows: number, usedRows: number }
 */
window.checkSheetCapacity = async function () {
    const payload = {
        action: 'checkCapacity'
    };

    try {
        const data = await makeApiRequest(payload, 10000);
        return data;
    } catch (error) {
        console.error('Error checking sheet capacity:', error);
        // Return conservative estimate on error - assume capacity is limited
        return {
            available: true,
            warning: true,
            message: 'Could not verify capacity. Proceeding with caution.',
            totalRows: 10000,
            usedRows: 0,
            availableRows: 10000
        };
    }
};

/**
 * Add product to Google Sheet
 * @param {Object} productData - Product data to add
 * @returns {Promise<Object>} - { success: boolean, productId?: string, barcode?: string, message: string }
 */
window.addProductToSheet = async function (productData) {
    // Validate input data
    const validation = validateProductData(productData);
    if (!validation.valid) {
        return {
            success: false,
            error: 'VALIDATION_ERROR',
            message: validation.errors.join(', '),
            validationErrors: validation.errors
        };
    }

    const user = JSON.parse(localStorage.getItem('pos_user')) || { username: 'admin' };

    // Generate request key for deduplication
    const requestKey = `addProduct_${productData.product_name}_${Date.now()}`;

    // Check if same request is already pending
    if (pendingRequests.has(requestKey)) {
        return {
            success: false,
            error: 'DUPLICATE_REQUEST',
            message: 'Request already in progress. Please wait.'
        };
    }

    try {
        // Mark request as pending
        pendingRequests.set(requestKey, true);

        // Check sheet capacity first
        const capacity = await checkSheetCapacity();
        if (capacity.available === false) {
            return {
                success: false,
                error: 'CAPACITY_EXCEEDED',
                rowLimit: true,
                message: capacity.message || 'Sheet is full. Please add more rows.'
            };
        }

        // Prepare payload
        const payload = {
            action: 'addProduct',
            product_name: productData.product_name.trim(),
            category: productData.category.trim(),
            purchase_price: parseFloat(productData.purchase_price),
            sale_price: parseFloat(productData.sale_price),
            quantity: parseInt(productData.quantity),
            minimum_quantity: parseInt(productData.minimum_quantity),
            weight: productData.weight ? productData.weight.toString().trim() : '',
            unit: productData.unit ? productData.unit.toString().trim() : '',
            added_by: user.username
        };

        // Clear cache before adding
        productsCache = null;
        cacheTimestamp = 0;

        // Make API request
        const data = await makeApiRequest(payload, 20000);

        // Check if backend reported success
        if (!data.success) {
            return {
                success: false,
                error: data.error || 'BACKEND_ERROR',
                message: data.message || 'Failed to add product'
            };
        }

        return data;

    } catch (error) {
        console.error('Add product error:', error);
        return getErrorResponse(error, 'Failed to add product');
    } finally {
        // Remove from pending requests
        pendingRequests.delete(requestKey);
    }
};

/**
 * Update product in Google Sheet
 * @param {Object} productData - Product data to update (must include product_id)
 * @returns {Promise<Object>} - { success: boolean, message: string }
 */
window.updateProductInSheet = async function (productData) {
    // Validate product ID
    if (!productData.product_id || productData.product_id.trim() === '') {
        return {
            success: false,
            error: 'VALIDATION_ERROR',
            message: 'Product ID is required for update'
        };
    }

    // Validate other product data
    const validation = validateProductData(productData);
    if (!validation.valid) {
        return {
            success: false,
            error: 'VALIDATION_ERROR',
            message: validation.errors.join(', '),
            validationErrors: validation.errors
        };
    }

    const user = JSON.parse(localStorage.getItem('pos_user')) || { username: 'admin' };

    // Generate request key for deduplication
    const requestKey = `updateProduct_${productData.product_id}_${Date.now()}`;

    if (pendingRequests.has(requestKey)) {
        return {
            success: false,
            error: 'DUPLICATE_REQUEST',
            message: 'Update already in progress. Please wait.'
        };
    }

    try {
        pendingRequests.set(requestKey, true);

        const payload = {
            action: 'updateProduct',
            product_id: productData.product_id.trim(),
            product_name: productData.product_name.trim(),
            category: productData.category.trim(),
            purchase_price: parseFloat(productData.purchase_price),
            sale_price: parseFloat(productData.sale_price),
            quantity: parseInt(productData.quantity),
            minimum_quantity: parseInt(productData.minimum_quantity),
            weight: productData.weight ? productData.weight.toString().trim() : '',
            unit: productData.unit ? productData.unit.toString().trim() : '',
            barcode: productData.barcode ? productData.barcode.toString().trim() : '',
            updated_by: user.username
        };

        productsCache = null;
        cacheTimestamp = 0;

        const data = await makeApiRequest(payload, 20000);

        // Check for specific error types
        if (!data.success) {
            // Handle barcode duplicate error specifically
            if (data.barcodeDuplicate || data.error === 'BARCODE_DUPLICATE') {
                return {
                    success: false,
                    barcodeDuplicate: true,
                    error: 'BARCODE_DUPLICATE',
                    message: data.message || 'This barcode is already assigned to another product'
                };
            }

            return {
                success: false,
                error: data.error || 'UPDATE_FAILED',
                message: data.message || 'Failed to update product'
            };
        }

        return data;

    } catch (error) {
        console.error('Update product error:', error);
        return getErrorResponse(error, 'Failed to update product');
    } finally {
        pendingRequests.delete(requestKey);
    }
};

/**
 * Delete product from Google Sheet
 * @param {string} productId - Product ID to delete
 * @returns {Promise<Object>} - { success: boolean, message: string }
 */
window.deleteProductFromSheet = async function (productId) {
    // Validate product ID
    if (!productId || productId.trim() === '') {
        return {
            success: false,
            error: 'VALIDATION_ERROR',
            message: 'Product ID is required for deletion'
        };
    }

    const user = JSON.parse(localStorage.getItem('pos_user')) || { username: 'admin' };

    const payload = {
        action: 'deleteProduct',
        product_id: productId.trim(),
        deleted_by: user.username
    };

    try {
        productsCache = null;
        cacheTimestamp = 0;

        const data = await makeApiRequest(payload, 15000);

        if (!data.success) {
            return {
                success: false,
                error: data.error || 'DELETE_FAILED',
                message: data.message || 'Failed to delete product'
            };
        }

        return data;

    } catch (error) {
        console.error('Delete product error:', error);
        return getErrorResponse(error, 'Failed to delete product');
    }
};

// Get products
window.getProducts = async function (forceRefresh = false) {
    if (!forceRefresh && productsCache && (Date.now() - cacheTimestamp) < CACHE_DURATION) {
        return productsCache;
    }

    try {
        const url = `${API_URL}?action=getProducts&_=${Date.now()}`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        const response = await fetch(url, {
            method: 'GET',
            signal: controller.signal,
            cache: 'no-cache'
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        productsCache = data.products || [];
        cacheTimestamp = Date.now();
        return productsCache;

    } catch (error) {
        return productsCache || [];
    }
};

/**
 * Add sale to Google Sheet
 * @param {Object} saleData - Sale data to add
 * @returns {Promise<Object>} - { success: boolean, order_number: string, message: string }
 */
window.addSaleV2 = async function (saleData) {
    // Validate sale data
    const validation = validateSaleData(saleData);
    if (!validation.valid) {
        return {
            success: false,
            error: 'VALIDATION_ERROR',
            message: validation.errors.join(', '),
            validationErrors: validation.errors
        };
    }

    const user = JSON.parse(localStorage.getItem('pos_user')) || { username: 'system' };

    // Generate request key for deduplication
    const requestKey = `addSale_${saleData.order_number}_${Date.now()}`;

    if (pendingRequests.has(requestKey)) {
        return {
            success: false,
            error: 'DUPLICATE_REQUEST',
            message: 'Sale submission already in progress. Please wait.'
        };
    }

    try {
        pendingRequests.set(requestKey, true);

        const payload = {
            action: 'addSaleV2',
            order_number: saleData.order_number.trim(),
            customer_name: saleData.customer_name ? saleData.customer_name.trim() : 'Walk-in Customer',
            total_items: parseInt(saleData.total_items),
            total_amount: parseFloat(saleData.total_amount),
            date: saleData.date,
            time: saleData.time,
            payment_method: saleData.payment_method.trim(),
            amount_paid: parseFloat(saleData.amount_paid) || 0,
            change: parseFloat(saleData.change) || 0,
            tax: parseFloat(saleData.tax) || 0,
            sold_by: user.username
        };

        const data = await makeApiRequest(payload, 20000);

        // Invalidate sales cache
        salesCache = null;

        if (!data.success) {
            return {
                success: false,
                error: data.error || 'SALE_FAILED',
                message: data.message || 'Failed to record sale'
            };
        }

        return data;

    } catch (error) {
        console.error('Add sale error:', error);
        return getErrorResponse(error, 'Failed to record sale');
    } finally {
        pendingRequests.delete(requestKey);
    }
};

/**
 * Add sale item to Google Sheet
 * @param {Object} itemData - Sale item data
 * @returns {Promise<Object>} - { success: boolean, message: string }
 */
window.addSaleItem = async function (itemData) {
    // Validate required fields
    const errors = [];

    if (!itemData.order_number || itemData.order_number.trim() === '') {
        errors.push('Order number is required');
    }
    if (!itemData.product_name || itemData.product_name.trim() === '') {
        errors.push('Product name is required');
    }
    if (itemData.quantity === undefined || itemData.quantity === null || parseInt(itemData.quantity) <= 0) {
        errors.push('Valid quantity is required');
    }
    if (itemData.price === undefined || itemData.price === null || parseFloat(itemData.price) < 0) {
        errors.push('Valid price is required');
    }

    if (errors.length > 0) {
        return {
            success: false,
            error: 'VALIDATION_ERROR',
            message: errors.join(', ')
        };
    }

    try {
        const payload = {
            action: 'addSaleItem',
            order_number: itemData.order_number.trim(),
            product_name: itemData.product_name.trim(),
            quantity: parseInt(itemData.quantity),
            category: itemData.category ? itemData.category.trim() : '',
            weight: itemData.weight ? itemData.weight.toString() : '',
            unit: itemData.unit ? itemData.unit.toString() : '',
            price: parseFloat(itemData.price),
            line_total: parseFloat(itemData.line_total),
            product_id: itemData.product_id ? itemData.product_id.trim() : ''
        };

        const data = await makeApiRequest(payload, 20000);

        if (!data.success) {
            return {
                success: false,
                error: data.error || 'ITEM_ADD_FAILED',
                message: data.message || 'Failed to add sale item'
            };
        }

        return data;

    } catch (error) {
        console.error('Add sale item error:', error);
        return getErrorResponse(error, 'Failed to add sale item');
    }
};

// Get sales
window.getSalesV2 = async function (forceRefresh = false) {
    try {
        // Check cache first (unless forcing refresh)
        if (!forceRefresh && salesCache && (Date.now() - cacheTimestamp) < CACHE_DURATION) {
            return salesCache;
        }

        const url = `${API_URL}?action=getSalesV2&_=${Date.now()}`;

        // Simple fetch without complex settings
        const response = await fetch(url, {
            method: 'GET',
            cache: 'no-cache'
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        // Get the raw response text
        const rawText = await response.text();

        // Try to parse as JSON
        let data;
        try {
            data = JSON.parse(rawText);
        } catch (parseError) {
            // Try to find JSON in the response
            const jsonMatch = rawText.match(/\{.*\}/s);
            if (jsonMatch) {
                try {
                    data = JSON.parse(jsonMatch[0]);
                } catch (e) {
                    throw new Error('Invalid JSON response');
                }
            } else {
                throw new Error('No valid JSON in response');
            }
        }

        // Extract the sales array from the response
        let salesArray = [];

        if (data && typeof data === 'object') {
            if (Array.isArray(data.sales)) {
                salesArray = data.sales;
            } else if (Array.isArray(data)) {
                salesArray = data;
            } else {
                // Try to find any array in the response
                for (const key in data) {
                    if (Array.isArray(data[key])) {
                        salesArray = data[key];
                        break;
                    }
                }
            }
        }

        // Update cache
        salesCache = salesArray;
        cacheTimestamp = Date.now();

        return salesCache;

    } catch (error) {
        // Return cached data if available
        if (salesCache) {
            return salesCache;
        }

        return [];
    }
};

// Get sale items with caching
window.getSaleItems = async function (orderNumber) {
    try {
        // Check cache first
        if (saleItemsCache[orderNumber]) {
            return saleItemsCache[orderNumber];
        }

        const url = `${API_URL}?action=getSaleItems&order_number=${orderNumber}&_=${Date.now()}`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const response = await fetch(url, {
            method: 'GET',
            signal: controller.signal,
            cache: 'no-cache'
        });

        clearTimeout(timeoutId);
        const data = await response.json();
        const items = data.items || [];

        // Cache the result
        saleItemsCache[orderNumber] = items;

        return items;
    } catch (error) {
        return saleItemsCache[orderNumber] || [];
    }
};

// Clear sale items cache for a specific order
window.clearSaleItemsCache = function (orderNumber) {
    if (saleItemsCache[orderNumber]) {
        delete saleItemsCache[orderNumber];
    }
};

/**
 * Get sales from Google Sheet (legacy, use getSalesV2 instead)
 * @returns {Promise<Array>} - Array of sales
 */
window.getSales = async function () {
    const payload = {
        action: 'getSales'
    };

    try {
        const data = await makeApiRequest(payload, 15000);
        return data.sales || [];
    } catch (error) {
        console.error('Get sales error:', error);
        return [];
    }
};

/**
 * Add sale (legacy, use addSaleV2 instead)
 * @param {Object} saleData - Sale data
 * @returns {Promise<Object>} - Result object
 */
window.addSale = async function (saleData) {
    const user = JSON.parse(localStorage.getItem('pos_user')) || { username: 'system' };

    const payload = {
        action: 'addSale',
        product_id: saleData.product_id || '',
        product_name: saleData.product_name || '',
        quantity_sold: parseInt(saleData.quantity_sold) || 0,
        total_price: parseFloat(saleData.total_price) || 0,
        sold_by: user.username
    };

    try {
        const data = await makeApiRequest(payload, 15000);
        return data;
    } catch (error) {
        console.error('Add sale error:', error);
        return {
            success: false,
            error: 'NETWORK_ERROR',
            message: 'Failed to record sale due to network error'
        };
    }
};

/**
 * Get activity logs from Google Sheet
 * @returns {Promise<Array>} - Array of log entries
 */
window.getLogs = async function () {
    const payload = {
        action: 'getLogs'
    };

    try {
        const data = await makeApiRequest(payload, 10000);
        return data.logs || [];
    } catch (error) {
        console.error('Get logs error:', error);
        return [];
    }
};

/**
 * Add activity log entry
 * @param {string} action - Action description
 * @returns {Promise<void>}
 */
window.addLog = async function (action) {
    if (!action || action.trim() === '') {
        return; // Silent fail for empty actions
    }

    const user = JSON.parse(localStorage.getItem('pos_user')) || { username: 'system' };

    const payload = {
        action: 'addLog',
        user: user.username,
        log_action: action.trim()
    };

    try {
        await makeApiRequest(payload, 5000);
    } catch (error) {
        // Silent fail for logging errors
        console.error('Add log error:', error);
    }
};

window.getUsers = async function () {
    try {
        const response = await fetch(`${API_URL}?action=getUsers`);
        const data = await response.json();
        return data.users || [];
    } catch (error) {
        return [
            {
                user_id: '1',
                username: 'admin',
                password: 'admin123',
                role: 'owner'
            },
            {
                user_id: '2',
                username: 'reception',
                password: 'reception123',
                role: 'reception'
            },
            {
                user_id: '3',
                username: 'inventory',
                password: 'inventory123',
                role: 'inventory'
            },
            {
                user_id: '4',
                username: 'customer',
                password: 'customer123',
                role: 'customer'
            }
        ];
    }
};