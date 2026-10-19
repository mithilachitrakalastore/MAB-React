import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Send, MapPin, Mail, Camera, Music2 } from 'lucide-react';
import { dbService } from '../services/dbservices';

export const Footer = () => {
    const [email, setEmail] = useState('');
    const [status, setStatus] = useState({ type: '', message: '' });
    const [loading, setLoading] = useState(false);

    const handleJournalSubscribe = async (event) => {
        event.preventDefault();

        const trimmedEmail = email.trim().toLowerCase();
        if (!trimmedEmail || !trimmedEmail.includes('@') || !trimmedEmail.includes('.')) {
            setStatus({ type: 'error', message: 'Enter a valid email address.' });
            return;
        }

        setLoading(true);
        setStatus({ type: '', message: '' });

        try {
            await dbService.subscribeJournalEmail(trimmedEmail);
            setStatus({ type: 'success', message: 'You are on the journal list.' });
            setEmail('');
        } catch (error) {
            setStatus({ type: 'error', message: error.message || 'Unable to join the journal list.' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <footer id="contact" className="scroll-mt-28 bg-stone-950 text-white print:hidden">
            <div className="mithila-divider"></div>
            <div className="relative overflow-hidden px-4 pb-20 pt-7 paper-texture sm:px-6 sm:pb-20 sm:pt-10 md:px-6 md:pb-12 md:pt-14">
                <div className="absolute -top-32 -right-32 w-96 h-96 bg-[#5c1111]/10 rounded-full blur-[120px] pointer-events-none"></div>
                <div className="absolute -bottom-32 -left-32 w-96 h-96 bg-amber-600/5 rounded-full blur-[120px] pointer-events-none"></div>

                <div className="max-w-7xl mx-auto relative z-10">
                    <div className="md:hidden">
                        <div className="flex items-center gap-3">
                            <img
                                className="h-9 w-9 rounded-[0.5rem] shadow-lg"
                                src="https://res.cloudinary.com/djmbuuz28/image/upload/v1761108817/logo.png"
                                alt="Logo"
                            />
                            <div>
                                <h3 className="font-playfair text-lg font-bold leading-none text-stone-100">Mithila Chitrakala Store</h3>
                                <span className="mt-1 block text-[8px] font-black uppercase tracking-[0.3em] text-stone-500">Est. Heritage &bull; Janakpur</span>
                            </div>
                        </div>
                        <p className="mt-3 max-w-md text-xs font-light leading-relaxed text-stone-300">
                            Traditional Mithila art, handcrafted textiles, and custom designs made with our artisans.
                        </p>
                        <div className="mt-3 flex items-center gap-2 text-[10px] leading-relaxed text-stone-300">
                            <MapPin size={15} className="shrink-0 text-[#d58e6d]" />
                            <span>Kabadhall, Pidari, Janakpur Dham - 13, Nepal</span>
                        </div>
                        <div className="mt-3 flex items-center justify-between gap-3">
                            <a href="mailto:hello@mithilachitrakalastore.com.np" className="min-w-0 truncate text-[10px] text-stone-300 transition-colors hover:text-stone-100">hello@mithilachitrakalastore.com.np</a>
                            <div className="flex shrink-0 gap-2">
                                <a href="https://www.instagram.com/mithilachitrakalastore" className="flex h-8 w-8 items-center justify-center rounded-full border border-white/5 bg-white/5" target="_blank" rel="noreferrer" title="Instagram"><Camera size={15} /></a>
                                <a href="https://www.facebook.com/profile.php?id=61578104247563" className="flex h-8 w-8 items-center justify-center rounded-full border border-white/5 bg-white/5" target="_blank" rel="noreferrer" title="Facebook"><span className="font-sans text-sm font-bold">f</span></a>
                                <a href="https://www.tiktok.com/@mithilachitrakalastore" className="flex h-8 w-8 items-center justify-center rounded-full border border-white/5 bg-white/5" target="_blank" rel="noreferrer" title="TikTok"><Music2 size={15} /></a>
                            </div>
                        </div>

                        <div className="mt-5 grid grid-cols-2 gap-5 border-y border-white/10 py-4">
                            <div>
                                <h4 className="mb-2 font-playfair text-sm font-black text-stone-100">Explore</h4>
                                <ul className="space-y-1.5 text-[10px] font-semibold text-stone-300">
                                    <li><Link to="/products?cat=paintings" className="hover:text-white">Paintings</Link></li>
                                    <li><Link to="/products?cat=home-decor" className="hover:text-white">Home Decor</Link></li>
                                    <li><Link to="/products" className="hover:text-white">Our Collection</Link></li>
                                    <li><Link to="/advice" className="hover:text-white">AI Art Consultant</Link></li>
                                    <li><Link to="/wishlist" className="hover:text-white">Wishlist</Link></li>
                                </ul>
                            </div>
                            <div>
                                <h4 className="mb-2 font-playfair text-sm font-black text-stone-100">Customer Care</h4>
                                <ul className="space-y-1.5 text-[10px] font-semibold text-stone-300">
                                    <li><Link to="/profile" className="hover:text-white">Track Collection</Link></li>
                                    <li><Link to="/privacy" className="hover:text-white">Privacy Policy</Link></li>
                                    <li><Link to="/terms-of-service" className="hover:text-white">Terms of Service</Link></li>
                                </ul>
                            </div>
                        </div>

                        <div className="py-4">
                            <h4 className="mb-1 font-playfair text-sm font-black text-stone-100">Join Our Newsletter</h4>
                            <p className="mb-2 text-[10px] text-stone-300">Heritage drops &amp; artisan stories, straight to your inbox.</p>
                            <form onSubmit={handleJournalSubscribe} className="flex gap-2">
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(event) => setEmail(event.target.value)}
                                    placeholder="Your email..."
                                    className="min-w-0 flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs placeholder:text-stone-600 focus:border-[#5c1111] focus:outline-none"
                                />
                                <button disabled={loading} type="submit" className="shrink-0 rounded-lg bg-[#5c1111] px-3 py-2 disabled:opacity-70" title="Subscribe">
                                    <Send size={14} />
                                </button>
                            </form>
                            {status.message && (
                                <p className={`mt-2 text-[9px] font-black uppercase tracking-[0.14em] ${status.type === 'success' ? 'text-green-300' : 'text-red-300'}`}>{status.message}</p>
                            )}
                        </div>

                        <div className="border-t border-white/10 py-3">
                            <h4 className="mb-2 font-playfair text-sm font-black text-stone-100">Business &amp; Contact Details</h4>
                            <div className="mt-3 grid grid-cols-2 gap-4 text-[10px] leading-relaxed text-stone-300">
                                <div className="space-y-2">
                                    <div><p className="font-semibold uppercase tracking-wider text-stone-200">Business name</p><p>Mithila Chitrakala Store</p></div>
                                    <div><p className="font-semibold uppercase tracking-wider text-stone-200">Business type</p><p>Mithila paintings, hand-painted clothing and accessories, handcrafted textile products, decor, and custom-made designs</p></div>
                                    <div><p className="font-semibold uppercase tracking-wider text-stone-200">Registration No.</p><p>24734/436/2083/084</p></div>
                                    <div><p className="font-semibold uppercase tracking-wider text-stone-200">Registration Authority</p><p>Department of Cottage and Small Industries - DCSI, Nepal</p></div>
                                    <div><p className="font-semibold uppercase tracking-wider text-stone-200">PAN No.</p><p>14450215</p></div>
                                </div>
                                <div className="space-y-2">
                                    <div><p className="font-semibold uppercase tracking-wider text-stone-200">Business address</p><p>Kabadhall, Pidari, Janakpur Dham - 13, Madhesh Province, Nepal</p></div>
                                    <div><p className="font-semibold uppercase tracking-wider text-stone-200">Email</p><a href="mailto:hello@mithilachitrakalastore.com.np" className="break-all hover:text-white">hello@mithilachitrakalastore.com.np</a></div>
                                    <div><p className="font-semibold uppercase tracking-wider text-stone-200">Grievance contact</p><p className="break-all">contact@mithilachitrakalastore.com.np,<br />+977 981-8270104</p></div>
                                    <div><p className="font-semibold uppercase tracking-wider text-stone-200">Management</p><p>Grievance Management Team</p></div>
                                </div>
                            </div>
                        </div>

                        <div className="mt-2 flex flex-col items-center gap-3 border-t border-white/10 pt-4">
                            <div className="flex gap-4 grayscale opacity-70">
                                <img src="https://upload.wikimedia.org/wikipedia/commons/b/b5/PayPal.svg" className="h-3" alt="PayPal" />
                                <img src="https://upload.wikimedia.org/wikipedia/commons/9/98/Visa_Inc._logo_%282005%E2%80%932014%29.svg" className="h-3" alt="Visa" />
                                <img src="https://upload.wikimedia.org/wikipedia/commons/2/2a/Mastercard-logo.svg" className="h-3" alt="Mastercard" />
                                <img src="https://cdn.brandfetch.io/idDVuHZ3OK/w/124/h/33/theme/dark/logo.png?c=1bxid64Mup7aczewSAYMX&t=1751351341090" className="h-4" alt="E-Sewa" />
                                <img src="https://cdn.brandfetch.io/idGPw_2fQs/w/1513/h/575/theme/dark/logo.png?c=1dxbfHSJFAPEGdCLU4o5B" className="h-5" alt="Khalti" />
                            </div>
                            <div className="text-center text-[8px] font-bold uppercase tracking-[0.12em] text-stone-400">
                                <p>&copy; 2025 Mithila Chitrakala Store &bull; Heritage Reserved</p>
                                <a href="https://taigranexuslab.onrender.com/" target="_blank" rel="noreferrer" className="mt-1 inline-block hover:text-[#f2c38b]">Designed &amp; Developed by Taigra Nexus Labs</a>
                            </div>
                        </div>
                    </div>

                    <div className="hidden gap-8 md:grid md:grid-cols-2 xl:grid-cols-[1.3fr_1.1fr_1fr_1.1fr] xl:gap-10">
                        {/* Brand / intro */}
                        <div className="space-y-5 xl:pr-6">
                            <div className="flex items-center gap-3">
                                <img
                                  className="h-9 w-9 rounded-[0.5rem] shadow-lg sm:h-10 sm:w-10"
                                  src="https://res.cloudinary.com/djmbuuz28/image/upload/v1761108817/logo.png"
                                  alt="Logo"
                                />
                                <div className="flex flex-col">
                                    <h3 className="font-playfair text-xl font-bold leading-none text-stone-100 sm:text-2xl">Mithila Chitrakala Store</h3>
                                    <span className="mt-1 text-[8px] font-black uppercase tracking-[0.3em] text-stone-500">Est. Heritage &bull; Janakpur</span>
                                </div>
                            </div>
                            <p className="max-w-md text-sm font-light leading-relaxed text-stone-300">
                                We bring Mithila art into everyday life through traditional paintings, hand-painted clothing and accessories, and handcrafted textile products. We also accept custom orders and designs—share your idea, and we’ll work with you to create a piece made just for you.
                            </p>

                            <div className="space-y-2.5 text-[11px] text-stone-300 sm:text-xs">
                                <p className="flex items-center gap-3"><MapPin size={18} className="text-[#d58e6d]" />Kabadhall, Pidari, Janakpur Dham - 13, Madhesh Province, Nepal</p>
                                <p className="flex items-center gap-3"><Mail size={14} className="text-[#d58e6d]" /> <a href="mailto:hello@mithilachitrakalastore.com.np" className="text-stone-300 transition-colors hover:text-stone-100">hello@mithilachitrakalastore.com.np</a></p>
                            </div>

                            <div className="flex gap-3">
                                <a href="https://www.instagram.com/mithilachitrakalastore" className="flex h-9 w-9 items-center justify-center rounded-full border border-white/5 bg-white/5 transition-all hover:-translate-y-1 hover:border-[#5c1111] hover:bg-[#5c1111] sm:h-10 sm:w-10" target='_blank' rel="noreferrer" title="Instagram"><Camera size={16} /></a>
                                <a href="https://www.facebook.com/profile.php?id=61578104247563" className="flex h-9 w-9 items-center justify-center rounded-full border border-white/5 bg-white/5 transition-all hover:-translate-y-1 hover:border-[#5c1111] hover:bg-[#5c1111] sm:h-10 sm:w-10" target='_blank' rel="noreferrer" title="Facebook"><span className="font-sans text-base font-bold">f</span></a>
                                <a href="https://www.tiktok.com/@mithilachitrakalastore" className="flex h-9 w-9 items-center justify-center rounded-full border border-white/5 bg-white/5 transition-all hover:-translate-y-1 hover:border-[#5c1111] hover:bg-[#5c1111] sm:h-10 sm:w-10" target='_blank' rel="noreferrer" title="TikTok"><Music2 size={16} /></a>
                            </div>
                        </div>

                        {/* General information */}
                        <div>
                            <h4 className="mb-4 font-playfair text-base font-black text-stone-100 sm:text-lg">General Information</h4>
                            <div className="space-y-4 text-[11px] leading-relaxed text-stone-300 sm:text-xs">
                                <div>
                                    <p className="font-semibold uppercase tracking-[0.14em] text-stone-200">Business Name</p>
                                    <p>Mithila Chitrakala Store</p>
                                </div>
                                <div>
                                    <p className="font-semibold uppercase tracking-[0.14em] text-stone-200">Business Type</p>
                                    <p>Mithila paintings, hand-painted clothing and accessories, handcrafted textile products, decor, and custom-made designs</p>
                                </div>
                                <div>
                                    <p className="font-semibold uppercase tracking-[0.14em] text-stone-200">Registration No.</p>
                                    <p>24734/436/2083/084</p>
                                </div>
                                <div>
                                    <p className="font-semibold uppercase tracking-[0.14em] text-stone-200">Registration Authority</p>
                                    <p>Department of Cottage and Small Industries - DCSI, Nepal</p>
                                </div>
                                <div>
                                    <p className="font-semibold uppercase tracking-[0.14em] text-stone-200">PAN No.</p>
                                    <p>14450215</p>
                                </div>
                            </div>
                        </div>

                        {/* Categories */}
                        <div>
                            <h4 className="mb-4 font-playfair text-base font-black text-stone-100 sm:text-lg">Explore</h4>
                            <ul className="space-y-2.5 text-[10px] font-black uppercase tracking-[0.14em] text-stone-300 sm:space-y-3 sm:text-[11px]">
                                <li><Link to="/products?cat=paintings" className="transition-colors hover:text-white">Paintings</Link></li>
                                <li><Link to="/products?cat=home-decor" className="transition-colors hover:text-white">Home Decor</Link></li>
                                <li><Link to="/products" className="transition-colors hover:text-white">Our Collection</Link></li>
                                <li><Link to="/advice" className="transition-colors hover:text-white">AI Art Consultant</Link></li>
                                <li><Link to="/wishlist" className="transition-colors hover:text-white">Wishlist</Link></li>
                            </ul>

                            <div className="mt-7">
                                <h4 className="mb-3 font-playfair text-base font-black text-stone-100 sm:text-lg">Customer Care</h4>
                                <ul className="space-y-2.5 text-[10px] font-black uppercase tracking-[0.14em] text-stone-300 sm:space-y-3 sm:text-[11px]">
                                    <li><Link to="/profile" className="transition-colors hover:text-white">Track Collection</Link></li>
                                    <li><Link to="/privacy" className="transition-colors hover:text-white">Privacy Policy</Link></li>
                                    <li><Link to="/terms-of-service" className="transition-colors hover:text-white">Terms of Service</Link></li>
                                </ul>
                            </div>
                        </div>

                        {/* Contact & newsletter */}
                        <div>
                            <h4 className="mb-4 font-playfair text-base font-black text-stone-100 sm:text-lg">Contact &amp; Grievance</h4>
                            <div className="space-y-4 text-[11px] leading-relaxed text-stone-300 sm:text-xs">
                                <div>
                                    <p className="font-semibold uppercase tracking-[0.14em] text-stone-200">Business Address</p>
                                    <p>kabadhall, Pidari, Janakpur Dham - 13, Madhesh Province, Nepal</p>
                                </div>
                                <div>
                                    <p className="font-semibold uppercase tracking-[0.14em] text-stone-200">Email</p>
                                    <a href="mailto:hello@mithilachitrakalastore.com.np" className="text-stone-300 transition-colors hover:text-white">hello@mithilachitrakalastore.com.np</a>
                                </div>
                                <div>
                                    <p className="font-semibold uppercase tracking-[0.14em] text-stone-200">Grievance Contact</p>
                                    <p>contact@mithilachitrakalastore.com.np,<br /> +977 981-8270104</p>
                                </div>
                                <div>
                                    <p className="font-semibold uppercase tracking-[0.14em] text-stone-200">Management</p>
                                    <p>Grievance Management Team</p>
                                </div>
                            </div>

                            <div className="mt-7">
                                <h4 className="mb-3 font-playfair text-base font-black text-stone-100 sm:text-lg">Join Our Newsletter</h4>
                                <p className="mb-3 text-[10px] font-black uppercase leading-relaxed tracking-[0.14em] text-stone-300 sm:text-[11px]">Join our circle for heritage drops &amp; artisan stories.</p>
                                <form onSubmit={handleJournalSubscribe} className="flex gap-2">
                                    <input
                                        type="email"
                                        required
                                        value={email}
                                        onChange={(event) => setEmail(event.target.value)}
                                        placeholder="Your email..."
                                        className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-xs transition-all placeholder:text-stone-600 focus:border-[#5c1111] focus:bg-white/10 focus:outline-none sm:px-4 sm:py-3 sm:text-sm"
                                    />
                                    <button disabled={loading} type="submit" className="shrink-0 rounded-xl bg-[#5c1111] px-3 py-2.5 shadow-lg transition-all hover:-translate-y-0.5 hover:bg-red-700 disabled:opacity-70 sm:px-4 sm:py-3" title="Subscribe">
                                        <Send size={14} className="sm:h-4 sm:w-4" />
                                    </button>
                                </form>
                                {status.message && (
                                    <p className={`mt-4 text-[9px] font-black uppercase tracking-[0.14em] ${status.type === 'success' ? 'text-green-300' : 'text-red-300'}`}>{status.message}</p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Bottom bar */}
                    <div className="mt-10 hidden flex-col items-center justify-between gap-4 border-t border-white/5 pt-6 sm:mt-20 sm:gap-6 sm:pt-10 md:flex md:flex-row">
                        <div className="flex flex-col items-center gap-2 text-center sm:items-start sm:text-left">
                            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-stone-400 sm:text-[10px] sm:tracking-[0.3em]">
                                &copy; 2025 Mithila Chitrakala Store &bull; Heritage Reserved
                            </p>
                            <a
                                href="https://taigranexuslab.onrender.com/"
                                target="_blank"
                                rel="noreferrer"
                                className="text-[9px] font-bold uppercase tracking-[0.2em] text-stone-400 transition-colors hover:text-[#f2c38b] sm:text-[10px]"
                            >
                                Designed &amp; Developed by Taigra Nexus Labs
                            </a>
                        </div>
                        <div className="flex gap-5 md:gap-6 grayscale opacity-70 hover:opacity-100 hover:grayscale-0 transition-all duration-500">
                            <img src="https://upload.wikimedia.org/wikipedia/commons/b/b5/PayPal.svg" className="h-3 md:h-4" alt="PayPal" />
                            <img src="https://upload.wikimedia.org/wikipedia/commons/9/98/Visa_Inc._logo_%282005%E2%80%932014%29.svg" className="h-3 md:h-4" alt="Visa" />
                            <img src="https://upload.wikimedia.org/wikipedia/commons/2/2a/Mastercard-logo.svg" className="h-3 md:h-4" alt="Mastercard" />
                            <img src="https://cdn.brandfetch.io/idDVuHZ3OK/w/124/h/33/theme/dark/logo.png?c=1bxid64Mup7aczewSAYMX&t=1751351341090" className='h-4 md:h-5' alt="E-Sewa" />
                            <img src="https://cdn.brandfetch.io/idGPw_2fQs/w/1513/h/575/theme/dark/logo.png?c=1dxbfHSJFAPEGdCLU4o5B" className="h-5 md:h-6" alt="Khalti" />
                        </div>
                    </div>
                </div>
            </div>
        </footer>
    );
};
