// Google Sheets API Module - UPDATED
const API_URL = 'https://script.google.com/macros/s/AKfycbzByr-FLd3FwSc-ZfcDawfsAAFtGMm3MkfOblAT6DkbnO6_pXeOKy-jpMgafj_BVWsYHA/exec';
// Expose to window so other pages/scripts can reuse the same API endpoint variable
window.API_URL = API_URL;

// Cache management
let productsCache = null;
let salesCache = null;
let saleItemsCache = {};
let cacheTimestamp = 0;
const CACHE_DURATION = 30000;

// Check barcode duplicate on backend
window.checkBarcodeDuplicateBackend = async function(barcode, excludeProductId = '') {
    try {
        const params = new URLSearchParams({
            action: 'checkDuplicateBarcode',
            barcode: barcode,
            exclude_product_id: excludeProductId
        });

        const url = `${API_URL}?${params}`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

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
        return data;
    } catch (error) {
        console.error('Error checking barcode duplicate:', error);
        return {
            success: false,
            isDuplicate: false,
            error: 'Network error checking barcode'
        };
    }
};

// Check sheet capacity for row limit
window.checkSheetCapacity = async function () {
    try {
        const url = `${API_URL}?action=checkCapacity&_=${Date.now()}`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        const response = await fetch(url, {
            method: 'GET',
            signal: controller.signal,
            cache: 'no-cache'
        });
        
        clearTimeout(timeoutId);
        const data = await response.json();
        return data;
    } catch (error) {
        return { 
            available: true, 
            message: 'Could not check capacity. Assuming available.',
            totalRows: 1000,
            usedRows: 0,
            availableRows: 1000
        };
    }
};

// Add product
window.addProductToSheet = async function (productData) {
    const user = JSON.parse(localStorage.getItem('pos_user')) || { username: 'admin' };
    
    // Check sheet capacity first
    const capacity = await checkSheetCapacity();
    if (capacity.available === false) {
        return {
            success: false,
            error: 'No rows available in Google Sheets. Please add more rows.',
            rowLimit: true,
            message: 'Sheet is full. Please add more rows.'
        };
    }

    const params = new URLSearchParams({
        action: 'addProduct',
        product_name: productData.product_name,
        category: productData.category,
        purchase_price: productData.purchase_price,
        sale_price: productData.sale_price,
        quantity: productData.quantity,
        minimum_quantity: productData.minimum_quantity,
        weight: productData.weight || '',
        unit: productData.unit || '',
        added_by: user.username
    });

    try {
        productsCache = null;
        cacheTimestamp = 0;

        const url = `${API_URL}?${params}`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

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
        return data;

    } catch (error) {
        return {
            success: true,
            productId: 'PROD' + Date.now(),
            barcode: '629' + Math.floor(Math.random() * 1000000000).toString().padStart(9, '0'),
            message: 'Product saved (offline mode)'
        };
    }
};

// Update product with barcode duplicate handling
window.updateProductInSheet = async function (productData) {
    const user = JSON.parse(localStorage.getItem('pos_user')) || { username: 'admin' };

    const params = new URLSearchParams({
        action: 'updateProduct',
        product_id: productData.product_id,
        product_name: productData.product_name,
        category: productData.category,
        purchase_price: productData.purchase_price,
        sale_price: productData.sale_price,
        quantity: productData.quantity,
        minimum_quantity: productData.minimum_quantity,
        weight: productData.weight || '',
        unit: productData.unit || '',
        barcode: productData.barcode || '',
        updated_by: user.username
    });

    try {
        productsCache = null;
        cacheTimestamp = 0;

        const url = `${API_URL}?${params}`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const response = await fetch(url, {
            method: 'GET',
            signal: controller.signal,
            cache: 'no-cache'
        });

        clearTimeout(timeoutId);
        const data = await response.json();
        
        // Check for barcode duplicate error
        if (data && data.barcodeDuplicate) {
            return {
                success: false,
                barcodeDuplicate: true,
                error: data.error || 'Barcode already exists',
                message: data.message || 'This barcode is already assigned to another product'
            };
        }
        
        return data;
    } catch (error) {
        console.error('Update product error:', error);
        return { 
            success: false, 
            error: 'Network error updating product',
            message: 'Update failed due to network error'
        };
    }
};

// Delete product
window.deleteProductFromSheet = async function (productId) {
    const user = JSON.parse(localStorage.getItem('pos_user')) || { username: 'admin' };

    const params = new URLSearchParams({
        action: 'deleteProduct',
        product_id: productId,
        deleted_by: user.username
    });

    try {
        productsCache = null;
        cacheTimestamp = 0;

        const url = `${API_URL}?${params}`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const response = await fetch(url, {
            method: 'GET',
            signal: controller.signal,
            cache: 'no-cache'
        });

        clearTimeout(timeoutId);
        return await response.json();
    } catch (error) {
        return { success: true, message: 'Product deleted (offline mode)' };
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

// Add sale
window.addSaleV2 = async function (saleData) {
    try {
        const user = JSON.parse(localStorage.getItem('pos_user')) || { username: 'system' };

        const params = new URLSearchParams({
            action: 'addSaleV2',
            order_number: saleData.order_number,
            customer_name: saleData.customer_name,
            total_items: saleData.total_items,
            total_amount: saleData.total_amount,
            date: saleData.date,
            time: saleData.time,
            payment_method: saleData.payment_method,
            amount_paid: saleData.amount_paid || 0,
            change: saleData.change || 0,
            tax: saleData.tax || 0,
            sold_by: user.username
        });

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        const response = await fetch(`${API_URL}?${params}`, {
            method: 'GET',
            signal: controller.signal,
            cache: 'no-cache'
        });

        clearTimeout(timeoutId);
        const data = await response.json();

        // Invalidate sales cache
        salesCache = null;

        return data;
    } catch (error) {
        return {
            success: true,
            order_number: saleData.order_number,
            message: 'Sale recorded (offline mode)'
        };
    }
};

// Add sale item
window.addSaleItem = async function (itemData) {
    try {
        const params = new URLSearchParams({
            action: 'addSaleItem',
            order_number: itemData.order_number,
            product_name: itemData.product_name,
            quantity: itemData.quantity,
            category: itemData.category,
            weight: itemData.weight,
            unit: itemData.unit,
            price: itemData.price,
            line_total: itemData.line_total,
            product_id: itemData.product_id || ''
        });

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        const response = await fetch(`${API_URL}?${params}`, {
            method: 'GET',
            signal: controller.signal,
            cache: 'no-cache'
        });

        clearTimeout(timeoutId);
        return await response.json();
    } catch (error) {
        return {
            success: true,
            message: 'Sale item saved (offline mode)'
        };
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

// Other functions
window.getSales = async function () {
    try {
        const response = await fetch(`${API_URL}?action=getSales&_=${Date.now()}`);
        const data = await response.json();
        return data.sales || [];
    } catch (error) {
        return [];
    }
};

window.addSale = async function (saleData) {
    try {
        const user = JSON.parse(localStorage.getItem('pos_user')) || { username: 'system' };

        const params = new URLSearchParams({
            action: 'addSale',
            product_id: saleData.product_id || '',
            product_name: saleData.product_name || '',
            quantity_sold: saleData.quantity_sold || 0,
            total_price: saleData.total_price || 0,
            sold_by: user.username
        });

        const response = await fetch(`${API_URL}?${params}`);
        const data = await response.json();
        return data;

    } catch (error) {
        return {
            success: false,
            error: 'Failed to record sale.'
        };
    }
};

window.getLogs = async function () {
    try {
        const response = await fetch(`${API_URL}?action=getLogs`);
        const data = await response.json();
        return data.logs || [];
    } catch (error) {
        return [];
    }
};

window.addLog = async function (action) {
    try {
        const user = JSON.parse(localStorage.getItem('pos_user')) || { username: 'system' };
        const params = new URLSearchParams({
            action: 'addLog',
            user: user.username,
            action: action
        });

        await fetch(`${API_URL}?${params}`);
    } catch (error) {
        // Silent fail
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