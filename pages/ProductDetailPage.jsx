import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, ArrowUpRight, BadgeCheck, Check, ChevronDown, ChevronLeft, ChevronRight, CircleCheck, Frame, Heart, Leaf, Minus, Palette, Pin, Plus, Ruler, Send, Share2, ShoppingCart, Star, Truck, X } from 'lucide-react';
import { ProductCard } from '../components/ProductCard';
import { ProductBadges } from '../components/ProductBadges';
import { dbService } from '../services/dbservices';
import { handleShareProduct } from '../services/shareProduct';

const parseKeyFeatures = (keyFeatures) => {
    if (!keyFeatures) return [];

    return String(keyFeatures)
        .split(/\r?\n|\r/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
            const pipeMatch = line.match(/^([^|]+?)\s*\|\s*(.+)$/);
            if (pipeMatch) {
                return {
                    label: pipeMatch[1].trim(),
                    value: pipeMatch[2].trim(),
                };
            }

            const directMatch = line.match(/^(.+?)\s*[:\-]\s*(.+)$/);
            if (directMatch) {
                return {
                    label: directMatch[1].trim(),
                    value: directMatch[2].trim(),
                };
            }

            return { label: 'Feature', value: line.trim() };
        })
        .filter((row) => row.label && row.value);
};

export const ProductDetailPage = ({ products, addToCart, wishlist, toggleWishlist }) => {
    const slug = useLocation().pathname.split('/').pop();
    const product = products.find((item) => item.slug === slug);
    const [activeImg, setActiveImg] = useState(product?.image);
    const [quantity, setQuantity] = useState(1);
    const [reviews, setReviews] = useState([]);
    const [newReview, setNewReview] = useState({ rating: 5, comment: '' });
    const [isSubmittingReview, setIsSubmittingReview] = useState(false);
    const [activeTab, setActiveTab] = useState('description');
    const [isImageZoomed, setIsImageZoomed] = useState(false);
    const [isCartAnimating, setIsCartAnimating] = useState(false);
    const [isAdded, setIsAdded] = useState(false);
    const [isShareCopied, setIsShareCopied] = useState(false);
    const navigate = useNavigate();
    const carouselRef = useRef(null);
    const thumbnailRef = useRef(null);
    const currentUser = JSON.parse(localStorage.getItem('mithila-user') || 'null');
    const isWishlisted = product ? wishlist.includes(product.id) : false;
    const isModerator = currentUser?.role === 'admin' || currentUser?.role === 'seller';
    const badgeContext = useMemo(() => ({
        catalog: products,
        wishlistProducts: products.filter((item) => wishlist.includes(item.id)),
    }), [products, wishlist]);

    useEffect(() => {
        if (!product) return;
        setActiveImg(product.image);
        setQuantity(1);
        window.scrollTo(0, 0);
        loadReviews();
    }, [product]);

    useEffect(() => {
        if (!product) return;
        const pageUrl = window.location.href;
        document.title = `${product.name} | Mithila Chitrakala Store`;
        const metaValues = {
            description: product.description || `Discover ${product.name} at Mithila Chitrakala Store.`,
            'og:title': product.name,
            'og:description': product.description || `Discover ${product.name} at Mithila Chitrakala Store.`,
            'og:url': pageUrl,
            'og:image': product.image,
            'twitter:title': product.name,
            'twitter:description': product.description || `Discover ${product.name} at Mithila Chitrakala Store.`,
            'twitter:image': product.image,
        };

        Object.entries(metaValues).forEach(([key, content]) => {
            const selector = key === 'description' ? 'meta[name="description"]' : `meta[property="${key}"], meta[name="${key}"]`;
            const meta = document.querySelector(selector);
            if (meta && content) meta.setAttribute('content', content);
        });

        return () => { document.title = 'Mithila Chitrakala Store - Premium Traditional Art'; };
    }, [product]);

    const loadReviews = async () => {
        if (product) setReviews(await dbService.getReviews(product.id));
    };

    const handleReviewSubmit = async (event) => {
        event.preventDefault();
        if (!currentUser || !product) return;
        setIsSubmittingReview(true);
        await dbService.addReview({ productId: product.id, userId: currentUser.id, userName: currentUser.name, ...newReview });
        setNewReview({ rating: 5, comment: '' });
        setIsSubmittingReview(false);
        loadReviews();
    };

    const relatedProducts = useMemo(() => {
        if (!product) return [];
        return products
            .filter((item) => item.category === product.category && item.id !== product.id)
            .concat(products.filter((item) => item.category !== product.category && item.id !== product.id));
    }, [product, products]);

    const customTags = useMemo(() => {
        if (!product) return [];
        const rawTags = Array.isArray(product.custom_tags)
            ? product.custom_tags
            : String(product.custom_tags || product.tags || '')
                .split(/[•,|]+/)
                .map((tag) => tag.trim())
                .filter(Boolean);
        return rawTags.slice(0, 6);
    }, [product]);

    const featureRows = useMemo(() => {
        if (!product) return [];
        return parseKeyFeatures(product.key_features);
    }, [product]);

    const currentPrice = Number(product?.price) || 0;
    const comparePrice = Number(product?.compare_price ?? product?.original_price ?? product?.mrp ?? 0) || 0;
    const isFramedArtwork = /paint|canvas|artwork|frame/i.test(`${product?.category || ''} ${product?.name || ''}`);
    const detailRows = product ? [
        { label: 'Material', value: product.material || 'Not specified', icon: Palette },
        { label: 'Size', value: product.length || 'Not specified', icon: Ruler },
        { label: isFramedArtwork ? 'Frame' : 'Care', value: isFramedArtwork ? 'Not included' : (product.instruction || 'Handle with care'), icon: Frame },
        { label: 'Authenticity', value: product.authenticity || 'Not specified', icon: CircleCheck },
    ] : [];

    const scrollCarousel = (direction) => {
        carouselRef.current?.scrollBy({ left: direction === 'left' ? -360 : 360, behavior: 'smooth' });
    };

    useEffect(() => {
        if (!isAdded) return undefined;
        const timer = setTimeout(() => setIsAdded(false), 2000);
        return () => clearTimeout(timer);
    }, [isAdded]);

    const handleAddToCart = () => {
        if (isCartAnimating || isAdded) return;
        for (let index = 0; index < quantity; index += 1) addToCart(product);
        setIsCartAnimating(true);
        setTimeout(() => {
            setIsCartAnimating(false);
            setIsAdded(true);
        }, 2050);
    };

    const handleShare = async () => {
        try {
            await handleShareProduct({
                product,
                baseUrl: window.location.origin,
                onCopy: () => {
                    setIsShareCopied(true);
                    setTimeout(() => setIsShareCopied(false), 2000);
                },
            });
        } catch (error) {
            console.error('Could not prepare product share link:', error);
        }
    };

    if (!product) {
        return <div className="flex min-h-screen items-center justify-center bg-[#f8f5ee] text-center"><div><h1 className="font-playfair text-4xl font-bold">Piece not found</h1><Link to="/products" className="mt-5 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[#7c2020]"><ArrowLeft size={14} /> Back to gallery</Link></div></div>;
    }

    const images = [product.image, ...(product.images || [])];
    const showNextImage = () => {
        const currentIndex = Math.max(0, images.indexOf(activeImg));
        setActiveImg(images[(currentIndex + 1) % images.length]);
    };

    return (
        <main className="min-h-screen bg-[#f8f4ed] px-3 pb-16 pt-24 text-[#29251f] sm:px-6 sm:pb-24 sm:pt-28 lg:px-10">
            <div className="mx-auto max-w-[1180px]">
                <div className="mb-5 flex items-center justify-between text-[9px] text-stone-500 sm:mb-7 sm:text-[10px]">
                    <div className="flex min-w-0 items-center gap-1.5"><Link to="/" className="shrink-0 hover:text-[#7c2020]">Home</Link><span>/</span><Link to="/products" className="shrink-0 hover:text-[#7c2020]">Paintings</Link><span>/</span><span className="truncate text-stone-700">{product.name}</span></div>
                    <button onClick={() => navigate(-1)} className="hidden items-center gap-1.5 uppercase tracking-widest hover:text-[#7c2020] sm:flex"><ArrowLeft size={13} /> Back</button>
                </div>

                <section className="grid gap-6 sm:gap-8 lg:grid-cols-[1.06fr_0.94fr] lg:items-start lg:gap-10">
                    <div className="grid grid-cols-[42px_1fr] gap-3 sm:grid-cols-[60px_1fr] sm:gap-6">
                        <div className="flex min-w-0 flex-col items-center">
                            <div ref={thumbnailRef} className="no-scrollbar flex max-h-[360px] w-full flex-col gap-2 overflow-y-auto sm:gap-3">
                            {images.map((image, index) => <button key={`${image}-${index}`} onClick={() => setActiveImg(image)} className={`aspect-[4/5] overflow-hidden rounded border bg-[#eee9df] p-0.5 transition ${activeImg === image ? 'border-[#9c2929] ring-1 ring-[#9c2929]' : 'border-transparent opacity-75 hover:opacity-100'}`} aria-label={`View image ${index + 1}`}><img src={image} alt="" className="h-full w-full object-contain" /></button>)}
                            </div>
                            <button onClick={showNextImage} className="mt-2 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-500 shadow-sm hover:text-[#7c2020]" aria-label="Show next image"><ChevronDown size={14} /></button>
                        </div>
                        <div className="relative aspect-square overflow-hidden rounded-lg border border-[#e5dccf] bg-[#eee9df] p-1 shadow-[0_10px_30px_rgba(74,48,25,0.06)] sm:aspect-[1.08/1] sm:p-2">
                        <img src={activeImg} alt={product.name} className="h-full w-full object-contain" /><button onClick={() => setIsImageZoomed(true)} className="absolute bottom-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-stone-600 shadow sm:bottom-3 sm:right-3 sm:h-8 sm:w-8" aria-label="View larger image"><ArrowUpRight size={14} /></button></div>
                    </div>

                    <div className="rounded-lg border border-[#e7ded1] bg-[#fffdf9] p-4 shadow-[0_10px_30px_rgba(74,48,25,0.05)] sm:p-6 lg:p-7">
                        <div className="mb-3 flex items-start justify-between gap-4"><ProductBadges product={product} context={badgeContext} fallbackLabel="Original Artwork" /><div className="flex gap-2"><button onClick={handleShare} className="flex h-8 items-center gap-1.5 rounded border border-stone-200 px-2 text-[10px] font-semibold text-stone-600 hover:text-[#7c2020]" aria-label="Share product">{isShareCopied ? <Check size={14} /> : <Share2 size={14} />}<span>{isShareCopied ? 'Copied' : 'Share'}</span></button><button onClick={() => toggleWishlist(product.id)} className="flex h-8 w-8 items-center justify-center rounded border border-stone-200 text-[#7c2020]" aria-label="Add to wishlist"><Heart size={15} fill={isWishlisted ? 'currentColor' : 'none'} /></button></div></div>
                        <h1 className="max-w-xl font-playfair text-[1.4rem] leading-[1.08] text-[#20221f] sm:text-3xl lg:text-[2.35rem]">{product.name}</h1>
                        <p className="mt-1 text-[11px] text-stone-500 sm:text-xs">By <span className="font-semibold text-stone-700">{product.storeName || 'Mithila Artisan'}</span> <span className="mx-1">•</span> {product.location || 'Janakpur, Nepal'}</p>
                        <div className="mt-1 flex flex-col items-start gap-2">
                            <span className="flex items-center gap-1 text-xs text-amber-600 lg:text-sm">{product.rating != null && <><Star size={13} fill="currentColor" /> {product.rating}</>} {reviews.length} {reviews.length === 1 ? 'review' : 'reviews'}</span>
                            <div className="flex flex-col items-start gap-1">
                                <span className="font-playfair text-2xl font-bold text-[#29251f] sm:text-3xl lg:text-[2.15rem]">रु {currentPrice.toLocaleString()}</span>
                                {comparePrice > currentPrice && (
                                    <span className="text-base font-medium text-stone-400 line-through sm:text-lg">रु {comparePrice.toLocaleString()}</span>
                                )}
                            </div>
                        </div>
                        {customTags.length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-2">
                                {customTags.map((tag) => (
                                    <span key={tag} className="rounded-full border border-stone-200 bg-stone-100 px-2 py-1 text-[10px] font-medium text-stone-600 sm:text-[11px]">
                                        {tag}
                                    </span>
                                ))}
                            </div>
                        )}
                        <p className="mt-3 max-w-xl text-xs leading-5 text-stone-600 sm:mt-2 sm:leading-6 lg:text-sm lg:leading-6">{product.description}</p>
                        <div className="mt-4 grid grid-cols-3 border-y border-[#e8e1d6] py-3 text-[9px] leading-4 text-stone-600 sm:gap-4 sm:text-[11px] lg:mt-5 lg:gap-5 lg:py-4 lg:text-xs lg:leading-5"><div className="flex items-start gap-1"><BadgeCheck size={16} className="mt-0.5 shrink-0 text-[#7c2020]" /> <span>Original artwork</span></div><div className="flex items-start gap-1 border-x border-[#e8e1d6] px-2 sm:px-3"><Leaf size={16} className="mt-0.5 shrink-0 text-[#7c2020]" /> <span>Handmade &amp; eco-friendly</span></div><div className="flex items-start gap-1"><Truck size={16} className="mt-0.5 shrink-0 text-[#7c2020]" /> <span>Ships from Nepal</span></div></div>
                        <p className="mt-5 text-[10px] font-semibold text-stone-700 lg:text-xs">Quantity</p>
                        <div className="mt-2 flex gap-2 sm:gap-3"><div className="flex h-10 w-24 shrink-0 items-center justify-between rounded border border-[#e0d8cc] bg-white px-1.5 sm:w-28 sm:px-2"><button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="p-1 text-stone-500" aria-label="Decrease quantity"><Minus size={13} /></button><span className="text-xs px-3 border-x border-[#e8e1d6]">{quantity}</span><button onClick={() => setQuantity(quantity + 1)} className="p-1 text-stone-500" aria-label="Increase quantity"><Plus size={13} /></button></div><button onClick={handleAddToCart} disabled={isCartAnimating || isAdded} className={`relative flex h-10 min-w-0 flex-1 items-center justify-center gap-2 overflow-hidden rounded px-2 text-[11px] font-semibold text-white transition sm:max-w-[260px] sm:px-4 sm:text-xs ${isAdded ? 'bg-green-600' : 'bg-[#8e1717] hover:bg-[#6f1010]'}`}>{isAdded ? <Check size={16} /> : <span className={`relative inline-flex items-center ${isCartAnimating ? 'cart-icon-flight' : ''}`}>{isCartAnimating && <span className="cart-wind-lines" aria-hidden="true"><span /><span /><span /></span>}<ShoppingCart size={14} className="relative z-10" /></span>}<span className={`transition-opacity duration-150 ${isCartAnimating ? 'opacity-0' : 'opacity-100'}`}>{isAdded ? 'Added' : 'Add to cart'}</span></button></div>
                        <div className="mt-3 flex items-center gap-2 rounded border border-[#eee5d8] bg-[#f5f0e7] px-3 py-2.5 text-[10px] text-stone-600 sm:text-xs"><Truck size={14} className="shrink-0 text-[#7c2020]" /> <span>Estimated delivery: {product.delivery || 'Not specified'}</span> <ChevronRight size={13} className="ml-auto shrink-0" /></div>
                    </div>
                </section>

                {featureRows.length > 0 && (
                    <section className="mt-8 w-full rounded-lg border border-[#e3d9ca] bg-[#f1ebe1] p-3 sm:mt-10 sm:p-5">
                        <div className="mb-4 flex items-center justify-between border-b border-[#d8ccbb] pb-3">
                            <h2 className="font-playfair text-lg font-bold tracking-tight text-[#1d1b1a] sm:text-xl">Key Features</h2>
                        </div>

                        <div className="overflow-hidden rounded-[0.75rem] border border-[#d8ccbb] bg-[#fbf8f3]">
                            <div className="grid grid-cols-[1.1fr_2fr] bg-[#efe8df] text-[9px] font-bold uppercase tracking-[0.1em] text-[#4a4139] sm:text-[10px]">
                                <div className="border-r border-[#d8ccbb] px-3 py-2.5 sm:px-4">Feature</div>
                                <div className="px-3 py-2.5 sm:px-4">Details</div>
                            </div>
                            {featureRows.map((row, index) => (
                                <div key={`${row.label}-${index}`} className="grid grid-cols-[1.1fr_2fr] border-t border-[#e7e0d4] bg-[#fffdfb] text-[11px] leading-5 text-[#1f1a17] sm:text-xs sm:leading-6">
                                    <div className="border-r border-[#e7e0d4] px-3 py-2.5 font-semibold text-[#2f2a26] sm:px-4">{row.label}</div>
                                    <div className="px-3 py-2.5 text-[#1f1a17] sm:px-4">{row.value}</div>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                <section className="mt-10 border-t border-[#dfd5c8] pt-7 sm:mt-14 sm:pt-8">
                    <div className="flex gap-6 overflow-x-auto border-b border-[#dfd5c8] text-[10px] font-semibold whitespace-nowrap sm:gap-8 sm:text-xs lg:text-sm" role="tablist" aria-label="Product information">
                        {[['description', 'Description'], ['details', 'Details'], ['artist', 'Artist'], ['shipping', 'Shipping & Return']].map(([tab, label]) => <button key={tab} type="button" role="tab" aria-selected={activeTab === tab} onClick={() => setActiveTab(tab)} className={`border-b-2 pb-3 transition-colors ${activeTab === tab ? 'border-[#8e1717] text-[#8e1717]' : 'border-transparent text-stone-500 hover:text-stone-800'}`}>{label}</button>)}
                    </div>
                    <div className="grid gap-6 py-6 sm:gap-8 sm:py-8 lg:grid-cols-[1.15fr_0.92fr_0.85fr] lg:items-stretch lg:gap-7">
                        {activeTab === 'description' && <div><h2 className="font-playfair text-xl lg:text-2xl">About This Artwork</h2><p className="mt-3 max-w-lg text-xs leading-6 text-stone-600 sm:text-sm sm:leading-7">{product.description}</p><p className="mt-4 font-playfair text-sm italic text-stone-600 lg:mt-5">Art is not just what we see, but what we feel.</p></div>}
                        {activeTab === 'details' && <div><h2 className="font-playfair text-xl lg:text-2xl">Artwork Details</h2><p className="mt-3 max-w-lg text-xs leading-6 text-stone-600 sm:text-sm sm:leading-7">A closer look at the materials, sizing, care, and authenticity supplied for this piece.</p></div>}
                        {activeTab === 'artist' && <div><h2 className="font-playfair text-xl lg:text-2xl">About the Artist</h2><p className="mt-3 max-w-lg text-xs leading-6 text-stone-600 sm:text-sm sm:leading-7">This piece is offered by {product.storeName || 'a Mithila artisan'} from {product.location || 'Nepal'}.</p><p className="mt-4 text-xs leading-6 text-stone-600 sm:text-sm">Your purchase helps keep traditional Mithila craft in the hands of local makers.</p></div>}
                        {activeTab === 'shipping' && <div><h2 className="font-playfair text-xl lg:text-2xl">Shipping &amp; Return</h2><p className="mt-3 max-w-lg text-xs leading-6 text-stone-600 sm:text-sm sm:leading-7"><span className="font-semibold text-stone-800">Estimated delivery:</span> {product.delivery || 'Not specified'}.</p><p className="mt-2 max-w-lg text-xs leading-6 text-stone-600 sm:text-sm sm:leading-7">{product.instruction || 'Please handle this handmade artwork with care.'}</p></div>}
                        {(activeTab === 'details' || activeTab === 'description') && <div className="grid grid-cols-2 gap-y-4 rounded-md bg-[#f5f0e8] p-4 text-[11px] leading-5 text-stone-600 sm:p-5 sm:text-xs lg:gap-y-5">{detailRows.map(({ label, value, icon: Icon }) => <React.Fragment key={label}><div className="flex items-center gap-2"><Icon size={15} /> {label}</div><div className="text-stone-800">{value}</div></React.Fragment>)}</div>}
                        {(activeTab === 'artist' || activeTab === 'shipping') && <div className="rounded-md bg-[#f5f0e8] p-4 text-xs leading-6 text-stone-600 sm:p-5 sm:text-sm"><p className="font-semibold text-stone-800">{activeTab === 'artist' ? 'Made with cultural care' : 'A considered delivery'}</p><p className="mt-2">{activeTab === 'artist' ? 'Every purchase supports the people and practices behind Mithila art.' : 'We package each order carefully and share delivery details before dispatch.'}</p></div>}
                        <div className="flex flex-col rounded-md border border-[#d9bda7] bg-[#fffaf3] p-4 sm:p-5"><div className="mb-3 text-[#c98255]"><Leaf size={30} /></div><h3 className="font-playfair text-base lg:text-lg">Support Traditional Artists</h3><p className="mt-2 text-[11px] leading-5 text-stone-500 sm:text-xs sm:leading-6">Your purchase helps preserve Mithila art and supports local artists and their families.</p><Link to="/journal" className="mt-4 inline-flex items-center gap-1 text-[10px] font-semibold text-[#7c2020] sm:mt-auto sm:pt-5 sm:text-xs">Learn More <ArrowRight size={14} /></Link></div>
                    </div>
                </section>

                <section className="mt-4 border-t border-[#dfd5c8] pt-8 sm:mt-6 sm:pt-10"><div className="mb-4 flex items-end justify-between"><div><p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-[#8e1717] sm:text-[10px]">Curated for you</p><h2 className="mt-1 inline-flex items-center gap-1 font-playfair text-xl lg:text-2xl">You May Also Like <ArrowRight size={17} className="text-[#8e1717]" /></h2></div><div className="flex gap-2"><button onClick={() => scrollCarousel('left')} className="flex h-8 w-8 items-center justify-center rounded-full border border-stone-200 bg-white" aria-label="Previous products"><ChevronLeft size={15} /></button><button onClick={() => scrollCarousel('right')} className="flex h-8 w-8 items-center justify-center rounded-full border border-stone-200 bg-white" aria-label="Next products"><ChevronRight size={15} /></button></div></div><div ref={carouselRef} className="flex gap-3 overflow-x-auto pb-4 no-scrollbar">{relatedProducts.map((related) => <div key={related.id} className="min-w-[180px] sm:min-w-[210px]"><ProductCard product={related} addToCart={addToCart} isWishlisted={wishlist.includes(related.id)} toggleWishlist={toggleWishlist} badgeContext={badgeContext} /></div>)}</div></section>

                <section className="mt-12 border-t border-[#e7e0d4] pt-10"><div className="grid gap-10 lg:grid-cols-[0.75fr_1.25fr]"><div><h2 className="font-playfair text-2xl lg:text-3xl">Voices of the Gallery</h2>{currentUser ? <form onSubmit={handleReviewSubmit} className="mt-5 space-y-3 rounded-md bg-[#f5f0e8] p-5"><p className="text-[10px] font-semibold uppercase tracking-widest lg:text-xs">Leave a review</p><div className="flex gap-1">{[1, 2, 3, 4, 5].map((star) => <button key={star} type="button" onClick={() => setNewReview({ ...newReview, rating: star })} className={newReview.rating >= star ? 'text-amber-500' : 'text-stone-300'} aria-label={`${star} stars`}><Star size={16} fill={newReview.rating >= star ? 'currentColor' : 'none'} /></button>)}</div><textarea required value={newReview.comment} onChange={(event) => setNewReview({ ...newReview, comment: event.target.value })} className="min-h-24 w-full resize-none rounded border border-stone-200 bg-white p-3 text-xs outline-none focus:border-[#8e1717] lg:text-sm" placeholder="Share your experience..." /><button disabled={isSubmittingReview} className="flex items-center gap-2 rounded bg-[#29251f] px-4 py-2 text-[10px] font-semibold text-white lg:text-xs">{isSubmittingReview ? 'Submitting...' : 'Submit review'} <Send size={12} /></button></form> : <div className="mt-5 rounded-md bg-[#f5f0e8] p-5"><p className="text-xs leading-5 text-stone-600 lg:text-sm">Sign in to share your appreciation for this artwork.</p><Link to="/login" className="mt-3 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-widest text-[#8e1717] lg:text-xs">Sign in to review <ArrowRight size={12} /></Link></div>}</div><div className="space-y-4">{reviews.length === 0 ? <p className="rounded-md bg-[#f5f0e8] p-6 text-xs italic text-stone-500 lg:text-sm">This piece awaits its first collector&apos;s voice.</p> : reviews.map((review) => <article key={review.id} className="border-b border-[#e7e0d4] pb-4"><div className="flex items-center justify-between"><div><p className="text-xs font-semibold lg:text-sm">{review.userName}</p><p className="text-[10px] text-stone-400 lg:text-xs">{new Date(review.date).toLocaleDateString()}</p></div><div className="flex text-amber-500">{[1, 2, 3, 4, 5].map((star) => <Star key={star} size={12} fill={star <= review.rating ? 'currentColor' : 'none'} />)}</div></div><p className="mt-2 text-sm italic text-stone-600 lg:text-base">&quot;{review.comment}&quot;</p>{isModerator && <button onClick={() => { dbService.toggleReviewPinned(review.id, !review.pinned).then(loadReviews); }} className="mt-2 flex items-center gap-1 text-[9px] uppercase tracking-widest text-[#8e1717] lg:text-[10px]"><Pin size={11} /> {review.pinned ? 'Unpin' : 'Pin'}</button>}</article>)}</div></div></section>
            </div>
            {isImageZoomed && <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 p-4" role="dialog" aria-modal="true" aria-label={`Enlarged image of ${product.name}`} onClick={() => setIsImageZoomed(false)}><button onClick={() => setIsImageZoomed(false)} className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white text-stone-800" aria-label="Close enlarged image"><X size={20} /></button><img src={activeImg} alt={product.name} className="max-h-[90vh] max-w-full object-contain" onClick={(event) => event.stopPropagation()} /></div>}
        </main>
    );
};
