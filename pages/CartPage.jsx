import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
    CheckCircle, ShoppingCart, ArrowRight, Minus, Plus, 
    Trash2, CreditCard, Package, Truck, MapPin, Calendar, 
    ClipboardList, User, Mail, Phone, Home, Building, ChevronLeft,
    Ticket, ShieldCheck
} from 'lucide-react';
import { SectionHeading } from '../components/SectionHeading';
import { dbService } from '../services/dbservices';
import { redirectToPayment } from '../services/payment';

const TrackingStep = ({ icon: Icon, label, status }) => (
    <div className="flex flex-col items-center relative z-10">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-500 ${
            status === 'complete' ? 'bg-[#5c1111] text-white shadow-lg' : 
            status === 'active' ? 'bg-amber-600 text-white shadow-lg scale-105' : 
            'bg-[#e5e1d8] text-stone-400'
        }`}>
            <Icon size={18} />
        </div>
        <p className={`mt-2 text-[9px] font-black uppercase tracking-widest text-center ${
            status === 'pending' ? 'text-stone-400' : 'text-[#2a2723]'
        }`}>{label}</p>
    </div>
);

export const CartPage = ({ cart, updateQty, remove, clearCart, currentUser, onOrderPlaced }) => {
    const subtotal = cart.reduce((acc, item) => acc + item.price * item.quantity, 0);
    const shippingFee = subtotal > 5000 ? 0 : 250;
    const total = subtotal + shippingFee;
    const advanceAmount = Math.round(cart.reduce(
        (sum, item) => sum + item.price * item.quantity * Number(item.advance_percentage || 0) / 100,
        0
    ) * 100) / 100;
    const canPayAdvance = cart.length > 0 && cart.every((item) => Number(item.advance_percentage) > 0);
    
    const [step, setStep] = useState('cart');
    const [orderInfos, setOrderInfos] = useState([]);
    const [paymentType, setPaymentType] = useState('full');
    const [paymentGateway, setPaymentGateway] = useState('esewa');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [shippingDetails, setShippingDetails] = useState({
        name: '', email: '', phone: '', address: '', city: ''
    });
    const [promo, setPromo] = useState('');
    const [checkoutError, setCheckoutError] = useState('');

    const handleCheckout = async (e) => {
        e.preventDefault();
        if (isSubmitting) return;
        setIsSubmitting(true);
        setCheckoutError('');
        let ordersCreated = [];

        try {
            if (!currentUser?.id) throw new Error('Please sign in before placing an order.');
            if (paymentType === 'advance' && !canPayAdvance) {
                throw new Error('Advance payment is not available for every item in your bag.');
            }
            // Group cart items by seller
            const itemsBySeller = cart.reduce((acc, item) => {
                if (!acc[item.seller_id]) acc[item.seller_id] = [];
                acc[item.seller_id].push(item);
                return acc;
            }, {});

            const orders = [];

            // Create separate orders for each seller
            for (const [sellerId, items] of Object.entries(itemsBySeller)) {
                const orderId = 'MITH-' + Math.random().toString(36).substr(2, 8).toUpperCase();
                const sellerSubtotal = items.reduce((acc, item) => acc + item.price * item.quantity, 0);
                const sellerShippingFee = sellerSubtotal > 5000 ? 0 : 250;
                const orderTotal = sellerSubtotal + sellerShippingFee;
                const newOrder = {
                    id: orderId,
                    date: new Date().toISOString(),
                    items: items,
                    total: orderTotal,
                    customer_id: currentUser.id,
                    seller_id: sellerId,
                    status: 'pending',
                    customer_payment_status: 'pending',
                    customer_payment_verified: false,
                    mcs_payment_status: 'pending',
                    payment_type: paymentType,
                    payment_gateway: paymentGateway,
                    customer: {
                        ...shippingDetails
                    }
                };

                await dbService.saveOrder(newOrder);
                orders.push(newOrder);
                ordersCreated.push(newOrder);
            }

            try {
                await onOrderPlaced?.();
            } catch (error) {
                console.error('Order was placed, but product inventory could not be refreshed:', error);
            }
            const payment = await dbService.startPayment(
                orders.map((order) => order.id),
                currentUser.id,
                paymentGateway,
                paymentType
            );
            setOrderInfos(orders);
            clearCart();
            redirectToPayment(payment);
        } catch (error) {
            console.error('Checkout failed:', error);
            if (ordersCreated.length > 0) {
                setOrderInfos(ordersCreated);
                clearCart();
                setStep('tracking');
                window.scrollTo(0, 0);
                setCheckoutError('Your order was saved, but payment could not be started. Visit your profile dashboard to retry payment.');
            } else {
                setCheckoutError(error.message || 'We could not complete your order right now. Please try again.');
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setShippingDetails(prev => ({ ...prev, [name]: value }));
    };

    if (step === 'tracking' && orderInfos.length > 0) {
        return (
            <div className="pt-20 pb-12 px-4 sm:px-6 max-w-4xl mx-auto min-h-screen animate-in fade-in duration-700">
                <div className="bg-[#f8f6f2] rounded-2xl sm:rounded-3xl p-6 sm:p-10 shadow-xl border border-[#e5e1d8] space-y-8">
                    <div className="text-center space-y-4">
                        <div className="w-16 h-16 bg-green-50/50 text-green-700 rounded-2xl flex items-center justify-center mx-auto shadow-sm mb-4 border border-green-100">
                            <CheckCircle size={32} />
                        </div>
                        <h2 className="font-playfair text-2xl sm:text-4xl font-black text-[#2a2723]">{checkoutError ? 'Payment needed.' : 'Greatness Awaits.'}</h2>
                        <p className="text-stone-500 font-light text-sm sm:text-base">Your {orderInfos.length > 1 ? 'orders' : 'order'} <span className="text-[#5c1111] font-black tracking-widest">#{orderInfos.map(o => o.id).join(', #')}</span> {checkoutError ? 'is saved and awaiting payment.' : 'is ready for payment confirmation.'}</p>
                        {checkoutError && <p role="alert" className="mx-auto max-w-md rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-900">{checkoutError}</p>}
                        <p className="text-xs text-stone-400">Receipt sent to: <span className="font-bold text-[#2a2723]">{orderInfos[0].customer.email}</span></p>
                        <p className="mx-auto max-w-md rounded-lg border border-green-100 bg-green-50 px-4 py-3 text-xs font-semibold text-green-800">
                            We will contact you soon via your WhatsApp number: {orderInfos[0].customer.phone}
                        </p>
                    </div>

                    <div className="relative py-6 px-4 border-y border-[#e5e1d8]">
                        <div className="absolute top-[3rem] left-[15%] right-[15%] h-[2px] bg-[#e5e1d8] -z-0">
                            <div className="absolute top-0 left-0 h-full w-[25%] bg-[#5c1111] shadow-[0_0_10px_rgba(92,17,17,0.3)]"></div>
                        </div>
                        <div className="flex justify-between items-start gap-2">
                            <TrackingStep icon={ClipboardList} label="Processing" status="active" />
                            <TrackingStep icon={Package} label="Crafting" status="pending" />
                            <TrackingStep icon={Truck} label="Courier" status="pending" />
                            <TrackingStep icon={MapPin} label="Arrived" status="pending" />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-[#5c1111]">Artisan Summary</h4>
                            <div className="space-y-3">
                                {orderInfos.flatMap(order => order.items).map(item => (
                                    <div key={`${item.id}-${Math.random()}`} className="flex gap-3 items-center group">
                                        <div className="w-12 h-12 rounded-lg overflow-hidden bg-[#efece6] shrink-0 border border-[#e5e1d8]">
                                            <img src={item.image} className="w-full h-full object-cover grayscale opacity-60 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-500" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-black text-[#2a2723] line-clamp-1">{item.name}</p>
                                            <p className="text-[8px] text-stone-400 font-black uppercase tracking-widest mt-0.5">रु {item.price.toLocaleString()} &bull; Qty: {item.quantity}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="bg-[#efece6] rounded-xl sm:rounded-2xl p-4 sm:p-6 space-y-4 self-start shadow-inner border border-[#d1cdc7]">
                            <div className="space-y-3">
                                <div className="flex items-center gap-3 text-[#2a2723]">
                                    <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center shadow-sm"><Calendar size={14} className="text-[#5c1111]" /></div>
                                    <div>
                                        <p className="text-[9px] font-black uppercase tracking-widest text-stone-400">Est. Heritage Arrival</p>
                                        <p className="text-sm font-bold text-[#2a2723]">October 12 - 15, 2025</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 text-[#2a2723]">
                                    <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center shadow-sm"><MapPin size={14} className="text-[#5c1111]" /></div>
                                    <div>
                                        <p className="text-[9px] font-black uppercase tracking-widest text-stone-400">Shipping Destination</p>
                                        <p className="text-sm font-bold text-[#2a2723] line-clamp-1">{orderInfos[0].customer.address}, {orderInfos[0].customer.city}</p>
                                    </div>
                                </div>
                            </div>
                            <div className="pt-4 border-t border-[#d1cdc7] flex justify-between items-baseline">
                                <span className="text-[9px] font-black uppercase tracking-widest text-stone-400">Total Payment</span>
                                <span className="font-playfair text-2xl sm:text-3xl font-black text-[#5c1111] tracking-tight">रु {orderInfos.reduce((acc, order) => acc + order.total, 0).toLocaleString()}</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3">
                        {checkoutError && <Link to="/profile" className="flex-1 bg-[#5c1111] text-white py-3 sm:py-4 rounded-xl sm:rounded-2xl font-black text-[10px] sm:text-[11px] uppercase tracking-[0.15em] text-center">Go to profile to pay</Link>}
                        <Link to="/products" className="flex-1 bg-[#2a2723] text-white py-3 sm:py-4 rounded-xl sm:rounded-2xl font-black text-[10px] sm:text-[11px] uppercase tracking-[0.15em] hover:bg-[#5c1111] transition-all shadow-lg text-center">
                            Continue Journey
                        </Link>
                        <Link to="/" className="flex-1 bg-white border border-[#d1cdc7] text-[#2a2723] py-3 sm:py-4 rounded-xl sm:rounded-2xl font-black text-[10px] sm:text-[11px] uppercase tracking-[0.15em] hover:bg-[#efece6] transition-all text-center">
                            Home Portal
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    if (step === 'shipping') {
        return (
            <div className="pt-20 pb-12 px-4 sm:px-6 max-w-4xl mx-auto min-h-screen">
                <button onClick={() => setStep('cart')} className="mb-6 sm:mb-8 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.15em] text-stone-400 hover:text-[#5c1111] transition-colors group">
                    <ChevronLeft size={16} className="transition-transform group-hover:-translate-x-1" /> Back to Collection
                </button>
                
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10">
                    <div className="lg:col-span-7">
                        <SectionHeading subtitle="Your Destination" title="Shipping Ritual" />
                        <form onSubmit={handleCheckout} className="bg-[#f8f6f2] rounded-xl sm:rounded-2xl p-5 sm:p-8 shadow-lg border border-[#e5e1d8] grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                            <div className="space-y-2">
                                <label className="text-[9px] font-black uppercase tracking-widest text-stone-400 pl-1">Full Legal Name</label>
                                <div className="relative">
                                    <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-300" />
                                    <input required name="name" value={shippingDetails.name} onChange={handleInputChange} type="text" placeholder="Janak Prasad" className="w-full pl-10 pr-4 py-3 bg-[#efece6] rounded-lg text-sm focus:ring-3 focus:ring-[#5c1111]/5 focus:bg-white outline-none transition-all font-medium text-[#2a2723]" />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[9px] font-black uppercase tracking-widest text-stone-400 pl-1">Email Address</label>
                                <div className="relative">
                                    <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-300" />
                                    <input required name="email" value={shippingDetails.email} onChange={handleInputChange} type="email" placeholder="janak@heritage.com" className="w-full pl-10 pr-4 py-3 bg-[#efece6] rounded-lg text-sm focus:ring-3 focus:ring-[#5c1111]/5 focus:bg-white outline-none transition-all font-medium text-[#2a2723]" />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[9px] font-black uppercase tracking-widest text-stone-400 pl-1">Contact Number</label>
                                <div className="relative">
                                    <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-300" />
                                    <input required name="phone" value={shippingDetails.phone} onChange={handleInputChange} type="tel" placeholder="+977 98..." className="w-full pl-10 pr-4 py-3 bg-[#efece6] rounded-lg text-sm focus:ring-3 focus:ring-[#5c1111]/5 focus:bg-white outline-none transition-all font-medium text-[#2a2723]" />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[9px] font-black uppercase tracking-widest text-stone-400 pl-1">City / Province</label>
                                <div className="relative">
                                    <Building size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-300" />
                                    <input required name="city" value={shippingDetails.city} onChange={handleInputChange} type="text" placeholder="Kathmandu" className="w-full pl-10 pr-4 py-3 bg-[#efece6] rounded-lg text-sm focus:ring-3 focus:ring-[#5c1111]/5 focus:bg-white outline-none transition-all font-medium text-[#2a2723]" />
                                </div>
                            </div>
                            <div className="md:col-span-2 space-y-2">
                                <label className="text-[9px] font-black uppercase tracking-widest text-stone-400 pl-1">Detailed Address</label>
                                <div className="relative">
                                    <Home size={14} className="absolute left-3 top-4 text-stone-300" />
                                    <textarea required name="address" value={shippingDetails.address} onChange={handleInputChange} rows={2} placeholder="House no, Area, Ward no..." className="w-full pl-10 pr-4 py-3 bg-[#efece6] rounded-lg text-sm focus:ring-3 focus:ring-[#5c1111]/5 focus:bg-white outline-none transition-all resize-none font-medium text-[#2a2723]" />
                                </div>
                            </div>
                            <fieldset className="md:col-span-2 space-y-3">
                                <legend className="text-[9px] font-black uppercase tracking-widest text-stone-400 pl-1">Payment amount</legend>
                                <label className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 ${paymentType === 'full' ? 'border-[#5c1111] bg-white' : 'border-[#e5e1d8] bg-[#efece6]'}`}>
                                    <input type="radio" name="paymentType" value="full" checked={paymentType === 'full'} onChange={() => setPaymentType('full')} className="mt-1 accent-[#5c1111]" />
                                    <span className="flex-1">
                                        <span className="block text-xs font-bold text-[#2a2723]">Pay in full</span>
                                        <span className="block text-[11px] text-stone-500">Pay रु {total.toLocaleString()} now.</span>
                                    </span>
                                </label>
                                <label className={`flex items-start gap-3 rounded-lg border p-3 ${canPayAdvance ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'} ${paymentType === 'advance' ? 'border-[#5c1111] bg-white' : 'border-[#e5e1d8] bg-[#efece6]'}`}>
                                    <input type="radio" name="paymentType" value="advance" checked={paymentType === 'advance'} disabled={!canPayAdvance} onChange={() => setPaymentType('advance')} className="mt-1 accent-[#5c1111]" />
                                    <span className="flex-1">
                                        <span className="block text-xs font-bold text-[#2a2723]">Pay advance</span>
                                        <span className="block text-[11px] text-stone-500">
                                            {canPayAdvance
                                                ? `Pay रु ${advanceAmount.toLocaleString()} now; pay the remaining balance from your profile dashboard.`
                                                : 'Advance payment is unavailable because one or more products do not offer it.'}
                                        </span>
                                    </span>
                                </label>
                            </fieldset>
                            <fieldset className="md:col-span-2">
                                <legend className="mb-2 text-[9px] font-black uppercase tracking-widest text-stone-400 pl-1">Payment method</legend>
                                <div className="grid grid-cols-2 gap-3">
                                    {[
                                        { id: 'esewa', label: 'eSewa' },
                                        { id: 'khalti', label: 'Khalti' },
                                    ].map((method) => (
                                        <label key={method.id} className={`flex cursor-pointer items-center gap-2 rounded-lg border p-3 text-xs font-bold ${paymentGateway === method.id ? 'border-[#5c1111] bg-white text-[#5c1111]' : 'border-[#e5e1d8] bg-[#efece6] text-stone-600'}`}>
                                            <input type="radio" name="paymentGateway" value={method.id} checked={paymentGateway === method.id} onChange={() => setPaymentGateway(method.id)} className="accent-[#5c1111]" />
                                            {method.label}
                                        </label>
                                    ))}
                                </div>
                            </fieldset>
                            <div className="md:col-span-2 pt-4">
                                <button type="submit" disabled={isSubmitting || (paymentType === 'advance' && !canPayAdvance)} className="w-full bg-[#5c1111] text-white py-3 sm:py-4 rounded-xl font-black text-[11px] uppercase tracking-[0.2em] shadow-lg hover:bg-[#2a2723] hover:-translate-y-0.5 transition-all flex items-center justify-center gap-3 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50">
                                    <CreditCard size={16} /> {isSubmitting ? 'Preparing secure payment...' : `Pay रु ${(paymentType === 'advance' ? advanceAmount : total).toLocaleString()} with ${paymentGateway === 'esewa' ? 'eSewa' : 'Khalti'}`}
                                </button>
                                <p className="text-center text-[10px] leading-relaxed text-stone-400">
                                    Secure payment is verified by the gateway. Advance balances remain available in your profile dashboard.
                                </p>
                                {checkoutError && <p role="alert" className="text-center text-xs font-semibold text-red-300">{checkoutError}</p>}
                            </div>
                        </form>
                    </div>

                    <div className="lg:col-span-5 space-y-6 pt-6 lg:pt-0">
                        <div className="bg-[#f8f6f2] rounded-xl sm:rounded-2xl p-5 sm:p-6 shadow-lg border border-[#e5e1d8] space-y-5 sticky top-24">
                            <h3 className="font-playfair text-xl sm:text-2xl font-black border-b border-[#e5e1d8] pb-4 italic text-[#2a2723]">Bag Summary</h3>
                            <div className="space-y-3 max-h-[200px] overflow-y-auto pr-2 custom-scroll">
                                {cart.map(item => (
                                    <div key={item.id} className="flex justify-between items-center text-xs font-medium">
                                        <span className="text-stone-500 line-clamp-1 flex-1 pr-3">{item.name} <span className="text-[9px] text-stone-400 font-black ml-1">x{item.quantity}</span></span>
                                        <span className="text-[#2a2723] whitespace-nowrap">रु {(item.price * item.quantity).toLocaleString()}</span>
                                    </div>
                                ))}
                            </div>
                            <div className="space-y-3 pt-4 border-t border-[#e5e1d8]">
                                <div className="flex justify-between text-stone-400 font-black text-[9px] uppercase tracking-widest">
                                    <span>Subtotal</span>
                                    <span>रु {subtotal.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between text-stone-400 font-black text-[9px] uppercase tracking-widest">
                                    <span>Shipping & Insurance</span>
                                    <span>{shippingFee === 0 ? <span className="text-amber-600">Complimentary</span> : `रु ${shippingFee}`}</span>
                                </div>
                                <div className="pt-4 flex justify-between items-baseline">
                                    <span className="font-playfair font-black text-base italic text-stone-400">Total</span>
                                    <span className="font-playfair text-2xl sm:text-3xl font-black text-[#5c1111] tracking-tight">रु {total.toLocaleString()}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (cart.length === 0) {
        return (
            <div className="pt-24 pb-12 px-4 text-center h-screen space-y-8 animate-in slide-in-from-bottom-8 duration-700">
                <div className="w-20 h-20 bg-[#f8f6f2] rounded-2xl flex items-center justify-center mx-auto shadow-xl text-[#5c1111]/5 rotate-12 ring-1 ring-[#e5e1d8]">
                    <ShoppingCart size={36} />
                </div>
                <div className="space-y-3">
                    <h2 className="font-playfair text-2xl sm:text-4xl font-black text-[#2a2723]">Your bag is silent.</h2>
                    <p className="text-stone-400 max-w-sm mx-auto text-sm">The collection awaits your eye. No pieces have been selected yet.</p>
                </div>
                <Link to="/products" className="inline-flex items-center gap-3 bg-[#5c1111] text-white px-8 py-4 rounded-xl font-black text-[10px] uppercase tracking-[0.2em] hover:bg-[#2a2723] transition-all shadow-lg">
                    Explore The Vault <ArrowRight size={16} />
                </Link>
            </div>
        );
    }

    return (
        <div className="pt-20 pb-12 px-4 sm:px-6 max-w-6xl mx-auto min-h-screen">
            <SectionHeading subtitle="Your Curated Bag" title="The Collection" />
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
                {/* Cart Items List */}
                <div className="lg:col-span-8 space-y-4">
                    {cart.map(item => (
                        <div key={item.id} className="bg-[#f8f6f2] p-1.5 sm:p-5 rounded-xl border border-[#e5e1d8] shadow-sm flex flex-row items-center gap-4 group transition-all hover:shadow-md hover:border-[#5c1111]/10">
                            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden bg-[#efece6] shrink-0 border border-[#e5e1d8] shadow-inner">
                                <img src={item.image} className="w-full h-full object-cover transition duration-500 group-hover:scale-105 opacity-90 group-hover:opacity-100" />
                            </div>
                            <div className="flex-1 text-center sm:text-left space-y-2 w-full">
                                <div className="flex flex-col sm:flex-row items-start justify-between gap-1">
                                    <div className="min-w-0">
                                        <h3 className="font-playfair text-[12px] sm:text-lg font-black text-[#2a2723] group-hover:text-[#5c1111] transition-colors line-clamp-1">{item.name}</h3>
                                        <p className="hidden sm:flex text-[9px] font-black uppercase tracking-[0.2em] text-stone-400 mt-0.5">{item.storeName} &bull; {item.location}</p>
                                    </div>
                                    <div className="text-center sm:text-right shrink-0">
                                        <p className="text-[7px] sm:text-[9px] font-black uppercase tracking-widest text-stone-300 mb-0.3 italic">Total Value</p>
                                        <p className="text-lg font-playfair font-black text-[#5c1111]">रु {(item.price * item.quantity).toLocaleString()}</p>
                                    </div>
                                </div>
                                <div className="flex items-center justify-center sm:justify-start gap-3 pt-1">
                                    <div className="flex items-center bg-[#efece6] rounded-lg p-0.5 shadow-inner border border-[#d1cdc7]">
                                        <button onClick={() => updateQty(item.id, item.quantity - 1)} className="p-1.5 text-stone-400 hover:text-[#5c1111] transition-colors"><Minus size={12} /></button>
                                        <span className="w-6 text-center font-black text-xs text-[#2a2723]">{item.quantity}</span>
                                        <button onClick={() => updateQty(item.id, item.quantity + 1)} className="p-1.5 text-stone-400 hover:text-[#5c1111] transition-colors"><Plus size={12} /></button>
                                    </div>
                                    <button onClick={() => remove(item.id)} className="w-8 h-8 bg-white text-stone-300 hover:text-red-700 hover:bg-red-50 transition-all rounded-lg flex items-center justify-center border border-[#e5e1d8] shadow-sm">
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                    
                    <div className="pt-6 flex items-center gap-4 opacity-30 grayscale justify-center sm:justify-start text-[8px] sm:text-[9px]">
                        <div className="flex items-center gap-2"><ShieldCheck size={14} /> <span className="font-black uppercase tracking-widest">Heritage Certified</span></div>
                        <div className="flex items-center gap-2"><Truck size={14} /> <span className="font-black uppercase tracking-widest">Insured Logistics</span></div>
                    </div>
                </div>

                {/* Sticky Summary Section */}
                <div className="lg:col-span-4 relative">
                    <div className="sticky top-24 space-y-4">
                        {/* Main Checkout Card */}
                        <div className="bg-[#2a2723] text-white p-5 sm:p-6 rounded-xl sm:rounded-2xl shadow-xl space-y-5 overflow-hidden border border-white/5">
                            <div className="absolute top-0 right-0 w-20 h-20 bg-[#5c1111]/10 rounded-full blur-[40px]"></div>
                            
                            <div className="flex items-baseline justify-between border-b border-white/10 pb-4">
                                <h3 className="font-playfair text-xl font-black italic">Summary</h3>
                                <span className="text-[9px] font-black text-stone-400 uppercase tracking-widest">{cart.length} unique pieces</span>
                            </div>

                            <div className="space-y-3">
                                <div className="flex justify-between text-stone-400 font-black text-[9px] uppercase tracking-widest">
                                    <span>Collection Value</span>
                                    <span className="text-white">रु {subtotal.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between text-stone-400 font-black text-[9px] uppercase tracking-widest">
                                    <span>Shipping</span>
                                    <span>{shippingFee === 0 ? <span className="text-amber-500">Complimentary</span> : `रु ${shippingFee}`}</span>
                                </div>
                                <div className="flex justify-between text-stone-400 font-black text-[9px] uppercase tracking-widest">
                                    <span>Estimated Taxes</span>
                                    <span className="text-white">Included</span>
                                </div>
                                
                                <div className="border-t border-white/10 pt-4 mt-3 flex justify-between items-baseline">
                                    <span className="font-playfair font-black text-base italic text-stone-400">Grand Total</span>
                                    <span className="text-3xl sm:text-4xl font-playfair font-black text-amber-500 tracking-tight">रु {total.toLocaleString()}</span>
                                </div>
                            </div>

                            <div className="space-y-3 pt-3">
                                <button 
                                    onClick={() => { setStep('shipping'); window.scrollTo(0, 0); }}
                                    className="w-full bg-white text-[#2a2723] py-3 sm:py-4 rounded-xl font-black text-[10px] sm:text-[11px] uppercase tracking-[0.2em] hover:bg-amber-500 hover:scale-[1.02] transition-all shadow-lg flex items-center justify-center gap-3 active:scale-95"
                                >
                                    Proceed to Checkout <ArrowRight size={14} />
                                </button>
                                <p className="text-center text-[9px] leading-relaxed text-white/55">
                                    We will contact you soon via your WhatsApp number.
                                </p>
                                <p className="text-center text-[8px] font-bold uppercase tracking-widest text-white/30 italic">Secure checkout with Mithila-Pay</p>
                            </div>
                        </div>

                        {/* Promo Code Card */}
                        <div className="bg-[#f8f6f2] p-4 sm:p-5 rounded-xl border border-[#e5e1d8] shadow-sm">
                            <div className="flex items-center gap-2 mb-3 text-[#2a2723]">
                                <Ticket size={16} className="text-[#5c1111]" />
                                <h4 className="font-black text-[9px] uppercase tracking-[0.2em]">Sacred Gift Code</h4>
                            </div>
                            <div className="flex gap-2">
                                <input 
                                    type="text" 
                                    placeholder="Enter Code..." 
                                    value={promo}
                                    onChange={(e) => setPromo(e.target.value)}
                                    className="flex-1 bg-[#efece6] border-none rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-[#5c1111]/20 outline-none text-[#2a2723] placeholder-stone-400 uppercase font-black tracking-widest"
                                />
                                <button className="bg-white border border-[#d1cdc7] text-[#2a2723] px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-stone-100 transition-colors">
                                    Apply
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
