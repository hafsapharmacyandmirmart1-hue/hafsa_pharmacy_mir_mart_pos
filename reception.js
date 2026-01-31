// reception.js - OPTIMIZED VERSION FOR FAST PROCESSING

// Global variables
let cart = [];
let products = [];
let currentOrderNumber = 50000000000;
let taxAmount = 1;
let isScanMode = true;
let barcodeTimer = null;
let isProcessingSale = false;

// Check access
if (!checkPageAccess('reception')) {
    window.location.href = 'index.html';
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', function () {
    initializePOS();
    setupEventListeners();
    loadProducts();
    updateDateTime();
    setInterval(updateDateTime, 1000);
    setScanMode();
});

// Initialize POS
async function initializePOS() {
    const user = JSON.parse(localStorage.getItem('pos_user'));
    if (user) {
        document.getElementById('cashierName').textContent = user.username;
    }

    await updateOrderNumber();
    setupBarcodeScanner();
    loadTodayTransactions();
}

// Setup event listeners
function setupEventListeners() {
    // Sidebar navigation
    const posLink = document.getElementById('posLink');
    const priceLink = document.getElementById('priceLink');

    if (posLink) {
        posLink.addEventListener('click', function (e) {
            e.preventDefault();
            window.location.href = 'reception.html';
        });
    }

    if (priceLink) {
        priceLink.addEventListener('click', function (e) {
            e.preventDefault();
            window.location.href = 'price-view.html';
        });
    }

    // Logout button
    document.getElementById('logoutBtn').addEventListener('click', function (e) {
        e.preventDefault();
        showModal('logoutModal');
    });

    // Mode buttons - FIXED: No scroll on click
    document.getElementById('scanModeBtn').addEventListener('click', function (e) {
        e.preventDefault();
        setScanMode();
    });

    document.getElementById('searchModeBtn').addEventListener('click', function (e) {
        e.preventDefault();
        setSearchMode();
        document.getElementById('searchProduct').focus();
    });

    // Refresh button
    document.getElementById('refreshBtn').addEventListener('click', function (e) {
        e.preventDefault();
        loadProducts(true);
    });

    // Refresh transactions button
    document.getElementById('refreshTransactionsBtn').addEventListener('click', function (e) {
        e.preventDefault();
        loadTodayTransactions(true);
    });

    // Search input
    document.getElementById('searchProduct').addEventListener('input', function (e) {
        searchProducts(e.target.value);
    });

    // Clear cart buttons
    document.getElementById('clearCartBtn').addEventListener('click', clearCart);
    document.getElementById('clearCartBtn2').addEventListener('click', clearCart);

    // Tax controls
    document.getElementById('decreaseTax').addEventListener('click', function () {
        adjustTax(-1);
    });

    document.getElementById('increaseTax').addEventListener('click', function () {
        adjustTax(1);
    });

    document.getElementById('taxAmount').addEventListener('change', function () {
        updateTax();
    });

    document.getElementById('taxAmount').addEventListener('input', function () {
        updateTax();
    });

    // Payment method change
    document.getElementById('paymentMethod').addEventListener('change', function () {
        toggleCashPayment();
        calculateChange();
    });

    // Amount paid input
    document.getElementById('amountPaid').addEventListener('input', function () {
        calculateChange();
    });

    // Customer name input
    document.getElementById('customerName').addEventListener('input', function () {
        const name = this.value || 'Walk-in Customer';
        document.getElementById('customerNameDisplay').textContent = name;
    });

    // Complete sale button - OPTIMIZED: Fast processing
    document.getElementById('completeSaleBtn').addEventListener('click', async function (e) {
        e.preventDefault();
        await completeSaleAndPrintFast();
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', function (e) {
        // Enter to complete sale
        if (e.key === 'Enter' && !e.target.matches('input, textarea, select') && !e.shiftKey) {
            e.preventDefault();
            if (cart.length > 0 && !isProcessingSale) {
                document.getElementById('completeSaleBtn').click();
            }
        }

        // F2 to focus on barcode input
        if (e.key === 'F2' && isScanMode) {
            e.preventDefault();
            const barcodeInput = document.getElementById('barcodeInput');
            if (barcodeInput) barcodeInput.focus();
        }

        // Escape to clear focus
        if (e.key === 'Escape') {
            document.activeElement.blur();
            closeBarcodePopup();
        }
    });

    // Barcode input focus
    document.getElementById('barcodeInput').addEventListener('focus', function () {
        this.value = '';
    });
}

// Setup barcode scanner
function setupBarcodeScanner() {
    const barcodeInput = document.getElementById('barcodeInput');
    let barcode = '';
    let lastTime = Date.now();

    barcodeInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            return;
        }
    });

    barcodeInput.addEventListener('input', function (e) {
        const currentTime = Date.now();
        const char = this.value;

        if (currentTime - lastTime > 200) {
            barcode = '';
        }

        lastTime = currentTime;
        barcode += char;
        this.value = '';

        if (barcode.length >= 8) {
            if (barcodeTimer) clearTimeout(barcodeTimer);
            barcodeTimer = setTimeout(() => {
                processBarcode(barcode.trim());
                barcode = '';
            }, 100);
        }
    });
}

// Process scanned barcode
function processBarcode(barcode) {
    if (!barcode || barcode.length < 3) return;

    showScanningAnimation();
    const cleanedBarcode = barcode.trim().replace(/[^\d]/g, '');

    const product = products.find(p => {
        if (!p.barcode) return false;
        const productBarcode = String(p.barcode).trim().replace(/[^\d]/g, '');
        return productBarcode === cleanedBarcode;
    });

    if (product) {
        showScannerStatus('✓ Product found: ' + product.product_name, 'success');
        setTimeout(() => {
            addToCart(product);
        }, 300);
    } else {
        showBarcodePopup('Product not found for barcode: ' + cleanedBarcode);
        setSearchMode();
        document.getElementById('searchProduct').value = cleanedBarcode;
        searchProducts(cleanedBarcode);
    }
}

// Show scanning animation
function showScanningAnimation() {
    const scannerStatus = document.getElementById('scannerStatus');
    scannerStatus.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Scanning...';
    scannerStatus.className = 'scanner-status scanning';

    setTimeout(() => {
        scannerStatus.innerHTML = '';
        scannerStatus.className = 'scanner-status';
    }, 1000);
}

// Show scanner status
function showScannerStatus(message, type) {
    const scannerStatus = document.getElementById('scannerStatus');
    scannerStatus.innerHTML = message;
    scannerStatus.className = `scanner-status ${type}`;

    setTimeout(() => {
        scannerStatus.innerHTML = '';
        scannerStatus.className = 'scanner-status';
    }, 3000);
}

// Show barcode popup
function showBarcodePopup(message) {
    const popup = document.getElementById('barcodePopup');
    const messageElement = document.getElementById('barcodePopupMessage');

    messageElement.textContent = message;
    popup.style.display = 'block';

    setTimeout(() => {
        closeBarcodePopup();
    }, 5000);
}

// Close barcode popup
function closeBarcodePopup() {
    const popup = document.getElementById('barcodePopup');
    popup.style.display = 'none';
}

// Set scan mode
function setScanMode() {
    isScanMode = true;
    document.getElementById('scanModeBtn').classList.add('active');
    document.getElementById('searchModeBtn').classList.remove('active');
    document.getElementById('searchSection').style.display = 'none';
    document.getElementById('productTableSection').style.display = 'none';
    document.getElementById('scanAnimationSection').style.display = 'block';
    // Ensure barcode input is focused so hardware scanners send input here
    const barcodeInput = document.getElementById('barcodeInput');
    if (barcodeInput) {
        barcodeInput.focus();
        barcodeInput.value = '';
    }
}

// Set search mode
function setSearchMode() {
    isScanMode = false;
    document.getElementById('searchModeBtn').classList.add('active');
    document.getElementById('scanModeBtn').classList.remove('active');
    document.getElementById('searchSection').style.display = 'block';
    document.getElementById('productTableSection').style.display = 'block';
    document.getElementById('scanAnimationSection').style.display = 'none';
    document.getElementById('searchProduct').focus();
}

// Load products
async function loadProducts(forceRefresh = false) {
    try {
        showLoadingProducts();
        products = await getProducts(forceRefresh);
        displayProducts(products);
    } catch (error) {
        showMessage('Error loading products: ' + error.message, 'error');
    }
}

// Show loading indicator
function showLoadingProducts() {
    const tbody = document.getElementById('productsTableBody');
    tbody.innerHTML = `
        <tr>
            <td colspan="6" class="text-center">
                <div class="loading-spinner">
                    <i class="fas fa-spinner fa-spin"></i> Loading products...
                </div>
            </td>
        </tr>
    `;
}

// Display products in table
function displayProducts(productsList) {
    const tbody = document.getElementById('productsTableBody');
    tbody.innerHTML = '';

    if (productsList.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center">No products found</td>
            </tr>
        `;
        return;
    }

    productsList.forEach(product => {
        const row = document.createElement('tr');
        row.className = 'product-row';
        row.innerHTML = `
            <td>${product.product_id || 'N/A'}</td>
            <td class="product-name-cell">${product.product_name || 'N/A'}</td>
            <td>${product.category || 'N/A'}</td>
            <td>Rs. ${(parseFloat(product.sale_price) || 0).toFixed(2)}</td>
            <td>${product.quantity || 0}</td>
            <td>${product.barcode || 'N/A'}</td>
        `;

        row.addEventListener('click', () => {
            addToCart(product);
        });
        tbody.appendChild(row);
    });
}

// Search products
function searchProducts(searchTerm) {
    const term = searchTerm.toLowerCase();
    const filteredProducts = products.filter(product =>
        (product.product_id && product.product_id.toLowerCase().includes(term)) ||
        (product.product_name && product.product_name.toLowerCase().includes(term)) ||
        (product.category && product.category.toLowerCase().includes(term)) ||
        (product.barcode && product.barcode.toString().toLowerCase().includes(term))
    );
    displayProducts(filteredProducts);
}

// Add to cart
function addToCart(product) {
    const availableStock = parseInt(product.quantity) || 0;
    if (availableStock <= 0) {
        showMessage(`${product.product_name} is out of stock`, 'error');
        return;
    }

    const existingIndex = cart.findIndex(item => item.product_id === product.product_id);

    if (existingIndex >= 0) {
        if (cart[existingIndex].quantity >= availableStock) {
            showMessage(`Only ${availableStock} items available`, 'error');
            return;
        }
        cart[existingIndex].quantity += 1;
        cart[existingIndex].total = cart[existingIndex].quantity * cart[existingIndex].price;
    } else {
        cart.push({
            product_id: product.product_id,
            product_name: product.product_name,
            category: product.category || '',
            weight: product.weight || '',
            unit: product.unit || '',
            price: parseFloat(product.sale_price) || 0,
            quantity: 1,
            total: parseFloat(product.sale_price) || 0
        });
    }

    updateCartDisplay();
    showMessage(`✓ ${product.product_name} added to cart`, 'success');
}

// Update cart display
function updateCartDisplay() {
    const cartItemsDiv = document.getElementById('cartItems');

    if (cart.length === 0) {
        cartItemsDiv.innerHTML = `
            <div class="empty-cart-state">
                <i class="fas fa-shopping-cart"></i>
                <p>Cart is empty. Scan or search products to add.</p>
            </div>
        `;
        document.getElementById('cartCount').textContent = '0 items';
        updateTotals();
        return;
    }

    let cartHTML = `
        <div class="cart-item-row" style="background: #f8f9fa; font-weight: bold; font-size: 12px; padding: 8px 0;">
            <div class="cart-item-col cart-item-name">Product Name</div>
            <div class="cart-item-col cart-item-weight">Weight</div>
            <div class="cart-item-col cart-item-price">Price</div>
            <div class="cart-item-col cart-item-qty">Qty</div>
            <div class="cart-item-col cart-item-total">Total</div>
            <div class="cart-item-col cart-item-actions-col">Actions</div>
        </div>
    `;

    cart.forEach((item, index) => {
        cartHTML += `
            <div class="cart-item-row">
                <div class="cart-item-col cart-item-name">${item.product_name}</div>
                <div class="cart-item-col cart-item-weight">${item.weight || '-'}</div>
                <div class="cart-item-col cart-item-price">Rs. ${item.price.toFixed(2)}</div>
                <div class="cart-item-col cart-item-qty">${item.quantity}</div>
                <div class="cart-item-col cart-item-total">Rs. ${item.total.toFixed(2)}</div>
                <div class="cart-item-col cart-item-actions-col">
                    <button class="btn-qty-compact" onclick="updateQuantity(${index}, -1)" title="Decrease">
                        <i class="fas fa-minus"></i>
                    </button>
                    <button class="btn-qty-compact" onclick="updateQuantity(${index}, 1)" title="Increase">
                        <i class="fas fa-plus"></i>
                    </button>
                    <button class="btn-remove-compact" onclick="removeFromCart(${index})" title="Remove">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    });

    cartItemsDiv.innerHTML = cartHTML;
    document.getElementById('cartCount').textContent = `${cart.reduce((sum, item) => sum + item.quantity, 0)} items`;
    updateTotals();
}

// Update quantity
function updateQuantity(index, change) {
    if (cart[index].quantity + change < 1) {
        removeFromCart(index);
        return;
    }

    const product = products.find(p => p.product_id === cart[index].product_id);
    const availableStock = parseInt(product?.quantity) || 0;

    if (cart[index].quantity + change > availableStock) {
        showMessage(`Only ${availableStock} items available`, 'error');
        return;
    }

    cart[index].quantity += change;
    cart[index].total = cart[index].quantity * cart[index].price;
    updateCartDisplay();
}

// Remove from cart
function removeFromCart(index) {
    const productName = cart[index].product_name;
    cart.splice(index, 1);
    updateCartDisplay();
    showMessage(`${productName} removed from cart`, 'info');
}

// Clear cart
function clearCart() {
    if (cart.length === 0) return;

    if (confirm('Clear all items from cart?')) {
        cart = [];
        document.getElementById('customerName').value = 'Walk-in Customer';
        document.getElementById('customerNameDisplay').textContent = 'Walk-in Customer';
        document.getElementById('amountPaid').value = '0';
        document.getElementById('changeAmount').value = '0.00';
        taxAmount = 1;
        document.getElementById('taxAmount').value = '1';
        updateCartDisplay();
        showMessage('Cart cleared', 'info');
    }
}

// Update totals
function updateTotals() {
    const subtotal = cart.reduce((sum, item) => sum + item.total, 0);
    const total = subtotal + taxAmount;

    document.getElementById('cartSubtotal').textContent = `Rs. ${subtotal.toFixed(2)}`;
    document.getElementById('cartTotal').textContent = `Rs. ${total.toFixed(2)}`;

    calculateChange();
}

// Update tax
function updateTax() {
    taxAmount = parseFloat(document.getElementById('taxAmount').value) || 0;
    if (taxAmount < 0) taxAmount = 0;
    document.getElementById('taxAmount').value = taxAmount;
    updateTotals();
}

// Adjust tax
function adjustTax(change) {
    taxAmount = parseFloat(document.getElementById('taxAmount').value) || 0;
    taxAmount += change;
    if (taxAmount < 0) taxAmount = 0;
    document.getElementById('taxAmount').value = taxAmount;
    updateTax();
}

// Toggle cash payment
function toggleCashPayment() {
    const method = document.getElementById('paymentMethod').value;
    const cashFields = document.getElementById('cashPaymentFields');
    cashFields.style.display = method === 'Cash' ? 'block' : 'none';
    calculateChange();
}

// Calculate change
function calculateChange() {
    const total = parseFloat(document.getElementById('cartTotal').textContent.replace('Rs. ', '')) || 0;
    const amountPaid = parseFloat(document.getElementById('amountPaid').value) || 0;
    const change = amountPaid - total;

    document.getElementById('changeAmount').value = change > 0 ? change.toFixed(2) : '0.00';
}

// Update date and time
function updateDateTime() {
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-GB');
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });

    document.getElementById('currentDate').textContent = dateStr;
    document.getElementById('currentTime').textContent = timeStr;
}

// Update order number
async function updateOrderNumber() {
    try {
        const sales = await getSalesV2();
        let maxOrderNumber = 50000000000;

        if (sales && sales.length > 0) {
            const orderNumbers = sales
                .map(sale => {
                    const orderNum = parseInt(sale.order_number);
                    return isNaN(orderNum) ? 0 : orderNum;
                })
                .filter(num => num >= 50000000000);

            if (orderNumbers.length > 0) {
                maxOrderNumber = Math.max(...orderNumbers);
            }
        }

        currentOrderNumber = maxOrderNumber + 1;
        document.getElementById('orderNumber').textContent = currentOrderNumber;
    } catch (error) {
        const timestampPart = Date.now() % 1000000;
        currentOrderNumber = 50000000000 + timestampPart;
        document.getElementById('orderNumber').textContent = currentOrderNumber;
    }
}

// Validate sale data
function validateSale() {
    let isValid = true;

    document.querySelectorAll('.validation-error').forEach(el => {
        el.style.display = 'none';
        el.textContent = '';
    });

    const customerName = document.getElementById('customerName').value.trim();
    const paymentMethod = document.getElementById('paymentMethod').value;
    const amountPaid = parseFloat(document.getElementById('amountPaid').value) || 0;
    const total = parseFloat(document.getElementById('cartTotal').textContent.replace('Rs. ', '')) || 0;

    if (cart.length === 0) {
        showMessage('Cart is empty! Add products first.', 'error');
        isValid = false;
    }

    if (!customerName) {
        document.getElementById('customerNameError').textContent = 'Customer name is required';
        document.getElementById('customerNameError').style.display = 'block';
        isValid = false;
    }

    if (paymentMethod === 'Cash' && amountPaid < total) {
        document.getElementById('amountPaidError').textContent = `Amount paid must be at least Rs. ${total.toFixed(2)}`;
        document.getElementById('amountPaidError').style.display = 'block';
        isValid = false;
    }

    return isValid;
}

// OPTIMIZED FUNCTION: COMPLETE SALE AND PRINT FAST (NO LOADER DELAY)
async function completeSaleAndPrintFast() {
    if (!validateSale()) {
        return;
    }

    if (isProcessingSale) {
        showMessage('Sale is already being processed. Please wait.', 'info');
        return;
    }

    isProcessingSale = true;

    try {
        const btn = document.getElementById('completeSaleBtn');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
        btn.classList.add('btn-loading');
        btn.disabled = true;

        // Prepare sale data
        const customerName = document.getElementById('customerName').value.trim() || 'Walk-in Customer';
        const paymentMethod = document.getElementById('paymentMethod').value;
        const amountPaid = parseFloat(document.getElementById('amountPaid').value) || 0;
        const change = parseFloat(document.getElementById('changeAmount').value) || 0;
        const subtotal = cart.reduce((sum, item) => sum + item.total, 0);
        const total = subtotal + taxAmount;
        const user = JSON.parse(localStorage.getItem('pos_user'));

        // Generate order number
        if (!currentOrderNumber || currentOrderNumber < 50000000001) {
            await updateOrderNumber();
        }

        const saleData = {
            order_number: currentOrderNumber,
            customer_name: customerName,
            total_items: cart.reduce((sum, item) => sum + item.quantity, 0),
            subtotal: subtotal,
            total_amount: total,
            date: new Date().toISOString().split('T')[0],
            time: new Date().toLocaleTimeString([], { hour12: true, hour: '2-digit', minute: '2-digit' }),
            payment_method: paymentMethod,
            amount_paid: amountPaid,
            change: change,
            tax: taxAmount,
            sold_by: user.username,
            items: [...cart]
        };

        // Generate bill HTML
        const printHTML = generateBillHTML(saleData);

        // DIRECT PRINT: Create print window with LARGE SIZE
        const printWindow = window.open('', '_blank', 'width=800,height=600,top=100,left=100,scrollbars=yes,resizable=yes');

        // Optimistic UI update: add transaction row immediately and save in background
        function addSaleToTransactionsUI(sale) {
            try {
                const tbody = document.getElementById('transactionsTableBody');
                if (!tbody) return;

                const tr = document.createElement('tr');
                const orderNum = sale.order_number || sale.orderNumber || 'N/A';
                const displayTime = sale.time || new Date().toLocaleTimeString([], { hour12: true, hour: '2-digit', minute: '2-digit' });
                const totalAmount = parseFloat(sale.total_amount || sale.totalAmount || 0).toFixed(2);

                tr.innerHTML = `
                    <td><strong>#${orderNum}</strong></td>
                    <td>${displayTime}</td>
                    <td>${sale.customer_name || sale.customerName || 'Walk-in Customer'}</td>
                    <td>${sale.total_items || sale.totalItems || 0}</td>
                    <td><strong>Rs. ${totalAmount}</strong></td>
                    <td>
                        <span class="payment-badge ${(sale.payment_method || sale.paymentMethod || 'Cash').toLowerCase().replace(' ', '-')}">
                            ${sale.payment_method || sale.paymentMethod || 'Cash'}
                        </span>
                    </td>
                    <td>
                        <span class="status-completed">Completed</span>
                    </td>
                    <td>
                        <button class="btn btn-sm btn-info" onclick="reprintBill('${orderNum}')" title="Reprint Bill">
                            <i class="fas fa-print"></i>
                        </button>
                    </td>
                `;

                if (tbody.firstChild) tbody.insertBefore(tr, tbody.firstChild);
                else tbody.appendChild(tr);
            } catch (e) { console.error('addSaleToTransactionsUI error', e); }
        }

        const finalizeSaleAfterPrint = async () => {
            // Print completed notification - no blocking UI changes here
            console.log('Print completed for order', currentOrderNumber);
        };

        // Listen for print-complete message from print window/iframe
        function onPrintMessage(e) {
            try {
                if (!e.data) return;
                if (typeof e.data === 'object' && e.data.type === 'print-complete' && e.data.order === currentOrderNumber) {
                    window.removeEventListener('message', onPrintMessage);
                    clearTimeout(printFallbackTimer);
                    finalizeSaleAfterPrint();
                }
            } catch (err) { console.error(err); }
        }

        window.addEventListener('message', onPrintMessage);

        // Fallback: if no onafterprint notification within 20s, ask user to confirm print
        const printFallbackTimer = setTimeout(() => {
            window.removeEventListener('message', onPrintMessage);
            const ok = confirm('Did the bill print successfully? Click OK to continue.');
            if (!ok) showMessage('Printing may have failed. Please check your printer.', 'info');
        }, 20000);

        // Perform immediate UI update so cashier can continue
        try {
            addSaleToTransactionsUI(saleData);
            showMessage('✓ Sale completed!', 'success');

            // Clear cart and reset UI for next customer immediately
            cart = [];
            document.getElementById('customerName').value = 'Walk-in Customer';
            document.getElementById('customerNameDisplay').textContent = 'Walk-in Customer';
            document.getElementById('amountPaid').value = '';
            document.getElementById('changeAmount').value = '0.00';
            taxAmount = 1;
            document.getElementById('taxAmount').value = '1';
            updateCartDisplay();
            currentOrderNumber++;
            document.getElementById('orderNumber').textContent = currentOrderNumber;
            setScanMode();
            const barcodeInput = document.getElementById('barcodeInput');
            if (barcodeInput) { barcodeInput.focus(); barcodeInput.value = ''; }

            // Save in background (non-blocking)
            saveSaleToBackendAsync(saleData).then(res => {
                if (!res || !res.success) console.warn('Background save failed for order', saleData.order_number, res && res.error);
                else {
                    // Ensure transactions list is in sync
                    loadTodayTransactions(true);
                }
            }).catch(err => console.error('saveSaleToBackendAsync error', err));
        } catch (e) { console.error(e); }

        if (!printWindow) {
            // If popup is blocked, use iframe method (printUsingIframeFast will postMessage when done)
            printUsingIframeFast(printHTML, currentOrderNumber);
        } else {
            // Write minimal HTML for fast loading and notify opener after print
            printWindow.document.write(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Bill #${currentOrderNumber}</title>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <style>
                        @media print {
                            @page { margin: 0 !important; padding: 0 !important; size: 80mm auto; }
                            body { margin: 0 !important; padding: 0 !important; font-family: 'Arial', sans-serif !important; }
                        }
                        body { margin: 0; padding: 0; font-family: 'Arial', sans-serif; background: white; }
                    </style>
                </head>
                <body>
                    ${printHTML}
                    <script>
                        // Notify opener after print dialog closes (may fire on both print or cancel)
                        function notifyOpener() {
                            try {
                                if (window.opener) {
                                    window.opener.postMessage({ type: 'print-complete', order: ${currentOrderNumber} }, '*');
                                }
                            } catch (e) {}
                        }
                        window.onafterprint = function() { notifyOpener(); setTimeout(() => window.close(), 200); };
                        // Trigger print
                        setTimeout(() => { window.print(); }, 200);
                    <\/script>
                </body>
                </html>
            `);
            printWindow.document.close();
        }

    } catch (error) {
        showMessage('✗ Error: ' + error.message, 'error');
    } finally {
        // Reset button immediately (no delay)
        const btn = document.getElementById('completeSaleBtn');
        btn.innerHTML = '<i class="fas fa-check-circle"></i> Complete Sale & Print (Enter)';
        btn.classList.remove('btn-loading');
        btn.disabled = false;
        isProcessingSale = false;
    }
}

// Fast print using iframe (no loading overlay)
function printUsingIframeFast(printHTML) {
    const iframe = document.createElement('iframe');
    iframe.style.position = 'absolute';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = 'none';
    document.body.appendChild(iframe);

    const iframeDoc = iframe.contentWindow.document;
    iframeDoc.open();
    iframeDoc.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Print Bill</title>
            <style>
                @media print {
                    @page {
                        margin: 0 !important;
                        padding: 0 !important;
                        size: 80mm auto;
                    }
                    body {
                        margin: 0 !important;
                        padding: 0 !important;
                        font-family: 'Arial', sans-serif !important;
                    }
                }
            </style>
        </head>
        <body>
            ${printHTML}
            <script>
                try {
                    function notifyParent(){
                        if (window.parent) window.parent.postMessage({ type: 'print-complete', order: ${currentOrderNumber} }, '*');
                    }
                    window.onafterprint = function(){ notifyParent(); };
                    setTimeout(function(){ window.print(); }, 200);
                } catch(e){}
            <\/script>
        </body>
        </html>
    `);
    iframeDoc.close();

    // Auto print immediately
    setTimeout(() => {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();

        // Remove iframe after printing
        setTimeout(() => {
            document.body.removeChild(iframe);
        }, 100);
    }, 100);
}

// Save sale to backend ASYNC (doesn't block UI)
async function saveSaleToBackendAsync(saleData) {
    try {
        // Save sale
        await addSaleV2(saleData);

        // Save sale items
        for (const item of saleData.items) {
            const itemData = {
                order_number: saleData.order_number,
                product_name: item.product_name,
                quantity: item.quantity,
                category: item.category,
                weight: item.weight,
                unit: item.unit,
                price: item.price,
                line_total: item.total,
                product_id: item.product_id
            };

            await addSaleItem(itemData);
        }

        // Update product quantities
        for (const item of saleData.items) {
            const product = products.find(p => p.product_id === item.product_id);
            if (product) {
                const newQty = parseInt(product.quantity) - item.quantity;
                if (newQty >= 0) {
                    await updateProductInSheet({
                        ...product,
                        quantity: newQty
                    });
                }
            }
        }

        return { success: true };
    } catch (error) {
        console.error('Error saving to backend:', error);
        // Silent fail - don't show error to user
        return { success: false, error: error.message };
    }
}

// Generate bill HTML (same as before)
function generateBillHTML(saleData) {
    const {
        order_number,
        customer_name,
        total_items,
        subtotal,
        total_amount,
        date,
        time,
        payment_method,
        amount_paid,
        change,
        tax,
        sold_by,
        items
    } = saleData;

    const currentDate = new Date();
    const formattedDate = currentDate.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const formattedTime = currentDate.toLocaleTimeString('en-US', { hour12: true, hour: '2-digit', minute: '2-digit' });

    const productRows = items.map(item => `
        <tr>
            <td style="width: 50%; font-size: 11px; font-weight: 400; line-height: 1.2; padding: 4px 2px;">${item.product_name}${item.weight ? ` (${item.weight})` : ''}</td>
            <td style="width: 15%; font-size: 11px; font-weight: 400; text-align: center; padding: 4px 2px;">${item.quantity}</td>
            <td style="width: 20%; font-size: 11px; font-weight: 400; text-align: right; padding: 4px 2px;">${item.price.toFixed(2)}</td>
            <td style="width: 15%; font-size: 11px; font-weight: 400; text-align: right; padding: 4px 2px;">${item.total.toFixed(2)}</td>
        </tr>
    `).join('');

    const paymentMethodClass = `payment-method-${payment_method.toLowerCase().replace(' ', '-')}`;

    return `
        <div style="width: 80mm; margin: 0 auto; padding: 1mm 0; font-family: 'Arial', sans-serif; font-size: 12px; line-height: 1.2;">
            <div style="padding: 0 3mm;">
                    <div style="text-align: center; margin-bottom: 3mm; border-bottom: 1px dashed #000; padding-bottom: 2mm;">
                    <div style="margin-bottom: 2mm;">
                        <img src="images/logo.png" alt="Logo" onerror="this.style.display='none'" style="width: 170px; height: auto; max-width: 100%; object-fit: contain; display: block; margin: 0 auto; margin-top: 10px">
                    </div>
                    <h2 style="font-size: 16px; font-weight: bold; margin: 2mm 0; text-transform: uppercase; line-height: 1.2;">HAFSA PHARMACY & MIR MART</h2>
                    <p style="font-size: 10px; margin: 1mm 0; line-height: 1.2;">
                        Bufferzone, North Nazimbad, Karachi<br>
                        Tel: 03218202579<br>
                        NTN: 4123456-7 | STRN: 1234567891234
                    </p>
                </div>
                
                <div style="margin: 2mm 0; font-size: 11px;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 1mm;">
                        <span><strong>Order #:</strong></span>
                        <span style="font-weight: bold;">${order_number}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 1mm;">
                        <span><strong>Cashier:</strong></span>
                        <span>${sold_by}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 1mm;">
                        <span><strong>Date:</strong></span>
                        <span>${formattedDate}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 1mm;">
                        <span><strong>Time:</strong></span>
                        <span>${formattedTime}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 2mm; border-bottom: 1px dashed #ccc; padding-bottom: 2mm;">
                        <span><strong>Customer:</strong></span>
                        <span style="font-weight: bold;">${customer_name}</span>
                    </div>
                </div>
                
                <table style="width: 100%; border-collapse: collapse; font-size: 11px; margin: 2mm 0;">
                    <thead>
                        <tr>
                            <th style="border-bottom: 1px solid #000; padding: 3px 1px; text-align: left; font-weight: bold;">Item</th>
                            <th style="border-bottom: 1px solid #000; padding: 3px 1px; text-align: center; font-weight: bold;">Qty</th>
                            <th style="border-bottom: 1px solid #000; padding: 3px 1px; text-align: right; font-weight: bold;">Price</th>
                            <th style="border-bottom: 1px solid #000; padding: 3px 1px; text-align: right; font-weight: bold;">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${productRows}
                    </tbody>
                </table>
                
                <div style="margin: 3mm 0; font-size: 10px;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 1mm;">
                        <span>Subtotal:</span>
                        <span>Rs. ${subtotal.toFixed(2)}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 1mm;">
                        <span>FBR Tax:</span>
                        <span>Rs. ${tax.toFixed(2)}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-top: 2mm; padding-top: 2mm; border-top: 2px solid #000; font-weight: bold; font-size: 12px;">
                        <span>GRAND TOTAL:</span>
                        <span><strong>Rs. ${total_amount.toFixed(2)}</strong></span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 1mm; margin-top: 2mm; padding-top: 2mm; border-top: 1px dashed #ccc;">
                        <span>Payment Method:</span>
                        <span class="${paymentMethodClass}" style="font-weight: bold;">${payment_method}</span>
                    </div>
                    ${payment_method === 'Cash' ? `
                    <div style="display: flex; justify-content: space-between; margin-bottom: 1mm;">
                        <span>Amount Paid:</span>
                        <span>Rs. ${amount_paid.toFixed(2)}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 1mm;">
                        <span>Change:</span>
                        <span>Rs. ${change.toFixed(2)}</span>
                    </div>
                    ` : ''}
                </div>
                
                <div style="margin-top: 3mm; padding-top: 2mm; border-top: 1px dashed #000; font-size: 9px; line-height: 1.1; text-align: justify;">
                    <p><strong>Terms & Conditions:</strong> Thanks for shopping with us. Replace & Return within 7 Days. No Return or Exchange on Crockery, Toys, Cosmetics, Vegetable & Fruit. Check your cash and belongings before you leave. Management will not be responsible for any loss or theft.</p>
                    <p style="text-align: center; font-weight: bold; margin-top: 1mm; font-size: 10px;"></p>
                </div>
            </div>
            
            <div style="height: 18mm; text-align: center; color: #999; font-size: 10px; padding-top: 3mm;">
                --- Cut Here ---
            </div>
        </div>
    `;
}

// Load today's transactions
async function loadTodayTransactions(forceRefresh = false) {
    try {
        const tbody = document.getElementById('transactionsTableBody');

        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="text-center">
                    <div class="loading-spinner">
                        <i class="fas fa-spinner fa-spin"></i> Loading transactions...
                    </div>
                </td>
            </tr>
        `;

        const allSales = await getSalesV2(forceRefresh);

        if (allSales.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" class="text-center">
                        <div style="padding: 40px 20px; color: #666;">
                            <i class="fas fa-shopping-cart" style="font-size: 48px; margin-bottom: 15px;"></i>
                            <h5>No Transactions Yet</h5>
                            <p>Complete your first sale to see transactions here.</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        const today = new Date();
        const todayISO = today.toISOString().split('T')[0];
        const todayFormatted = today.toLocaleDateString('en-GB');

        const todaySales = allSales.filter(sale => {
            if (!sale.date) return false;
            const saleDate = String(sale.date).trim();
            return saleDate === todayISO || saleDate === todayFormatted;
        });

        const displaySales = todaySales.length > 0 ? todaySales : allSales.slice(0, 10);

        tbody.innerHTML = '';

        displaySales.forEach(sale => {
            const row = document.createElement('tr');
            const orderNum = sale.order_number || sale.orderNumber || 'N/A';

            let displayTime = sale.time || 'N/A';
            if (sale.time && sale.time.includes(':')) {
                const timeParts = sale.time.split(':');
                if (timeParts.length >= 2) {
                    const hours = parseInt(timeParts[0]);
                    const minutes = timeParts[1];
                    const ampm = hours >= 12 ? 'PM' : 'AM';
                    const displayHours = hours % 12 || 12;
                    displayTime = `${displayHours}:${minutes} ${ampm}`;
                }
            }

            const totalAmount = parseFloat(sale.total_amount || sale.totalAmount || 0).toFixed(2);

            row.innerHTML = `
                <td><strong>#${orderNum}</strong></td>
                <td>${displayTime}</td>
                <td>${sale.customer_name || sale.customerName || 'Walk-in Customer'}</td>
                <td>${sale.total_items || sale.totalItems || 0}</td>
                <td><strong>Rs. ${totalAmount}</strong></td>
                <td>
                    <span class="payment-badge ${(sale.payment_method || sale.paymentMethod || 'Cash').toLowerCase().replace(' ', '-')}">
                        ${sale.payment_method || sale.paymentMethod || 'Cash'}
                    </span>
                </td>
                <td>
                    <span class="status-completed">Completed</span>
                </td>
                <td>
                    <button class="btn btn-sm btn-info" onclick="reprintBill('${orderNum}')" title="Reprint Bill">
                        <i class="fas fa-print"></i>
                    </button>
                </td>
            `;
            tbody.appendChild(row);
        });

    } catch (error) {
        const tbody = document.getElementById('transactionsTableBody');
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="text-center" style="color: #dc3545;">
                    <i class="fas fa-exclamation-circle"></i> Error loading transactions
                </td>
            </tr>
        `;
    }
}

// Reprint bill
async function reprintBill(orderNumber) {
    try {
        const sales = await getSalesV2();
        const sale = sales.find(s => {
            const saleOrderNum = s.order_number ? s.order_number.toString() : '';
            return saleOrderNum === orderNumber.toString();
        });

        if (!sale) {
            showMessage(`Sale #${orderNumber} not found`, 'error');
            return;
        }

        const items = await getSaleItems(orderNumber);

        const saleData = {
            order_number: sale.order_number,
            customer_name: sale.customer_name,
            total_items: sale.total_items,
            subtotal: parseFloat(sale.total_amount) - parseFloat(sale.tax || 0),
            total_amount: parseFloat(sale.total_amount) || 0,
            date: sale.date,
            time: sale.time,
            payment_method: sale.payment_method,
            amount_paid: parseFloat(sale.amount_paid) || 0,
            change: parseFloat(sale.change) || 0,
            tax: parseFloat(sale.tax) || 0,
            sold_by: sale.sold_by,
            items: items.map(item => ({
                product_name: item.product_name,
                weight: item.weight,
                quantity: parseInt(item.quantity) || 0,
                price: parseFloat(item.price) || 0,
                total: parseFloat(item.line_total) || 0
            }))
        };

        const printHTML = generateBillHTML(saleData);

        // Open print window with LARGE size
        const printWindow = window.open('', '_blank', 'width=800,height=600,top=100,left=100,scrollbars=yes,resizable=yes');
        if (printWindow) {
            printWindow.document.write(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Reprint Bill #${orderNumber}</title>
                    <style>
                        @media print {
                            @page {
                                margin: 0;
                                size: 80mm auto;
                            }
                            body {
                                margin: 0;
                                padding: 0;
                                font-family: 'Arial', sans-serif;
                            }
                        }
                    </style>
                </head>
                <body onload="window.print(); setTimeout(() => window.close(), 100);">
                    ${printHTML}
                </body>
                </html>
            `);
            printWindow.document.close();
        }

    } catch (error) {
        showMessage('Error reprinting bill: ' + error.message, 'error');
    }
}

// Modal functions
function showModal(modalId) {
    document.getElementById(modalId).style.display = 'block';
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

function confirmLogout() {
    logout();
    closeModal('logoutModal');
}

// Show message
function showMessage(message, type) {
    const existingMessages = document.querySelectorAll('.message');
    existingMessages.forEach(msg => msg.remove());

    const messageDiv = document.createElement('div');
    messageDiv.className = `message message-${type}`;
    messageDiv.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' :
            type === 'error' ? 'exclamation-circle' :
                type === 'info' ? 'info-circle' : 'bell'}"></i>
        ${message}
    `;

    const mainContent = document.querySelector('.main-content');
    const mainPosContainer = document.querySelector('.pos-layout-grid');

    if (mainContent && mainPosContainer) {
        mainContent.insertBefore(messageDiv, mainPosContainer);
    }

    setTimeout(() => {
        if (messageDiv.parentNode) {
            messageDiv.remove();
        }
    }, 3000);
}

// Export functions to window
window.updateQuantity = updateQuantity;
window.removeFromCart = removeFromCart;
window.clearCart = clearCart;
window.adjustTax = adjustTax;
window.updateTax = updateTax;
window.toggleCashPayment = toggleCashPayment;
window.calculateChange = calculateChange;
window.reprintBill = reprintBill;
window.closeModal = closeModal;
window.closeBarcodePopup = closeBarcodePopup;
window.confirmLogout = confirmLogout;
window.completeSaleAndPrintFast = completeSaleAndPrintFast;