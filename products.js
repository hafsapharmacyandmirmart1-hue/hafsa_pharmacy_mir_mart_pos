// Products Module for Hafsa Pharmacy & Mir Mart POS

// Product categories
const PRODUCT_CATEGORIES = [
    'Grocery',
    'Cosmetics',
    'Personal Care',
    'Baby Care',
    'Dairy Products',
    'Bakery Items',
    'Beverages',
    'Snacks & Biscuits',
    'Frozen Foods',
    'Household Items',
    'Cleaning & Detergents',
    'Stationery',
    'Kitchen Items',
    'Plastic & Disposable Items',
    'Pet Care',
    'Health & Wellness',
    'Others',
    'custom'
];

// Weight options
const WEIGHT_OPTIONS = [
    '50 g',
    '100 g',
    '½ Pao (125 g)',
    '1 Pao (250 g)',
    '½ KG (500 g)',
    '1 KG',
    '2 KG',
    '5 KG',
    'custom'
];

// Unit options
const UNIT_OPTIONS = [
    'Piece (pcs)',
    'Bottle',
    'Tube',
    'Pack',
    'Jar',
    'Box',
    'Carton',
    'Packet',
    'Dozen',
    'custom'
];

// Get all products
async function getAllProducts() {
    try {
        const products = await getProducts();
        return products || [];
    } catch (error) {
        console.error('Error getting products:', error);
        return [];
    }
}

// Get product by ID
async function getProductById(productId) {
    try {
        const products = await getProducts();
        return products.find(product => product.product_id === productId) || null;
    } catch (error) {
        console.error('Error getting product:', error);
        return null;
    }
}

// Search products
function searchProducts(products, searchTerm) {
    if (!searchTerm) return products;
    
    const term = searchTerm.toLowerCase();
    return products.filter(product => 
        (product.product_name && product.product_name.toLowerCase().includes(term)) ||
        (product.category && product.category.toLowerCase().includes(term)) ||
        (product.barcode && product.barcode.includes(term)) ||
        (product.product_id && product.product_id.toLowerCase().includes(term)) ||
        (product.weight && product.weight.toLowerCase().includes(term)) ||
        (product.unit && product.unit.toLowerCase().includes(term))
    );
}

// Filter products by category
function filterProductsByCategory(products, category) {
    if (!category) return products;
    return products.filter(product => product.category === category);
}

// Get unique categories from products
function getUniqueCategories(products) {
    const categories = new Set();
    products.forEach(product => {
        if (product.category) {
            categories.add(product.category);
        }
    });
    return Array.from(categories).sort();
}

// Get category counts
function getCategoryCounts(products) {
    const counts = {};
    products.forEach(product => {
        const category = product.category || 'Uncategorized';
        counts[category] = (counts[category] || 0) + 1;
    });
    return counts;
}

// Sort products
function sortProducts(products, sortBy = 'name') {
    const sorted = [...products];
    
    switch (sortBy) {
        case 'name':
            sorted.sort((a, b) => (a.product_name || '').localeCompare(b.product_name || ''));
            break;
        case 'price_low':
            sorted.sort((a, b) => (parseFloat(a.sale_price) || 0) - (parseFloat(b.sale_price) || 0));
            break;
        case 'price_high':
            sorted.sort((a, b) => (parseFloat(b.sale_price) || 0) - (parseFloat(a.sale_price) || 0));
            break;
        case 'category':
            sorted.sort((a, b) => (a.category || '').localeCompare(b.category || ''));
            break;
        case 'quantity_low':
            sorted.sort((a, b) => (parseInt(a.quantity) || 0) - (parseInt(b.quantity) || 0));
            break;
        case 'quantity_high':
            sorted.sort((a, b) => (parseInt(b.quantity) || 0) - (parseInt(a.quantity) || 0));
            break;
        case 'low_stock':
            sorted.sort((a, b) => {
                const aQty = parseInt(a.quantity) || 0;
                const aMin = parseInt(a.minimum_quantity) || 10;
                const bQty = parseInt(b.quantity) || 0;
                const bMin = parseInt(b.minimum_quantity) || 10;
                const aIsLow = aQty < aMin;
                const bIsLow = bQty < bMin;
                
                if (aIsLow && !bIsLow) return -1;
                if (!aIsLow && bIsLow) return 1;
                return 0;
            });
            break;
        default:
            sorted.sort((a, b) => (a.product_name || '').localeCompare(b.product_name || ''));
    }
    
    return sorted;
}

// Get low stock products
function getLowStockProducts(products, threshold = 10) {
    return products.filter(product => {
        const quantity = parseInt(product.quantity) || 0;
        const minQty = parseInt(product.minimum_quantity) || threshold;
        return quantity > 0 && quantity < minQty;
    });
}

// Get out of stock products
function getOutOfStockProducts(products) {
    return products.filter(product => {
        const quantity = parseInt(product.quantity) || 0;
        return quantity <= 0;
    });
}

// Calculate inventory value
function calculateInventoryValue(products) {
    return products.reduce((total, product) => {
        const quantity = parseInt(product.quantity) || 0;
        const purchasePrice = parseFloat(product.purchase_price) || 0;
        return total + (quantity * purchasePrice);
    }, 0);
}

// Format price
function formatPrice(price) {
    const num = parseFloat(price) || 0;
    return 'Rs. ' + num.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// Format quantity with unit
function formatQuantity(product) {
    const quantity = parseInt(product.quantity) || 0;
    const unit = product.unit || '';
    const weight = product.weight || '';
    
    let formatted = quantity.toString();
    
    if (weight) {
        formatted += ' ' + weight;
    }
    
    if (unit && !weight.includes(unit)) {
        formatted += ' ' + unit;
    }
    
    return formatted;
}

// Validate product data
function validateProductData(productData) {
    const errors = [];
    
    if (!productData.product_name || productData.product_name.trim() === '') {
        errors.push('Product name is required');
    }
    
    if (!productData.category || productData.category.trim() === '') {
        errors.push('Category is required');
    }
    
    const purchasePrice = parseFloat(productData.purchase_price);
    if (isNaN(purchasePrice) || purchasePrice < 0) {
        errors.push('Valid purchase price is required');
    }
    
    const salePrice = parseFloat(productData.sale_price);
    if (isNaN(salePrice) || salePrice < 0) {
        errors.push('Valid sale price is required');
    }
    
    const quantity = parseInt(productData.quantity);
    if (isNaN(quantity) || quantity < 0) {
        errors.push('Valid quantity is required');
    }
    
    if (!productData.weight || productData.weight.trim() === '') {
        errors.push('Weight/Quantity is required');
    }
    
    if (!productData.unit || productData.unit.trim() === '') {
        errors.push('Unit is required');
    }
    
    return {
        isValid: errors.length === 0,
        errors: errors
    };
}

// Generate barcode number
function generateBarcodeNumber() {
    // Generate 12-digit EAN-13 compatible barcode
    // Start with 629 (commonly used for retail)
    const base = '629' + Math.floor(Math.random() * 1000000000).toString().padStart(9, '0');
    
    // Calculate check digit
    const digits = base.split('').map(Number);
    let sum = 0;
    
    for (let i = 0; i < digits.length; i++) {
        sum += digits[i] * (i % 2 === 0 ? 1 : 3);
    }
    
    const checkDigit = (10 - (sum % 10)) % 10;
    return base + checkDigit;
}

// Generate custom barcode (for editing)
function generateCustomBarcode() {
    // Generate custom barcode with timestamp
    const timestamp = Date.now().toString().slice(-8);
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return 'CUST' + timestamp + random;
}

// Get category color
function getCategoryColor(category) {
    const colors = {
        'Grocery': '#4CAF50',
        'Cosmetics': '#E91E63',
        'Personal Care': '#2196F3',
        'Baby Care': '#FF9800',
        'Dairy Products': '#795548',
        'Bakery Items': '#FF5722',
        'Beverages': '#009688',
        'Snacks & Biscuits': '#9C27B0',
        'Frozen Foods': '#00BCD4',
        'Household Items': '#607D8B',
        'Cleaning & Detergents': '#3F51B5',
        'Stationery': '#FFC107',
        'Kitchen Items': '#8BC34A',
        'Plastic & Disposable Items': '#9E9E9E',
        'Pet Care': '#795548',
        'Health & Wellness': '#FF4081',
        'Others': '#9C27B0'
    };
    return colors[category] || '#666';
}

// Check for duplicate product (name, weight, unit)
function checkForDuplicateProduct(products, productData, excludeProductId = '') {
    const name = productData.product_name.trim().toLowerCase();
    const weight = productData.weight.trim().toLowerCase();
    const unit = productData.unit.trim().toLowerCase();
    
    return products.some(product => {
        // Skip the product being edited
        if (excludeProductId && product.product_id === excludeProductId) {
            return false;
        }
        
        const existingName = (product.product_name || '').trim().toLowerCase();
        const existingWeight = (product.weight || '').trim().toLowerCase();
        const existingUnit = (product.unit || '').trim().toLowerCase();
        
        return existingName === name && 
               existingWeight === weight && 
               existingUnit === unit;
    });
}

// Check for duplicate barcode
function checkForDuplicateBarcode(products, barcode, excludeProductId = '') {
    if (!barcode) return false;
    
    return products.some(product => {
        if (excludeProductId && product.product_id === excludeProductId) {
            return false;
        }
        return product.barcode === barcode;
    });
}

// Format product for display
function formatProductForDisplay(product) {
    return {
        id: product.product_id || 'N/A',
        name: product.product_name || 'N/A',
        category: product.category || 'N/A',
        purchase_price: parseFloat(product.purchase_price) || 0,
        sale_price: parseFloat(product.sale_price) || 0,
        quantity: parseInt(product.quantity) || 0,
        min_qty: parseInt(product.minimum_quantity) || 10,
        barcode: product.barcode || 'N/A',
        weight: product.weight || '-',
        unit: product.unit || '-'
    };
}

// Export functions
window.PRODUCTS = {
    getAllProducts,
    getProductById,
    searchProducts,
    filterProductsByCategory,
    getUniqueCategories,
    getCategoryCounts,
    sortProducts,
    getLowStockProducts,
    getOutOfStockProducts,
    calculateInventoryValue,
    formatPrice,
    formatQuantity,
    validateProductData,
    generateBarcodeNumber,
    generateCustomBarcode,
    getCategoryColor,
    checkForDuplicateProduct,
    checkForDuplicateBarcode,
    formatProductForDisplay,
    CATEGORIES: PRODUCT_CATEGORIES,
    WEIGHTS: WEIGHT_OPTIONS,
    UNITS: UNIT_OPTIONS
};

// Initialize product module
console.log('📦 Products module loaded successfully');