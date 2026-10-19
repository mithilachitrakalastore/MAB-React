const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ||'/api';
const TRANSIENT_DB_STATUSES = new Set([502, 503, 504]);
const DB_REQUEST_RETRIES = 3;

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

const callDbService = async (action, payload = {}) => {
    try {
        for (let attempt = 0; attempt <= DB_REQUEST_RETRIES; attempt += 1) {
            const response = await fetch(`${API_BASE_URL}/db`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ action, payload })
            });

            if (response.ok) return await response.json();

            const errorData = await response.json().catch(() => ({}));
            const isLastAttempt = attempt === DB_REQUEST_RETRIES;
            if (!TRANSIENT_DB_STATUSES.has(response.status) || isLastAttempt) {
                if (response.status === 429 && !errorData.error) {
                    const retryAfterHeader = response.headers.get('Retry-After');
                    const retryAfterSeconds = Number(retryAfterHeader);
                    const retryAtSeconds = retryAfterHeader && !Number.isFinite(retryAfterSeconds)
                        ? Math.ceil((Date.parse(retryAfterHeader) - Date.now()) / 1000)
                        : retryAfterSeconds;
                    const retryMessage = Number.isFinite(retryAtSeconds) && retryAtSeconds > 0
                        ? ` Please wait about ${retryAtSeconds} seconds before trying again.`
                        : ' Please wait a short while before trying again.';
                    throw new Error(`Too many requests reached the server.${retryMessage}`);
                }
                throw new Error(errorData.error || `Server returned ${response.status}`);
            }

            await wait(500 * (attempt + 1));
        }
    } catch (error) {
        console.error(`DB Service Error [${action}]:`, error);
        throw error;
    }
};

export const dbService = {
    login: (username, password) => callDbService('login', { username, password }),
    requestSellerConversion: (userId, password, storeName) => callDbService('requestSellerConversion', { userId, password, storeName }),
    verifyEmailOtp: async (email, code) => {
        const response = await fetch(`${API_BASE_URL}/email/verify-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, code }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || `Server returned ${response.status}`);
        return data.user;
    },
    resendEmailOtp: async (email) => {
        const response = await fetch(`${API_BASE_URL}/email/resend-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || `Server returned ${response.status}`);
        return data;
    },
    getUserByEmail: (email) => callDbService('getUserByEmail', { email }),
    register: (userData) => callDbService('register', { userData }),
    registerGoogleUser: (userData) => callDbService('registerGoogleUser', { userData }),
    getUsers: () => callDbService('getUsers'),
    updateUser: (userId, userData) => callDbService('updateUser', { userId, userData }),
    approveStoreNameChange: (userId, approvedStoreName, adminId) => callDbService('approveStoreNameChange', { userId, approvedStoreName, adminId }),
    rejectStoreNameChange: (userId, adminId) => callDbService('rejectStoreNameChange', { userId, adminId }),
    updateUserStatus: (id, status, adminId) => callDbService('updateUserStatus', { id, status, adminId }),
    getGlobalCommission: () => callDbService('getGlobalCommission'),
    setGlobalCommission: (commission, adminId) => callDbService('setGlobalCommission', { commission, adminId }),
    getProducts: (sellerId) => callDbService('getProducts', { sellerId }),
    addProduct: (productData) => callDbService('addProduct', { productData }),
    updateProduct: (productId, productData) => callDbService('updateProduct', { productId, productData }),
    deleteProduct: (productId) => callDbService('deleteProduct', { productId }),
    getProductCategories: () => callDbService('getProductCategories'),
    addProductCategory: (category) => callDbService('addProductCategory', { category }),
    getOrders: (sellerId, customerId) => callDbService('getOrders', { sellerId, customerId }),
    getPublicInvoices: (invoiceNumbers) => callDbService('getPublicInvoices', { invoiceNumbers }),
    saveOrder: (order) => callDbService('saveOrder', { order }),
    startPayment: async (orderIds, userId, gateway, paymentType) => {
        const response = await fetch(`${API_BASE_URL}/payments/start`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orderIds, userId, gateway, paymentType }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || `Server returned ${response.status}`);
        return data;
    },
    updateOrderStatus: (id, status, role, userId) => callDbService('updateOrderStatus', { id, status, role, userId }),
    updateOrderDetails: (orderId, customer, userId) => callDbService('updateOrderDetails', { orderId, customer, userId }),
    confirmPayout: (orderId, adminId) => callDbService('confirmPayout', { orderId, adminId }),
    updateCustomerPaymentVerified: (orderId, verified, adminId) => callDbService('updateCustomerPaymentVerified', { orderId, verified, adminId }),
    getLogs: () => callDbService('getLogs'),
    addReview: (reviewData) => callDbService('addReview', { reviewData }),
    getReviews: (productId) => callDbService('getReviews', { productId }),
    toggleReviewPinned: (reviewId, pinned) => callDbService('pinReview', { reviewId, pinned }),
    getWishlists: (sellerId) => callDbService('getWishlists', { sellerId }),
    addToWishlist: (userId, productId) => callDbService('addToWishlist', { userId, productId }),
    removeFromWishlist: (userId, productId) => callDbService('removeFromWishlist', { userId, productId }),
    sendManualEmail: async (payload, emailAdminToken) => {
        const response = await fetch(`${API_BASE_URL}/email/manual`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${emailAdminToken || ''}`,
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(data.error || `Server returned ${response.status}`);
        }
        return data;
    },
    getResendTemplates: async (emailAdminToken) => {
        const response = await fetch(`${API_BASE_URL}/email/templates`, {
            headers: { Authorization: `Bearer ${emailAdminToken || ''}` },
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(data.error || `Server returned ${response.status}`);
        }
        return data.templates || [];
    },
    getResendTemplate: async (templateId, emailAdminToken) => {
        const response = await fetch(`${API_BASE_URL}/email/templates/${encodeURIComponent(templateId)}`, {
            headers: { Authorization: `Bearer ${emailAdminToken || ''}` },
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(data.error || `Server returned ${response.status}`);
        }
        return data.template;
    },
    createAdminEmailSession: async (supabaseAccessToken) => {
        const response = await fetch(`${API_BASE_URL}/email/admin-session`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ supabaseAccessToken }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(data.error || `Server returned ${response.status}`);
        }
        return data.emailAdminToken;
    },
    getHeroSlides: () => callDbService('getHeroSlides'),
    saveHeroSlide: (slide, adminId) => callDbService('saveHeroSlide', { slide, adminId }),
    deleteHeroSlide: (id, adminId) => callDbService('deleteHeroSlide', { id, adminId }),
    subscribeJournalEmail: (email) => callDbService('subscribeJournalEmail', { email }),
    getJournalPosts: () => callDbService('getJournalPosts'),
    saveJournalPost: (post, adminId) => callDbService('saveJournalPost', { post, adminId }),
    deleteJournalPost: (id, adminId) => callDbService('deleteJournalPost', { id, adminId })
};
