import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle, Gift, Heart, LogOut, Mail, MapPin, Package, Pencil, Phone, Save, ShoppingBag, Store, User, X } from 'lucide-react';
import { dbService } from '../services/dbservices';
import { ProductCard } from '../components/ProductCard';
import { redirectToPayment } from '../services/payment';

const statusStyles = {
    delivered: 'bg-[#e8f2e5] text-[#3f6b3b]', shipped: 'bg-[#e6f0f7] text-[#3c6782]',
    processing: 'bg-[#fff0d5] text-[#a76216]', cancelled: 'bg-[#f9e4e1] text-[#a64d43]', pending: 'bg-[#fff0d5] text-[#a76216]'
};

const formatStatus = (status = 'pending') => status.charAt(0).toUpperCase() + status.slice(1);
const SHOPPING_PREFERENCES = [
    { value: 'female', label: 'Female' },
    { value: 'male', label: 'Male' },
    { value: 'non-binary', label: 'Non-binary' },
    { value: 'prefer-not-to-say', label: 'Prefer not to say' }
];
const SHOPPING_PREFERENCE_SYMBOLS = {
    female: '♀',
    male: '♂',
    'non-binary': '⚧',
    'prefer-not-to-say': '—'
};
const SHOPPING_PREFERENCE_COLORS = {
    female: 'text-pink-600',
    male: 'text-blue-600',
    'non-binary': 'text-violet-600',
    'prefer-not-to-say': 'text-stone-500'
};
const normalizeShoppingPreference = (value) => {
    const normalized = String(value || '').toLowerCase().trim().replace(/[\s_]+/g, '-');
    if (['female', 'women', "women's", 'woman'].includes(normalized)) return 'female';
    if (['male', 'men', "men's", 'man'].includes(normalized)) return 'male';
    if (['nonbinary', 'non-binary', 'other'].includes(normalized)) return 'non-binary';
    if (['prefer-not-to-say', 'prefer-not-say'].includes(normalized)) return 'prefer-not-to-say';
    return '';
};
const getDeliveryDate = (date) => {
    const deliveryDate = new Date(date || Date.now());
    deliveryDate.setDate(deliveryDate.getDate() + 7);
    return deliveryDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

export const ProfilePage = ({ currentUser, setCurrentUser, wishlist, products, toggleWishlist, addToCart }) => {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [ordersError, setOrdersError] = useState('');
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [activeView, setActiveView] = useState('dashboard');
    const [isEditing, setIsEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [sellerStoreName, setSellerStoreName] = useState('');
    const [sellerPassword, setSellerPassword] = useState('');
    const [sellerRequesting, setSellerRequesting] = useState(false);
    const [sellerRequestError, setSellerRequestError] = useState('');
    const [payingOrderId, setPayingOrderId] = useState('');
    const [paymentError, setPaymentError] = useState('');
    const [paymentGateway, setPaymentGateway] = useState('esewa');
    const paymentResult = new URLSearchParams(window.location.search).get('payment');
    const [profile, setProfile] = useState({
        name: currentUser.name || '',
        username: currentUser.username || '',
        phone: currentUser.phone || '',
        address: currentUser.address || '',
        city: currentUser.city || '',
        gender: normalizeShoppingPreference(currentUser.gender),
        storeName: currentUser.storeName || ''
    });

    useEffect(() => {
        setProfile({
            name: currentUser.name || '',
            username: currentUser.username || '',
            phone: currentUser.phone || '',
            address: currentUser.address || '',
            city: currentUser.city || '',
            gender: normalizeShoppingPreference(currentUser.gender),
            storeName: currentUser.storeName || ''
        });
    }, [currentUser]);

    useEffect(() => {
        let isCurrentAccount = true;
        setOrders([]);
        setLoading(true);
        setOrdersError('');

        const loadOrders = async () => {
            try {
                const data = currentUser.role === 'admin'
                    ? await dbService.getOrders()
                    : await dbService.getOrders(undefined, currentUser.id);
                if (isCurrentAccount) setOrders(data);
            } catch (error) {
                if (isCurrentAccount) {
                    console.error('Failed to load account orders:', error);
                    setOrdersError('Unable to load your orders. Please try again.');
                }
            } finally {
                if (isCurrentAccount) setLoading(false);
            }
        };
        loadOrders();
        return () => { isCurrentAccount = false; };
    }, [currentUser.id, currentUser.role]);

    const wishlistProducts = products.filter(product => wishlist.includes(product.id));
    const deliveredOrders = orders.filter(order => order.status === 'delivered').length;
    const handleCancelOrder = async (orderId) => {
        if (!window.confirm('Are you sure you want to cancel this order?')) return;
        try {
            await dbService.updateOrderStatus(orderId, 'cancelled', currentUser.role, currentUser.id);
            setOrders(await dbService.getOrders(undefined, currentUser.id));
        } catch (error) { alert('Failed to cancel order. Please try again.'); }
    };
    const saveProfile = async () => {
        setSaving(true);
        try {
            const updatedUser = await dbService.updateUser(currentUser.id, profile);
            setCurrentUser(updatedUser);
            setIsEditing(false);
        } catch (error) {
            alert(error.message || 'Failed to update profile. Please try again.');
        } finally {
            setSaving(false);
        }
    };
    const requestSellerConversion = async () => {
        setSellerRequesting(true);
        setSellerRequestError('');
        try {
            const updatedUser = await dbService.requestSellerConversion(currentUser.id, sellerPassword, sellerStoreName);
            setCurrentUser(updatedUser);
            setSellerPassword('');
            setSellerStoreName('');
        } catch (error) {
            setSellerRequestError(error.message || 'Unable to submit your seller application.');
        } finally {
            setSellerRequesting(false);
        }
    };
    const saveOrderDetails = async (orderId, customer) => {
        setSaving(true);
        try {
            await dbService.updateOrderDetails(orderId, customer, currentUser.id);
            setOrders(previous => previous.map(order => order.id === orderId ? { ...order, customer } : order));
            setSelectedOrder(previous => previous ? { ...previous, customer } : previous);
        } catch (error) { alert(error.message || 'Failed to update order details.'); }
        finally { setSaving(false); }
    };
    const payRemainingBalance = async (order) => {
        setPayingOrderId(order.id);
        setPaymentError('');
        try {
            const payment = await dbService.startPayment([order.id], currentUser.id, paymentGateway, 'balance');
            redirectToPayment(payment);
        } catch (error) {
            console.error('Unable to start remaining-balance payment:', error);
            setPaymentError(error.message || 'Unable to start payment. Please try again.');
        } finally {
            setPayingOrderId('');
        }
    };
    const navItems = [
        { id: 'dashboard', label: 'Dashboard', icon: User }, { id: 'orders', label: 'My Orders', icon: ShoppingBag },
        { id: 'wishlist', label: 'Wishlist', icon: Heart, count: wishlist.length }, { id: 'profile', label: 'Profile Information', icon: User }, { id: 'address', label: 'Saved Address', icon: MapPin }
    ];
    const showSellerDashboardLink = currentUser.role === 'admin' || (currentUser.role === 'seller' && currentUser.status === 'active');

    return (
        <main className="min-h-screen bg-[#fcf8f0] px-4 pb-32 pt-28 text-[#29251f] sm:px-6 lg:px-5 lg:pt-32">
            <div className="mx-auto max-w-[1440px]">
                <div className="mb-5 flex items-center gap-2 text-xs font-semibold text-[#8b8378]"><Link to="/">Home</Link><span>/</span><span className="text-[#29251f]">Account</span></div>
                <header className="relative mb-5 overflow-hidden rounded border border-[#e5dccd] bg-[#fffaf0] px-5 py-5 sm:px-8">
                    <div className="relative flex items-center gap-4 sm:gap-6"><img src={currentUser.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.name || 'User')}&background=7c2020&color=fff&size=96`} alt="" className="h-16 w-16 rounded-full border-4 border-white object-cover shadow-md sm:h-20 sm:w-20" /><div><p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-[#9b6c47]">Your heritage account</p><h1 className="font-playfair text-2xl font-bold sm:text-3xl">Welcome back, {currentUser.name || 'Art Lover'}{currentUser.role === 'customer' && normalizeShoppingPreference(currentUser.gender) && <span aria-label={`${SHOPPING_PREFERENCES.find(option => option.value === normalizeShoppingPreference(currentUser.gender))?.label} gender`} className={`ml-2 inline-block font-black ${SHOPPING_PREFERENCE_COLORS[normalizeShoppingPreference(currentUser.gender)]}`} style={{ WebkitTextStroke: '0.7px currentColor' }}>{SHOPPING_PREFERENCE_SYMBOLS[normalizeShoppingPreference(currentUser.gender)]}</span>}</h1><p className="mt-1 text-xs text-[#766e62]">Manage your orders, wishlist, profile and saved addresses.</p><p className="mt-2 flex items-center gap-1.5 text-xs text-[#766e62]"><Mail size={12} /> {currentUser.email}</p></div></div>
                </header>
                <div className="grid gap-5 lg:grid-cols-[300px_1fr]">
                    <aside className="rounded border border-[#e5dccd] bg-[#fffaf0] p-2">
                        <nav aria-label="Account navigation" className="grid grid-cols-2 gap-1 lg:grid-cols-1">
                            {navItems.map(({ id, label, icon: Icon, count }) => (
                                <button key={id} type="button" onClick={() => setActiveView(id)} className={`flex min-h-10 items-center gap-2 rounded px-3 py-2 text-left text-xs font-semibold ${activeView === id ? 'bg-[#29251f] text-white' : 'text-[#5e574e] hover:bg-[#f0e8db]'}`}>
                                    <Icon size={14} />
                                    <span className="flex-1">{label}</span>
                                    {count > 0 && <span>{count}</span>}
                                </button>
                            ))}
                            {showSellerDashboardLink && (
                                <Link to="/seller" className="flex min-h-10 items-center gap-2 rounded px-3 py-2 text-xs font-semibold text-[#5e574e]">
                                    <Store size={14} /> Seller dashboard
                                </Link>
                            )}
                            <button type="button" onClick={() => setCurrentUser(null)} className="flex min-h-10 items-center gap-2 rounded px-3 py-2 text-left text-xs font-semibold text-[#7c2020]">
                                <LogOut size={14} /> Logout
                            </button>
                        </nav>
                    </aside>
                    <div className="min-w-0 space-y-5">
                        {paymentResult === 'success' && <p role="status" className="rounded border border-green-200 bg-green-50 px-4 py-3 text-sm font-semibold text-green-800">Payment verified. Your order balance has been updated.</p>}
                        {paymentResult === 'failed' && <p role="alert" className="rounded border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">Payment was not completed. You can retry below.</p>}
                        {(activeView === 'dashboard' || activeView === 'orders') && <><div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{[{ label: 'Orders', value: orders.length, icon: Package }, { label: 'Wishlist', value: wishlist.length, icon: Heart }, { label: 'Reviews', value: deliveredOrders, icon: CheckCircle }, { label: 'Reward Points', value: orders.length * 250, icon: Gift }].map(({ label, value, icon: Icon }) => <div key={label} className="flex items-center gap-3 rounded border border-[#e5dccd] bg-[#fffaf0] px-4 py-3"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#f5ead9] text-[#9b5f30]"><Icon size={17} /></span><div><p className="text-[11px] font-semibold uppercase tracking-widest text-[#8b8378]">{label}</p><p className="font-playfair text-lg font-bold">{Number(value).toLocaleString()}</p></div></div>)}</div><OutstandingPayments orders={orders} loading={loading} gateway={paymentGateway} setGateway={setPaymentGateway} payingOrderId={payingOrderId} error={paymentError} onPay={payRemainingBalance} /><OrderPanel orders={activeView === 'dashboard' ? orders.slice(0, 4) : orders} loading={loading} error={ordersError} onCancel={handleCancelOrder} onViewOrder={setSelectedOrder} onViewAll={() => setActiveView('orders')} />{activeView === 'dashboard' && <WishlistPanel products={wishlistProducts.slice(0, 2)} addToCart={addToCart} toggleWishlist={toggleWishlist} />}</>}
                        {activeView === 'wishlist' && <WishlistPanel products={wishlistProducts} addToCart={addToCart} toggleWishlist={toggleWishlist} expanded />}
                        {(activeView === 'profile' || activeView === 'address') && (
                            <>
                                <ProfilePanel currentUser={currentUser} profile={profile} setProfile={setProfile} editing={isEditing} setEditing={setIsEditing} saving={saving} onSave={saveProfile} onlyAddress={activeView === 'address'} />
                                {activeView === 'profile' && <SellerApplicationPanel currentUser={currentUser} storeName={sellerStoreName} setStoreName={setSellerStoreName} password={sellerPassword} setPassword={setSellerPassword} submitting={sellerRequesting} error={sellerRequestError} onSubmit={requestSellerConversion} />}
                            </>
                        )}
                    </div>
                </div>
            </div>
            {selectedOrder && <OrderDetails order={selectedOrder} onClose={() => setSelectedOrder(null)} onSave={saveOrderDetails} saving={saving} />}
        </main>
    );
};

const OutstandingPayments = ({ orders, loading, gateway, setGateway, payingOrderId, error, onPay }) => {
    const dueOrders = orders.filter((order) => (
        order.status !== 'cancelled' &&
        Number(order.total || 0) - Number(order.amount_paid || 0) > 0.009
    ));
    if (loading || dueOrders.length === 0) return null;

    return (
        <section className="rounded border border-[#e5dccd] bg-[#fffaf0] p-4 sm:p-5">
            <div className="mb-4">
                <h2 className="font-playfair text-lg font-bold">Payments due</h2>
                <p className="mt-1 text-xs text-[#8b8378]">Pay your remaining balance here at any time.</p>
            </div>
            <div className="mb-4 flex gap-2">
                {['esewa', 'khalti'].map((method) => (
                    <label key={method} className={`flex min-h-10 cursor-pointer items-center gap-2 rounded border px-3 text-xs font-semibold capitalize ${gateway === method ? 'border-[#7c2020] bg-[#f5ead9] text-[#7c2020]' : 'border-[#d7c8b6]'}`}>
                        <input type="radio" name="balanceGateway" value={method} checked={gateway === method} onChange={() => setGateway(method)} />
                        {method === 'esewa' ? 'eSewa' : 'Khalti'}
                    </label>
                ))}
            </div>
            {error && <p role="alert" className="mb-3 text-sm font-semibold text-[#a64d43]">{error}</p>}
            <div className="space-y-3">
                {dueOrders.map((order) => {
                    const balance = Math.max(Number(order.total || 0) - Number(order.amount_paid || 0), 0);
                    return (
                        <div key={order.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-[#eee6d9] pt-3">
                            <div>
                                <p className="text-sm font-semibold">Order #{order.id}</p>
                                <p className="text-xs text-[#8b8378]">
                                    Paid रु {Number(order.amount_paid || 0).toLocaleString()} of रु {Number(order.total || 0).toLocaleString()}
                                </p>
                            </div>
                            <button
                                type="button"
                                disabled={Boolean(payingOrderId)}
                                onClick={() => onPay(order)}
                                className="min-h-10 rounded bg-[#7c2020] px-4 text-xs font-semibold text-white disabled:cursor-wait disabled:opacity-60"
                            >
                                {payingOrderId === order.id ? 'Starting payment...' : `Pay रु ${balance.toLocaleString()} with ${gateway === 'esewa' ? 'eSewa' : 'Khalti'}`}
                            </button>
                        </div>
                    );
                })}
            </div>
        </section>
    );
};

const OrderPanel = ({ orders, loading, error, onCancel, onViewOrder, onViewAll }) => <section className="overflow-hidden rounded border border-[#e5dccd] bg-[#fffaf0]"><div className="flex items-center justify-between border-b border-[#e5dccd] px-4 py-3"><h2 className="font-playfair text-lg font-bold">Recent Orders</h2><button type="button" onClick={onViewAll} className="inline-flex min-h-10 items-center rounded border border-[#d7c8b6] bg-[#fffaf0] px-3 text-xs font-semibold text-[#9b6c47] shadow-sm transition-colors hover:border-[#7c2020] hover:bg-[#f5ead9] hover:text-[#7c2020] focus:outline-none focus:ring-2 focus:ring-[#7c2020]/30">View all <span aria-hidden="true" className="ml-1 text-sm">→</span></button></div>{loading ? <div className="p-4 text-sm text-[#8b8378]">Loading orders...</div> : error ? <div role="alert" className="p-4 text-sm text-[#a64d43]">{error}</div> : orders.length === 0 ? <div className="p-8 text-center text-sm text-[#8b8378]">No orders yet. <Link className="text-[#7c2020]" to="/products">Browse the gallery.</Link></div> : orders.map(order => <div key={order.id} className="flex flex-wrap items-center gap-3 border-b border-[#eee6d9] px-4 py-3 last:border-0 sm:flex-nowrap"><img src={order.items?.[0]?.image} alt={order.items?.[0]?.name || 'Order item'} className="h-12 w-12 rounded object-cover" /><div className="min-w-0 flex-1"><p className="truncate font-playfair text-sm font-bold">{order.items?.[0]?.name || 'Mithila artwork'}{order.items?.length > 1 ? ' & more' : ''}</p><p className="mt-0.5 text-xs text-[#8b8378]">Order #{order.id} · {new Date(order.date).toLocaleDateString()}</p><span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusStyles[order.status] || statusStyles.pending}`}>{formatStatus(order.status)}</span></div><p className="font-playfair text-sm font-bold">Rs. {Number(order.total || 0).toLocaleString()}</p><div className="flex w-full gap-2 sm:w-auto"><button type="button" onClick={() => onViewOrder(order)} className="flex-1 rounded border border-[#d7c8b6] px-3 py-2 text-xs font-semibold sm:flex-none">View Order</button>{order.status === 'pending' && Number(order.amount_paid || 0) <= 0 && <button type="button" onClick={() => onCancel(order.id)} className="rounded px-2 text-xs text-[#a64d43]">Cancel</button>}</div></div>)}</section>;

const OrderDetails = ({ order, onClose, onSave, saving }) => {
    const customer = order.customer || {};
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState({ name: customer.name || '', email: customer.email || '', phone: customer.phone || '', address: customer.address || '', city: customer.city || '' });
    const update = (field, value) => setDraft(previous => ({ ...previous, [field]: value }));
    const submit = async () => { await onSave(order.id, draft); setEditing(false); };
    return <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-[#29251f]/40 p-4" role="dialog" aria-modal="true" aria-label="Order details"><div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded border border-[#e5dccd] bg-[#fffaf0] p-5 shadow-2xl sm:p-7"><div className="mb-5 flex items-start justify-between border-b border-[#e5dccd] pb-4"><div><p className="text-xs font-semibold uppercase tracking-widest text-[#9b6c47]">Order details</p><h2 className="mt-1 font-playfair text-2xl font-bold">Order #{order.id}</h2><p className="mt-1 text-sm text-[#766e62]">Placed {new Date(order.date).toLocaleDateString()}</p></div><button type="button" onClick={onClose} aria-label="Close order details"><X size={20} /></button></div><div className="grid gap-3 sm:grid-cols-2"><Info label="Approx. delivery" value={getDeliveryDate(order.date)} /><Info label="Status" value={formatStatus(order.status)} /><Info label="Customer" value={customer.name || 'Not provided'} /><Info label="Contact" value={[customer.email, customer.phone].filter(Boolean).join(' · ') || 'Not provided'} /><Info label="Delivery address" value={[customer.address, customer.city].filter(Boolean).join(', ') || 'Not provided'} /></div>{order.status === 'pending' && !editing && <button type="button" onClick={() => setEditing(true)} className="my-5 flex min-h-10 items-center gap-2 rounded border border-[#d7c8b6] px-4 text-xs font-semibold text-[#7c2020]"><Pencil size={14} /> Edit delivery details</button>}{editing && <div className="my-5 rounded border border-[#e5dccd] bg-white p-4"><div className="grid gap-3 sm:grid-cols-2">{['name', 'email', 'phone', 'address', 'city'].map(field => <label key={field} className="block"><span className="mb-1 block text-xs font-semibold capitalize text-[#8b8378]">{field === 'city' ? 'City / Province' : field}</span><input value={draft[field]} onChange={event => update(field, event.target.value)} className="w-full rounded border border-[#d7c8b6] px-3 py-2.5 text-sm" /></label>)}</div><div className="mt-4 flex gap-2"><button type="button" disabled={saving} onClick={submit} className="flex min-h-10 items-center gap-2 rounded bg-[#7c2020] px-4 text-xs font-semibold text-white disabled:opacity-60"><Save size={14} /> {saving ? 'Saving...' : 'Save details'}</button><button type="button" onClick={() => setEditing(false)} className="flex min-h-10 items-center gap-2 rounded border border-[#d7c8b6] px-4 text-xs font-semibold"><X size={14} /> Cancel</button></div></div>}<div className="mt-5 flex items-center justify-between"><span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusStyles[order.status] || statusStyles.pending}`}>{formatStatus(order.status)}</span><span className="text-sm text-[#766e62]">Payment: {order.customer_payment_status || 'pending'}</span></div><div className="mt-4 space-y-3">{(order.items || []).map((item, index) => <div key={`${item.id || item.slug || item.name}-${index}`} className="flex items-center gap-3 border-b border-[#eee6d9] pb-3"><img src={item.image} alt={item.name} className="h-16 w-16 rounded object-cover" /><div className="min-w-0 flex-1"><p className="font-playfair text-base font-bold">{item.name}</p><p className="text-sm text-[#766e62]">Quantity: {item.quantity}</p></div><p className="text-sm font-semibold">Rs. {(item.price * item.quantity).toLocaleString()}</p></div>)}</div><div className="mt-6 flex justify-end border-t border-[#e5dccd] pt-4"><p className="font-playfair text-xl font-bold text-[#7c2020]">Total: Rs. {Number(order.total || 0).toLocaleString()}</p></div></div></div>;
};

const Info = ({ label, value }) => <div className="rounded bg-[#f5ead9] p-3"><p className="text-xs font-semibold uppercase tracking-wider text-[#8b8378]">{label}</p><p className="mt-1 text-sm text-[#5e574e]">{value}</p></div>;
const WishlistPanel = ({ products, addToCart, toggleWishlist, expanded }) => <section className="rounded border border-[#e5dccd] bg-[#fffaf0] p-4"><div className="mb-3 flex items-center justify-between"><h2 className="font-playfair text-lg font-bold">My Wishlist</h2><Link to="/wishlist" className="text-xs text-[#9b6c47]">View all →</Link></div>{products.length ? <div className={`grid gap-3 ${expanded ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4' : 'grid-cols-2'}`}>{products.map(product => <ProductCard key={product.id} product={product} addToCart={addToCart} isWishlisted toggleWishlist={toggleWishlist} />)}</div> : <div className="py-8 text-center text-sm text-[#8b8378]">Your wishlist is waiting for a new treasure.</div>}</section>;
const ProfilePanel = ({ currentUser, profile, setProfile, editing, setEditing, saving, onSave, onlyAddress }) => {
    const canEditStoreName = currentUser.role !== 'customer' && !currentUser.storeName && !currentUser.storeName_pending;
    const visibleStoreName = currentUser.storeName_pending || profile.storeName || currentUser.storeName || '';

    return (
        <section className="rounded border border-[#e5dccd] bg-[#fffaf0] p-5">
            <div className="mb-5 flex items-center justify-between border-b border-[#e5dccd] pb-3">
                <div>
                    <p className="text-xs font-semibold uppercase tracking-widest text-[#9b6c47]">Account details</p>
                    <h2 className="font-playfair text-xl font-bold">{onlyAddress ? 'Saved Address' : 'Profile Information'}</h2>
                </div>
                <button type="button" onClick={() => setEditing(true)} className="flex min-h-10 items-center gap-1 rounded border border-[#d7c8b6] px-3 text-xs font-semibold text-[#7c2020]"><Pencil size={13} /> Edit Profile</button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">{!onlyAddress && <><Field label="Full name" value={profile.name} editing={editing} onChange={value => setProfile({ ...profile, name: value })} /><Field label="Username" value={profile.username} editing={editing} onChange={value => setProfile({ ...profile, username: value })} />{currentUser.role !== 'customer' && <Field label="Store name" value={visibleStoreName} editing={editing && canEditStoreName} onChange={value => setProfile({ ...profile, storeName: value })} disabled={!canEditStoreName} />}{currentUser.role !== 'customer' && currentUser.storeName_pending && <div className="sm:col-span-2 rounded border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-800">Store name change is pending admin approval.</div>}{currentUser.role !== 'customer' && currentUser.storeName && !currentUser.storeName_pending && <div className="sm:col-span-2 rounded border border-stone-200 bg-[#f7efe7] p-3 text-xs font-semibold text-stone-700">Store name is approved. To request a change, contact the admin.</div>}<Field label="Email" value={currentUser.email} /><Field label="Phone" value={profile.phone} editing={editing} onChange={value => setProfile({ ...profile, phone: value })} />{currentUser.role === 'customer' && <label className="block"><span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[#8b8378]">Gender</span>{editing ? <><select value={normalizeShoppingPreference(profile.gender)} onChange={event => setProfile({ ...profile, gender: event.target.value })} className="w-full rounded border border-[#d7c8b6] bg-white px-3 py-2.5 text-sm"><option value="">Select your gender</option>{SHOPPING_PREFERENCES.map(option => <option key={option.value} value={option.value}>{SHOPPING_PREFERENCE_SYMBOLS[option.value]} {option.label}</option>)}</select><span className="mt-1 block text-[11px] text-[#8b8378]">Used to personalize product recommendations; all products remain available.</span></> : <span className="flex min-h-10 items-center gap-2 rounded bg-[#f5ead9] px-3 py-2.5 text-sm text-[#5e574e]"><span aria-hidden="true" className={`text-lg font-black ${SHOPPING_PREFERENCE_COLORS[normalizeShoppingPreference(profile.gender)] || 'text-stone-500'}`} style={{ WebkitTextStroke: '0.7px currentColor' }}>{SHOPPING_PREFERENCE_SYMBOLS[normalizeShoppingPreference(profile.gender)] || '○'}</span>{SHOPPING_PREFERENCES.find(option => option.value === normalizeShoppingPreference(profile.gender))?.label || 'Not provided'}</span>}</label>}</>}{(onlyAddress || editing) && <><Field label="Address" value={profile.address} editing={editing} onChange={value => setProfile({ ...profile, address: value })} /><Field label="City / Province" value={profile.city} editing={editing} onChange={value => setProfile({ ...profile, city: value })} /></>}</div>{editing && <div className="mt-5 flex gap-2"><button type="button" disabled={saving} onClick={onSave} className="flex min-h-10 items-center gap-2 rounded bg-[#7c2020] px-4 text-xs font-semibold text-white disabled:opacity-60"><Save size={13} /> {saving ? 'Saving...' : 'Save changes'}</button><button type="button" onClick={() => setEditing(false)} className="flex min-h-10 items-center gap-2 rounded border border-[#d7c8b6] px-4 text-xs font-semibold"><X size={13} /> Cancel</button></div>}</section>
    );
};

const SellerApplicationPanel = ({ currentUser, storeName, setStoreName, password, setPassword, submitting, error, onSubmit }) => {
    if (currentUser.role === 'seller') {
        if (currentUser.status === 'active') return null;
        return (
            <section className="rounded border border-amber-200 bg-amber-50 p-5" role="status">
                <h2 className="font-playfair text-lg font-bold text-amber-900">Artisan application pending</h2>
                <p className="mt-1 text-sm text-amber-800">Your account is awaiting administrator approval. Seller tools will become available after approval.</p>
            </section>
        );
    }
    if (currentUser.role !== 'customer') return null;

    return (
        <section className="rounded border border-[#e5dccd] bg-[#fffaf0] p-5">
            <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#f5ead9] text-[#7c2020]"><Store size={18} /></span>
                <div>
                    <p className="text-xs font-semibold uppercase tracking-widest text-[#9b6c47]">Artisan account</p>
                    <h2 className="font-playfair text-xl font-bold">Switch to a seller account</h2>
                    <p className="mt-1 text-sm leading-6 text-[#766e62]">Apply using your customer account. An administrator will review your studio before seller access is enabled.</p>
                </div>
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <label className="block">
                    <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[#8b8378]">Studio name</span>
                    <input value={storeName} onChange={event => setStoreName(event.target.value)} required autoComplete="organization" className="w-full rounded border border-[#d7c8b6] bg-white px-3 py-2.5 text-sm" />
                </label>
                <label className="block">
                    <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[#8b8378]">Current password</span>
                    <input type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} required className="w-full rounded border border-[#d7c8b6] bg-white px-3 py-2.5 text-sm" />
                </label>
            </div>
            {error && <p className="mt-3 text-sm font-semibold text-[#a64d43]" role="alert">{error}</p>}
            <button type="button" disabled={submitting || !storeName.trim() || !password} onClick={onSubmit} className="mt-4 min-h-10 rounded bg-[#7c2020] px-4 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60">
                {submitting ? 'Submitting request...' : 'Request seller access'}
            </button>
        </section>
    );
};

const Field = ({ label, value, editing, onChange, disabled = false }) => <label className="block"><span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[#8b8378]">{label}</span>{editing && onChange ? <input value={value || ''} onChange={event => onChange(event.target.value)} disabled={disabled} className="w-full rounded border border-[#d7c8b6] bg-white px-3 py-2.5 text-sm disabled:cursor-not-allowed disabled:bg-stone-100" /> : <span className="block min-h-10 rounded bg-[#f5ead9] px-3 py-2.5 text-sm text-[#5e574e]">{value || 'Not provided'}</span>}</label>;