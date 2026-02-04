// Authentication Module for Hafsa Pharmacy & Mir Mart POS
// FIXED - No API_URL declaration here

// IMPORTANT: Make sure google-sheet-api.js is loaded BEFORE this file
// API_URL is defined in google-sheet-api.js

// Check if user is logged in
function checkAuth() {
    const user = JSON.parse(localStorage.getItem('pos_user'));
    if (!user) {
        window.location.href = 'index.html';
        return null;
    }
    return user;
}

// Handle login
async function login(username, password) {
    try {
        // Use the API_URL from google-sheet-api.js
        // If not defined, use the default
        const apiUrl = window.API_URL || 'https://script.google.com/macros/s/AKfycbyXx-gKXpUnAf4-aET5c9lyeU2fvPgG8aWKJ-CFTPhdLloGH3dXNIdDSm_84B_Wpz9-/exec';
        
        const params = new URLSearchParams({
            action: 'login',
            username: username,
            password: password
        });
        
        const response = await fetch(`${apiUrl}?${params}`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success) {
            // Store user data in localStorage
            localStorage.setItem('pos_user', JSON.stringify(data.user));
            
            // Redirect based on role
            redirectBasedOnRole(data.user.role);
            
            return { success: true };
        } else {
            return { success: false, error: data.error || 'Invalid credentials' };
        }
    } catch (error) {
        console.error('Login error:', error);
        return { success: false, error: 'Network error. Please check API connection.' };
    }
}

// Redirect user based on their role
function redirectBasedOnRole(role) {
    switch (role.toLowerCase()) {
        case 'owner':
            window.location.href = 'owner.html';
            break;
        case 'reception':
            window.location.href = 'reception.html';
            break;
        case 'inventory':
            window.location.href = 'add-items.html';
            break;
        case 'customer':
            window.location.href = 'price-view.html';
            break;
        default:
            window.location.href = 'index.html';
    }
}

// Logout function with confirmation
function logout() {
    // Remove user from localStorage
    localStorage.removeItem('pos_user');
    // Redirect to login page
    window.location.href = 'index.html';
}

// Export logout to window
window.logout = logout;

// Check if user has access to current page
function checkPageAccess(requiredRole) {
    const user = JSON.parse(localStorage.getItem('pos_user'));
    
    // If no user, redirect to login
    if (!user) {
        window.location.href = 'index.html';
        return false;
    }
    
    // Role hierarchy (higher number = more access)
    const roleHierarchy = {
        'owner': 4,
        'reception': 3,
        'inventory': 2,
        'customer': 1
    };
    
    const userRole = user.role.toLowerCase();
    const requiredRoleLower = requiredRole.toLowerCase();
    
    // Check if role exists in hierarchy
    if (!roleHierarchy[userRole] || !roleHierarchy[requiredRoleLower]) {
        alert('Invalid user role detected!');
        logout();
        return false;
    }
    
    // Check access permission
    if (roleHierarchy[userRole] < roleHierarchy[requiredRoleLower]) {
        alert('Access denied! You do not have permission to access this page.');
        redirectBasedOnRole(user.role);
        return false;
    }
    
    return true;
}

// Update user info in header
function updateUserInfo() {
    const user = JSON.parse(localStorage.getItem('pos_user'));
    if (user) {
        const userInfoElement = document.getElementById('userInfo');
        if (userInfoElement) {
            // Capitalize first letter of role
            const role = user.role.charAt(0).toUpperCase() + user.role.slice(1);
            
            userInfoElement.innerHTML = `
                <span style="background: #e3f2fd; padding: 5px 10px; border-radius: 4px; color: #1976d2;">
                    <i class="fas fa-user"></i> ${user.username} (${role})
                </span>
                <button onclick="logout()" class="btn btn-danger" style="padding: 8px 15px; font-size: 14px;">
                    <i class="fas fa-sign-out-alt"></i> Logout
                </button>
            `;
        }
    }
}

// Initialize auth on page load
document.addEventListener('DOMContentLoaded', function() {
    // Don't run on login page
    if (window.location.pathname.includes('index.html')) return;
    
    const user = checkAuth();
    if (user) {
        updateUserInfo();
    }
});

// Export functions to window
window.login = login;
window.logout = logout;
window.checkAuth = checkAuth;
window.checkPageAccess = checkPageAccess;
window.updateUserInfo = updateUserInfo;
window.redirectBasedOnRole = redirectBasedOnRole;