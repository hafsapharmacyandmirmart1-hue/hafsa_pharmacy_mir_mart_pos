// Users Module for Hafsa Pharmacy & Mir Mart POS

// User roles
const USER_ROLES = {
    OWNER: 'owner',
    RECEPTION: 'reception',
    INVENTORY: 'inventory',
    CUSTOMER: 'customer'
};

// Get current user
function getCurrentUser() {
    return JSON.parse(localStorage.getItem('pos_user')) || null;
}

// Get user role
function getUserRole() {
    const user = getCurrentUser();
    return user ? user.role : null;
}

// Check if user has permission
function hasPermission(requiredRole) {
    const userRole = getUserRole();
    
    if (!userRole) return false;
    
    const roleHierarchy = {
        'owner': 4,
        'reception': 3,
        'inventory': 2,
        'customer': 1
    };
    
    return roleHierarchy[userRole] >= roleHierarchy[requiredRole];
}

// Get all users (admin only)
async function getAllUsers() {
    try {
        const users = await getUsers();
        return users || [];
    } catch (error) {
        console.error('Error getting users:', error);
        return [];
    }
}

// Format user role for display
function formatUserRole(role) {
    switch (role) {
        case 'owner':
            return 'Owner';
        case 'reception':
            return 'Reception';
        case 'inventory':
            return 'Inventory Manager';
        case 'customer':
            return 'Customer';
        default:
            return role;
    }
}

// Get role color
function getRoleColor(role) {
    switch (role) {
        case 'owner':
            return '#e74c3c'; // Red
        case 'reception':
            return '#3498db'; // Blue
        case 'inventory':
            return '#f39c12'; // Orange
        case 'customer':
            return '#27ae60'; // Green
        default:
            return '#95a5a6'; // Gray
    }
}

// Validate user data
function validateUserData(userData) {
    const errors = [];
    
    if (!userData.username || userData.username.trim() === '') {
        errors.push('Username is required');
    }
    
    if (!userData.password || userData.password.trim() === '') {
        errors.push('Password is required');
    }
    
    if (userData.password && userData.password.length < 6) {
        errors.push('Password must be at least 6 characters');
    }
    
    if (!userData.role || !Object.values(USER_ROLES).includes(userData.role)) {
        errors.push('Valid role is required');
    }
    
    return {
        isValid: errors.length === 0,
        errors: errors
    };
}

// Create user display element
function createUserDisplay(user) {
    const roleColor = getRoleColor(user.role);
    const formattedRole = formatUserRole(user.role);
    
    return `
        <div style="display: flex; align-items: center; gap: 10px;">
            <div style="width: 40px; height: 40px; background: ${roleColor}; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold;">
                ${user.username.charAt(0).toUpperCase()}
            </div>
            <div>
                <strong>${user.username}</strong><br>
                <small style="color: ${roleColor}; font-weight: 500;">${formattedRole}</small>
            </div>
        </div>
    `;
}

// Export functions
window.USERS = {
    getCurrentUser,
    getUserRole,
    hasPermission,
    getAllUsers,
    formatUserRole,
    getRoleColor,
    validateUserData,
    createUserDisplay,
    ROLES: USER_ROLES
};