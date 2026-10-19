import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, ShoppingCart, Star, MapPin, Check } from 'lucide-react';
import { ProductBadges } from './ProductBadges';

export const QuickViewModal = ({ product, isOpen, onClose, addToCart, badgeContext }) => {
    const [isCartAnimating, setIsCartAnimating] = useState(false);
    const [isAdded, setIsAdded] = useState(false);

    useEffect(() => {
        if (!isAdded) return undefined;
        const timer = setTimeout(() => setIsAdded(false), 2000);
        return () => clearTimeout(timer);
    }, [isAdded]);

    if (!isOpen || !product) return null;

    const handleAddToCart = () => {
        if (isCartAnimating || isAdded) return;
        addToCart(product);
        setIsCartAnimating(true);
        setTimeout(() => {
            setIsCartAnimating(false);
            setIsAdded(true);
        }, 2050);
    };

    return createPortal((
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 sm:p-12">
            {/* Backdrop */}
            <div 
                className="absolute inset-0 bg-[#2a2723]/60 backdrop-blur-md animate-in fade-in duration-300"
                onClick={onClose}
            ></div>
            
            {/* Modal Content */}
            <div className="relative bg-[#f8f6f2] w-full max-w-4xl rounded-[3rem] overflow-hidden shadow-2xl flex flex-col md:flex-row animate-in zoom-in-95 slide-in-from-bottom-4 duration-300 border border-[#e5e1d8]">
                <button 
                    onClick={onClose}
                    className="absolute top-6 right-6 z-30 p-2.5 bg-white/80 backdrop-blur-sm text-stone-500 hover:text-[#5c1111] rounded-full shadow-lg transition-all active:scale-90"
                >
                    <X size={18} />
                </button>

                {/* Left side: Image */}
                <div className="md:w-[45%] h-64 md:h-auto overflow-hidden bg-[#efece6]">
                    <img 
                        src={product.image} 
                        alt={product.name} 
                        className="w-full h-full object-cover"
                    />
                </div>

                {/* Right side: Info */}
                <div className="md:w-[55%] p-8 md:p-10 flex flex-col justify-center space-y-6">
                    <div className="space-y-3">
                        <div className="flex items-center gap-3">
                            <ProductBadges product={product} context={badgeContext} fallbackLabel="Artisan" />
                            <div className="flex items-center gap-1 text-amber-600 text-[9px] font-black">
                                <Star size={10} fill="currentColor" /> {product.rating}
                            </div>
                        </div>
                        <h2 className="font-playfair text-3xl md:text-4xl font-black text-[#2a2723] leading-tight">
                            {product.name}
                        </h2>
                        <p className="text-[#5c1111] font-playfair font-black text-2xl">
                            रु {product.price.toLocaleString()}
                        </p>
                    </div>

                    <p className="text-stone-500 text-sm leading-relaxed font-light italic border-l-2 border-[#d1cdc7] pl-4">
                        "{product.description}"
                    </p>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <p className="text-[8px] font-black uppercase tracking-widest text-stone-400 mb-1">Store</p>
                            <p className="text-stone-800 font-bold text-xs">{product.storeName}</p>
                        </div>
                        <div>
                            <p className="text-[8px] font-black uppercase tracking-widest text-stone-400 mb-1">Origin</p>
                            <p className="text-stone-800 font-bold text-xs flex items-center gap-1"><MapPin size={10} className="text-[#5c1111]" /> {product.location}</p>
                        </div>
                    </div>

                    <div className="pt-2 flex gap-4">
                        <button 
                            onClick={handleAddToCart}
                            disabled={isCartAnimating || isAdded}
                            className={`relative flex-1 overflow-hidden rounded-xl py-4 font-black text-[10px] uppercase tracking-[0.2em] shadow-xl transition-all active:scale-95 flex items-center justify-center gap-3 ${
                                isAdded
                                    ? 'bg-green-600 text-white'
                                    : 'bg-[#5c1111] text-white hover:bg-[#2a2723]'
                            }`}
                        >
                            {isAdded ? (
                                <Check size={16} />
                            ) : (
                                <span className={`relative inline-flex items-center ${isCartAnimating ? 'cart-icon-flight' : ''}`}>
                                    {isCartAnimating && (
                                        <span className="cart-wind-lines" aria-hidden="true">
                                            <span />
                                            <span />
                                            <span />
                                        </span>
                                    )}
                                    <ShoppingCart size={14} className="relative z-10" />
                                </span>
                            )}
                            <span className={`transition-opacity duration-150 ${isCartAnimating ? 'opacity-0' : 'opacity-100'}`}>
                                {isAdded ? 'Added' : 'Add To Bag'}
                            </span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    ), document.body);
};
