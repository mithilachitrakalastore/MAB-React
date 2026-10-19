import React, { lazy, Suspense, useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { dbService } from './services/dbservices';
import { StoreLoadingScreen } from './components/StoreLoadingScreen';

// 1. New Scroll Management Component
const ScrollToTop = () => {
    const { pathname, hash } = useLocation();

    useEffect(() => {
        if (!hash) {
            // If no #hash, jump to top of page
            window.scrollTo(0, 0);
        } else {
            // If there is a #hash, find the element and scroll smoothly
            const id = hash.replace('#', '');
            const element = document.getElementById(id);
            if (element) {
                element.scrollIntoView({ behavior: 'smooth' });
            }
        }
    }, [pathname, hash]); // Trigger on route or hash change

    return null; 
};

const MetaPixelPageView = () => {
    const { pathname, search, hash } = useLocation();
    const lastTrackedLocation = useRef(`${window.location.pathname}${window.location.search}${window.location.hash}`);

    useEffect(() => {
        const currentLocation = `${pathname}${search}${hash}`;
        if (lastTrackedLocation.current === currentLocation) return;

        lastTrackedLocation.current = currentLocation;
        window.fbq?.('track', 'PageView');
    }, [pathname, search, hash]);

    return null;
};

const RouteFooter = () => {
    const { pathname } = useLocation();

    return pathname === '/login' ? null : <Footer />;
};

const RouteMain = ({ children }) => {
    const { pathname } = useLocation();

    return (
        <main className={`flex-grow ${pathname === '/login' ? 'pb-0' : 'pb-20'} lg:pb-0`}>
            {children}
        </main>
    );
};

// Components
import { Navbar } from './components/Navbar';
import { BottomNav } from './components/BottomNav';
import { Footer } from './components/Footer';

// Pages
import { HomePage } from './pages/HomePage';
const ProductsPage = lazy(() => import('./pages/ProductsPage').then((module) => ({ default: module.ProductsPage })));
const ProductDetailPage = lazy(() => import('./pages/ProductDetailPage').then((module) => ({ default: module.ProductDetailPage })));
const CartPage = lazy(() => import('./pages/CartPage').then((module) => ({ default: module.CartPage })));
const ArtAdvicePage = lazy(() => import('./pages/ArtAdvicePage').then((module) => ({ default: module.ArtAdvicePage })));
const ProfilePage = lazy(() => import('./pages/ProfilePage').then((module) => ({ default: module.ProfilePage })));
const WishlistPage = lazy(() => import('./pages/WishlistPage').then((module) => ({ default: module.WishlistPage })));
const SellerPanel = lazy(() => import('./pages/SellerPanel').then((module) => ({ default: module.SellerPanel })));
const LoginPage = lazy(() => import('./pages/LoginPage').then((module) => ({ default: module.LoginPage })));
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy').then((module) => ({ default: module.PrivacyPolicy })));
const TermsOfService = lazy(() => import('./pages/TermsOfService').then((module) => ({ default: module.TermsOfService })));
const CulturalJournalPage = lazy(() => import('./pages/CulturalJournalPage'));
const InvoiceVerificationPage = lazy(() => import('./pages/InvoiceVerificationPage').then((module) => ({ default: module.InvoiceVerificationPage })));


// Load cart and wishlist from localStorage immediately when the module loads
const loadCartFromStorage = () => {
    try {
        const saved = localStorage.getItem('mithila-cart');
        return saved ? JSON.parse(saved) : [];
    } catch (e) {
        return [];
    }
};

// Removed loadWishlistFromStorage

const loadUserFromStorage = () => {
    try {
        const saved = localStorage.getItem('mithila-user');
        return saved ? JSON.parse(saved) : null;
    } catch (e) {
        return null;
    }
};

// Initialize state with data from localStorage immediately
const initialCart = loadCartFromStorage();
const initialWishlist = [];
const initialUser = loadUserFromStorage();

export default function App() {
    const [showLoadingScreen, setShowLoadingScreen] = useState(true);
    const [isLoadingScreenExiting, setIsLoadingScreenExiting] = useState(false);
    const [products, setProducts] = useState([]);
    const [productsLoading, setProductsLoading] = useState(true);
    const [cart, setCart] = useState(initialCart);
    const [wishlist, setWishlist] = useState(initialWishlist);
    const [currentUser, setCurrentUser] = useState(initialUser);

    useEffect(() => {
        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const exitDelay = reducedMotion ? 150 : 300;
        const removeDelay = reducedMotion ? 450 : 950;
        const exitTimer = window.setTimeout(() => setIsLoadingScreenExiting(true), exitDelay);
        const removeTimer = window.setTimeout(() => setShowLoadingScreen(false), removeDelay);

        return () => {
            window.clearTimeout(exitTimer);
            window.clearTimeout(removeTimer);
        };
    }, []);
    
    useEffect(() => {
        const loadInitialData = async () => {
            try {
                const data = await dbService.getProducts();
                setProducts(data);
                setProductsLoading(false);

                if (currentUser) {
                    try {
                        const allUsers = await dbService.getUsers();
                        const refreshedUser = allUsers.find(user => user.id === currentUser.id);
                        if (refreshedUser) {
                            if (refreshedUser.role === 'admin' && !currentUser.emailAdminToken) {
                                setCurrentUser(null);
                                return;
                            }
                            setCurrentUser({ ...refreshedUser, emailAdminToken: currentUser.emailAdminToken });
                        }
                    } catch (userSyncError) {
                        console.error('Failed to sync current user from database:', userSyncError);
                    }

                    const wishlistsData = await dbService.getWishlists();
                    const userWishlists = wishlistsData.filter(w => w.userId === currentUser.id).map(w => w.productId);
                    if (userWishlists.length > 0) {
                        // Merge local wishlist with DB ones, preferring DB
                        const merged = Array.from(new Set([...wishlist, ...userWishlists]));
                        setWishlist(merged);
                        
                        // Push any local only ones to DB
                        const localOnly = wishlist.filter(id => !userWishlists.includes(id));
                        for (let id of localOnly) {
                             await dbService.addToWishlist(currentUser.id, id).catch(() => {});
                        }
                    }
                } else {
                    setWishlist([]); // Clear wishlist on logout or for guests on load
                }
            } catch (error) {
                setProductsLoading(false);
                console.error("Failed to harmonize portals:", error);
            }
        };
        loadInitialData();
    }, [currentUser?.id]);

    useEffect(() => { localStorage.setItem('mithila-cart', JSON.stringify(cart)); }, [cart]);
    // Wishlist no longer stored in localStorage
    useEffect(() => { if (currentUser) localStorage.setItem('mithila-user', JSON.stringify(currentUser)); else localStorage.removeItem('mithila-user'); }, [currentUser]);

    const addToCart = (product) => {
        setCart(prev => {
            const exists = prev.find(i => i.id === product.id);
            if (exists) return prev.map(i => i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i);
            return [...prev, { ...product, quantity: 1 }];
        });
    };

    const toggleWishlist = async (id) => {
        const isAdding = !wishlist.includes(id);
        
        // Optimistic UI update
        setWishlist(prev => isAdding ? [...prev, id] : prev.filter(i => i !== id));

        // Sync with backend if user is logged in
        if (currentUser) {
            try {
                if (isAdding) {
                    await dbService.addToWishlist(currentUser.id, id);
                } else {
                    await dbService.removeFromWishlist(currentUser.id, id);
                }
            } catch (error) {
                console.error("Failed to sync wishlist with server:", error);
            }
        }
    };
    const updateQty = (id, q) => {
        if (q <= 0) { setCart(prev => prev.filter(i => i.id !== id)); return; }
        setCart(prev => prev.map(i => i.id === id ? { ...i, quantity: q } : i));
    };

    const remove = (id) => setCart(prev => prev.filter(i => i.id !== id));
    const clearCart = () => setCart([]);
    const refreshProducts = async () => {
        try {
            setProducts(await dbService.getProducts());
        } catch (error) {
            console.error('Failed to refresh product inventory:', error);
        }
    };
    const cartCount = cart.reduce((acc, item) => acc + item.quantity, 0);

    return (
        <Router>
            <ScrollToTop />
            <MetaPixelPageView />
            {showLoadingScreen && <StoreLoadingScreen isExiting={isLoadingScreenExiting} />}
            <div inert={showLoadingScreen} className="min-h-screen flex flex-col selection:bg-[#5c1111] selection:text-white animate-in fade-in zoom-in-95 duration-1000">
                <Navbar cartCount={cartCount} currentUser={currentUser} setCurrentUser={setCurrentUser} />
                <RouteMain>
                    <Suspense fallback={null}>
                    <Routes>
                        <Route path="/" element={<HomePage products={products} addToCart={addToCart} wishlist={wishlist} toggleWishlist={toggleWishlist} />} />
                        <Route path="/products" element={<ProductsPage products={products} addToCart={addToCart} wishlist={wishlist} toggleWishlist={toggleWishlist} currentUser={currentUser} />} />
                        <Route path="/product/:slug" element={<ProductDetailPage products={products} addToCart={addToCart} wishlist={wishlist} toggleWishlist={toggleWishlist} />} />
                        <Route path="/cart" element={currentUser ? <CartPage cart={cart} updateQty={updateQty} remove={remove} clearCart={clearCart} currentUser={currentUser} onOrderPlaced={refreshProducts} /> : <Navigate to="/login" />} />
                        <Route path="/advice" element={<ArtAdvicePage />} />
                        <Route path="/journal" element={<CulturalJournalPage />} />
                        <Route path="/journal/:slug" element={<CulturalJournalPage />} />
                        <Route path="/login" element={currentUser ? <Navigate to="/profile" /> : <LoginPage onLogin={setCurrentUser} />} />
                        <Route path="/profile" element={currentUser ? <ProfilePage currentUser={currentUser} setCurrentUser={setCurrentUser} wishlist={wishlist} products={products} toggleWishlist={toggleWishlist} addToCart={addToCart} /> : <Navigate to="/login" />} />
                        <Route path="/wishlist" element={<WishlistPage products={products} wishlist={wishlist} toggleWishlist={toggleWishlist} addToCart={addToCart} />} />
                        <Route 
                            path="/seller" 
                            element={
                                (currentUser && (currentUser.role === 'seller' || currentUser.role === 'admin')) ? 
                                <SellerPanel currentUser={currentUser} /> : 
                                <Navigate to="/login" />
                            } 
                        />
                        <Route path="/privacy" element={<PrivacyPolicy />} />
                        <Route path="/terms-of-service" element={<TermsOfService />} />
                        <Route path="/verify" element={<InvoiceVerificationPage />} />
                        <Route path="/verify/:invoiceNo" element={<InvoiceVerificationPage />} />
                    </Routes>
                    </Suspense>
                </RouteMain>
                <BottomNav currentUser={currentUser} />
                <RouteFooter />
            </div>
        </Router>
    );
}
