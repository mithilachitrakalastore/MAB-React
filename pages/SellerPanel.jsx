import React, { useState, useEffect, useRef } from 'react';
import { 
    Package, Plus, Trash2, Box, TrendingUp, ShoppingBag, 
    Printer, Eye, X, Wallet, Shield, Users, AlertCircle,
    LayoutDashboard, MapPin, Search, ChevronRight, Settings, Info, Download,
    Check, UserX, ShieldCheck, Heart, RotateCcw, Filter, Pencil, ChevronDown, Mail
} from 'lucide-react';
import { dbService } from '../services/dbservices';
import { SectionHeading } from '../components/SectionHeading';
import { Badge } from '../components/Badge';
import { InvoiceView } from '../components/InvoiceView';

const splitProductCategories = (value) => String(value || '')
    .split(',')
    .map((category) => category.trim())
    .filter(Boolean);
const AUTO_EMAIL_TEMPLATE_VARIABLES = new Set(['USER_NAME', 'USER_EMAIL', 'APP_NAME', 'CREATED_DATE', 'YEAR']);

let chartLibraryPromise;

const loadChartLibrary = () => {
    if (window.Chart) return Promise.resolve();
    if (!chartLibraryPromise) {
        chartLibraryPromise = new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/chart.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }
    return chartLibraryPromise;
};

// Helper Component for Sidebar Tabs
const TabBtn = ({ children, active, onClick, icon }) => (
    <button 
        onClick={onClick}
        className={`px-6 py-3 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all ${
            active 
            ? 'bg-[#5c1111] text-white shadow-lg' 
            : 'text-stone-500 hover:text-stone-900 hover:bg-white/50'
        }`}
    >
        {icon} {children}
    </button>
);

const EmailSenderFields = ({ manualEmail, setManualEmail }) => (
    <>
        <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-stone-500 mb-2">From</label>
            <select
                value={manualEmail.sender}
                onChange={(e) => setManualEmail((prev) => ({ ...prev, sender: e.target.value }))}
                className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl outline-none focus:ring-2 focus:ring-[#5c1111]/20"
            >
                <option value="hello">hello@mithilachitrakalastore.com.np</option>
                <option value="orders">orders@mithilachitrakalastore.com.np</option>
                <option value="support">support@mithilachitrakalastore.com.np</option>
                <option value="security">security@mithilachitrakalastore.com.np</option>
            </select>
        </div>
        <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-stone-500 mb-2">Reply-to</label>
            <select
                value={manualEmail.replyTo}
                onChange={(e) => setManualEmail((prev) => ({ ...prev, replyTo: e.target.value }))}
                className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl outline-none focus:ring-2 focus:ring-[#5c1111]/20"
            >
                <option value="hello">hello@mithilachitrakalastore.com.np</option>
                <option value="orders">orders@mithilachitrakalastore.com.np</option>
                <option value="support">support@mithilachitrakalastore.com.np</option>
                <option value="security">security@mithilachitrakalastore.com.np</option>
            </select>
        </div>
    </>
);

// Helper Component for Metric Cards
const StatCard = ({ label, value, sub, color = "text-stone-900" }) => (
    <div className="bg-white p-5 sm:p-8 rounded-[1rem] sm:rounded-[2.5rem] border border-stone-100 shadow-sm space-y-2 relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-10 h-10 sm:w-16 sm:h-16 bg-stone-50 rounded-bl-[2rem] group-hover:bg-[#5c1111]/5 transition-colors"></div>
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-600">{label}</p>
        <h3 className={`font-playfair text-lg sm:text-3xl font-black ${color}`}>{value}</h3>
        <p className="text-[8px] font-bold text-stone-500 uppercase tracking-widest">{sub}</p>
    </div>
);

export const SellerPanel = ({ currentUser }) => {
    const isAdmin = currentUser?.role === 'admin';
    const adminTabs = new Set(['admin_users', 'admin_hero', 'admin_blog', 'admin_email', 'admin_config', 'admin_logs']);
    const [products, setProducts] = useState([]);
    const [orders, setOrders] = useState([]);
    const [allUsers, setAllUsers] = useState([]);
    const [logs, setLogs] = useState([]);
    const [wishlists, setWishlists] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('dashboard');
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [invoiceOrder, setInvoiceOrder] = useState(null);
    const [globalCommission, setGlobalCommission] = useState(12);
    const [lowStockThreshold, setLowStockThreshold] = useState(5);
    const [showAddProductModal, setShowAddProductModal] = useState(false);
    const [editingProductId, setEditingProductId] = useState(null);
    const [uploadingImage, setUploadingImage] = useState(false);
    const [showNewCategory, setShowNewCategory] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState('');
    const [savedCategories, setSavedCategories] = useState([]);
    const [categoryMenuOpen, setCategoryMenuOpen] = useState(false);
    const [newProduct, setNewProduct] = useState({
        id: null,
        seller_id: null,
        storeName: currentUser?.storeName || '',
        name: '',
        description: '',
        product_code: '',
        key_features: '',
        price: 0,
        advance_percentage: 0,
        compare_price: 0,
        image: '',
        images: [],
        category: '',
        style: '',
        theme: '',
        tags: '',
        custom_tags: '',
        stock: 0,
        location: '',
        material: '',
        length: '',
        delivery: '',
        instruction: '',
        authenticity: '',
        visible_to_users: false
    });

    const [manualEmail, setManualEmail] = useState({
        mode: 'custom',
        sender: 'hello',
        replyTo: 'support',
        category: 'security',
        to: '',
        subject: '',
        template: '',
        templateVariables: {},
        contentType: 'text',
        message: '',
        sending: false,
    });
    const [resendTemplates, setResendTemplates] = useState([]);
    const [selectedResendTemplate, setSelectedResendTemplate] = useState(null);
    const [templatesLoading, setTemplatesLoading] = useState(false);
    const [templatesError, setTemplatesError] = useState('');
    const [templateDetailsLoading, setTemplateDetailsLoading] = useState(false);
    const [templateDetailsError, setTemplateDetailsError] = useState('');
    const [heroSlides, setHeroSlides] = useState([]);
    const [heroDraft, setHeroDraft] = useState({
        id: null,
        cta: '',
        link: '',
        image: '',
        sort_order: 0,
        active: true
    });
    const [editingHeroId, setEditingHeroId] = useState(null);
    const [journalPosts, setJournalPosts] = useState([]);
    const [editingJournalId, setEditingJournalId] = useState(null);
    const [journalDraft, setJournalDraft] = useState({
        id: null,
        slug: '',
        title: '',
        excerpt: '',
        body: '',
        image: '',
        published: true,
    });

    const normalizeHeroSlide = (slide) => {
        return {
            id: slide.id,
            cta: slide.cta ?? slide.cta_label ?? 'Explore Collection',
            link: slide.link ?? slide.cta_link ?? '/products',
            image: slide.image ?? '',
            sort_order: slide.sort_order ?? 0,
            active: slide.active ?? true
        };
    };

    const [stats, setStats] = useState({ revenue: 0, payable: 0, paid: 0, pendingPayout: 0, orderCount: 0 });

    // Search and filter states
    const [searchQuery, setSearchQuery] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [filterCategory, setFilterCategory] = useState('all');
    const [refreshing, setRefreshing] = useState(false);
    const [groupByCustomer, setGroupByCustomer] = useState(false);
    const [expandedCustomers, setExpandedCustomers] = useState({});
    const [combinedOrders, setCombinedOrders] = useState([]);

    const salesChartRef = useRef(null);
    const chartInstance = useRef(null);

    useEffect(() => {
        if (!isAdmin && adminTabs.has(activeTab)) {
            setActiveTab('dashboard');
        }
    }, [isAdmin, activeTab]);

    useEffect(() => { loadData(); }, [activeTab, currentUser]);
    useEffect(() => { if (activeTab === 'dashboard' && !loading) renderCharts(); }, [activeTab, orders, loading]);
    useEffect(() => {
        if (activeTab !== 'admin_email' || !isAdmin) return;

        let isCurrent = true;
        setTemplatesLoading(true);
        setTemplatesError('');
        dbService.getResendTemplates(currentUser.emailAdminToken)
            .then((templates) => {
                if (isCurrent) setResendTemplates(templates);
            })
            .catch((error) => {
                if (isCurrent) setTemplatesError(error.message || 'Unable to load Resend templates.');
            })
            .finally(() => {
                if (isCurrent) setTemplatesLoading(false);
            });

        return () => { isCurrent = false; };
    }, [activeTab, currentUser, isAdmin]);
    useEffect(() => {
        if (manualEmail.mode !== 'template' || !manualEmail.template) {
            setSelectedResendTemplate(null);
            setTemplateDetailsError('');
            return;
        }

        let isCurrent = true;
        setTemplateDetailsLoading(true);
        setTemplateDetailsError('');
        dbService.getResendTemplate(manualEmail.template, currentUser.emailAdminToken)
            .then((template) => {
                if (isCurrent) setSelectedResendTemplate(template);
            })
            .catch((error) => {
                if (isCurrent) {
                    setSelectedResendTemplate(null);
                    setTemplateDetailsError(error.message || 'Unable to load template details.');
                }
            })
            .finally(() => {
                if (isCurrent) setTemplateDetailsLoading(false);
            });

        return () => { isCurrent = false; };
    }, [manualEmail.mode, manualEmail.template, currentUser.emailAdminToken]);

    const loadData = async () => {
        if (!refreshing) setLoading(true);
        try {
            if (currentUser.role === 'admin') {
                const [p, o, u, l, w, h, j, c] = await Promise.all([
                    dbService.getProducts(),
                    dbService.getOrders(),
                    dbService.getUsers(),
                    dbService.getLogs(),
                    dbService.getWishlists(),
                    dbService.getHeroSlides(),
                    dbService.getJournalPosts(),
                    dbService.getProductCategories()
                ]);
                setProducts(p);
                setOrders(o);
                setAllUsers(u);
                setLogs(l);
                setWishlists(w);
                setHeroSlides((h || []).map(normalizeHeroSlide));
                setJournalPosts(j || []);
                setSavedCategories((c || []).flatMap((category) => splitProductCategories(category.name)));
                const commissionData = await dbService.getGlobalCommission();
                setGlobalCommission(commissionData?.globalCommission ?? 12);
            } else {
                const [p, o, w, c] = await Promise.all([
                    dbService.getProducts(currentUser.id),
                    dbService.getOrders(currentUser.id),
                    dbService.getWishlists(currentUser.id),
                    dbService.getProductCategories()
                ]);
                setProducts(p);
                setOrders(o);
                setWishlists(w);
                setSavedCategories((c || []).flatMap((category) => splitProductCategories(category.name)));
            }
            calculateSellerStats();
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleRefresh = async () => {
        setRefreshing(true);
        await loadData();
    };

    const calculateSellerStats = () => {
        const s = { revenue: 0, payable: 0, paid: 0, pendingPayout: 0, orderCount: orders.length };
        orders.forEach(o => {
            if (o.status !== 'cancelled') {
                s.revenue += o.total;
                if (['packing', 'billing', 'arrived', 'delivered'].includes(o.status)) {
                    s.payable += o.seller_payable_amount;
                    if (o.mcs_payment_status === 'done') s.paid += o.seller_payable_amount;
                    else s.pendingPayout += o.seller_payable_amount;
                }
            }
        });
        setStats(s);
    };

    const renderCharts = async () => {
        if (!salesChartRef.current) return;
        try {
            await loadChartLibrary();
        } catch (error) {
            console.error('Failed to load seller dashboard charts:', error);
            return;
        }
        if (!salesChartRef.current) return;
        if (chartInstance.current) chartInstance.current.destroy();
        const ctx = salesChartRef.current.getContext('2d');
        chartInstance.current = new window.Chart(ctx, {
            type: 'line',
            data: {
                labels: orders.slice(-7).map(o => new Date(o.date).toLocaleDateString()),
                datasets: [{ 
                    label: 'Market Performance', 
                    data: orders.slice(-7).map(o => o.total), 
                    borderColor: '#5c1111', 
                    backgroundColor: 'rgba(92, 17, 17, 0.05)', 
                    fill: true, 
                    tension: 0.4 
                }]
            },
            options: { 
                responsive: true, 
                maintainAspectRatio: false, 
                plugins: { legend: { display: false } },
                scales: { y: { beginAtZero: true, grid: { display: false } }, x: { grid: { display: false } } }
            }
        });
    };

    const handleUpdateStatus = async (orderId, status) => {
        await dbService.updateOrderStatus(orderId, status, currentUser.role, currentUser.id);
        loadData();
    };

    const handleConfirmPayout = async (orderId) => {
        if (currentUser.role !== 'admin') return;
        await dbService.confirmPayout(orderId, currentUser.id);
        loadData();
    };

    const handleTogglePaymentVerification = async (orderId, verified) => {
        if (currentUser.role !== 'admin') return;
        await dbService.updateCustomerPaymentVerified(orderId, verified, currentUser.id);
        loadData();
    };

    const resetProductForm = () => {
        setEditingProductId(null);
        setShowNewCategory(false);
        setNewCategoryName('');
        setCategoryMenuOpen(false);
        setNewProduct({
            id: null,
            seller_id: null,
            storeName: currentUser?.storeName || '',
            name: '',
            description: '',
            product_code: '',
            key_features: '',
            price: 0,
            advance_percentage: 0,
            compare_price: 0,
            image: '',
            images: [],
            category: '',
            style: '',
            theme: '',
            tags: '',
            custom_tags: '',
            stock: 0,
            location: '',
            material: '',
            length: '',
            delivery: '',
            instruction: '',
            authenticity: '',
            visible_to_users: false
        });
    };

    const handleEditProduct = (product) => {
        setEditingProductId(product.id);
        setShowNewCategory(false);
        setNewCategoryName('');
        setCategoryMenuOpen(false);
        setNewProduct({
            id: product.id,
            seller_id: product.seller_id,
            storeName: product.storeName || currentUser?.storeName || '',
            name: product.name || '',
            description: product.description || '',
            product_code: product.product_code || '',
            key_features: product.key_features || '',
            price: product.price || 0,
            advance_percentage: product.advance_percentage || 0,
            compare_price: product.compare_price || 0,
            image: product.image || '',
            images: Array.isArray(product.images) ? product.images : [],
            category: product.category || '',
            style: product.style || '',
            theme: product.theme || '',
            tags: Array.isArray(product.tags) ? product.tags.join(', ') : (product.tags || ''),
            custom_tags: product.custom_tags || '',
            stock: product.stock || 0,
            location: product.location || '',
            material: product.material || '',
            length: product.length || '',
            delivery: product.delivery || '',
            instruction: product.instruction || '',
            authenticity: product.authenticity || '',
            visible_to_users: Boolean(product.visible_to_users)
        });
        setShowAddProductModal(true);
    };

    const buildFeatureRows = (value = '') => {
        const rows = String(value || '')
            .split(/\r?\n/)
            .map((row) => {
                const [feature = '', ...rest] = row.split('|');
                return {
                    feature,
                    detail: rest.join('|'),
                };
            });

        return rows.length > 0 ? rows : [{ feature: '', detail: '' }];
    };

    const serializeFeatureRows = (rows = []) => rows
        .map((row) => `${row.feature || ''}|${row.detail || ''}`)
        .join('\n');

    const cleanKeyFeaturesForStorage = (value = '') => String(value || '')
        .split(/\r?\n/)
        .map((row) => {
            const [feature = '', ...rest] = row.split('|');
            const detail = rest.join('|').trim();
            return {
                feature: feature.trim(),
                detail: detail.trim(),
            };
        })
        .filter((row) => row.feature.trim() || row.detail.trim())
        .map((row) => `${row.feature}|${row.detail}`)
        .join('\n');

    const addFeatureRow = () => {
        const currentRows = buildFeatureRows(newProduct.key_features);
        const nextRows = [...currentRows, { feature: '', detail: '' }];
        setNewProduct((previous) => ({
            ...previous,
            key_features: serializeFeatureRows(nextRows),
        }));
    };

    const productCategories = [...new Set(savedCategories)]
        .sort((a, b) => a.localeCompare(b));

    const handleCategorySelect = (event) => {
        const values = Array.from(event.target.selectedOptions).map((option) => option.value);
        if (values.includes('__new__')) {
            setShowNewCategory(true);
            return;
        }
        setShowNewCategory(false);
        setNewProduct((previous) => ({ ...previous, category: values.join(', ') }));
    };

    const toggleCategory = (category) => {
        setNewProduct((previous) => {
            const selectedCategories = splitProductCategories(previous.category);
            const nextCategories = selectedCategories.includes(category)
                ? selectedCategories.filter((selectedCategory) => selectedCategory !== category)
                : [...selectedCategories, category];
            return { ...previous, category: nextCategories.join(', ') };
        });
    };

    const addNewCategory = () => {
        const category = newCategoryName.trim();
        if (!category) return;
        dbService.addProductCategory(category)
            .then((savedCategory) => {
                const savedName = savedCategory?.name || category;
                setSavedCategories((previous) => [...new Set([...previous, savedName])]);
                setNewProduct((previous) => ({
                    ...previous,
                    category: [...new Set([...splitProductCategories(previous.category), savedName])].join(', '),
                }));
                setNewCategoryName('');
                setShowNewCategory(false);
            })
            .catch((error) => {
                console.error('Error saving product category:', error);
                window.alert(error.message || 'Unable to save category.');
            });
    };

    const handleSaveProduct = async () => {
        try {
            const productPayload = {
                ...newProduct,
                storeName: newProduct.storeName || currentUser?.storeName || '',
                key_features: cleanKeyFeaturesForStorage(newProduct.key_features),
                seller_id: newProduct.seller_id || currentUser.id,
                visible_to_users: Boolean(newProduct.visible_to_users),
            };

            if (editingProductId) {
                await dbService.updateProduct(editingProductId, productPayload);
            } else {
                await dbService.addProduct(productPayload);
            }
            setShowAddProductModal(false);
            resetProductForm();
            loadData();
        } catch (error) {
            console.error('Error saving product:', error);
        }
    };

    const handleProductImageUpload = async (event) => {
        const files = Array.from(event.target.files || []);
        if (!files.length) return;

        if (files.some((file) => !file.type.startsWith('image/'))) {
            window.alert('Please choose an image file.');
            event.target.value = '';
            return;
        }

        setUploadingImage(true);
        try {
            const signatureResponse = await fetch('/api/cloudinary/signature');
            const signatureData = await signatureResponse.json();
            if (!signatureResponse.ok) throw new Error(signatureData.error || 'Cloudinary signed upload is not configured.');

            const uploadedUrls = [];
            for (const file of files) {
                const formData = new FormData();
                formData.append('file', file);
                formData.append('api_key', signatureData.apiKey);
                formData.append('timestamp', String(signatureData.timestamp));
                formData.append('folder', signatureData.folder);
                formData.append('signature', signatureData.signature);

                const response = await fetch(`https://api.cloudinary.com/v1_1/${signatureData.cloudName}/image/upload`, {
                    method: 'POST',
                    body: formData,
                });
                const result = await response.json();
                if (!response.ok || !result.secure_url) {
                    const cloudinaryError = result.error?.message || 'Cloudinary upload failed';
                    throw new Error(cloudinaryError);
                }
                uploadedUrls.push(result.secure_url);
            }

            setNewProduct((previous) => {
                const primaryImage = previous.image || uploadedUrls[0] || '';
                const secondaryImages = [
                    ...(previous.images || []),
                    ...(previous.image ? uploadedUrls : uploadedUrls.slice(1)),
                ];
                return { ...previous, image: primaryImage, images: [...new Set(secondaryImages)] };
            });
        } catch (error) {
            console.error('Product image upload failed:', error);
            window.alert(error.message || 'Product image upload failed.');
        } finally {
            setUploadingImage(false);
            event.target.value = '';
        }
    };

    const removeProductImage = (imageUrl) => {
        setNewProduct((previous) => {
            if (previous.image === imageUrl) {
                const [nextPrimary, ...remainingImages] = previous.images || [];
                return { ...previous, image: nextPrimary || '', images: remainingImages };
            }
            return { ...previous, images: (previous.images || []).filter((image) => image !== imageUrl) };
        });
    };

    const handleDeleteProduct = async (productId) => {
        if (!window.confirm('Delete this product? This action cannot be undone.')) return;
        try {
            await dbService.deleteProduct(productId);
            loadData();
        } catch (error) {
            console.error('Error deleting product:', error);
        }
    };

    const handleEditHero = (slide) => {
        setEditingHeroId(slide.id);
        setHeroDraft({
            ...heroDraft,
            id: slide.id,
            cta: slide.cta ?? '',
            link: slide.link ?? '',
            image: slide.image ?? '',
            sort_order: slide.sort_order ?? 0,
            active: slide.active ?? true
        });
    };

    const handleResetHeroDraft = () => {
        setEditingHeroId(null);
        setHeroDraft({
            id: null,
            cta: '',
            link: '',
            image: '',
            sort_order: 0,
            active: true
        });
    };

    const handleSaveHero = async () => {
        try {
            const slideData = {
                id: heroDraft.id,
                cta_label: heroDraft.cta || 'Explore Collection',
                cta_link: heroDraft.link || '/products',
                image: heroDraft.image || '',
                sort_order: heroDraft.sort_order ?? 0,
                active: heroDraft.active ?? true
            };
            await dbService.saveHeroSlide(slideData, currentUser.id);
            handleResetHeroDraft();
            loadData();
        } catch (error) {
            console.error('Error saving hero slide:', error);
        }
    };

    const handleDeleteHero = async (id) => {
        if (!window.confirm('Delete this hero slide?')) return;
        try {
            await dbService.deleteHeroSlide(id, currentUser.id);
            loadData();
        } catch (error) {
            console.error('Error deleting hero slide:', error);
        }
    };

    const handleSendManualEmail = async () => {
        if (!currentUser || currentUser.role !== 'admin') return;
        const to = String(manualEmail.to || '').trim();
        const subject = String(manualEmail.subject || '').trim();
        const message = String(manualEmail.message || '').trim();
        const template = String(manualEmail.template || '').trim();

        if (!to || (manualEmail.mode === 'custom' && !subject) || (manualEmail.mode === 'custom' && !message) || (manualEmail.mode === 'template' && !template)) {
            window.alert('Please complete the recipient, subject, and required email content before sending.');
            return;
        }

        setManualEmail((previous) => ({ ...previous, sending: true }));

        try {
            const result = await dbService.sendManualEmail({
                to,
                subject,
                message,
                isHtml: manualEmail.contentType === 'html',
                category: manualEmail.category,
                sender: manualEmail.sender,
                replyTo: manualEmail.replyTo,
                template: manualEmail.mode === 'template' ? template : '',
                templateMode: manualEmail.mode,
                templateVariables: manualEmail.templateVariables,
            }, currentUser.emailAdminToken);

            window.alert(result?.message || 'Email queued successfully.');
            setManualEmail({
                mode: 'custom',
                sender: 'hello',
                replyTo: 'support',
                category: 'security',
                to: '',
                subject: '',
                template: '',
                templateVariables: {},
                contentType: 'text',
                message: '',
                sending: false,
            });
        } catch (error) {
            console.error('Manual email send failed:', error);
            window.alert(error.message || 'Unable to send the email.');
            setManualEmail((previous) => ({ ...previous, sending: false }));
        }
    };

    const handleOpenNewHero = () => {
        handleResetHeroDraft();
        setActiveTab('admin_hero');
    };

    const resetJournalDraft = () => {
        setEditingJournalId(null);
        setJournalDraft({ id: null, slug: '', title: '', excerpt: '', body: '', image: '', published: true });
    };

    const editJournalPost = (post) => {
        setEditingJournalId(post.id);
        setJournalDraft({ ...post });
        setActiveTab('admin_blog');
    };

    const saveJournalPost = async () => {
        try {
            const post = {
                ...journalDraft,
                slug: journalDraft.slug || journalDraft.title.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
            };
            await dbService.saveJournalPost(post, currentUser.id);
            resetJournalDraft();
            loadData();
        } catch (error) {
            console.error('Error saving journal post:', error);
        }
    };

    const deleteJournalPost = async (id) => {
        if (!window.confirm('Delete this journal post?')) return;
        try {
            await dbService.deleteJournalPost(id, currentUser.id);
            loadData();
        } catch (error) {
            console.error('Error deleting journal post:', error);
        }
    };

    const handleOpenAddProduct = () => {
        resetProductForm();
        setShowAddProductModal(true);
    };

    const handleUserStatusUpdate = async (userId, status) => {
        if (currentUser.role !== 'admin') return;
        await dbService.updateUserStatus(userId, status, currentUser.id);
        loadData();
    };

    const handleApproveStoreName = async (userId, approvedStoreName) => {
        if (currentUser.role !== 'admin') return;
        await dbService.approveStoreNameChange(userId, approvedStoreName, currentUser.id);
        loadData();
    };

    const handleRejectStoreName = async (userId) => {
        if (currentUser.role !== 'admin') return;
        await dbService.rejectStoreNameChange(userId, currentUser.id);
        loadData();
    };

    return (
        <div className="pt-40 pb-32 px-3 sm:px-6 max-w-7xl mx-auto min-h-screen print:p-0">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-10 mb-12 print:hidden">
                <div>
                    <SectionHeading 
                        subtitle={currentUser.role === 'admin' ? "Global Governance" : "Artisan Studio"} 
                        title={currentUser.role === 'admin' ? "Registry Command" : `${currentUser.storeName}`} 
                    />
                    
                    <div className="flex flex-wrap gap-2 mt-8 bg-[#efece6] p-1.5 rounded-[2rem] w-fit border border-[#d1cdc7] shadow-inner">
                        <TabBtn active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={<LayoutDashboard size={14}/>}>Summary</TabBtn>
                        <TabBtn active={activeTab === 'inventory'} onClick={() => setActiveTab('inventory')} icon={<Box size={14}/>}>Inventory</TabBtn>
                        <TabBtn active={activeTab === 'orders'} onClick={() => setActiveTab('orders')} icon={<ShoppingBag size={14}/>}>Orders</TabBtn>
                        <TabBtn active={activeTab === 'wishlists'} onClick={() => setActiveTab('wishlists')} icon={<Heart size={14}/>}>Wishlists</TabBtn>
                        {isAdmin && (
                            <>
                                <TabBtn active={activeTab === 'admin_users'} onClick={() => setActiveTab('admin_users')} icon={<Users size={14}/>}>Artisans</TabBtn>
                                <TabBtn active={activeTab === 'admin_hero'} onClick={() => setActiveTab('admin_hero')} icon={<Pencil size={14}/>}>Hero</TabBtn>
                                <TabBtn active={activeTab === 'admin_blog'} onClick={() => setActiveTab('admin_blog')} icon={<Pencil size={14}/>}>Blog</TabBtn>
                                <TabBtn active={activeTab === 'admin_email'} onClick={() => setActiveTab('admin_email')} icon={<Mail size={14}/>}>Email</TabBtn>
                                <TabBtn active={activeTab === 'admin_config'} onClick={() => setActiveTab('admin_config')} icon={<TrendingUp size={14}/>}>Policy</TabBtn>
                                <TabBtn active={activeTab === 'admin_logs'} onClick={() => setActiveTab('admin_logs')} icon={<Shield size={14}/>}>Audit</TabBtn>
                            </>
                        )}
                    </div>
                </div>

                <div className="flex gap-4">
                    {activeTab === 'inventory' && (
                        <div className="flex items-center gap-4 bg-white px-6 py-3 rounded-2xl border border-stone-200 shadow-sm">
                           <div className="flex items-center gap-2 text-stone-400">
                                <Settings size={14} />
                                <span className="text-[9px] font-black uppercase tracking-widest">Low Stock Alert:</span>
                           </div>
                           <input 
                            type="number" 
                            value={lowStockThreshold} 
                            onChange={(e) => setLowStockThreshold(parseInt(e.target.value) || 0)}
                            className="w-12 text-center font-black text-sm bg-stone-50 border-none outline-none focus:ring-0"
                           />
                        </div>
                    )}
                </div>
            </div>

            {loading ? <div className="py-20 text-center animate-pulse text-stone-400 uppercase font-black tracking-widest text-[10px] print:hidden">Harmonizing Portals...</div> : (
                <div className="animate-in fade-in duration-500 print:hidden">
                    {activeTab === 'dashboard' && (
                        <div className="space-y-10">
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-6">
                                <StatCard label="Registry Volume" value={`रु ${stats.revenue.toLocaleString()}`} sub="Gross Market Sales" />
                                <StatCard label="MCS Share" value={`रु ${(stats.revenue - stats.payable).toLocaleString()}`} sub="Revenue Retained" color="text-amber-600" />
                                <StatCard label="Due for Disbursement" value={`रु ${stats.pendingPayout.toLocaleString()}`} sub="Pending Clearance" color="text-blue-600" />
                                <StatCard label="Settled Funds" value={`रु ${stats.paid.toLocaleString()}`} sub="Successfully Payout" color="text-green-600" />
                            </div>
                            <div className="bg-white p-2 sm:p-10 rounded-[1rem] sm:rounded-[3.5rem] border border-stone-100 shadow-sm">
                                <h3 className="font-playfair text-xl font-black mb-10 text-stone-900 border-l-4 border-[#5c1111] pl-6 italic">Market Momentum</h3>
                                <div className="h-72"><canvas ref={salesChartRef}></canvas></div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'inventory' && (
                        <div className="space-y-6">
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                <div className="flex items-center gap-3 flex-1 w-full md:w-auto">
                                    <div className="relative flex-1 md:max-w-md">
                                        <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" />
                                        <input 
                                            type="text" 
                                            placeholder="Search products..." 
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            className="w-full pl-10 pr-4 py-3 bg-white border border-stone-200 rounded-2xl focus:ring-2 focus:ring-[#5c1111]/20 focus:border-[#5c1111] outline-none transition-all text-xs font-medium"
                                        />
                                    </div>
                                    <div className="relative">
                                        <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                                        <select 
                                            value={filterCategory}
                                            onChange={(e) => setFilterCategory(e.target.value)}
                                            className="pl-9 pr-8 py-3 bg-white border border-stone-200 rounded-2xl focus:ring-2 focus:ring-[#5c1111]/20 focus:border-[#5c1111] outline-none transition-all text-xs font-medium appearance-none"
                                        >
                                            <option value="all">All Categories</option>
                                            {[...new Set(products.map(p => p.category))].filter(Boolean).map(cat => (
                                                <option key={cat} value={cat}>{cat}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <button 
                                        onClick={handleRefresh} 
                                        disabled={refreshing}
                                        className="p-3 bg-white border border-stone-200 rounded-2xl hover:bg-stone-50 transition-all disabled:opacity-50"
                                    >
                                        <RotateCcw size={16} className={`text-stone-600 ${refreshing ? 'animate-spin' : ''}`} />
                                    </button>
                                </div>
                                <button
                                    onClick={handleOpenAddProduct}
                                    className="px-6 py-3 bg-[#5c1111] text-white rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 hover:bg-[#2a2723] transition-all"
                                >
                                    <Plus size={16} /> Add New Product
                                </button> 
                            </div>
                            <div className="grid grid-cols-1 gap-2">
                                {products.length === 0 ? (
                                    <div className="text-center py-40 bg-white rounded-[4rem] border border-dashed border-stone-200">
                                        <Box size={48} className="mx-auto text-stone-200 mb-6" />
                                        <p className="text-stone-400 font-bold uppercase text-[10px] tracking-widest">The vault is currently empty.</p>
                                    </div>
                                ) : products.map(p => {
                                const isLow = p.stock <= lowStockThreshold;
                                return (
                                    <div key={p.id} className={`p-1.5 sm:p-4 rounded-3xl border transition-all relative flex items-center gap-4 sm:gap-8 hover:shadow-xl ${isLow ? 'bg-red-50/50 border-red-100' : 'bg-white border-stone-100'}`}>
                                        <img src={p.image} className="w-16 h-16 sm:w-24 sm:h-24 rounded-2xl object-contain shadow-sm ring-1 ring-stone-100" />
                                        <div className="flex-1">
                                            <div className="flex items-center gap-1 sm:gap-4">
                                                <h4 className="font-black text-[10px] sm:text-sm text-stone-900">{p.name}</h4>
                                                {isLow && (
                                                    <div className="flex items-center gap-1 sm:px-3 sm:py-0.7 px-1 py-0.5 bg-red-600 text-white rounded-lg text-[5px] sm:text-[10px] font-black uppercase tracking-widest animate-pulse">
                                                        <AlertCircle size={10} /> Critical Reserves
                                                    </div>
                                                )}
                                            </div>
                                            <p className="text-[9px] text-stone-400 font-bold uppercase tracking-widest mt-1">{p.category} &bull; रु {p.price.toLocaleString()}</p>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <div className="text-right">
                                                <p className="text-[8px] uppercase font-bold text-stone-300 tracking-widest">Stock Level</p>
                                                <p className={`text-base font-black ${isLow ? 'text-red-600' : 'text-stone-900'}`}>{p.stock}</p>
                                            </div>
                                            <button onClick={() => handleEditProduct(p)} className="p-3 text-stone-300 hover:text-[#5c1111] transition-colors" title="Edit product"><Pencil size={18}/></button>
                                            {(currentUser.role === 'admin' || p.seller_id === currentUser.id) && (
                                                <button onClick={() => handleDeleteProduct(p.id)} className="p-3 text-stone-300 hover:text-red-600 transition-colors" title="Delete product"><Trash2 size={18}/></button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                            </div>
                        </div>
                    )}

                    {activeTab === 'orders' && (
                        <div className="space-y-4">
                            <div className="flex flex-row md:flex-row items-center gap-2 sm:gap-3 flex-wrap">
                                <div className="relative flex-1 md:max-w-md">
                                    <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" />
                                    <input 
                                        type="text" 
                                        placeholder="Search orders..." 
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="w-full pl-10 pr-4 py-3 bg-white border border-stone-200 rounded-2xl focus:ring-2 focus:ring-[#5c1111]/20 focus:border-[#5c1111] outline-none transition-all text-xs font-medium"
                                    />
                                </div>
                                <div className="relative">
                                    <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                                    <select 
                                        value={filterStatus}
                                        onChange={(e) => setFilterStatus(e.target.value)}
                                        className="pl-9 pr-8 py-3 bg-white border border-stone-200 rounded-2xl focus:ring-2 focus:ring-[#5c1111]/20 focus:border-[#5c1111] outline-none transition-all text-xs font-medium appearance-none"
                                    >
                                        <option value="all">All Status</option>
                                        {['pending', 'confirmed', 'packing', 'billing', 'shipped', 'arrived', 'delivered', 'cancelled'].map(s => (
                                            <option key={s} value={s}>{s}</option>
                                        ))}
                                    </select>
                                </div>
                                <button 
                                    onClick={handleRefresh} 
                                    disabled={refreshing}
                                    className="p-3 bg-white border border-stone-200 rounded-2xl hover:bg-stone-50 transition-all disabled:opacity-50"
                                >
                                    <RotateCcw size={16} className={`text-stone-600 ${refreshing ? 'animate-spin' : ''}`} />
                                </button>
                                {currentUser.role === 'admin' && (
                                    <button 
                                        onClick={() => {
                                            setGroupByCustomer(!groupByCustomer);
                                            setExpandedCustomers({});
                                        }}
                                        className={`px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all ${
                                            groupByCustomer 
                                            ? 'bg-[#5c1111] text-white shadow-lg' 
                                            : 'bg-white border border-stone-200 text-stone-500 hover:text-stone-900'
                                        }`}
                                    >
                                        <Users size={14} /> Group by Customer
                                    </button>
                                )}
                            </div>
                            {orders.filter(o =>
                                (filterStatus === 'all' || o.status === filterStatus) &&
                                (searchQuery === '' || o.id?.toString().includes(searchQuery) || o.customer?.name?.toLowerCase().includes(searchQuery.toLowerCase()))
                            ).length === 0 ? (
                                <div className="text-center py-40 bg-white rounded-[4rem] border border-dashed border-stone-200">
                                    <ShoppingBag size={48} className="mx-auto text-stone-200 mb-6" />
                                    <p className="text-stone-400 font-bold uppercase text-[10px] tracking-widest">No order cycles detected.</p>
                                </div>
                            ) : groupByCustomer ? (
                                // Group by Customer View
                                (() => {
                                    const filteredOrders = orders.filter(o => 
                                        (filterStatus === 'all' || o.status === filterStatus) &&
                                        (searchQuery === '' || o.id?.toString().includes(searchQuery) || o.customer?.name?.toLowerCase().includes(searchQuery.toLowerCase()))
                                    );
                                    const groupedOrders = filteredOrders.reduce((acc, order) => {
                                        const customerId = order.customer_id || order.customer?.email || 'unknown';
                                        if (!acc[customerId]) {
                                            acc[customerId] = { customer: order.customer, orders: [], total: 0 };
                                        }
                                        acc[customerId].orders.push(order);
                                        acc[customerId].total += order.total;
                                        return acc;
                                    }, {});
                                    
                                    return Object.entries(groupedOrders).map(([customerId, group]) => (
                                        <div key={customerId} className="bg-white p-6 rounded-[2.5rem] border border-stone-100 shadow-sm">
                                            <div className="flex flex-col lg:flex-row justify-between items-center gap-8 cursor-pointer hover:border-[#5c1111]/30 transition-all"
                                                onClick={() => setExpandedCustomers(prev => ({...prev, [customerId]: !prev[customerId]}))}>
                                                <div className="flex items-center gap-6">
                                                    <div className="w-14 h-14 bg-[#5c1111] rounded-2xl flex items-center justify-center text-white shadow-inner">
                                                        <Users size={24}/>
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <h4 className="font-black text-sm text-stone-900">{group.customer?.name || 'Unknown Customer'}</h4>
                                                            <Badge variant="primary">{group.orders.length} Orders</Badge>
                                                        </div>
                                                        <p className="text-[10px] text-stone-400 font-bold uppercase tracking-widest mt-1">
                                                            {group.customer?.email} &bull; Total: रु {group.total.toLocaleString()}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-4">
                                                    <div className="text-right">
                                                        <p className="text-[8px] uppercase text-stone-400 font-bold tracking-widest">Combined Total</p>
                                                        <p className="text-xl font-black text-[#5c1111]">रु {group.total.toLocaleString()}</p>
                                                    </div>
                                                    <ChevronRight size={24} className={`text-stone-400 transition-transform ${expandedCustomers[customerId] ? 'rotate-90' : ''}`}/>
                                                </div>
                                            </div>
                                            
                                            {expandedCustomers[customerId] && (
                                                <div className="mt-6 space-y-4 pl-4 border-l-2 border-[#5c1111]/20">
                                                    <div className="flex justify-end">
                                                        <button 
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setCombinedOrders(group.orders);
                                                                setInvoiceOrder(group.orders[0]);
                                                            }}
                                                            className="px-4 py-2 bg-[#5c1111] text-white rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-[#2a2723] transition-all shadow-md"
                                                        >
                                                            <Printer size={12} /> Print Combined Invoice
                                                        </button>
                                                    </div>
                                                    {group.orders.map(o => (
                                                        <div key={o.id} className="bg-stone-50 p-4 rounded-2xl flex flex-col lg:flex-row justify-between items-center gap-4">
                                                            <div className="flex items-center gap-4">
                                                                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-[#5c1111] shadow-inner">
                                                                    <ShoppingBag size={18}/>
                                                                </div>
                                                                <div>
                                                                    <div className="flex items-center gap-2">
                                                                        <h4 className="font-black text-xs text-stone-900">Registry #{o.id}</h4>
                                                                        <Badge variant={o.status === 'delivered' ? 'primary' : 'dark'}>{o.status}</Badge>
                                                                    </div>
                                                                    <p className="text-[9px] text-stone-400 font-bold uppercase tracking-widest mt-1">
                                                                        {new Date(o.date).toLocaleDateString()} &bull; {o.items?.length || 0} items
                                                                    </p>
                                                                </div>
                                                            </div>
                                                            <div className="flex flex-wrap items-center gap-4 justify-end">
                                                                <div className="text-right">
                                                                    <p className="text-[8px] uppercase text-stone-400 font-bold tracking-widest">Settlement</p>
                                                                    <p className="text-sm font-black text-[#5c1111]">रु {o.seller_payable_amount.toLocaleString()}</p>
                                                                </div>
                                                                {currentUser.role === 'admin' && (
                                                                    <button disabled={!['packing', 'billing'].includes(o.status)}
                                                                        onClick={(e) => { e.stopPropagation(); setInvoiceOrder(o); }} 
                                                                        className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-2 transition-all shadow-md ${
                                                                            ['packing', 'billing'].includes(o.status) ? 'bg-[#5c1111] text-white hover:bg-[#2a2723] active:scale-95' : 'bg-stone-100 text-stone-300 cursor-not-allowed opacity-60 shadow-none'}`}
                                                                    >
                                                                        <Printer size={12} /> Invoice
                                                                    </button>
                                                                )}
                                                                <button onClick={(e) => { e.stopPropagation(); setSelectedOrder(o); }} className="p-2 bg-white rounded-xl hover:bg-stone-100 transition-colors" title="View Details">
                                                                    <Eye size={16} className="text-stone-400 hover:text-stone-900" />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    ));
                                })()
                            ) : orders.map(o => (
                                <div key={o.id} className="bg-white p-2 sm:p-6 sm:rounded-[2rem] rounded-[1rem] border border-stone-100 shadow-sm flex flex-col lg:flex-row justify-between items-center gap-4 sm:gap-8 hover:border-[#5c1111]/30 transition-all group">
                                    <div className="flex items-center gap-2 sm:gap-6">
                                        <div className="w-14 h-14 bg-[#efece6] rounded-2xl flex items-center justify-center text-[#5c1111] shadow-inner group-hover:scale-105 transition-transform"><ShoppingBag size={24}/></div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h4 className="font-black text-xs sm:text-sm text-stone-900">Registry #{o.id}</h4>
                                                <Badge variant={o.status === 'delivered' ? 'primary' : 'dark'}>{o.status}</Badge>
                                            </div>
                                            <p className="text-[8px] sm:text-[10px] text-stone-400 font-bold uppercase tracking-widest mt-0.5 sm:mt-1">{o.customer.name} &bull; {new Date(o.date).toLocaleDateString()}</p>
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-1 sm:gap-4 justify-start">
                                        <div className="text-center">
                                            <p className="text-[8px] uppercase text-stone-400 font-bold tracking-widest">Update Phase</p>
                                            <select
                                                value={o.status}
                                                onChange={(e) => handleUpdateStatus(o.id, e.target.value)}
                                                className="bg-stone-50 text-[10px] font-black uppercase px-4 py-2 rounded-xl border border-stone-100 outline-none focus:ring-2 focus:ring-[#5c1111]/10 transition-all"
                                                disabled={currentUser.role !== 'admin' && ['billing', 'arrived', 'delivered'].includes(o.status)}
                                            >
                                                {currentUser.role === 'admin' 
                                                    ? ['pending', 'confirmed', 'packing', 'billing', 'shipped', 'arrived', 'delivered', 'cancelled'].map(s => <option key={s} value={s}>{s}</option>)
                                                    : ['pending', 'confirmed', 'packing'].map(s => <option key={s} value={s}>{s}</option>)
                                                }
                                            </select>
                                        </div>
                                        <div className="flex gap-2 items-center">

                                            <button onClick={() => setSelectedOrder(o)} className="flex flex-row items-center gap-2 p-2 sm:p-3 bg-stone-50 rounded-xl hover:bg-stone-100 transition-colors" title="View Detail">
                                                <Eye size={18} className="text-stone-400 hover:text-stone-900" />
                                                <p className="text-[8px] sm:text-[10px] uppercase text-stone-400 font-bold tracking-widest">View</p>
                                            </button>

                                            <div className="text-left mr-3">
                                                <p className="text-[8px] uppercase text-stone-400 font-bold tracking-widest">Settlement</p>
                                                <p className="text-sm font-black text-[#5c1111]">रु {o.seller_payable_amount.toLocaleString()}</p>
                                            </div>
                                            
                                            {currentUser.role === 'admin' && (
                                                <button 
                                                    disabled={!['packing', 'billing'].includes(o.status)}
                                                    onClick={() => setInvoiceOrder(o)} 
                                                    className={`px-1 py-2 sm:px-5 sm:py-3 rounded-xl text-[7px] sm:text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all shadow-md ${
                                                        ['packing', 'billing'].includes(o.status) 
                                                        ? 'bg-[#5c1111] text-white hover:bg-[#2a2723] active:scale-95' 
                                                        : 'bg-stone-100 text-stone-300 cursor-not-allowed opacity-60 shadow-none'
                                                    }`}
                                                >
                                                    <Printer size={17} /> <span>Print Invoice</span>
                                                </button>
                                            )}
                                            
                                            

                                            {['pending', 'confirmed'].includes(o.status) && (
                                                <button
                                                    onClick={() => handleUpdateStatus(o.id, 'cancelled')}
                                                    className="px-4 py-2 bg-red-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-red-700 transition-all"
                                                >
                                                    Cancel
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {activeTab === 'wishlists' && (
                        <div className="space-y-6">
                            <div className="flex flex-row items-start gap-3">
                                <div className="relative flex-1 md:max-w-md">
                                    <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" />
                                    <input 
                                        type="text" 
                                        placeholder="Search wishlisted products..." 
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="w-full pl-10 pr-4 py-3 bg-white border border-stone-200 rounded-2xl focus:ring-2 focus:ring-[#5c1111]/20 focus:border-[#5c1111] outline-none transition-all text-xs font-medium"
                                    />
                                </div>
                                <button 
                                    onClick={handleRefresh} 
                                    disabled={refreshing}
                                    className="p-3 bg-white border border-stone-200 rounded-2xl hover:bg-stone-50 transition-all disabled:opacity-50"
                                >
                                    <RotateCcw size={16} className={`text-stone-600 ${refreshing ? 'animate-spin' : ''}`} />
                                </button>
                            </div>

                            <div className="bg-white p-2 sm:p-8 rounded-[1rem] sm:rounded-[2.5rem] border border-stone-100 shadow-sm">
                                <h3 className="font-playfair text-xl font-black mb-6 text-stone-900 border-l-4 border-[#5c1111] pl-6 italic">Product Demand (Wishlists)</h3>
                                <div className="grid grid-cols-1 gap-4">
                                    {wishlists.length === 0 ? (
                                        <div className="text-center py-20 bg-stone-50 rounded-[3rem] border border-dashed border-stone-200">
                                            <Heart size={48} className="mx-auto text-stone-200 mb-6" />
                                            <p className="text-stone-400 font-bold uppercase text-[10px] tracking-widest">No products in wishlist yet.</p>
                                        </div>
                                    ) : (() => {
                                        const demand = wishlists.reduce((acc, w) => {
                                            if (w.product) {
                                                if (!acc[w.product.id]) {
                                                    acc[w.product.id] = { product: w.product, count: 0, customers: [] };
                                                }
                                                acc[w.product.id].count += 1;
                                                if (w.customer && w.customer.name) {
                                                    acc[w.product.id].customers.push(w.customer.name);
                                                }
                                            }
                                            return acc;
                                        }, {});
                                        
                                        const searchFilteredDemand = Object.values(demand).filter(item => 
                                            searchQuery === '' || item.product.name.toLowerCase().includes(searchQuery.toLowerCase())
                                        );

                                        if (searchFilteredDemand.length === 0) {
                                            return (
                                                <div className="text-center py-10">
                                                    <p className="text-stone-400 font-bold uppercase text-[10px] tracking-widest">No matching products found.</p>
                                                </div>
                                            );
                                        }

                                        return searchFilteredDemand.sort((a, b) => b.count - a.count).map(item => (
                                            <div key={item.product.id} className="p-1 sm:p-6 rounded-[1rem] sm:rounded-[2rem] border border-stone-100 bg-white flex items-center justify-between gap-2 sm:gap-6 hover:shadow-md transition-all group">
                                                <div className="flex items-center gap-2 sm:gap-6">
                                                    <div className="relative">
                                                        <img src={item.product.image} className="w-10 h-10 sm:w-16 sm:h-16 rounded-lg object-cover shadow-sm group-hover:scale-105 transition-transform" />
                                                        <div className="absolute -top-2 -right-2 bg-red-500 text-white w-4 h-4 sm:w-6 sm:h-6 rounded-full flex items-center justify-center text-[10px] font-black shadow-md border-2 border-white">{item.count}</div>
                                                    </div>
                                                    <div>
                                                        <h4 className="font-black text-xs text-stone-900">{item.product.name}</h4>
                                                        <p className="text-[10px] text-stone-500 font-bold uppercase tracking-widest mt-1">रु {item.product.price.toLocaleString()}</p>
                                                        <p className="text-[9px] text-stone-500 mt-2 truncate max-w-xs" title={item.customers.join(', ')}>
                                                            <span className="font-bold text-stone-700">Interested Collectors:</span> {item.customers.length ? item.customers.join(', ') : 'Anonymous'}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <span className="text-[8px] sm:text-[10px] uppercase font-bold text-stone-500 tracking-widest block mb-1">Demand Level</span>
                                                    <Badge  variant={item.count > 5 ? 'primary' : 'saffron'}>{item.count > 5 ? 'High Demand' : 'Trending'}</Badge>
                                                </div>
                                            </div>
                                        ));
                                    })()}
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'admin_users' && currentUser.role === 'admin' && (
                        <div className="space-y-4">
                            {allUsers.filter(u => u.id !== currentUser.id).map(u => (
                                <div key={u.id} className="bg-white p-2 sm:p-8 rounded-[1rem] sm:rounded-[2.5rem] border border-stone-100 flex flex-col md:flex-row justify-between items-center group gap-8">
                                    <div className="flex items-center gap-6">
                                        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center font-black text-xl shadow-inner ${u.role === 'seller' ? 'bg-amber-50 text-amber-700' : 'bg-blue-50 text-blue-700'}`}>
                                            {u.name.charAt(0)}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2 sm:gap-3">
                                                <h3 className="font-black text-sm text-stone-900">{u.name}</h3>
                                                <Badge variant={u.role === 'seller' ? 'saffron' : 'dark'}>{u.role}</Badge>
                                            </div>
                                            <p className="text-[10px] text-stone-400 font-bold uppercase tracking-widest mt-1">
                                                {u.storeName ? `Studio: ${u.storeName}` : u.email}
                                            </p>
                                        </div>
                                    </div>
                                    
                                    <div className="flex items-left gap-6">
                                        <div className="text-left">
                                            <p className="text-[8px] uppercase text-stone-400 font-bold tracking-[0.2em] mb-1 text-center">Current Status</p>
                                            <Badge variant={u.status === 'active' ? 'primary' : u.status === 'pending' ? 'saffron' : 'dark'}>{u.status}</Badge>
                                        </div>
                                        
                                        <div className="flex flex-col gap-2">
                                            {u.storeName_pending && (
                                                <div className="rounded-xl border border-amber-200 bg-amber-50 p-2 text-left">
                                                    <p className="text-[8px] font-black uppercase tracking-[0.2em] text-amber-700">Store name pending</p>
                                                    <p className="mt-1 text-xs font-semibold text-stone-700">{u.storeName_pending}</p>
                                                    <div className="mt-2 flex gap-2">
                                                        <button
                                                            onClick={() => handleApproveStoreName(u.id, u.storeName_pending)}
                                                            className="px-3 py-2 bg-green-600 text-white rounded-lg text-[8px] font-black uppercase tracking-widest"
                                                        >
                                                            Approve
                                                        </button>
                                                        <button
                                                            onClick={() => handleRejectStoreName(u.id)}
                                                            className="px-3 py-2 bg-stone-200 text-stone-700 rounded-lg text-[8px] font-black uppercase tracking-widest"
                                                        >
                                                            Reject
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                            {u.status === 'pending' && (
                                                <button 
                                                    onClick={() => handleUserStatusUpdate(u.id, 'active')}
                                                    className="p-3 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-all shadow-md flex items-center gap-2 text-[9px] font-black uppercase tracking-widest"
                                                >
                                                    <ShieldCheck size={16} /> Approve
                                                </button>
                                            )}
                                            {u.status === 'active' ? (
                                                <button 
                                                    onClick={() => handleUserStatusUpdate(u.id, 'disabled')}
                                                    className="p-3 bg-stone-100 text-stone-400 rounded-xl hover:bg-red-50 hover:text-red-700 transition-all flex items-center gap-2 text-[9px] font-black uppercase tracking-widest"
                                                >
                                                    <UserX size={16} /> Deactivate
                                                </button>
                                            ) : u.status !== 'pending' && (
                                                <button 
                                                    onClick={() => handleUserStatusUpdate(u.id, 'active')}
                                                    className="p-3 bg-stone-900 text-white rounded-xl hover:bg-[#5c1111] transition-all flex items-center gap-2 text-[9px] font-black uppercase tracking-widest"
                                                >
                                                    <Check size={16} /> Reinstate
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {activeTab === 'admin_config' && currentUser.role === 'admin' && (
                        <div className="space-y-6 animate-in fade-in duration-300">
                            <div className="bg-white p-2 md:p-12 rounded-[1rem] sm:rounded-[3.5rem] border border-stone-100 shadow-sm">
                                <h3 className="font-playfair text-2xl font-black mb-8 text-stone-900 border-l-4 border-[#5c1111] pl-6 italic">Platform Economic Policy</h3>
                                
                                <div className="max-w-xl">
                                    <div className="bg-stone-50 p-6 rounded-3xl border border-stone-200 mb-8">
                                        <div className="flex items-center gap-4 mb-4">
                                            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-[#5c1111] shadow-sm"><TrendingUp size={20}/></div>
                                            <div>
                                                <h4 className="font-black text-sm text-stone-900">Global Commission Rate</h4>
                                                <p className="text-[10px] text-stone-400 font-bold uppercase tracking-widest mt-1">Applied to all future artisan sales</p>
                                            </div>
                                        </div>
                                        
                                        <div className="flex items-center gap-4 mt-6">
                                            <div className="relative flex-1">
                                                <input 
                                                    type="number" 
                                                    value={globalCommission}
                                                    onChange={(e) => setGlobalCommission(parseFloat(e.target.value) || 0)}
                                                    className="w-full pl-4 pr-12 py-4 bg-white border border-stone-200 rounded-2xl focus:ring-2 focus:ring-[#5c1111]/20 focus:border-[#5c1111] outline-none text-xl font-black transition-all"
                                                />
                                                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-stone-400 font-black">%</span>
                                            </div>
                                            <button 
                                                onClick={async () => {
                                                    const savedConfig = await dbService.setGlobalCommission(globalCommission, currentUser.id);
                                                    setGlobalCommission(savedConfig.globalCommission);
                                                    await loadData();
                                                    alert("Global commission updated successfully.");
                                                }}
                                                className="px-8 py-4 bg-[#5c1111] text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-[#2a2723] transition-all whitespace-nowrap shadow-md"
                                            >
                                                Enact Policy
                                            </button>
                                        </div>
                                    </div>

                                    <div className="flex items-start gap-4 p-4 rounded-2xl bg-amber-50 border border-amber-100/50">
                                        <Info size={16} className="text-amber-600 mt-0.5 shrink-0" />
                                        <p className="text-xs font-medium text-amber-800 leading-relaxed">
                                            Modifying the global commission rate will only affect orders placed <span className="font-black">after</span> this policy change. Historical orders will retain their respective commission agreements at the time of purchase.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'admin_blog' && currentUser.role === 'admin' && (
                        <div className="space-y-6 animate-in fade-in duration-300">
                            <div className="rounded-[1rem] border border-stone-100 bg-white p-4 shadow-sm sm:rounded-[3.5rem] md:p-12">
                                <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
                                    <div>
                                        <h3 className="border-l-4 border-[#5c1111] pl-6 font-playfair text-2xl font-black italic text-stone-900">Cultural Journal</h3>
                                        <p className="mt-2 text-[10px] font-bold uppercase tracking-widest text-stone-400">Add, edit, publish, or remove journal stories.</p>
                                    </div>
                                    <button type="button" onClick={resetJournalDraft} className="flex items-center gap-2 rounded-2xl bg-[#5c1111] px-4 py-3 text-[10px] font-black uppercase tracking-widest text-white">
                                        <Plus size={14} /> New Post
                                    </button>
                                </div>
                                <div className="space-y-3">
                                    {journalPosts.length === 0 ? <p className="rounded-2xl border border-dashed border-stone-200 p-8 text-center text-[10px] font-bold uppercase tracking-widest text-stone-400">No journal posts yet.</p> : journalPosts.map((post) => (
                                        <div key={post.id} className="flex flex-col justify-between gap-4 rounded-3xl border border-stone-200 bg-stone-50 p-4 lg:flex-row lg:items-center">
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2"><h4 className="truncate font-black text-stone-900">{post.title}</h4><span className={`rounded-full px-2 py-1 text-[8px] font-black uppercase ${post.published ? 'bg-green-100 text-green-700' : 'bg-stone-200 text-stone-500'}`}>{post.published ? 'Published' : 'Draft'}</span></div>
                                                <p className="mt-1 truncate text-[10px] text-stone-400">/{post.slug}</p>
                                            </div>
                                            <div className="flex gap-2">
                                                <button type="button" onClick={() => editJournalPost(post)} className="rounded-xl border border-stone-200 bg-white px-4 py-2 text-[10px] font-black uppercase tracking-widest text-stone-700">Edit</button>
                                                <button type="button" onClick={() => deleteJournalPost(post.id)} className="rounded-xl bg-red-600 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-white">Delete</button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div className="mt-8 grid gap-4 rounded-[2rem] bg-[#f8f6f2] p-5 sm:grid-cols-2 sm:p-8">
                                    <input value={journalDraft.title} onChange={(e) => setJournalDraft({ ...journalDraft, title: e.target.value })} placeholder="Title" className="rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm outline-none focus:border-[#5c1111]" />
                                    <input value={journalDraft.slug} onChange={(e) => setJournalDraft({ ...journalDraft, slug: e.target.value })} placeholder="Slug (optional)" className="rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm outline-none focus:border-[#5c1111]" />
                                    <input value={journalDraft.image} onChange={(e) => setJournalDraft({ ...journalDraft, image: e.target.value })} placeholder="Image URL" className="rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm outline-none focus:border-[#5c1111] sm:col-span-2" />
                                    <textarea value={journalDraft.excerpt} onChange={(e) => setJournalDraft({ ...journalDraft, excerpt: e.target.value })} placeholder="Short excerpt" rows={2} className="rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm outline-none focus:border-[#5c1111] sm:col-span-2" />
                                    <textarea value={journalDraft.body} onChange={(e) => setJournalDraft({ ...journalDraft, body: e.target.value })} placeholder="Article body" rows={6} className="rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm outline-none focus:border-[#5c1111] sm:col-span-2" />
                                    <label className="flex items-center gap-2 text-xs font-bold text-stone-600"><input type="checkbox" checked={journalDraft.published} onChange={(e) => setJournalDraft({ ...journalDraft, published: e.target.checked })} /> Publish this post</label>
                                    <div className="flex justify-end gap-2 sm:col-span-2"><button type="button" onClick={resetJournalDraft} className="rounded-xl border border-stone-200 bg-white px-5 py-3 text-[10px] font-black uppercase tracking-widest">Clear</button><button type="button" onClick={saveJournalPost} disabled={!journalDraft.title.trim() || !journalDraft.body.trim()} className="rounded-xl bg-[#5c1111] px-5 py-3 text-[10px] font-black uppercase tracking-widest text-white disabled:opacity-40">{editingJournalId ? 'Update Post' : 'Save Post'}</button></div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'admin_hero' && currentUser.role === 'admin' && (
                        <div className="space-y-6 animate-in fade-in duration-300">
                            <div className="bg-white p-2 md:p-12 rounded-[1rem] sm:rounded-[3.5rem] border border-stone-100 shadow-sm">
                                <div className="flex items-center justify-between mb-8">
                                    <div>
                                        <h3 className="font-playfair text-2xl font-black text-stone-900 border-l-4 border-[#5c1111] pl-6 italic">Homepage Hero Slides</h3>
                                        <p className="text-[10px] text-stone-400 font-bold uppercase tracking-widest mt-2">Create and edit the homepage hero carousel.</p>
                                    </div>
                                    <button
                                        onClick={handleOpenNewHero}
                                        className="px-6 py-3 bg-[#5c1111] text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-[#2a2723] transition-all"
                                    >
                                        <Plus size={16} /> Add Slide
                                    </button>
                                </div>

                                <div className="space-y-6">
                                    {heroSlides.length === 0 ? (
                                        <div className="text-center py-20 bg-stone-50 rounded-[3rem] border border-dashed border-stone-200">
                                            <p className="text-stone-400 font-bold uppercase text-[10px] tracking-widest">No hero slides configured yet.</p>
                                        </div>
                                    ) : heroSlides.map((slide) => (
                                        <div key={slide.id} className="bg-stone-50 p-4 rounded-3xl border border-stone-200 flex flex-col lg:flex-row justify-between gap-4">
                                            <div>
                                                <p className="text-[9px] uppercase tracking-[0.2em] text-stone-500 mb-2">Image Hero</p>
                                                <div className="h-20 w-40 overflow-hidden rounded-xl border border-stone-200 bg-white">
                                                    <img src={slide.image} alt="" className="h-full w-full object-cover" />
                                                </div>
                                                <p className="text-[10px] text-stone-400 uppercase tracking-[0.2em] mt-4">Link: {slide.link || '—'}</p>
                                                <p className="text-[10px] text-stone-400 uppercase tracking-[0.2em] mt-2">Button: {slide.cta || 'Explore Collection'}</p>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <button
                                                    onClick={() => handleEditHero(slide)}
                                                    className="px-4 py-3 bg-white border border-stone-200 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:border-[#5c1111] hover:text-[#5c1111] transition-all"
                                                >Edit</button>
                                                <button
                                                    onClick={() => handleDeleteHero(slide.id)}
                                                    className="px-4 py-3 bg-red-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-red-700 transition-all"
                                                >Delete</button>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div className="mt-10 bg-[#f8f6f2] p-6 rounded-[2rem] border border-stone-100 shadow-sm">
                                    <div className="flex flex-col md:flex-row justify-between gap-4 mb-6">
                                        <div>
                                            <h4 className="font-black text-xl text-stone-900">{editingHeroId ? 'Edit Slide' : 'New Slide'}</h4>
                                            <p className="text-[10px] uppercase tracking-[0.2em] text-stone-400 mt-2">Fill the slide fields and save to update the homepage carousel.</p>
                                        </div>
                                        <div className="flex gap-3">
                                            <button
                                                onClick={handleSaveHero}
                                                className="px-6 py-3 bg-[#5c1111] text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-[#2a2723] transition-all"
                                            >Save Slide</button>
                                            <button
                                                onClick={handleResetHeroDraft}
                                                className="px-6 py-3 bg-white border border-stone-200 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-stone-50 transition-all"
                                            >Reset</button>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                        <div className="space-y-4">
                                            <label className="block text-[10px] font-black uppercase tracking-widest text-stone-400">CTA button text</label>
                                            <input
                                                value={heroDraft.cta}
                                                onChange={(e) => setHeroDraft(prev => ({ ...prev, cta: e.target.value }))}
                                                className="w-full px-4 py-3 bg-white border border-stone-200 rounded-2xl outline-none focus:ring-2 focus:ring-[#5c1111]/20"
                                            />

                                            <label className="block text-[10px] font-black uppercase tracking-widest text-stone-400">Link</label>
                                            <input
                                                value={heroDraft.link}
                                                onChange={(e) => setHeroDraft(prev => ({ ...prev, link: e.target.value }))}
                                                className="w-full px-4 py-3 bg-white border border-stone-200 rounded-2xl outline-none focus:ring-2 focus:ring-[#5c1111]/20"
                                            />
                                        </div>
                                        <div className="space-y-4">
                                            <label className="block text-[10px] font-black uppercase tracking-widest text-stone-400">Image URL</label>
                                            <input
                                                value={heroDraft.image}
                                                onChange={(e) => setHeroDraft(prev => ({ ...prev, image: e.target.value }))}
                                                className="w-full px-4 py-3 bg-white border border-stone-200 rounded-2xl outline-none focus:ring-2 focus:ring-[#5c1111]/20"
                                            />

                                            <label className="block text-[10px] font-black uppercase tracking-widest text-stone-400">Sort order</label>
                                            <input
                                                type="number"
                                                value={heroDraft.sort_order}
                                                onChange={(e) => setHeroDraft(prev => ({ ...prev, sort_order: parseInt(e.target.value) || 0 }))}
                                                className="w-full px-4 py-3 bg-white border border-stone-200 rounded-2xl outline-none focus:ring-2 focus:ring-[#5c1111]/20"
                                            />

                                            <label className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-stone-400">
                                                <input
                                                    type="checkbox"
                                                    checked={heroDraft.active}
                                                    onChange={(e) => setHeroDraft(prev => ({ ...prev, active: e.target.checked }))}
                                                    className="w-4 h-4 accent-[#5c1111]"
                                                />
                                                Active slide
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'admin_email' && currentUser.role === 'admin' && (
                        <div className="space-y-6 animate-in fade-in duration-300">
                            <div className="bg-white rounded-[1rem] sm:rounded-[3rem] border border-stone-100 shadow-sm p-4 sm:p-8">
                                <div className="flex items-center justify-between gap-4 mb-6">
                                    <h3 className="font-playfair text-2xl font-black text-stone-900 border-l-4 border-[#5c1111] pl-6 italic">Compose Email</h3>
                                </div>

                                <div className="mb-6 flex w-full max-w-sm rounded-2xl bg-stone-100 p-1">
                                    <button
                                        type="button"
                                        onClick={() => setManualEmail((prev) => ({ ...prev, mode: 'custom' }))}
                                        className={`flex-1 rounded-xl px-4 py-3 text-xs font-bold transition-colors ${manualEmail.mode === 'custom' ? 'bg-white text-[#5c1111] shadow-sm' : 'text-stone-500 hover:text-stone-800'}`}
                                    >Custom</button>
                                    <button
                                        type="button"
                                        onClick={() => setManualEmail((prev) => ({ ...prev, mode: 'template' }))}
                                        className={`flex-1 rounded-xl px-4 py-3 text-xs font-bold transition-colors ${manualEmail.mode === 'template' ? 'bg-white text-[#5c1111] shadow-sm' : 'text-stone-500 hover:text-stone-800'}`}
                                    >Resend template</button>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-[minmax(0,2fr)_minmax(220px,1fr)] gap-4 mb-6">
                                    <div>
                                        <label className="block text-[10px] font-black uppercase tracking-widest text-stone-500 mb-2">To</label>
                                        <input
                                            type="email"
                                            value={manualEmail.to}
                                            onChange={(e) => setManualEmail((prev) => ({ ...prev, to: e.target.value }))}
                                            placeholder="customer@example.com"
                                            className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl outline-none focus:ring-2 focus:ring-[#5c1111]/20"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black uppercase tracking-widest text-stone-500 mb-2">Category</label>
                                        <select
                                            value={manualEmail.category}
                                            onChange={(e) => setManualEmail((prev) => ({ ...prev, category: e.target.value }))}
                                            className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl outline-none focus:ring-2 focus:ring-[#5c1111]/20"
                                        >
                                            <option value="security">Security</option>
                                            <option value="support">Support</option>
                                            <option value="general">General</option>
                                            <option value="orders">Orders</option>
                                            <option value="welcome">Welcome</option>
                                        </select>
                                    </div>
                                </div>

                                {manualEmail.mode === 'template' ? (
                                    <div className="space-y-5">
                                        <div>
                                            <label className="block text-[10px] font-black uppercase tracking-widest text-stone-500 mb-2">Published template</label>
                                            <select
                                                value={manualEmail.template}
                                                onChange={(e) => setManualEmail((prev) => ({ ...prev, template: e.target.value, templateVariables: {} }))}
                                                className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl outline-none focus:ring-2 focus:ring-[#5c1111]/20"
                                            >
                                                <option value="">{templatesLoading ? 'Loading templates...' : 'Choose a template'}</option>
                                                {resendTemplates.map((template) => (
                                                    <option key={template.id} value={template.id}>{template.name}</option>
                                                ))}
                                            </select>
                                            {templatesError && <p className="mt-2 text-xs text-red-700">{templatesError}</p>}
                                            {!templatesLoading && !templatesError && resendTemplates.length === 0 && (
                                                <p className="mt-2 text-xs text-stone-500">No published templates available.</p>
                                            )}
                                        </div>

                                        {templateDetailsLoading && <p className="text-xs text-stone-500">Loading template fields...</p>}
                                        {templateDetailsError && <p className="text-xs text-red-700">{templateDetailsError}</p>}
                                        {selectedResendTemplate?.variables?.some((variable) => AUTO_EMAIL_TEMPLATE_VARIABLES.has(variable.key)) && (
                                            <p className="text-xs text-stone-500">
                                                USER_NAME is resolved from the recipient's customer profile, or from their email address. USER_EMAIL and standard store values are filled automatically.
                                            </p>
                                        )}
                                        {selectedResendTemplate?.variables?.length > 0 && (
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-stone-100 pt-5">
                                                {selectedResendTemplate.variables.filter((variable) => !AUTO_EMAIL_TEMPLATE_VARIABLES.has(variable.key)).map((variable) => (
                                                    <div key={variable.key}>
                                                        <label className="block text-[10px] font-black uppercase tracking-widest text-stone-500 mb-2">
                                                            {variable.key} <span className="font-medium normal-case tracking-normal text-stone-400">({variable.type})</span>
                                                        </label>
                                                        <input
                                                            type={variable.type === 'number' ? 'number' : 'text'}
                                                            step={variable.type === 'number' ? 'any' : undefined}
                                                            value={manualEmail.templateVariables[variable.key] ?? (variable.fallback_value == null ? '' : String(variable.fallback_value))}
                                                            onChange={(e) => setManualEmail((prev) => ({
                                                                ...prev,
                                                                templateVariables: { ...prev.templateVariables, [variable.key]: e.target.value },
                                                            }))}
                                                            placeholder={`Value for ${variable.key}`}
                                                            className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl outline-none focus:ring-2 focus:ring-[#5c1111]/20"
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {selectedResendTemplate && !selectedResendTemplate.variables?.length && (
                                            <p className="text-xs text-stone-500">This template needs no additional values.</p>
                                        )}
                                        {selectedResendTemplate?.variables?.length > 0 && selectedResendTemplate.variables.every((variable) => AUTO_EMAIL_TEMPLATE_VARIABLES.has(variable.key)) && (
                                            <p className="text-xs text-stone-500">This template's values are filled automatically from the recipient and store.</p>
                                        )}

                                        <details className="border-t border-stone-100 pt-4">
                                            <summary className="cursor-pointer text-xs font-bold text-stone-600">Advanced settings</summary>
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
                                                <div className="md:col-span-1">
                                                    <label className="block text-[10px] font-black uppercase tracking-widest text-stone-500 mb-2">Subject override</label>
                                                    <input
                                                        type="text"
                                                        value={manualEmail.subject}
                                                        onChange={(e) => setManualEmail((prev) => ({ ...prev, subject: e.target.value }))}
                                                        placeholder={selectedResendTemplate?.subject || 'Use template subject'}
                                                        className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl outline-none focus:ring-2 focus:ring-[#5c1111]/20"
                                                    />
                                                </div>
                                                <EmailSenderFields manualEmail={manualEmail} setManualEmail={setManualEmail} />
                                            </div>
                                        </details>
                                    </div>
                                ) : (
                                    <div className="space-y-5">
                                        <div>
                                            <label className="block text-[10px] font-black uppercase tracking-widest text-stone-500 mb-2">Subject</label>
                                            <input
                                                type="text"
                                                value={manualEmail.subject}
                                                onChange={(e) => setManualEmail((prev) => ({ ...prev, subject: e.target.value }))}
                                                placeholder="Email subject"
                                                className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl outline-none focus:ring-2 focus:ring-[#5c1111]/20"
                                            />
                                        </div>
                                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                            <label className="block text-[10px] font-black uppercase tracking-widest text-stone-500">Message</label>
                                            <div className="inline-flex rounded-xl bg-stone-100 p-1 self-start">
                                                <button type="button" onClick={() => setManualEmail((prev) => ({ ...prev, contentType: 'text' }))} className={`px-3 py-2 rounded-lg text-[11px] font-bold ${manualEmail.contentType === 'text' ? 'bg-white text-[#5c1111] shadow-sm' : 'text-stone-500'}`}>Text</button>
                                                <button type="button" onClick={() => setManualEmail((prev) => ({ ...prev, contentType: 'html' }))} className={`px-3 py-2 rounded-lg text-[11px] font-bold ${manualEmail.contentType === 'html' ? 'bg-white text-[#5c1111] shadow-sm' : 'text-stone-500'}`}>HTML</button>
                                            </div>
                                        </div>
                                        <textarea
                                            rows={12}
                                            value={manualEmail.message}
                                            onChange={(e) => setManualEmail((prev) => ({ ...prev, message: e.target.value }))}
                                            placeholder={manualEmail.contentType === 'html' ? '<html>...</html>' : 'Write your message'}
                                            spellCheck={manualEmail.contentType !== 'html'}
                                            className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl outline-none focus:ring-2 focus:ring-[#5c1111]/20 font-mono text-xs"
                                        />
                                        <details className="border-t border-stone-100 pt-4">
                                            <summary className="cursor-pointer text-xs font-bold text-stone-600">Advanced settings</summary>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
                                                <EmailSenderFields manualEmail={manualEmail} setManualEmail={setManualEmail} />
                                            </div>
                                        </details>
                                    </div>
                                )}

                                <div className="mt-6 flex justify-end">
                                    <button
                                        onClick={handleSendManualEmail}
                                        disabled={manualEmail.sending || templateDetailsLoading || (manualEmail.mode === 'template' && Boolean(templateDetailsError))}
                                        className="px-6 py-3 rounded-full bg-[#5c1111] text-white text-[10px] font-black uppercase tracking-widest disabled:opacity-60"
                                    >
                                        {manualEmail.sending ? 'Sending...' : 'Send Email'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'admin_logs' && currentUser.role === 'admin' && (
                        <div className="space-y-6 animate-in fade-in duration-300">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="font-playfair text-2xl font-black text-stone-900 border-l-4 border-[#5c1111] pl-6 italic">Governance Audit Trail</h3>
                                <button className="flex items-center gap-2 px-4 py-2 bg-white border border-stone-200 rounded-xl text-[9px] font-black uppercase tracking-widest text-stone-500 hover:text-stone-900 hover:bg-stone-50 transition-all">
                                    <Download size={14} /> Export Register
                                </button>
                            </div>
                            
                            <div className="bg-white rounded-[1rem] sm:rounded-[3.5rem] border border-stone-100 shadow-sm overflow-hidden">
                                {logs.length === 0 ? (
                                    <div className="text-center py-32 bg-stone-50">
                                        <Shield size={48} className="mx-auto text-stone-200 mb-6" />
                                        <p className="text-stone-400 font-bold uppercase text-[10px] tracking-widest">The audit register is pristine.</p>
                                    </div>
                                ) : (
                                    <div className="divide-y divide-stone-100">
                                        {[...logs].reverse().map(log => (
                                            <div key={log.id} className="p-4 md:p-8 flex flex-col md:flex-row gap-6 items-start md:items-center hover:bg-stone-50/50 transition-colors group">
                                                <div className="flex items-center gap-4 w-full md:w-auto md:min-w-[200px]">
                                                    <div className="w-10 h-10 bg-[#efece6] rounded-xl flex items-center justify-center text-[#5c1111] shrink-0">
                                                        <ShieldCheck size={16} />
                                                    </div>
                                                    <div>
                                                        <p className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1">Timestamp</p>
                                                        <p className="text-xs font-bold text-stone-900">{new Date(log.timestamp).toLocaleString()}</p>
                                                    </div>
                                                </div>
                                                
                                                <div className="flex-1">
                                                    <p className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1">Directorate Action</p>
                                                    <p className="text-sm font-medium text-stone-700 leading-relaxed group-hover:text-stone-900 transition-colors">
                                                        {log.action}
                                                    </p>
                                                </div>
                                                
                                                <div className="w-full md:w-auto md:min-w-[150px] text-left md:text-right">
                                                    <p className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1">Executing Officer</p>
                                                    <Badge variant="dark" className="inline-flex">ID: {log.admin_id.substring(0, 8)}...</Badge>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Deep Detail Order Modal */}
            {selectedOrder && (
                <div className="fixed inset-0 z-[1000] flex items-center justify-center p-1 sm:p-6 bg-[#2a2723]/60 backdrop-blur-md animate-in fade-in duration-300 print:hidden">
                    <div className="bg-[#f8f6f2] w-full max-w-5xl rounded-[1rem] sm:rounded-[3rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-500 relative border border-white/20">
                        <button onClick={() => setSelectedOrder(null)} className="absolute top-10 right-10 p-4 bg-white/80 rounded-full hover:text-red-800 transition-all active:scale-90 z-10 shadow-sm"><X size={20}/></button>
                        
                        <div className="grid grid-cols-1 lg:grid-cols-12 max-h-[90vh] overflow-y-auto no-scrollbar">
                            <div className="lg:col-span-7 p-2 md:p-16 space-y-12">
                                <div className="space-y-6">
                                    <SectionHeading subtitle="Registry Intelligence" title={`Artifact Order #${selectedOrder.id}`} />
                                    <div className="bg-white p-4 sm:p-8 rounded-[1rem] sm:rounded-[2.5rem] border border-stone-100 space-y-2 sm:space-y-4 shadow-inner">
                                        <h5 className="text-[10px] font-black uppercase text-[#5c1111] tracking-[0.2em] flex items-center gap-2">
                                            <MapPin size={12} /> Shipping Coordinates
                                        </h5>
                                        <div className="text-sm font-medium text-stone-600">
                                            <p className="font-black text-stone-900 text-base">{selectedOrder.customer.name}</p>
                                            <p className="mt-2 leading-relaxed italic">
                                                {selectedOrder.customer.address}, {selectedOrder.customer.city}<br/>
                                                Secured Contact: {selectedOrder.customer.phone}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-6">
                                    <h5 className="text-[10px] font-black uppercase text-stone-400 tracking-[0.2em] border-b border-stone-100 pb-3">Collection Manifesto</h5>
                                    <div className="space-y-4">
                                        {selectedOrder.items.map(item => (
                                            <div key={item.id} className="flex gap-6 items-center bg-white p-1.5 sm:p-5 rounded-xl sm:rounded-3xl border border-stone-50 group shadow-sm">
                                                <img src={item.image} className="w-20 h-20 rounded-2xl object-cover shadow-sm group-hover:scale-105 transition-transform" />
                                                <div className="flex-1">
                                                    <p className="text-xs font-black uppercase tracking-widest text-stone-900">{item.name}</p>
                                                    <p className="text-[10px] text-stone-400 font-bold mt-1">Medium: {item.material} &bull; Qty: {item.quantity}</p>
                                                    <p className="text-sm font-black text-[#5c1111] mt-1">रु {item.price.toLocaleString()}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            <div className="lg:col-span-5 p-2 md:p-16 bg-[#efece6]/30 space-y-10 border-l border-white/50">
                                <div className="bg-white p-10 rounded-[1rem] sm:rounded-[3rem] space-y-8 shadow-sm border border-white">
                                    <h5 className="text-[10px] font-black uppercase text-stone-400 border-b border-stone-100 pb-3 tracking-widest text-center">Ledger Split</h5>
                                    <div className="space-y-5">
                                        <div className="flex justify-between text-xs font-medium">
                                            <span className="text-stone-400 uppercase tracking-tighter">Gross Principal</span>
                                            <span className="font-black text-stone-900">रु {selectedOrder.total.toLocaleString()}</span>
                                        </div>
                                        <div className="flex justify-between text-xs font-medium">
                                            <span className="text-stone-400 uppercase tracking-tighter">MCS Commission</span>
                                            <span className="font-black text-red-700">- रु {selectedOrder.commission_amount.toLocaleString()}</span>
                                        </div>
                                        <div className="pt-6 border-t border-stone-100 flex justify-between items-baseline">
                                            <span className="font-playfair font-black text-stone-400 italic text-sm">Disbursable to Studio</span>
                                            <span className="text-3xl font-black text-[#5c1111]">रु {selectedOrder.seller_payable_amount.toLocaleString()}</span>
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="space-y-6">
                                    <div className="flex gap-4">
                                        <div className={`flex-1 p-5 rounded-2xl border text-center ${selectedOrder.customer_payment_status === 'done' ? 'bg-green-50 border-green-100 text-green-700' : 'bg-amber-50 border-amber-100 text-amber-700'}`}>
                                            <p className="text-[9px] font-black uppercase mb-1">Collector</p>
                                            <p className="text-[10px] font-black">{selectedOrder.customer_payment_status === 'done' ? 'SETTLED' : 'AWAITING'}</p>
                                        </div>
                                        <div className={`flex-1 p-5 rounded-2xl border text-center ${selectedOrder.mcs_payment_status === 'done' ? 'bg-blue-50 border-blue-100 text-blue-700' : 'bg-white border-stone-100 text-stone-400'}`}>
                                            <p className="text-[9px] font-black uppercase mb-1">Disbursement</p>
                                            <p className="text-[10px] font-black">{selectedOrder.mcs_payment_status === 'done' ? 'COMPLETED' : 'PENDING'}</p>
                                        </div>
                                    </div>

                                    {currentUser.role === 'admin' && (
                                        <div className="bg-white p-5 rounded-2xl border border-stone-100">
                                            <div className="flex items-center justify-between">
                                                <div className="text-center flex-1">
                                                    <p className="text-[9px] font-black uppercase mb-1">Payment Verification</p>
                                                    <p className={`text-[10px] font-black ${selectedOrder.customer_payment_verified ? 'text-green-700' : 'text-red-700'}`}>
                                                        {selectedOrder.customer_payment_verified ? 'VERIFIED' : 'UNVERIFIED'}
                                                    </p>
                                                </div>
                                                <button
                                                    onClick={() => handleTogglePaymentVerification(selectedOrder.id, !selectedOrder.customer_payment_verified)}
                                                    className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${
                                                        selectedOrder.customer_payment_verified
                                                        ? 'bg-red-600 text-white hover:bg-red-700'
                                                        : 'bg-green-600 text-white hover:bg-green-700'
                                                    }`}
                                                >
                                                    {selectedOrder.customer_payment_verified ? 'Unverify' : 'Verify'}
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {currentUser.role === 'admin' && (
                                        <button 
                                            disabled={!['packing', 'billing', 'delivered'].includes(selectedOrder.status)}
                                            onClick={() => { setInvoiceOrder(selectedOrder); setSelectedOrder(null); }} 
                                            className={`w-full py-6 rounded-[2rem] font-black text-[10px] uppercase tracking-[0.3em] shadow-xl flex items-center justify-center gap-3 transition-all active:scale-95 ${
                                                ['packing', 'billing', 'delivered'].includes(selectedOrder.status)
                                                ? 'bg-[#5c1111] text-white hover:bg-stone-900'
                                                : 'bg-stone-100 text-stone-300 cursor-not-allowed'
                                            }`}
                                        >
                                            <Printer size={18} /> Official Heritage Bill
                                        </button>
                                    )}
                                    
                                    {currentUser.role === 'admin' && selectedOrder.mcs_payment_status === 'pending' && (
                                        <button onClick={() => handleConfirmPayout(selectedOrder.id)} className="w-full bg-stone-900 text-white py-6 rounded-[2rem] font-black text-[10px] uppercase tracking-[0.3em] shadow-lg flex items-center justify-center gap-3 hover:bg-[#5c1111] transition-all">
                                            <Wallet size={18} /> Confirm Studio Payout
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {invoiceOrder && (
                <InvoiceView
                    order={invoiceOrder}
                    onClose={() => {
                        setInvoiceOrder(null);
                        setCombinedOrders([]);
                    }}
                    role={currentUser.role}
                    isCombined={combinedOrders.length > 0}
                    combinedOrders={combinedOrders}
                />
            )}

            {/* Add Product Modal */}
            {showAddProductModal && (
                <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-[#2a2723]/60 p-4 backdrop-blur-md sm:p-6 print:hidden">
                    <div className="relative w-full max-w-6xl max-h-[90vh] overflow-hidden rounded-[1.5rem] border border-white/20 bg-[#f8f6f2] shadow-2xl">
                        <button
                            onClick={() => setShowAddProductModal(false)}
                            className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/80 text-stone-600 shadow-sm transition-all hover:text-red-800 active:scale-90 sm:right-6 sm:top-6"
                            aria-label="Close add product dialog"
                        >
                            <X size={18} />
                        </button>

                        <div className="max-h-[90vh] overflow-y-auto p-4 sm:p-6 lg:p-8">
                            <div className="mb-6 flex flex-col gap-4 border-b border-stone-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-[0.28em] text-[#5c1111]">Product Registry</p>
                                    <h2 className="mt-2 font-playfair text-2xl font-black text-stone-900 sm:text-4xl">
                                        {editingProductId ? 'Edit Artifact' : 'Add New Artifact'}
                                    </h2>
                                </div>

                                <div className="flex items-center gap-3 self-start sm:self-auto">
                                    <button
                                        onClick={() => {
                                            setShowAddProductModal(false);
                                            resetProductForm();
                                        }}
                                        className="rounded-2xl border border-stone-200 bg-white px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.22em] text-stone-600 transition-all hover:border-stone-300 hover:bg-stone-100"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleSaveProduct}
                                        className="rounded-2xl bg-[#5c1111] px-5 py-2.5 text-[10px] font-black uppercase tracking-[0.22em] text-white shadow-lg shadow-[#5c1111]/20 transition-all hover:bg-[#2a2723]"
                                    >
                                        {editingProductId ? 'Save Changes' : 'Publish Product'}
                                    </button>
                                </div>
                            </div>

                            <div className="grid gap-6 xl:grid-cols-[1.7fr_0.9fr]">
                                <div className="space-y-5">
                                    <section className="rounded-[2rem] border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
                                        <div className="mb-4 flex items-center justify-between">
                                            <h3 className="text-[10px] font-black uppercase tracking-[0.22em] text-stone-500">Product Overview</h3>
                                            <span className="rounded-full bg-[#5c1111]/10 px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.2em] text-[#5c1111]">Essential</span>
                                        </div>

                                        <div className="grid gap-4 md:grid-cols-2">
                                            <div className="md:col-span-2">
                                                <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.22em] text-stone-400">Product Name</label>
                                                <input
                                                    type="text"
                                                    value={newProduct.name}
                                                    onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                                                    className="w-full rounded-2xl border border-stone-200 bg-[#f9f7f3] px-4 py-3 text-sm text-stone-800 outline-none transition-all focus:border-[#5c1111] focus:ring-2 focus:ring-[#5c1111]/10"
                                                    placeholder="Enter product name"
                                                />
                                            </div>

                                            <div className="md:col-span-2">
                                                <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.22em] text-stone-400">Categories</label>
                                                <div className="relative">
                                                    <button
                                                        type="button"
                                                        onClick={() => setCategoryMenuOpen((open) => !open)}
                                                        className={`flex w-full items-center justify-between rounded-2xl border bg-[#f9f7f3] px-4 py-3 text-left text-sm transition-all ${categoryMenuOpen ? 'border-[#5c1111] ring-2 ring-[#5c1111]/10' : 'border-stone-200 hover:border-stone-300'}`}
                                                    >
                                                        <span className={newProduct.category ? 'font-semibold text-stone-800' : 'text-stone-400'}>
                                                            {splitProductCategories(newProduct.category).length > 0
                                                                ? `${splitProductCategories(newProduct.category).length} categor${splitProductCategories(newProduct.category).length === 1 ? 'y' : 'ies'} selected`
                                                                : 'Choose categories'}
                                                        </span>
                                                        <ChevronDown size={16} className={`text-stone-400 transition-transform ${categoryMenuOpen ? 'rotate-180' : ''}`} />
                                                    </button>

                                                    {categoryMenuOpen && (
                                                        <div className="absolute left-0 right-0 top-full z-20 mt-2 max-h-64 overflow-y-auto rounded-2xl border border-stone-200 bg-white p-2 shadow-xl">
                                                            <div className="grid gap-1 sm:grid-cols-2">
                                                                {productCategories.map((category) => {
                                                                    const isSelected = splitProductCategories(newProduct.category).includes(category);
                                                                    return (
                                                                        <label key={category} className={`flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-xs transition-colors ${isSelected ? 'bg-[#5c1111]/10 text-[#5c1111]' : 'text-stone-600 hover:bg-stone-50'}`}>
                                                                            <input
                                                                                type="checkbox"
                                                                                checked={isSelected}
                                                                                onChange={() => toggleCategory(category)}
                                                                                className="h-4 w-4 cursor-pointer accent-[#5c1111]"
                                                                            />
                                                                            <span className={isSelected ? 'font-bold' : 'font-medium'}>{category}</span>
                                                                        </label>
                                                                    );
                                                                })}
                                                            </div>
                                                            <button
                                                                type="button"
                                                                onClick={() => setShowNewCategory(true)}
                                                                className="mt-2 flex w-full items-center gap-2 border-t border-stone-100 px-3 py-3 text-left text-[10px] font-black uppercase tracking-[0.2em] text-[#5c1111] transition-colors hover:bg-stone-50"
                                                            >
                                                                <Plus size={13} /> Add new category
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>

                                                {showNewCategory && (
                                                    <div className="mt-2 flex gap-2">
                                                        <input
                                                            type="text"
                                                            value={newCategoryName}
                                                            onChange={(e) => setNewCategoryName(e.target.value)}
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') {
                                                                    e.preventDefault();
                                                                    addNewCategory();
                                                                }
                                                            }}
                                                            className="min-w-0 flex-1 rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm outline-none transition-all focus:border-[#5c1111]"
                                                            placeholder="New category name"
                                                            autoFocus
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={addNewCategory}
                                                            className="rounded-xl bg-[#5c1111] px-3 py-2.5 text-[10px] font-black uppercase tracking-[0.2em] text-white"
                                                        >
                                                            Add
                                                        </button>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="md:col-span-2">
                                                <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.22em] text-stone-400">Description</label>
                                                <textarea
                                                    value={newProduct.description}
                                                    onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })}
                                                    className="h-28 w-full resize-none rounded-2xl border border-stone-200 bg-[#f9f7f3] px-4 py-3 text-sm text-stone-800 outline-none transition-all focus:border-[#5c1111] focus:ring-2 focus:ring-[#5c1111]/10"
                                                    placeholder="Describe your product"
                                                />
                                            </div>
                                        </div>
                                    </section>

                                    <section className="rounded-[2rem] border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
                                        <div className="mb-4 flex items-center justify-between">
                                            <h3 className="text-[10px] font-black uppercase tracking-[0.22em] text-stone-500">Key Features</h3>
                                            <button
                                                type="button"
                                                onClick={addFeatureRow}
                                                className="rounded-xl bg-[#5c1111] px-3 py-2 text-[9px] font-black uppercase tracking-[0.2em] text-white transition-all hover:bg-[#2a2723]"
                                            >
                                                + Add Row
                                            </button>
                                        </div>

                                        <div className="space-y-2 rounded-2xl border border-stone-200 bg-[#f9f7f3] p-3">
                                            {(() => {
                                                const rows = buildFeatureRows(newProduct.key_features);
                                                if (rows.length === 0) {
                                                    rows.push({ feature: '', detail: '' });
                                                }

                                                return rows.map((row, index) => (
                                                    <div key={`feature-row-${index}`} className="grid gap-2 md:grid-cols-[1fr_1.2fr]">
                                                        <input
                                                            type="text"
                                                            value={row.feature}
                                                            onChange={(e) => {
                                                                const currentRows = buildFeatureRows(newProduct.key_features);
                                                                if (currentRows.length === 0) currentRows.push({ feature: '', detail: '' });
                                                                if (index >= currentRows.length) currentRows.push({ feature: '', detail: '' });
                                                                currentRows[index] = { ...currentRows[index], feature: e.target.value };
                                                                setNewProduct({ ...newProduct, key_features: serializeFeatureRows(currentRows) });
                                                            }}
                                                            className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm outline-none transition-all focus:border-[#5c1111] focus:ring-2 focus:ring-[#5c1111]/10"
                                                            placeholder="Feature"
                                                        />
                                                        <div className="flex gap-2">
                                                            <input
                                                                type="text"
                                                                value={row.detail}
                                                                onChange={(e) => {
                                                                    const currentRows = buildFeatureRows(newProduct.key_features);
                                                                    if (currentRows.length === 0) currentRows.push({ feature: '', detail: '' });
                                                                    if (index >= currentRows.length) currentRows.push({ feature: '', detail: '' });
                                                                    currentRows[index] = { ...currentRows[index], detail: e.target.value };
                                                                    setNewProduct({ ...newProduct, key_features: serializeFeatureRows(currentRows) });
                                                                }}
                                                                className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm outline-none transition-all focus:border-[#5c1111] focus:ring-2 focus:ring-[#5c1111]/10"
                                                                placeholder="Detail"
                                                            />
                                                            {buildFeatureRows(newProduct.key_features).length > 1 && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        const currentRows = buildFeatureRows(newProduct.key_features);
                                                                        currentRows.splice(index, 1);
                                                                        setNewProduct({ ...newProduct, key_features: serializeFeatureRows(currentRows) });
                                                                    }}
                                                                    className="rounded-xl border border-red-200 bg-red-50 px-2 text-xs font-bold text-red-700 transition-all hover:bg-red-100"
                                                                    aria-label="Remove key feature row"
                                                                >
                                                                    ×
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                ));
                                            })()}
                                        </div>
                                    </section>

                                    <section className="rounded-[2rem] border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
                                        <div className="mb-4 flex items-center justify-between">
                                            <h3 className="text-[10px] font-black uppercase tracking-[0.22em] text-stone-500">Media & Pricing</h3>
                                            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.2em] text-emerald-700">Live</span>
                                        </div>

                                        <div className="grid gap-4 md:grid-cols-2">
                                            <div className="md:col-span-2">
                                                <div className="mb-2 flex items-center justify-between gap-3">
                                                    <label className="block text-[10px] font-black uppercase tracking-[0.22em] text-stone-400">Product Images</label>
                                                    <label className={`cursor-pointer rounded-xl px-3 py-2 text-[9px] font-black uppercase tracking-[0.2em] transition-all ${uploadingImage ? 'pointer-events-none bg-stone-200 text-stone-400' : 'bg-[#5c1111] text-white hover:bg-[#2a2723]'}`}>
                                                        {uploadingImage ? 'Uploading...' : 'Upload Images'}
                                                        <input type="file" accept="image/*" multiple onChange={handleProductImageUpload} className="hidden" disabled={uploadingImage} />
                                                    </label>
                                                </div>
                                                <input
                                                    type="url"
                                                    value={newProduct.image}
                                                    onChange={(e) => setNewProduct({ ...newProduct, image: e.target.value })}
                                                    className="w-full rounded-2xl border border-stone-200 bg-[#f9f7f3] px-4 py-3 text-sm outline-none transition-all focus:border-[#5c1111] focus:ring-2 focus:ring-[#5c1111]/10"
                                                    placeholder="Primary image URL or paste an image link"
                                                />

                                                {(newProduct.image || newProduct.images?.length > 0) && (
                                                    <div className="mt-3 flex flex-wrap gap-3">
                                                        {[newProduct.image, ...(newProduct.images || [])].filter(Boolean).map((imageUrl, index) => (
                                                            <div key={`${imageUrl}-${index}`} className="group relative">
                                                                <img src={imageUrl} alt={`Product preview ${index + 1}`} className="h-24 w-24 rounded-2xl border border-stone-200 object-cover" />
                                                                {index === 0 && <span className="absolute bottom-1 left-1 rounded bg-[#5c1111] px-1.5 py-0.5 text-[8px] font-bold uppercase text-white">Primary</span>}
                                                                <button type="button" onClick={() => removeProductImage(imageUrl)} className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-white text-stone-500 shadow hover:text-[#5c1111]" aria-label={`Remove image ${index + 1}`}><X size={12} /></button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>

                                            <div>
                                                <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.22em] text-stone-400">Price (रु)</label>
                                                <input
                                                    type="number"
                                                    value={newProduct.price}
                                                    onChange={(e) => setNewProduct({ ...newProduct, price: parseFloat(e.target.value) || 0 })}
                                                    className="w-full rounded-2xl border border-stone-200 bg-[#f9f7f3] px-4 py-3 text-sm outline-none transition-all focus:border-[#5c1111] focus:ring-2 focus:ring-[#5c1111]/10"
                                                    placeholder="0"
                                                />
                                            </div>

                                            <div>
                                                <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.22em] text-stone-400">Advance payment (%)</label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    max="100"
                                                    step="0.01"
                                                    value={newProduct.advance_percentage}
                                                    onChange={(e) => setNewProduct({ ...newProduct, advance_percentage: Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)) })}
                                                    className="w-full rounded-2xl border border-stone-200 bg-[#f9f7f3] px-4 py-3 text-sm outline-none transition-all focus:border-[#5c1111] focus:ring-2 focus:ring-[#5c1111]/10"
                                                    placeholder="0"
                                                />
                                                <p className="mt-1 text-xs text-stone-400">Set 0 to require full payment only.</p>
                                            </div>

                                            <div>
                                                <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.22em] text-stone-400">Compare at Price</label>
                                                <input
                                                    type="number"
                                                    value={newProduct.compare_price}
                                                    onChange={(e) => setNewProduct({ ...newProduct, compare_price: parseFloat(e.target.value) || 0 })}
                                                    className="w-full rounded-2xl border border-stone-200 bg-[#f9f7f3] px-4 py-3 text-sm outline-none transition-all focus:border-[#5c1111] focus:ring-2 focus:ring-[#5c1111]/10"
                                                    placeholder="0"
                                                />
                                            </div>

                                            <div>
                                                <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.22em] text-stone-400">Stock Quantity</label>
                                                <input
                                                    type="number"
                                                    value={newProduct.stock}
                                                    onChange={(e) => setNewProduct({ ...newProduct, stock: parseInt(e.target.value) || 0 })}
                                                    className="w-full rounded-2xl border border-stone-200 bg-[#f9f7f3] px-4 py-3 text-sm outline-none transition-all focus:border-[#5c1111] focus:ring-2 focus:ring-[#5c1111]/10"
                                                    placeholder="0"
                                                />
                                            </div>

                                            <div>
                                                <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.22em] text-stone-400">Product Code</label>
                                                <input
                                                    type="text"
                                                    value={newProduct.product_code}
                                                    onChange={(e) => setNewProduct({ ...newProduct, product_code: e.target.value })}
                                                    className="w-full rounded-2xl border border-stone-200 bg-[#f9f7f3] px-4 py-3 text-sm outline-none transition-all focus:border-[#5c1111] focus:ring-2 focus:ring-[#5c1111]/10"
                                                    placeholder="MCS-ART-102"
                                                />
                                            </div>
                                        </div>
                                    </section>

                                    <section className="rounded-[2rem] border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
                                        <div className="mb-4 flex items-center justify-between">
                                            <h3 className="text-[10px] font-black uppercase tracking-[0.22em] text-stone-500">Details</h3>
                                            <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.2em] text-amber-700">Meta</span>
                                        </div>

                                        <div className="grid gap-4 md:grid-cols-2">
                                            <div>
                                                <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.22em] text-stone-400">Style</label>
                                                <select
                                                    value={newProduct.style}
                                                    onChange={(e) => setNewProduct({ ...newProduct, style: e.target.value })}
                                                    className="w-full rounded-2xl border border-stone-200 bg-[#f9f7f3] px-4 py-3 text-sm outline-none transition-all focus:border-[#5c1111] focus:ring-2 focus:ring-[#5c1111]/10"
                                                >
                                                    <option value="">Choose a style</option>
                                                    <option value="Traditional">Traditional</option>
                                                    <option value="Modern">Modern</option>
                                                    <option value="Folk">Folk</option>
                                                    <option value="Contemporary">Contemporary</option>
                                                    <option value="Minimal">Minimal</option>
                                                </select>
                                            </div>

                                            <div>
                                                <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.22em] text-stone-400">Theme</label>
                                                <select
                                                    value={newProduct.theme}
                                                    onChange={(e) => setNewProduct({ ...newProduct, theme: e.target.value })}
                                                    className="w-full rounded-2xl border border-stone-200 bg-[#f9f7f3] px-4 py-3 text-sm outline-none transition-all focus:border-[#5c1111] focus:ring-2 focus:ring-[#5c1111]/10"
                                                >
                                                    <option value="">Choose a theme</option>
                                                    <option value="Nature">Nature</option>
                                                    <option value="Floral">Floral</option>
                                                    <option value="Birds">Birds</option>
                                                    <option value="Devotional">Devotional</option>
                                                    <option value="Mythology">Mythology</option>
                                                    <option value="Village Life">Village Life</option>
                                                    <option value="Folklore">Folklore</option>
                                                    <option value="Abstract">Abstract</option>
                                                </select>
                                            </div>

                                            <div>
                                                <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.22em] text-stone-400">Material</label>
                                                <input
                                                    type="text"
                                                    value={newProduct.material}
                                                    onChange={(e) => setNewProduct({ ...newProduct, material: e.target.value })}
                                                    className="w-full rounded-2xl border border-stone-200 bg-[#f9f7f3] px-4 py-3 text-sm outline-none transition-all focus:border-[#5c1111] focus:ring-2 focus:ring-[#5c1111]/10"
                                                    placeholder="Canvas, Wood"
                                                />
                                            </div>

                                            <div>
                                                <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.22em] text-stone-400">Dimensions</label>
                                                <input
                                                    type="text"
                                                    value={newProduct.length}
                                                    onChange={(e) => setNewProduct({ ...newProduct, length: e.target.value })}
                                                    className="w-full rounded-2xl border border-stone-200 bg-[#f9f7f3] px-4 py-3 text-sm outline-none transition-all focus:border-[#5c1111] focus:ring-2 focus:ring-[#5c1111]/10"
                                                    placeholder="12x16 inches"
                                                />
                                            </div>

                                            <div>
                                                <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.22em] text-stone-400">Delivery Time</label>
                                                <input
                                                    type="text"
                                                    value={newProduct.delivery}
                                                    onChange={(e) => setNewProduct({ ...newProduct, delivery: e.target.value })}
                                                    className="w-full rounded-2xl border border-stone-200 bg-[#f9f7f3] px-4 py-3 text-sm outline-none transition-all focus:border-[#5c1111] focus:ring-2 focus:ring-[#5c1111]/10"
                                                    placeholder="7-10 days"
                                                />
                                            </div>

                                            <div>
                                                <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.22em] text-stone-400">Location</label>
                                                <input
                                                    type="text"
                                                    value={newProduct.location}
                                                    onChange={(e) => setNewProduct({ ...newProduct, location: e.target.value })}
                                                    className="w-full rounded-2xl border border-stone-200 bg-[#f9f7f3] px-4 py-3 text-sm outline-none transition-all focus:border-[#5c1111] focus:ring-2 focus:ring-[#5c1111]/10"
                                                    placeholder="Janakpur"
                                                />
                                            </div>

                                            <div className="md:col-span-2">
                                                <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.22em] text-stone-400">Care Instructions</label>
                                                <input
                                                    type="text"
                                                    value={newProduct.instruction}
                                                    onChange={(e) => setNewProduct({ ...newProduct, instruction: e.target.value })}
                                                    className="w-full rounded-2xl border border-stone-200 bg-[#f9f7f3] px-4 py-3 text-sm outline-none transition-all focus:border-[#5c1111] focus:ring-2 focus:ring-[#5c1111]/10"
                                                    placeholder="Keep away from direct sunlight"
                                                />
                                            </div>

                                            <div className="md:col-span-2">
                                                <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.22em] text-stone-400">Authenticity</label>
                                                <input
                                                    type="text"
                                                    value={newProduct.authenticity}
                                                    onChange={(e) => setNewProduct({ ...newProduct, authenticity: e.target.value })}
                                                    className="w-full rounded-2xl border border-stone-200 bg-[#f9f7f3] px-4 py-3 text-sm outline-none transition-all focus:border-[#5c1111] focus:ring-2 focus:ring-[#5c1111]/10"
                                                    placeholder="Certified authentic Mithila art"
                                                />
                                            </div>
                                        </div>
                                    </section>
                                </div>

                                <aside className="space-y-5">
                                    <section className="rounded-[2rem] border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
                                        <h3 className="text-[10px] font-black uppercase tracking-[0.22em] text-stone-500">Quick Status</h3>

                                        <div className="mt-4 flex items-center justify-between rounded-2xl border border-stone-200 bg-[#f9f7f3] px-4 py-3">
                                            <div>
                                                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-stone-400">Visibility</p>
                                                <p className="mt-1 text-xs font-semibold text-stone-600">Storefront listing</p>
                                            </div>
                                            <label className="relative inline-flex cursor-pointer items-center">
                                                <input
                                                    type="checkbox"
                                                    checked={Boolean(newProduct.visible_to_users)}
                                                    onChange={(e) => setNewProduct({ ...newProduct, visible_to_users: e.target.checked })}
                                                    className="peer sr-only"
                                                />
                                                <span className="h-6 w-11 rounded-full bg-stone-200 transition peer-checked:bg-[#5c1111]" />
                                                <span className="absolute left-1 top-1 h-4 w-4 rounded-full bg-white transition peer-checked:translate-x-5" />
                                            </label>
                                        </div>

                                        <div className="mt-4 space-y-3">
                                            <div className="rounded-2xl border border-stone-200 bg-[#f9f7f3] p-3">
                                                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-stone-400">Price</p>
                                                <p className="mt-1 text-xl font-black text-stone-900">रु {Number(newProduct.price || 0).toLocaleString()}</p>
                                            </div>
                                            <div className="rounded-2xl border border-stone-200 bg-[#f9f7f3] p-3">
                                                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-stone-400">Stock</p>
                                                <p className="mt-1 text-xl font-black text-stone-900">रु {Number(newProduct.stock || 0).toLocaleString()}</p>
                                            </div>
                                        </div>
                                    </section>

                                    <section className="rounded-[2rem] border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
                                        <h3 className="text-[10px] font-black uppercase tracking-[0.22em] text-stone-500">Catalog Labels</h3>

                                        <div className="mt-4 space-y-3">
                                            <div>
                                                <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.22em] text-stone-400">Custom Tags</label>
                                                <input
                                                    type="text"
                                                    value={newProduct.custom_tags}
                                                    onChange={(e) => setNewProduct({ ...newProduct, custom_tags: e.target.value })}
                                                    className="w-full rounded-2xl border border-stone-200 bg-[#f9f7f3] px-4 py-3 text-sm outline-none transition-all focus:border-[#5c1111] focus:ring-2 focus:ring-[#5c1111]/10"
                                                    placeholder="100% Cotton • Hand Painted"
                                                />
                                            </div>

                                            <div>
                                                <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.22em] text-stone-400">Tags</label>
                                                <input
                                                    type="text"
                                                    value={newProduct.tags}
                                                    onChange={(e) => setNewProduct({ ...newProduct, tags: e.target.value })}
                                                    className="w-full rounded-2xl border border-stone-200 bg-[#f9f7f3] px-4 py-3 text-sm outline-none transition-all focus:border-[#5c1111] focus:ring-2 focus:ring-[#5c1111]/10"
                                                    placeholder="handmade, floral, mithila"
                                                />
                                            </div>
                                        </div>
                                    </section>

                                    <section className="rounded-[2rem] border border-stone-200 bg-[#5c1111] p-4 text-white shadow-lg shadow-[#5c1111]/15 sm:p-5">
                                        <h3 className="text-[10px] font-black uppercase tracking-[0.22em] text-white/80">Checklist</h3>
                                        <div className="mt-4 space-y-3 text-sm text-white/90">
                                            <div className="flex items-center gap-3">
                                                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/20 text-[10px] font-bold">{newProduct.name ? '✓' : '•'}</span>
                                                Product name added
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/20 text-[10px] font-bold">{newProduct.image ? '✓' : '•'}</span>
                                                Product image ready
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/20 text-[10px] font-bold">{newProduct.price > 0 ? '✓' : '•'}</span>
                                                Pricing set
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/20 text-[10px] font-bold">{splitProductCategories(newProduct.category).length > 0 ? '✓' : '•'}</span>
                                                Category assigned
                                            </div>
                                        </div>
                                    </section>
                                </aside>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
