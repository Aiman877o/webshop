/**
 * التطبيق الرئيسي لمتجر 3D (Main Application Controller)
 * إدارة المنتجات، التصنيفات، البحث، السلة، وإضافة المنتجات الجديدة
 */

let productsState = [];
let cartState = [];
let activeCategory = 'all';
let activeSearchQuery = '';
let activeSortBy = 'popular';
let activeCoupon = null;

// قاموس المعاملات وحسومات الكوبونات
const COUPONS = {
  'ARABIC3D': { discount: 0.15, label: 'حسم 15% بمناسبة الافتتاح' },
  'MAKER10': { discount: 0.10, label: 'حسم 10% للتصميمات ثلاثية الأبعاد' }
};

/**
 * ==========================================================================
 * وحدة الأمان وحماية البيانات والوقاية من الاختراق (Security & Anti-XSS Core)
 * ==========================================================================
 */

function escapeHTML(str) {
  if (typeof str !== 'string') return str || '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
    .replace(/javascript:/gi, '')
    .replace(/onerror/gi, '')
    .replace(/onload/gi, '');
}

function sanitizeInput(str, maxLength = 250) {
  if (!str) return '';
  const trimmed = String(str).trim().slice(0, maxLength);
  return escapeHTML(trimmed);
}

document.addEventListener('DOMContentLoaded', async () => {
  // 1. تهيئة قاعدة البيانات السحابية والمحلية IndexedDB
  if (typeof ShopDB !== 'undefined') {
    await ShopDB.init();
    productsState = await getProductsDataAsync();

    // ربط الاستماع الفوري بالتغييرات السحابية (Real-time Sync)
    ShopDB.onCloudProductsUpdated((cloudProducts) => {
      if (cloudProducts && cloudProducts.length > 0) {
        console.log("⚡ تحديث لحظي للمتجر من قاعدة البيانات السحابية");
        productsState = cloudProducts;
        renderCategories();
        renderProducts();
        if (typeof renderImageManagerGrid === 'function') renderImageManagerGrid();
      }
    });
  } else {
    productsState = getProductsData();
  }
  
  loadCartFromStorage();

  // 2. إعداد المستمعين للأحداث
  setupEventListeners();

  // 3. عرض التصنيفات والمنتجات واللغة
  syncLanguageSelectUI();
  renderCategories();
  renderProducts();

  // 4. تحديث مؤشر السلة
  updateCartUI();

  // 5. تهيئة عارض Three.js في رأس الصفحة الرئيسي (Hero Viewer)
  initHero3DViewer();

  // 6. تهيئة حاسبة الطلب المخصص
  if (typeof initCustomOrderForm === 'function') {
    initCustomOrderForm();
  }
});

/**
 * تهيئة العارض ثلاثي الأبعاد المميز في رأس الصفحة الرئيسية (Hero Canvas)
 */
function initHero3DViewer() {
  const container = document.getElementById('hero-3d-canvas');
  if (!container || typeof WebGL3DViewer === 'undefined') return;

  const heroViewer = new WebGL3DViewer(container, {
    meshType: 'vase',
    color: '#C5A059',
    cameraZ: 4.2,
    autoRotate: true
  });

  // إضافة إمكانية التبديل السريع للمجسم المعروض في رأس الصفحة
  const presetButtons = document.querySelectorAll('.hero-preset-btn');
  presetButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      presetButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const mesh = btn.getAttribute('data-mesh');
      const color = btn.getAttribute('data-color') || '#00F0FF';
      heroViewer.options.color = color;
      heroViewer.material.color.set(color);
      heroViewer.buildGeometry(mesh);
    });
  });

  // التحكم باللون من لوحة Hero
  const heroColorPicker = document.getElementById('hero-color-picker');
  if (heroColorPicker) {
    heroColorPicker.addEventListener('input', (e) => {
      heroViewer.setColor(e.target.value);
    });
  }
}

/**
 * إعداد كافة مستمعي الأحداث للبحث والتنقل والناوافذ المنسدلة
 */
function setupEventListeners() {
  // أزرار البحث والتصفية
  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      activeSearchQuery = e.target.value.trim().toLowerCase();
      renderProducts();
    });
  }

  const sortSelect = document.getElementById('sort-select');
  if (sortSelect) {
    sortSelect.addEventListener('change', (e) => {
      activeSortBy = e.target.value;
      renderProducts();
    });
  }

  // فتح وإغلاق السلة الجانبية
  const cartToggleBtn = document.getElementById('cart-toggle-btn');
  const cartDrawer = document.getElementById('cart-drawer');
  const cartCloseBtn = document.getElementById('cart-close-btn');

  if (cartToggleBtn && cartDrawer) {
    cartToggleBtn.addEventListener('click', () => cartDrawer.classList.add('active'));
  }
  if (cartCloseBtn && cartDrawer) {
    cartCloseBtn.addEventListener('click', () => cartDrawer.classList.remove('active'));
  }

  // تطبيق الكوبون في السلة
  const applyCouponBtn = document.getElementById('apply-coupon-btn');
  const couponInput = document.getElementById('coupon-input');
  if (applyCouponBtn && couponInput) {
    applyCouponBtn.addEventListener('click', () => {
      const code = couponInput.value.trim().toUpperCase();
      if (COUPONS[code]) {
        activeCoupon = COUPONS[code];
        showToast(`✅ تم تطبيق الكوبون: ${activeCoupon.label}`, 'success');
        updateCartUI();
      } else {
        showToast('❌ رمز الكوبون غير صحيح', 'error');
      }
    });
  }

  // إتمام الطلب من السلة (Checkout)
  const checkoutBtn = document.getElementById('checkout-btn');
  if (checkoutBtn) {
    checkoutBtn.addEventListener('click', handleCheckout);
  }

  // إغلاق النوافذ عند زر Escape (منع الإغلاق العشوائي عند النقر خارج الإطار لمنع ضياع البيانات)
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (typeof closeAddProductModal === 'function') closeAddProductModal();
      if (typeof closeEditProductModal === 'function') closeEditProductModal();
      if (typeof closeProductModal === 'function') closeProductModal();
      if (typeof closeImageManagerModal === 'function') closeImageManagerModal();
      if (typeof closeEmailContactModal === 'function') closeEmailContactModal();
      if (typeof closeAdminLoginModal === 'function') closeAdminLoginModal();
    }
  });

  // زر العودة السلسة إلى القائمة الرئيسية ورأس الصفحة
  const backToHomeBtn = document.getElementById('back-to-home-btn');
  if (backToHomeBtn) {
    backToHomeBtn.addEventListener('click', (e) => {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // نموذج إضافة وتعديل المنتج
  const addProductForm = document.getElementById('add-product-form');
  if (addProductForm) {
    addProductForm.addEventListener('submit', handleAddNewProduct);
  }

  const editProductForm = document.getElementById('edit-product-form');
  if (editProductForm) {
    editProductForm.addEventListener('submit', handleEditProductSubmit);
  }

  // مستمعات المعاينة الفورية لصورة المنتج عند الرفع أو إدخال الرابط
  const imageFileInput = document.getElementById('new-p-image-file');
  if (imageFileInput) {
    imageFileInput.addEventListener('change', async (e) => {
      const file = e.target.files && e.target.files[0];
      if (file && typeof ShopDB !== 'undefined') {
        const base64 = await ShopDB.processImageFile(file);
        updateLiveImagePreview(base64);
      }
    });
  }

  const imageUrlInput = document.getElementById('new-p-image-url');
  if (imageUrlInput) {
    imageUrlInput.addEventListener('input', (e) => {
      const url = e.target.value.trim();
      if (url) {
        updateLiveImagePreview(url);
      } else {
        clearLiveImagePreview();
      }
    });
  }
}

/**
 * عرض أزرار التصنيفات الأساسية والمخصصة ديناميكياً مع الأيقونات
 */
function renderCategories() {
  const categoriesContainer = document.getElementById('categories-list');
  if (!categoriesContainer) return;

  const categoryMap = new Map();
  categoryMap.set('all', { id: 'all', name: 'الكل', icon: '✨' });

  const presetIcons = {
    'decor': '🎨',
    'مجسمات وديكورات': '🎨',
    'mechanical': '⚙️',
    'قطع ميكانيكية': '⚙️',
    'accessories': '💎',
    'إكسسوارات ومجوهرات': '💎',
    'arabesque': '🏛️',
    'زخارف وعمارة عربية': '🏛️',
    'digital': '💻',
    'ملفات ثلاثية الأبعاد': '💻'
  };

  categoryMap.set('decor', { id: 'decor', name: 'مجسمات وديكورات', icon: '🎨' });
  categoryMap.set('mechanical', { id: 'mechanical', name: 'قطع ميكانيكية', icon: '⚙️' });
  categoryMap.set('accessories', { id: 'accessories', name: 'إكسسوارات ومجوهرات', icon: '💎' });
  categoryMap.set('arabesque', { id: 'arabesque', name: 'زخارف وعمارة عربية', icon: '🏛️' });
  categoryMap.set('digital', { id: 'digital', name: 'ملفات ثلاثية الأبعاد', icon: '💻' });

  // إضافة التصنيفات المخصصة من المنتجات ديناميكياً
  if (Array.isArray(productsState)) {
    productsState.forEach(p => {
      const catName = p.categoryName || p.category;
      if (catName && !categoryMap.has(p.category) && !categoryMap.has(catName)) {
        categoryMap.set(catName, {
          id: catName,
          name: catName,
          icon: presetIcons[catName] || '🏷️'
        });
      }
    });
  }

  const categories = Array.from(categoryMap.values());

  categoriesContainer.innerHTML = categories.map(cat => `
    <button 
      class="category-chip ${cat.id === activeCategory ? 'active' : ''}" 
      onclick="filterCategory('${cat.id}')">
      <span class="text-lg">${cat.icon}</span>
      <span>${cat.name}</span>
    </button>
  `).join('');
}

function filterCategory(catId) {
  activeCategory = catId;
  renderCategories();
  renderProducts();
}

function readImageFileAsBase64(file) {
  return new Promise((resolve) => {
    if (!file) {
      resolve('');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result || '');
    reader.onerror = () => resolve('');
    reader.readAsDataURL(file);
  });
}

/**
 * تصفية وعرض بطاقات المنتجات والصور المرفقة
 */
function renderProducts() {
  const grid = document.getElementById('products-grid');
  const countDisplay = document.getElementById('products-count');
  if (!grid) return;

  // 1. تصفية حسب التصنيف
  let filtered = productsState.filter(p => {
    if (activeCategory !== 'all' && p.category !== activeCategory) return false;
    if (activeSearchQuery) {
      const matchName = p.name.toLowerCase().includes(activeSearchQuery);
      const matchDesc = p.description.toLowerCase().includes(activeSearchQuery);
      const matchTag = p.tags && p.tags.some(t => t.toLowerCase().includes(activeSearchQuery));
      return matchName || matchDesc || matchTag;
    }
    return true;
  });

  // 2. الفرز
  if (activeSortBy === 'price-low') {
    filtered.sort((a, b) => a.price - b.price);
  } else if (activeSortBy === 'price-high') {
    filtered.sort((a, b) => b.price - a.price);
  } else if (activeSortBy === 'rating') {
    filtered.sort((a, b) => b.rating - a.rating);
  }

  if (countDisplay) {
    countDisplay.textContent = `${filtered.length} منتج متوفر`;
  }

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div class="col-span-full text-center py-16 glass-card rounded-2xl">
        <div class="text-5xl mb-4">🔍</div>
        <h3 class="text-xl font-bold text-gray-300">لم نجد منتجات تطابق بحثك</h3>
        <p class="text-gray-400 mt-2 text-sm">جرب البحث بكلمات أخرى أو اختر تصنيفاً مختلفاً</p>
      </div>
    `;
    return;
  }

  const fallbackImg = 'https://images.unsplash.com/photo-1612196808214-b7e239e5f6b7?auto=format&fit=crop&w=800&q=80';

  grid.innerHTML = filtered.map(p => {
    const displayImg = p.imageUrl || fallbackImg;

    const adminButtonsHTML = isAdminLoggedIn ? `
        <!-- أزرار تعديل وحذف المنتج (تظهر فقط للعملاء والمدير عند تسجيل الدخول) -->
        <div class="absolute top-3 left-3 z-20 flex gap-1.5">
          <button 
            onclick="openEditProductModal('${p.id}')" 
            class="w-7 h-7 rounded-full bg-amber-900/80 hover:bg-amber-600 text-white text-xs flex items-center justify-center transition-colors shadow-lg cursor-pointer" 
            title="تعديل بيانات وسعر المنتج">
            ✏️
          </button>
          <button 
            onclick="deleteProductFromStore('${p.id}')" 
            class="w-7 h-7 rounded-full bg-red-900/80 hover:bg-red-600 text-white text-xs flex items-center justify-center transition-colors shadow-lg cursor-pointer" 
            title="حذف المنتج من المتجر">
            🗑️
          </button>
        </div>
    ` : '';

    return `
    <div class="product-card glass-card rounded-2xl overflow-hidden flex flex-col justify-between relative group">
      <div class="product-card-header relative">
        <span class="product-badge badge badge-cyan">${p.badge || p.categoryName}</span>
        
        ${adminButtonsHTML}

        <!-- صورة المنتج المرفوعة والمعروضة بشكل أنيق -->
        <div class="product-image-container relative w-full h-60 overflow-hidden bg-slate-950 flex items-center justify-center">
          <img 
            src="${displayImg}" 
            alt="${p.name}" 
            class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            onerror="this.onerror=null; this.src='${fallbackImg}';"
          >
          <button 
            onclick="openProductModal('${p.id}')" 
            class="btn-inspect-3d absolute bottom-3 left-1/2 -translate-x-1/2 text-xs py-1.5 px-4 shadow-xl" 
            title="معاينة تفاصيل المنتج والصورة الكبيرة">
            🔍 تفاصيل المنتج
          </button>
        </div>
      </div>

      <div class="p-5 flex-1 flex flex-col justify-between">
        <div>
          <div class="flex items-center justify-between text-xs text-gray-400 mb-1">
            <span>${escapeHTML(p.material) || 'PLA +'}</span>
            <span class="text-gold-400 font-bold">★ ${p.rating} (${p.reviewsCount})</span>
          </div>
          <h3 class="text-lg font-bold text-white mb-2 line-clamp-1">${escapeHTML(p.name)}</h3>
          <p class="text-gray-400 text-xs line-clamp-2 mb-4 leading-relaxed">${escapeHTML(p.description)}</p>
        </div>

        <div class="flex items-center justify-between border-t border-glass pt-3 mt-2">
          <div>
            <span class="text-xs text-gray-400 block">السعر</span>
            <span class="text-2xl font-black text-cyan-400">${p.price} <span class="text-xs">€</span></span>
          </div>
          <button 
            onclick="addToCart('${p.id}')" 
            class="btn btn-primary text-sm flex items-center gap-2">
            <span>إضافة للسلة</span>
            <span>🛒</span>
          </button>
        </div>
      </div>
    </div>
  `;
  }).join('');
}

/**
 * فتح النافذة المنبثقة للتفاصيل والصورة الكبيرة للمنتج
 */
function openProductModal(productId) {
  const product = productsState.find(p => p.id === productId);
  if (!product) return;

  const modal = document.getElementById('product-detail-modal');
  if (!modal) return;

  const fallbackImg = 'https://images.unsplash.com/photo-1612196808214-b7e239e5f6b7?auto=format&fit=crop&w=800&q=80';
  
  document.getElementById('modal-product-title').textContent = product.name;
  document.getElementById('modal-product-category').textContent = product.categoryName;
  document.getElementById('modal-product-price').textContent = `${product.price} €`;
  document.getElementById('modal-product-desc').textContent = product.description;
  document.getElementById('modal-product-material').textContent = product.material || 'PLA Silk+';
  
  // استخراج وتفصيل الأبعاد: الطول، العرض، الارتفاع
  let lenStr = '10 سم';
  let widthStr = '10 سم';
  let heightStr = '15 سم';

  if (product.dimensions) {
    const parts = product.dimensions.split('×').map(s => parseFloat(s.trim()));
    if (parts.length >= 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
      lenStr = `${parts[0]} سم`;
      widthStr = `${parts[1]} سم`;
      heightStr = `${parts[2]} سم`;
    } else {
      lenStr = product.dimensions;
    }
  }

  const lenEl = document.getElementById('modal-product-length');
  const widthEl = document.getElementById('modal-product-width');
  const heightEl = document.getElementById('modal-product-height');
  const weightEl = document.getElementById('modal-product-weight');

  if (lenEl) lenEl.textContent = lenStr;
  if (widthEl) widthEl.textContent = widthStr;
  if (heightEl) heightEl.textContent = heightStr;
  if (weightEl) weightEl.textContent = product.weight || '180 غرام';

  const imgElement = document.getElementById('modal-product-img-element');
  if (imgElement) {
    imgElement.src = product.imageUrl || fallbackImg;
    imgElement.onerror = () => { imgElement.src = fallbackImg; };
  }

  modal.classList.add('active');

  // زر الإضافة للسلة وزر التعديل من النافذة
  const addBtn = document.getElementById('modal-add-to-cart-btn');
  if (addBtn) {
    addBtn.onclick = () => {
      addToCart(product.id);
      closeProductModal();
    };
  }

  const editBtn = document.getElementById('modal-edit-product-btn');
  if (editBtn) {
    if (isAdminLoggedIn) {
      editBtn.classList.remove('hidden');
      editBtn.onclick = () => {
        closeProductModal();
        openEditProductModal(product.id);
      };
    } else {
      editBtn.classList.add('hidden');
    }
  }
}

function closeProductModal() {
  const modal = document.getElementById('product-detail-modal');
  if (modal) modal.classList.remove('active');
}

/**
 * إضافة وإدارة المنتجات في السلة
 */
function addToCart(productId) {
  const product = productsState.find(p => p.id === productId);
  if (!product) return;

  const existing = cartState.find(item => item.id === productId);
  if (existing) {
    existing.quantity += 1;
  } else {
    cartState.push({
      id: product.id,
      name: product.name,
      price: product.price,
      meshType: product.meshType,
      color: product.defaultColor,
      quantity: 1
    });
  }

  saveCartToStorage();
  updateCartUI();
  showToast(`🛒 تم إضافة "${product.name}" إلى السلة!`, 'success');
}

function updateCartQuantity(productId, delta) {
  const item = cartState.find(i => i.id === productId);
  if (!item) return;

  item.quantity += delta;
  if (item.quantity <= 0) {
    cartState = cartState.filter(i => i.id !== productId);
  }

  saveCartToStorage();
  updateCartUI();
}

function removeFromCart(productId) {
  cartState = cartState.filter(i => i.id !== productId);
  saveCartToStorage();
  updateCartUI();
  showToast('تم إزالة المنتج من السلة', 'info');
}

function updateCartUI() {
  const badge = document.getElementById('cart-count-badge');
  const itemsContainer = document.getElementById('cart-items-container');
  const subtotalDisplay = document.getElementById('cart-subtotal');
  const discountDisplay = document.getElementById('cart-discount');
  const totalDisplay = document.getElementById('cart-total');

  const totalItemsCount = cartState.reduce((sum, item) => sum + item.quantity, 0);
  if (badge) {
    badge.textContent = totalItemsCount;
    badge.style.display = totalItemsCount > 0 ? 'inline-flex' : 'none';
  }

  if (!itemsContainer) return;

  if (cartState.length === 0) {
    itemsContainer.innerHTML = `
      <div class="text-center py-12 text-gray-400">
        <div class="text-4xl mb-3">🛒</div>
        <p class="font-bold text-white mb-1">سلتك فارغة حالياً</p>
        <p class="text-xs">استكشف المنتجات وأضف ما يعجبك!</p>
      </div>
    `;
    if (subtotalDisplay) subtotalDisplay.textContent = '0 €';
    if (discountDisplay) discountDisplay.textContent = '0 €';
    if (totalDisplay) totalDisplay.textContent = '0 €';
    return;
  }

  const subtotal = cartState.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  let discountAmount = 0;
  if (activeCoupon) {
    discountAmount = Math.round(subtotal * activeCoupon.discount);
  }
  const finalTotal = Math.max(0, subtotal - discountAmount);

  itemsContainer.innerHTML = cartState.map(item => `
    <div class="cart-item flex items-center justify-between gap-3 p-3 glass-card rounded-xl">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-lg bg-gray-800 flex items-center justify-center text-cyan-400 border border-glass">
          🎲
        </div>
        <div>
          <h4 class="font-bold text-sm text-white line-clamp-1">${item.name}</h4>
          <span class="text-cyan-400 font-bold text-xs">${item.price} €</span>
        </div>
      </div>

      <div class="flex items-center gap-2">
        <button onclick="updateCartQuantity('${item.id}', -1)" class="cart-qty-btn">-</button>
        <span class="text-sm font-bold w-4 text-center">${item.quantity}</span>
        <button onclick="updateCartQuantity('${item.id}', 1)" class="cart-qty-btn">+</button>
        <button onclick="removeFromCart('${item.id}')" class="text-red-400 hover:text-red-300 ml-2 text-xs">🗑️</button>
      </div>
    </div>
  `).join('');

  if (subtotalDisplay) subtotalDisplay.textContent = `${subtotal} €`;
  if (discountDisplay) discountDisplay.textContent = `-${discountAmount} €`;
  if (totalDisplay) totalDisplay.textContent = `${finalTotal} €`;
}

function saveCartToStorage() {
  localStorage.setItem('arabic_3d_webshop_cart', JSON.stringify(cartState));
}

function loadCartFromStorage() {
  const saved = localStorage.getItem('arabic_3d_webshop_cart');
  if (saved) {
    try {
      cartState = JSON.parse(saved);
    } catch (e) {}
  }
}

/**
 * معالجة إتمام الدفع (Checkout)
 */
function handleCheckout() {
  openCustomerCheckoutModal();
}

function openCustomerCheckoutModal() {
  if (cartState.length === 0) {
    showToast('❌ سلة التسوق فارغة!', 'error');
    return;
  }

  const subtotal = cartState.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  let discountAmount = 0;
  if (activeCoupon) {
    discountAmount = Math.round(subtotal * activeCoupon.discount);
  }
  const finalTotal = Math.max(0, subtotal - discountAmount);
  const totalCount = cartState.reduce((sum, item) => sum + item.quantity, 0);

  const countEl = document.getElementById('checkout-summary-count');
  const totalEl = document.getElementById('checkout-summary-total');

  if (countEl) countEl.textContent = `${totalCount} قطعة`;
  if (totalEl) totalEl.textContent = `${finalTotal} €`;

  const modal = document.getElementById('customer-checkout-modal');
  if (modal) modal.classList.add('active');
}

function closeCustomerCheckoutModal() {
  const modal = document.getElementById('customer-checkout-modal');
  if (modal) modal.classList.remove('active');
}

async function handleCustomerCheckoutSubmit(e) {
  if (e && e.preventDefault) e.preventDefault();

  if (cartState.length === 0) {
    showToast('⚠️ لا يوجد منتجات في السلة حالياً!', 'warning');
    closeCustomerCheckoutModal();
    return;
  }

  const name = document.getElementById('customer-name')?.value.trim() || 'عميل';
  const phone = document.getElementById('customer-phone')?.value.trim() || '';
  const address = document.getElementById('customer-address')?.value.trim() || '';
  const notes = document.getElementById('customer-notes')?.value.trim() || 'لا يوجد';

  const receiptId = 'REC-' + Math.floor(100000 + Math.random() * 900000);
  const subtotal = cartState.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  let discountAmount = 0;
  if (activeCoupon) {
    discountAmount = Math.round(subtotal * activeCoupon.discount);
  }
  const finalTotal = Math.max(0, subtotal - discountAmount);

  const fallbackImg = 'https://images.unsplash.com/photo-1612196808214-b7e239e5f6b7?auto=format&fit=crop&w=800&q=80';

  const itemsListText = cartState.map((i, idx) => {
    const imgUrl = i.imageUrl || fallbackImg;
    return `  ${idx + 1}. ${i.name}
     - الكمية (Aantal): ${i.quantity} قطعة
     - السعر الإجمالي (Prijs): ${i.price * i.quantity} €
     - الخامة (Materiaal): ${i.material || 'PLA Silk+'}
     - الأبعاد (Afmetingen): ${i.dimensions || '10 × 10 × 15 سم'}
     - الوزن (Gewicht): ${i.weight || '180 غرام'}
     - صورة المنتج 🖼️: ${imgUrl}`;
  }).join('\n\n---------------------------------------\n');

  const fullOrderBody = 
`📌 طلب شراء جديد رقم: ${receiptId}
📅 التاريخ والوقت: ${new Date().toLocaleString('ar-SA')}

👤 بيانات العميل للتوصيل (Klantgegevens):
---------------------------------------
الاسم (Naam): ${name}
الهاتف / الواتساب (Telefoon): ${phone}
العنوان والمدينة (Adres): ${address}
الملاحظات (Opmerkingen): ${notes}
---------------------------------------

🛒 المنتجات المطلوبة وتفاصيل الصور (Bestelde Producten & Foto's):
---------------------------------------
${itemsListText}
---------------------------------------

💰 المجموع الفرعي (Subtotaal): ${subtotal} €
${discountAmount > 0 ? `🏷️ الخصم المطبق (Korting): -${discountAmount} €\n` : ''}💵 الإجمالي النهائي المطلوب (Totaal): ${finalTotal} €`;

  // بناء التنسيق البصري لقالب الإيميل بالإميج المباشر (Visual HTML Email Template)
  const fullOrderHTML = `
  <div style="font-family: Arial, sans-serif; direction: rtl; text-align: right; background-color: #0f172a; color: #f8fafc; padding: 25px; border-radius: 16px; border: 1px solid #1e293b;">
    <h2 style="color: #00F0FF; margin-top: 0;">📌 طلب شراء جديد رقم: ${receiptId}</h2>
    <p style="color: #94a3b8; font-size: 13px;">📅 التاريخ والوقت: ${new Date().toLocaleString('ar-SA')}</p>

    <div style="background: #1e293b; padding: 15px; border-radius: 12px; margin-bottom: 20px; border: 1px solid #334155;">
      <h3 style="color: #F43F5E; margin-top: 0;">👤 بيانات العميل للتوصيل:</h3>
      <p style="margin: 5px 0;"><strong>الاسم (Naam):</strong> ${name}</p>
      <p style="margin: 5px 0;"><strong>رقم الهاتف (Telefoon):</strong> <span dir="ltr">${phone}</span></p>
      <p style="margin: 5px 0;"><strong>العنوان والمدينة (Adres):</strong> ${address}</p>
      <p style="margin: 5px 0;"><strong>الملاحظات (Opmerkingen):</strong> ${notes}</p>
    </div>

    <h3 style="color: #00F0FF;">🛒 المنتجات المطلوبة وصورها الحقيقية:</h3>
    ${cartState.map((i, idx) => `
      <div style="background: #090d16; padding: 15px; border-radius: 12px; margin-bottom: 15px; border: 1px solid #334155;">
        <div style="margin-bottom: 10px;">
          <img src="${i.imageUrl || fallbackImg}" alt="${i.name}" width="220" style="width: 220px; max-width: 100%; height: auto; border-radius: 12px; border: 2px solid #00F0FF; display: block;" />
        </div>
        <div>
          <h4 style="margin: 5px 0; color: #ffffff; font-size: 16px;">${idx + 1}. ${i.name}</h4>
          <p style="margin: 4px 0; color: #00F0FF; font-weight: bold;">الكمية: ${i.quantity} قطعة | السعر: ${i.price * i.quantity} €</p>
          <p style="margin: 4px 0; color: #cbd5e1; font-size: 13px;">الخامة: ${i.material || 'PLA Silk+'}</p>
          <p style="margin: 4px 0; color: #cbd5e1; font-size: 13px;">الأبعاد: ${i.dimensions || '10 × 10 × 15 سم'}</p>
          <p style="margin: 4px 0; color: #cbd5e1; font-size: 13px;">الوزن: ${i.weight || '180 غرام'}</p>
        </div>
      </div>
    `).join('')}

    <div style="border-top: 2px solid #334155; padding-top: 15px; margin-top: 20px;">
      <p style="margin: 5px 0;">المجموع الفرعي: <strong>${subtotal} €</strong></p>
      ${discountAmount > 0 ? `<p style="margin: 5px 0; color: #4ade80;">الخصم: <strong>-${discountAmount} €</strong></p>` : ''}
      <h3 style="color: #00F0FF; font-size: 22px; margin-top: 10px;">💵 الإجمالي النهائي المطلوب: ${finalTotal} €</h3>
    </div>
  </div>
  `;

  const targetAdminEmail = 'Alstv3000@gmail.com';
  const subjectText = `🚀 طلب جديد [${receiptId}] - العميل: ${name} (${finalTotal} €)`;

  showToast('⏳ جاري إرسال الطلب إلى Alstv3000@gmail.com...', 'info');

  const endpoint = getFormspreeEndpoint();
  const formData = new FormData();
  formData.append('name', name);
  formData.append('phone', phone);
  formData.append('address', address);
  formData.append('notes', notes);
  formData.append('receipt_id', receiptId);
  formData.append('total_price', `${finalTotal} €`);
  formData.append('message', fullOrderBody);

  let isSent = false;
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      body: formData,
      headers: {
        'Accept': 'application/json'
      }
    });

    if (response.ok) {
      isSent = true;
      showToast('🚀 تم إرسال الطلب بنجاح ومباشرة إلى Alstv3000@gmail.com!', 'success');
    } else {
      console.warn("Formspree response not OK:", response.status);
    }
  } catch (err) {
    console.warn("Formspree fetch error:", err);
  }

  // إذا لم يتم الإرسال عبر Formspree (مثلاً عدم تفعيل الحساب)، يتم تشغيل التوجيه المباشر لتطبيق البريد كخطة احتياطية
  if (!isSent) {
    const mailtoUrl = `mailto:${targetAdminEmail}?subject=${encodeURIComponent(subjectText)}&body=${encodeURIComponent(fullOrderBody)}`;
    const link = document.createElement('a');
    link.href = mailtoUrl;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    setTimeout(() => link.remove(), 500);
  }

  // تنظيف السلة وإغلاق القوائم
  cartState = [];
  saveCartToStorage();
  updateCartUI();
  closeCustomerCheckoutModal();

  const drawer = document.getElementById('cart-drawer');
  if (drawer) drawer.classList.remove('active');

  // إظهار نافذة شكر مؤكدة للعميل مع رقم الطلب
  showOrderSuccessConfirmationModal(receiptId, name, phone, address, finalTotal);
}

function showOrderSuccessConfirmationModal(receiptId, name, phone, address, total) {
  const modal = document.createElement('div');
  modal.className = 'modal-backdrop active';
  modal.innerHTML = `
    <div class="modal-content glass-card p-6 md:p-8 rounded-3xl max-w-md mx-auto text-center border border-cyan-400/40">
      <div class="text-5xl mb-3">🎉</div>
      <h3 class="text-2xl font-black text-white mb-1">تم استلام طلبك بنجاح!</h3>
      <p class="text-xs text-gray-300 mb-4">شكراً لك يا <strong class="text-cyan-400">${name}</strong>، تم تسجيل طلبك وإرساله للإدارة بنجاح.</p>

      <div class="bg-slate-950/80 p-4 rounded-2xl border border-glass space-y-2 text-right text-xs text-gray-300 mb-6">
        <div class="flex justify-between border-b border-glass/30 pb-1.5">
          <span class="text-gray-400">رقم الفاتورة والطلب:</span>
          <span class="font-mono font-bold text-amber-400">${receiptId}</span>
        </div>
        <div class="flex justify-between border-b border-glass/30 pb-1.5">
          <span class="text-gray-400">رقم الهاتف:</span>
          <span class="font-mono font-bold text-white">${phone}</span>
        </div>
        <div class="flex justify-between border-b border-glass/30 pb-1.5">
          <span class="text-gray-400">العنوان:</span>
          <span class="font-bold text-white line-clamp-1">${address}</span>
        </div>
        <div class="flex justify-between pt-1">
          <span class="text-gray-400 font-bold">الإجمالي:</span>
          <span class="font-black text-cyan-400 text-sm">${total} €</span>
        </div>
      </div>

      <button onclick="this.closest('.modal-backdrop').remove()" class="btn btn-primary w-full py-3 text-sm font-bold">
        👍 تم، حسناً
      </button>
    </div>
  `;
  document.body.appendChild(modal);
}

function confirmOrder(receiptId, mode = 'direct') {
  const targetAdminEmail = 'Alstv3000@gmail.com';

  if (cartState.length === 0) {
    showToast('⚠️ لا يوجد منتجات في السلة حالياً!', 'warning');
    return;
  }

  const subtotal = cartState.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  let discountAmount = 0;
  if (activeCoupon) {
    discountAmount = Math.round(subtotal * activeCoupon.discount);
  }
  const finalTotal = Math.max(0, subtotal - discountAmount);

  const itemsListText = cartState.map((i, idx) => 
    `  ${idx + 1}. ${i.name} (الكمية: ${i.quantity}) - السعر: ${i.price * i.quantity} €`
  ).join('\n');

  const fullEmailBody = 
`📌 طلب شراء جديد رقم: ${receiptId}
📅 التاريخ والوقت: ${new Date().toLocaleString('ar-SA')}

🛒 المنتجات والقطع المطلوبة:
---------------------------------------
${itemsListText}
---------------------------------------

💰 المجموع الفرعي: ${subtotal} €
${discountAmount > 0 ? `🏷️ الخصم المطبق: -${discountAmount} €\n` : ''}💵 الإجمالي النهائي المطلوب: ${finalTotal} €

يرجى متابعة الطلب والتواصل مع العميل لإتمام عملية التسليم والشحن.`;

  const subjectText = `🚀 طلب شراء جديد [${receiptId}] - إجمالي ${finalTotal} €`;

  // محاولة الإرسال الآلي التلقائي عبر خادم Formspree إذا كان الرابط متاحاً
  const endpoint = getFormspreeEndpoint();
  if (endpoint && mode !== 'copy') {
    fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        _replyto: targetAdminEmail,
        email: targetAdminEmail,
        receiptId: receiptId,
        subject: subjectText,
        orderDetails: itemsListText,
        subtotal: `${subtotal} €`,
        discount: `${discountAmount} €`,
        finalTotal: `${finalTotal} €`,
        message: fullEmailBody
      })
    }).then(res => {
      if (res.ok) {
        showToast('🚀 تم إرسال الطلب آلياً إلى Alstv3000@gmail.com بنجاح عبر خادم الإرسال!', 'success');
      }
    }).catch(err => console.warn('Formspree submission error:', err));
  }

  if (mode === 'copy') {
    navigator.clipboard.writeText(fullEmailBody).then(() => {
      showToast(`📋 تم نسخ تفاصيل الطلب والفاتورة إلى الحافظة بنجاح!`, 'success');
    }).catch(() => {
      showToast(`📌 رقم الطلب: ${receiptId} - الإجمالي: ${finalTotal} €`, 'info');
    });
    return;
  }

  if (mode === 'web') {
    const webGmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${targetAdminEmail}&su=${encodeURIComponent(subjectText)}&body=${encodeURIComponent(fullEmailBody)}`;
    window.open(webGmailUrl, '_blank');
  } else {
    const mailtoUrl = `mailto:${targetAdminEmail}?subject=${encodeURIComponent(subjectText)}&body=${encodeURIComponent(fullEmailBody)}`;
    const link = document.createElement('a');
    link.href = mailtoUrl;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    setTimeout(() => link.remove(), 500);
  }

  // تنظيف السلة وتحديث الواجهة
  cartState = [];
  saveCartToStorage();
  updateCartUI();

  const modals = document.querySelectorAll('.modal-backdrop');
  modals.forEach(m => m.remove());

  const drawer = document.getElementById('cart-drawer');
  if (drawer) drawer.classList.remove('active');

  showToast(`📧 تم توجيه وإرسال تفاصيل الطلب إلى Alstv3000@gmail.com بنجاح!`, 'success');
}

/**
 * إضافة منتج جديد (Add Product Modal Handler)
 */
async function handleAddNewProduct(e) {
  if (e && e.preventDefault) e.preventDefault();

  const nameInput = document.getElementById('new-p-name');
  const categoryInput = document.getElementById('new-p-category');
  const priceInput = document.getElementById('new-p-price');
  const meshInput = document.getElementById('new-p-mesh');
  const colorInput = document.getElementById('new-p-color');
  const descInput = document.getElementById('new-p-desc');
  const materialInput = document.getElementById('new-p-material');
  const imageFileInput = document.getElementById('new-p-image-file');
  const imageUrlInput = document.getElementById('new-p-image-url');

  const lenInput = document.getElementById('new-p-length');
  const widthInput = document.getElementById('new-p-width');
  const heightInput = document.getElementById('new-p-height');
  const weightInput = document.getElementById('new-p-weight');

  const name = nameInput ? sanitizeInput(nameInput.value, 100) : '';
  const category = categoryInput ? sanitizeInput(categoryInput.value, 50) : 'decor';
  const price = priceInput ? Math.max(0.01, Math.min(100000, parseFloat(priceInput.value) || 1)) : 1;
  const meshType = meshInput ? meshInput.value : 'vase';
  const defaultColor = colorInput ? colorInput.value : '#C5A059';
  const description = descInput ? sanitizeInput(descInput.value, 600) : '';
  const material = (materialInput && materialInput.value.trim()) ? sanitizeInput(materialInput.value, 50) : 'PLA +';

  const lenVal = lenInput && parseFloat(lenInput.value) > 0 ? parseFloat(lenInput.value) : 10;
  const widthVal = widthInput && parseFloat(widthInput.value) > 0 ? parseFloat(widthInput.value) : 10;
  const heightVal = heightInput && parseFloat(heightInput.value) > 0 ? parseFloat(heightInput.value) : 15;
  const weightVal = weightInput && parseFloat(weightInput.value) > 0 ? parseFloat(weightInput.value) : 180;

  const dimsStr = `${lenVal} × ${widthVal} × ${heightVal} سم`;
  const weightStr = `${weightVal} غرام`;

  let imageUrl = imageUrlInput ? imageUrlInput.value.trim() : '';

  if (imageFileInput && imageFileInput.files && imageFileInput.files[0]) {
    try {
      const base64Data = await readImageFileAsBase64(imageFileInput.files[0]);
      if (base64Data) {
        imageUrl = base64Data;
      }
    } catch (err) {
      console.error("خطأ في معالجة صورة المنتج:", err);
    }
  }

  if (!imageUrl) {
    imageUrl = 'https://images.unsplash.com/photo-1612196808214-b7e239e5f6b7?auto=format&fit=crop&w=800&q=80';
  }

  const categoryNamesMap = {
    'decor': 'مجسمات وديكورات',
    'mechanical': 'قطع ميكانيكية',
    'accessories': 'إكسسوارات ومجوهرات',
    'arabesque': 'زخارف وعمارة عربية',
    'digital': 'ملفات ثلاثية الأبعاد'
  };

  const rawCategory = categoryInput ? categoryInput.value.trim() : 'مجسمات وديكورات';
  const categoryName = categoryNamesMap[rawCategory] || rawCategory || 'عام';

  const newProduct = {
    id: 'p_' + Date.now(),
    name: name || 'منتج 3D جديد',
    category: rawCategory,
    categoryName: categoryName,
    price: price,
    rating: 5.0,
    reviewsCount: 1,
    meshType: meshType,
    defaultColor: defaultColor,
    imageUrl: imageUrl,
    material: material,
    dimensions: dimsStr,
    weight: weightStr,
    description: description || 'وصف منتج ثلاثي الأبعاد جديد',
    isFeatured: false,
    badge: 'جديد مضاف',
    tags: ['جديد', rawCategory]
  };

  productsState.unshift(newProduct);

  // إغلاق النافذة وتنظيف النموذج فوراً
  closeAddProductModal();

  try {
    if (typeof saveProductToDB === 'function') {
      await saveProductToDB(newProduct);
    }
    if (typeof saveProductsData === 'function') {
      saveProductsData(productsState);
    }
  } catch (err) {
    console.error("خطأ عند حفظ المنتج في قاعدة البيانات:", err);
  }

  renderCategories();
  renderProducts();
  if (typeof renderImageManagerGrid === 'function') {
    renderImageManagerGrid();
  }

  showToast(`✨ تم حفظ ونشر المنتج الجديد "${newProduct.name}" وتصنيفه "${categoryName}" بنجاح!`, 'success');
}

function openAddProductModal() {
  const modal = document.getElementById('add-product-modal');
  if (modal) modal.classList.add('active');
}

function closeAddProductModal() {
  const modal = document.getElementById('add-product-modal');
  if (modal) modal.classList.remove('active');
  const form = document.getElementById('add-product-form');
  if (form) form.reset();
  if (typeof clearLiveImagePreview === 'function') clearLiveImagePreview();
}

/**
 * فتح وتعبئة نموذج تعديل المنتج (Edit Product Modal)
 */
function openEditProductModal(productId) {
  const product = productsState.find(p => p.id === productId);
  if (!product) return;

  const idEl = document.getElementById('edit-p-id');
  const nameEl = document.getElementById('edit-p-name');
  const catEl = document.getElementById('edit-p-category');
  const priceEl = document.getElementById('edit-p-price');
  const meshEl = document.getElementById('edit-p-mesh');
  const colorEl = document.getElementById('edit-p-color');
  const matEl = document.getElementById('edit-p-material');
  const urlEl = document.getElementById('edit-p-image-url');
  const descEl = document.getElementById('edit-p-desc');
  const lenEl = document.getElementById('edit-p-length');
  const widthEl = document.getElementById('edit-p-width');
  const heightEl = document.getElementById('edit-p-height');
  const weightEl = document.getElementById('edit-p-weight');

  if (idEl) idEl.value = product.id;
  if (nameEl) nameEl.value = product.name || '';
  if (catEl) catEl.value = product.categoryName || product.category || 'مجسمات وديكورات';
  if (priceEl) priceEl.value = product.price || 1;
  if (meshEl) meshEl.value = product.meshType || 'vase';
  if (colorEl) colorEl.value = product.defaultColor || '#C5A059';
  if (matEl) matEl.value = product.material || '';
  if (urlEl) urlEl.value = product.imageUrl || '';
  if (descEl) descEl.value = product.description || '';

  if (product.dimensions) {
    const parts = product.dimensions.split('×').map(s => parseFloat(s.trim()));
    if (lenEl && !isNaN(parts[0])) lenEl.value = parts[0];
    if (widthEl && !isNaN(parts[1])) widthEl.value = parts[1];
    if (heightEl && !isNaN(parts[2])) heightEl.value = parts[2];
  }

  if (product.weight && weightEl) {
    const wtNum = parseFloat(product.weight);
    if (!isNaN(wtNum)) weightEl.value = wtNum;
  }

  const modal = document.getElementById('edit-product-modal');
  if (modal) modal.classList.add('active');
}

function closeEditProductModal() {
  const modal = document.getElementById('edit-product-modal');
  if (modal) modal.classList.remove('active');
}

/**
 * حفظ التعديلات على المنتج في المتجر وقاعدة البيانات IndexedDB
 */
async function handleEditProductSubmit(e) {
  if (e && e.preventDefault) e.preventDefault();

  const productId = document.getElementById('edit-p-id')?.value;
  const product = productsState.find(p => p.id === productId);
  if (!product) {
    closeEditProductModal();
    return;
  }

  const name = document.getElementById('edit-p-name')?.value.trim() || product.name;
  const rawCategory = document.getElementById('edit-p-category')?.value.trim() || product.categoryName || product.category;
  const price = parseFloat(document.getElementById('edit-p-price')?.value) || product.price;
  const meshType = document.getElementById('edit-p-mesh')?.value || product.meshType;
  const defaultColor = document.getElementById('edit-p-color')?.value || product.defaultColor;
  const material = document.getElementById('edit-p-material')?.value.trim() || product.material;
  const description = document.getElementById('edit-p-desc')?.value.trim() || product.description;
  const imageFileInput = document.getElementById('edit-p-image-file');
  const imageUrlInput = document.getElementById('edit-p-image-url');

  let imageUrl = imageUrlInput && imageUrlInput.value.trim() !== '' ? imageUrlInput.value.trim() : product.imageUrl;

  if (imageFileInput && imageFileInput.files && imageFileInput.files[0]) {
    try {
      const base64Data = await readImageFileAsBase64(imageFileInput.files[0]);
      if (base64Data) {
        imageUrl = base64Data;
      }
    } catch (err) {}
  }

  const categoryNamesMap = {
    'decor': 'مجسمات وديكورات',
    'mechanical': 'قطع ميكانيكية',
    'accessories': 'إكسسوارات ومجوهرات',
    'arabesque': 'زخارف وعمارة عربية',
    'digital': 'ملفات ثلاثية الأبعاد'
  };

  const lenEl = document.getElementById('edit-p-length');
  const widthEl = document.getElementById('edit-p-width');
  const heightEl = document.getElementById('edit-p-height');
  const weightEl = document.getElementById('edit-p-weight');

  const lenVal = lenEl && parseFloat(lenEl.value) > 0 ? parseFloat(lenEl.value) : 10;
  const widthVal = widthEl && parseFloat(widthEl.value) > 0 ? parseFloat(widthEl.value) : 10;
  const heightVal = heightEl && parseFloat(heightEl.value) > 0 ? parseFloat(heightEl.value) : 15;
  const weightVal = weightEl && parseFloat(weightEl.value) > 0 ? parseFloat(weightEl.value) : 180;

  const finalCategoryName = categoryNamesMap[rawCategory] || rawCategory || 'عام';

  product.name = name;
  product.category = rawCategory;
  product.categoryName = finalCategoryName;
  product.price = price;
  product.meshType = meshType;
  product.defaultColor = defaultColor;
  product.material = material;
  product.dimensions = `${lenVal} × ${widthVal} × ${heightVal} سم`;
  product.weight = `${weightVal} غرام`;
  product.description = description;
  product.imageUrl = imageUrl;

  // إغلاق النافذة المنبثقة فوراً
  closeEditProductModal();

  try {
    if (typeof saveProductToDB === 'function') {
      await saveProductToDB(product);
    }
    if (typeof saveProductsData === 'function') {
      saveProductsData(productsState);
    }
  } catch (err) {
    console.error("خطأ عند تعديل المنتج:", err);
  }

  renderCategories();
  renderProducts();
  if (typeof renderImageManagerGrid === 'function') {
    renderImageManagerGrid();
  }

  showToast(`💾 تم حفظ التعديلات وتصنيف المنتج "${name}" بنجاح!`, 'success');
}

/**
 * حذف منتج من المتجر وقاعدة البيانات IndexedDB
 */
async function deleteProductFromStore(productId) {
  const product = productsState.find(p => p.id === productId);
  if (!product) return;

  if (!confirm(`هل أنت تأكد من رغبتك في حذف المنتج "${product.name}" من المتجر وقاعدة البيانات؟`)) {
    return;
  }

  productsState = productsState.filter(p => p.id !== productId);
  saveProductsData(productsState);

  if (typeof ShopDB !== 'undefined') {
    await ShopDB.deleteProduct(productId);
  }

  renderProducts();
  showToast(`🗑️ تم حذف المنتج "${product.name}" بنجاح`, 'info');
}

/**
 * نظام التنبيهات المنبثقة (Toast Notification System)
 */
function showToast(message, type = 'info') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'fixed bottom-5 right-5 z-50 flex flex-col gap-2 pointer-events-none';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type} glass-card p-4 rounded-xl shadow-2xl flex items-center gap-3 text-white text-sm animate-slide-in pointer-events-auto`;
  toast.innerHTML = `
    <span>${message}</span>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('opacity-0', 'transition-opacity', 'duration-300');
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

/**
 * ==========================================================================
 * وحدة لوحة التحكم بجميع الصور والإعلام (Image Control Center & Gallery Dashboard)
 * ==========================================================================
 */

function openImageManagerModal() {
  const modal = document.getElementById('image-manager-modal');
  if (!modal) return;
  modal.classList.add('active');
  renderImageManagerGrid();
}

function closeImageManagerModal() {
  const modal = document.getElementById('image-manager-modal');
  if (modal) modal.classList.remove('active');
}

function renderImageManagerGrid() {
  const grid = document.getElementById('image-manager-grid');
  const searchInput = document.getElementById('image-search-input');
  if (!grid) return;

  const query = searchInput ? searchInput.value.trim().toLowerCase() : '';
  const fallbackImg = 'https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?auto=format&fit=crop&w=600&q=80';

  let items = productsState.filter(p => {
    if (!query) return true;
    return p.name.toLowerCase().includes(query) || p.categoryName.toLowerCase().includes(query);
  });

  if (items.length === 0) {
    grid.innerHTML = `
      <div class="col-span-full text-center py-10 text-gray-400">
        <div class="text-3xl mb-2">🖼️</div>
        <p class="text-sm">لم يتم العثور على صور مطابقة للبحث</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = items.map(p => `
    <div class="glass-card rounded-xl p-3 flex flex-col justify-between border border-glass bg-slate-900/70 relative">
      <div>
        <div class="w-full h-36 rounded-lg overflow-hidden mb-2 relative bg-black/40">
          <img 
            src="${p.imageUrl || fallbackImg}" 
            alt="${p.name}" 
            class="w-full h-full object-cover"
            onerror="this.onerror=null; this.src='${fallbackImg}';"
          >
          <span class="absolute top-2 right-2 badge badge-cyan text-[10px] py-0.5 px-2">${p.categoryName}</span>
        </div>

        <h4 class="font-bold text-xs text-white line-clamp-1 mb-1">${p.name}</h4>
        <span class="text-[10px] text-gray-400 block mb-3">ID: ${p.id}</span>
      </div>

      <div class="space-y-1.5 border-t border-glass pt-2">
        <label class="btn btn-outline text-[11px] py-1 px-2 w-full text-center cursor-pointer block">
          <span>📁 رفع صورة جديدة</span>
          <input 
            type="file" 
            accept="image/*" 
            class="hidden" 
            onchange="handleProductImageFileChange(event, '${p.id}')"
          >
        </label>
        
        <div class="flex gap-1">
          <button 
            onclick="promptChangeProductImageUrl('${p.id}')" 
            class="btn btn-outline text-[10px] py-1 px-2 flex-1 text-center" 
            title="تحديد رابط صورة مباشر">
            🌐 رابط
          </button>
          <button 
            onclick="copyImageUrlToClipboard('${p.imageUrl || fallbackImg}')" 
            class="btn btn-outline text-[10px] py-1 px-2 flex-1 text-center" 
            title="نسخ رابط الصورة">
            📋 نسخ
          </button>
        </div>
      </div>
    </div>
  `).join('');
}

/**
 * تغيير صورة منتج عبر رفع ملف صورة جديد من الجهاز
 */
async function handleProductImageFileChange(e, productId) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;

  try {
    const base64Image = await ShopDB.processImageFile(file);
    await updateProductImage(productId, base64Image);
    showToast(`✅ تم تحديث صورة المنتج بنجاح!`, 'success');
  } catch (err) {
    showToast(`❌ تعذر معالجة الصورة المرفوعة`, 'error');
  }
}

/**
 * تغيير صورة منتج عبر إدخال رابط مباشر
 */
async function promptChangeProductImageUrl(productId) {
  const product = productsState.find(p => p.id === productId);
  if (!product) return;

  const newUrl = prompt('أدخل رابط الصورة الجديد للمنتج:', product.imageUrl || '');
  if (newUrl !== null && newUrl.trim() !== '') {
    await updateProductImage(productId, newUrl.trim());
    showToast(`✅ تم تحديث رابط صورة المنتج بنجاح!`, 'success');
  }
}

/**
 * حفظ الصورة الجديدة وتحديث المتجر وقاعدة البيانات
 */
async function updateProductImage(productId, newImageUrl) {
  const product = productsState.find(p => p.id === productId);
  if (!product) return;

  product.imageUrl = newImageUrl;
  saveProductsData(productsState);

  if (typeof saveProductToDB === 'function') {
    await saveProductToDB(product);
  }

  renderProducts();
  renderImageManagerGrid();
}

/**
 * رفع صورة جديدة عامة للمعرض
 */
async function handleGlobalImageUpload(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;

  try {
    const base64Image = await ShopDB.processImageFile(file);
    // إضافة منتج معرض صور جديد
    const newMediaProduct = {
      id: 'media_' + Date.now(),
      name: 'صورة معرض جديدة (' + file.name + ')',
      category: 'decor',
      categoryName: 'معرض الصور',
      price: 25,
      rating: 5.0,
      reviewsCount: 1,
      meshType: 'vase',
      defaultColor: '#C5A059',
      imageUrl: base64Image,
      material: 'صورة مخصصة',
      dimensions: 'صورة عالية الدقة',
      weight: 'وسائط',
      description: 'صورة مرفوعة في مكتبة وسائط المتجر.',
      isFeatured: false,
      badge: 'وسائط جديدة',
      tags: ['صورة', 'معرض']
    };

    productsState.unshift(newMediaProduct);
    if (typeof saveProductToDB === 'function') {
      await saveProductToDB(newMediaProduct);
    }
    saveProductsData(productsState);

    renderProducts();
    renderImageManagerGrid();
    showToast(`📸 تم إضافة الصورة الجديدة إلى المعرض وقاعدة البيانات!`, 'success');
  } catch (err) {
    showToast(`❌ فشل رفع الصورة`, 'error');
  }
}

function copyImageUrlToClipboard(url) {
  navigator.clipboard.writeText(url).then(() => {
    showToast(`📋 تم نسخ رابط الصورة إلى الحافظة`, 'info');
  }).catch(() => {
    showToast(`رابط الصورة: ${url.substring(0, 30)}...`, 'info');
  });
}

function selectPresetProductImage(url) {
  const urlInput = document.getElementById('new-p-image-url');
  if (urlInput) {
    urlInput.value = url;
    updateLiveImagePreview(url);
    showToast(`🖼️ تم اختيار الصورة المحددة بنجاح!`, 'success');
  }
}

function updateLiveImagePreview(src) {
  const box = document.getElementById('image-live-preview-box');
  const img = document.getElementById('image-live-preview-img');
  if (box && img && src) {
    img.src = src;
    box.classList.remove('hidden');
  }
}

function clearLiveImagePreview() {
  const box = document.getElementById('image-live-preview-box');
  const img = document.getElementById('image-live-preview-img');
  const urlInput = document.getElementById('new-p-image-url');
  const fileInput = document.getElementById('new-p-image-file');
  if (box) box.classList.add('hidden');
  if (img) img.src = '';
  if (urlInput) urlInput.value = '';
  if (fileInput) fileInput.value = '';
}

/**
 * ==========================================================================
 * وحدة المراسلة عبر البريد الإلكتروني (Email Contact System)
 * ==========================================================================
 */

function openEmailContactModal() {
  const modal = document.getElementById('email-contact-modal');
  if (modal) modal.classList.add('active');
}

function closeEmailContactModal() {
  const modal = document.getElementById('email-contact-modal');
  if (modal) modal.classList.remove('active');
  const form = document.getElementById('email-contact-form');
  if (form) form.reset();
}

async function handleEmailContactSubmit(e) {
  if (e && e.preventDefault) e.preventDefault();

  const name = document.getElementById('email-sender-name')?.value.trim() || 'عميل';
  const senderEmail = document.getElementById('email-sender-address')?.value.trim() || '';
  const subject = document.getElementById('email-subject')?.value.trim() || 'استفسار متجر 3D';
  const body = document.getElementById('email-message-body')?.value.trim() || '';

  const endpoint = getFormspreeEndpoint();
  showToast('⏳ جاري إرسال الرسالة إلى Alstv3000@gmail.com...', 'info');

  const formData = new FormData();
  formData.append('name', name);
  formData.append('email', senderEmail || 'Alstv3000@gmail.com');
  formData.append('subject', subject);
  formData.append('message', body);

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      body: formData,
      headers: {
        'Accept': 'application/json'
      }
    });

    if (response.ok) {
      closeEmailContactModal();
      showToast('🚀 تم إرسال الرسالة بنجاح وبشكل مباشر إلى Alstv3000@gmail.com!', 'success');
      return;
    }
  } catch (err) {
    console.warn('Formspree email submission fallback:', err);
  }

  // Fallback to mailto link
  const targetEmail = 'Alstv3000@gmail.com';
  const fullBody = `📌 الاسم: ${name}\n📧 بريد العميل: ${senderEmail}\n\n📝 نص الرسالة:\n${body}`;
  const mailtoUrl = `mailto:${targetEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(fullBody)}`;

  const link = document.createElement('a');
  link.href = mailtoUrl;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  setTimeout(() => link.remove(), 500);

  closeEmailContactModal();
  showToast(`✉️ تم تجهيز الرسالة وفتح البريد الإلكتروني (Alstv3000@gmail.com) بنجاح!`, 'success');
}

/**
 * ==========================================================================
 * وحدة الحماية بكلمة سر مدير الموقع (Admin Protection & Auth System)
 * ==========================================================================
 */

let isAdminLoggedIn = false;
let pendingAdminAction = null;
const ADMIN_PASS_STORAGE_KEY = 'arabic_3d_admin_password';

function getAdminPassword() {
  return localStorage.getItem(ADMIN_PASS_STORAGE_KEY) || 'admin123';
}

function requireAdminAuth(actionCallback) {
  if (isAdminLoggedIn) {
    if (typeof actionCallback === 'function') actionCallback();
  } else {
    pendingAdminAction = actionCallback;
    openAdminLoginModal();
  }
}

function openAdminLoginModal() {
  const modal = document.getElementById('admin-login-modal');
  if (modal) modal.classList.add('active');
  const passInput = document.getElementById('admin-password-input');
  if (passInput) {
    passInput.value = '';
    setTimeout(() => passInput.focus(), 100);
  }
}

function closeAdminLoginModal() {
  const modal = document.getElementById('admin-login-modal');
  if (modal) modal.classList.remove('active');
  const passInput = document.getElementById('admin-password-input');
  if (passInput) passInput.value = '';
  const changeBox = document.getElementById('change-password-box');
  if (changeBox) changeBox.classList.add('hidden');
}

let adminLoginAttempts = 0;
let adminLockoutUntil = 0;

function isAdminLockedOut() {
  const now = Date.now();
  if (adminLockoutUntil > now) {
    const remainingSec = Math.ceil((adminLockoutUntil - now) / 1000);
    showToast(`⛔ النظام مغلق مؤقتاً لحماية المتجر ضد التخمين. يرجى الانتظار ${remainingSec} ثانية.`, 'error');
    return true;
  }
  return false;
}

function handleAdminLoginSubmit(e) {
  if (e && e.preventDefault) e.preventDefault();

  if (isAdminLockedOut()) return;

  const inputPass = document.getElementById('admin-password-input')?.value.trim();
  const currentPass = getAdminPassword();

  if (inputPass === currentPass) {
    isAdminLoggedIn = true;
    adminLoginAttempts = 0;
    adminLockoutUntil = 0;
    closeAdminLoginModal();
    updateAdminAuthUI();
    showToast('🔓 تم تسجيل دخول مدير الموقع بنجاح واستعراض الصلاحيات!', 'success');

    if (typeof pendingAdminAction === 'function') {
      const action = pendingAdminAction;
      pendingAdminAction = null;
      action();
    }
  } else {
    adminLoginAttempts += 1;
    if (adminLoginAttempts >= 5) {
      adminLockoutUntil = Date.now() + 3 * 60 * 1000;
      showToast('⛔ تم كشف محاولات تخمين متعددة! تم قفل دخول المدير مؤقتاً لمدة 3 دقائق لحماية المتجر 🔒', 'error');
      closeAdminLoginModal();
    } else {
      const remaining = 5 - adminLoginAttempts;
      showToast(`❌ كلمة السر غير صحيحة! المتبقي: ${remaining} محاولات قبل القفل الأمني.`, 'error');
    }
  }
}

function handleAdminAuthButtonClick() {
  if (isAdminLoggedIn) {
    isAdminLoggedIn = false;
    updateAdminAuthUI();
    showToast('🔒 تم تسجيل الخروج من لوحة المدير بنجاح', 'info');
  } else {
    pendingAdminAction = null;
    openAdminLoginModal();
  }
}

function updateAdminAuthUI() {
  const navText = document.getElementById('admin-nav-text');
  const navBtn = document.getElementById('admin-auth-nav-btn');

  if (navText && navBtn) {
    if (isAdminLoggedIn) {
      navText.textContent = 'المدير مفعّل (خروج)';
      navBtn.className = 'text-xs py-1 px-3 rounded-full border border-green-500/60 bg-green-950/40 text-green-400 hover:bg-green-900/60 transition-colors cursor-pointer flex items-center gap-1 font-bold';
    } else {
      navText.textContent = 'دخول المدير';
      navBtn.className = 'text-xs py-1 px-3 rounded-full border border-amber-500/40 text-amber-400 hover:bg-amber-500/10 transition-colors cursor-pointer flex items-center gap-1';
    }
  }

  // إعادة التحديث لإظهار/إخفاء أزرار الحذف والتعديل من على بطاقات الصور مباشرة
  renderProducts();
}

function toggleChangePasswordBox() {
  const box = document.getElementById('change-password-box');
  if (box) box.classList.toggle('hidden');
}

function saveNewAdminPassword() {
  const oldPass = document.getElementById('old-admin-pass')?.value.trim();
  const newPass = document.getElementById('new-admin-pass')?.value.trim();
  const currentPass = getAdminPassword();

  if (oldPass !== currentPass) {
    showToast('❌ كلمة السر الحالية غير صحيحة!', 'error');
    return;
  }

  if (!newPass || newPass.length < 4) {
    showToast('⚠️ يجب أن تتكون كلمة السر الجديدة من 4 أحرف/أرقام على الأقل.', 'warning');
    return;
  }

  localStorage.setItem(ADMIN_PASS_STORAGE_KEY, newPass);
  document.getElementById('old-admin-pass').value = '';
  document.getElementById('new-admin-pass').value = '';
  toggleChangePasswordBox();
  showToast('🔑 تم تغيير كلمة سر المدير بنجاح وحفظها!', 'success');
}

/**
 * ==========================================================================
 * وحدة ترجمة لغات العالم الفورية (Instant Website Translation Module)
 * ==========================================================================
 */

function changeWebsiteLanguage(langCode) {
  if (!langCode) return;

  // 1. تعيين كوكيز ترجمة جوجل لضمان حفظ واستمرار اللغة
  document.cookie = `googtrans=/ar/${langCode}; path=/;`;
  document.cookie = `googtrans=/ar/${langCode}; domain=${window.location.hostname}; path=/;`;

  // 2. تفعيل عنصر خيار Google Translate فوراً إن وجد
  const combo = document.querySelector('.goog-te-combo');
  if (combo) {
    combo.value = langCode;
    combo.dispatchEvent(new Event('change'));
    showToast(`🌐 جاري ترجمة محتوى الموقع...`, 'info');
  } else {
    window.location.reload();
  }
}

function syncLanguageSelectUI() {
  const match = document.cookie.match(/googtrans=\/ar\/([a-zA-Z\-]+)/);
  if (match && match[1]) {
    const langSelect = document.getElementById('language-switcher-select');
    if (langSelect) langSelect.value = match[1];
  }
}

/**
 * ==========================================================================
 * وحدة خادم الإرسال الآلي للإيميل (Formspree Direct Email Endpoint Module)
 * ==========================================================================
 */

const FORMSPREE_STORAGE_KEY = 'arabic_3d_formspree_endpoint';

function getFormspreeEndpoint() {
  return localStorage.getItem(FORMSPREE_STORAGE_KEY) || 'https://formspree.io/f/myegekab';
}

function toggleFormspreeBox() {
  const box = document.getElementById('formspree-box');
  const input = document.getElementById('formspree-endpoint-input');
  if (box) {
    box.classList.toggle('hidden');
    if (!box.classList.contains('hidden') && input) {
      input.value = getFormspreeEndpoint();
    }
  }
}

function saveFormspreeEndpoint() {
  const input = document.getElementById('formspree-endpoint-input');
  if (input) {
    const url = input.value.trim();
    localStorage.setItem(FORMSPREE_STORAGE_KEY, url);
    showToast('⚙️ تم حفظ رابط خادم الإرسال (Formspree Endpoint) بنجاح!', 'success');
    toggleFormspreeBox();
  }
}

/**
 * ==========================================================================
 * وحدة التحكم بقاعدة البيانات السحابية والمزامنة الفورية (Cloud DB Admin Unit)
 * ==========================================================================
 */

function openCloudConfigModal() {
  const modal = document.getElementById('cloud-config-modal');
  if (!modal) return;

  const urlInput = document.getElementById('cloud-url-input');
  const enabledCheckbox = document.getElementById('cloud-enabled-checkbox');

  if (typeof ShopDB !== 'undefined' && ShopDB.cloudConfig) {
    if (urlInput) urlInput.value = ShopDB.cloudConfig.firebaseUrl || '';
    if (enabledCheckbox) enabledCheckbox.checked = ShopDB.cloudConfig.enabled !== false;
  }

  modal.classList.add('active');
}

function closeCloudConfigModal() {
  const modal = document.getElementById('cloud-config-modal');
  if (modal) modal.classList.remove('active');
}

async function handleCloudConfigSubmit(e) {
  if (e && e.preventDefault) e.preventDefault();

  const urlInput = document.getElementById('cloud-url-input')?.value.trim();
  const enabledCheckbox = document.getElementById('cloud-enabled-checkbox')?.checked;

  if (!urlInput) {
    showToast('⚠️ يرجى إدخال رابط قاعدة البيانات السحابية', 'warning');
    return;
  }

  if (typeof ShopDB !== 'undefined') {
    let cleanUrl = urlInput.replace(/\/+$/, '');
    ShopDB.saveCloudConfig({
      firebaseUrl: cleanUrl,
      enabled: enabledCheckbox
    });

    showToast('☁️ تم حفظ إعدادات السحابة وجاري اختبار الاتصال...', 'info');
    await ShopDB.initCloudDB();

    if (ShopDB.isCloudConnected) {
      showToast('✅ تم الاتصال بالمزامنة السحابية بنجاح! التعديلات ستظهر للجميع.', 'success');
    } else {
      showToast('⚠️ يتعذر الوصول للسحابة برابط الخادم المدخل، تم تحويل الاتصال لقاعدة البيانات المحلية.', 'warning');
    }
  }

  closeCloudConfigModal();
}

async function testCloudConnectionUI() {
  showToast('⚡ جاري اختبار الاتصال بقاعدة البيانات السحابية...', 'info');
  if (typeof ShopDB !== 'undefined') {
    await ShopDB.initCloudDB();
    if (ShopDB.isCloudConnected) {
      showToast('🟢 خادم السحابة متصل وجاهز للمزامنة مع كافة الأجهزة!', 'success');
    } else {
      showToast('🔴 يتعذر الاتصال بالسحابة حالياً، يتم الاعتماد على التخزين المحلي.', 'error');
    }
  }
}

async function syncCurrentProductsToCloudUI() {
  const targetDB = (typeof ShopDB !== 'undefined' ? ShopDB : (window.ShopDB || null));

  if (!targetDB) {
    if (typeof ShopDatabase !== 'undefined') {
      window.ShopDB = new ShopDatabase();
      await window.ShopDB.init();
    } else {
      showToast('⚡ جاري الاتصال بقاعدة البيانات... يرجى الضغط مرة أخرى خلال ثانية.', 'info');
      return;
    }
  }

  const activeDB = window.ShopDB || ShopDB;

  // 1. استخدام productsState أو جلب كافة المنتجات من local storage أو البيانات المبدئية
  let listToSync = (productsState && productsState.length > 0) ? productsState : [];
  if (listToSync.length === 0 && typeof getProductsData === 'function') {
    listToSync = getProductsData();
  }
  if (listToSync.length === 0 && typeof initialProducts !== 'undefined') {
    listToSync = initialProducts;
  }

  if (!listToSync || listToSync.length === 0) {
    showToast('⚠️ لا يوجد منتجات لرفعها حالياً', 'warning');
    return;
  }

  showToast(`🚀 جاري رفع ومزامنة ${listToSync.length} منتج مع السحابة...`, 'info');

  await activeDB.syncAllProductsToCloud(listToSync);

  productsState = listToSync;
  renderCategories();
  renderProducts();

  showToast(`✨ تم رفع وتأمين ${listToSync.length} منتج في قاعدة البيانات السحابية بنجاح! ستظهر على كافة الأجهزة.`, 'success');
}

async function exportDatabaseUI() {
  if (typeof ShopDB !== 'undefined') {
    showToast('📦 جاري تصدير نسخة من قاعدة البيانات كملف JSON...', 'info');
    await ShopDB.exportDatabaseJSON();
  }
}

async function importDatabaseFileUI(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (evt) => {
    try {
      const content = evt.target.result;
      if (typeof ShopDB !== 'undefined') {
        const ok = await ShopDB.importDatabaseJSON(content);
        if (ok) {
          productsState = await getProductsDataAsync();
          renderCategories();
          renderProducts();
          showToast('🎉 تم استيراد وتطبيق كتالوج المنتجات بنجاح على كافة الشاشات!', 'success');
        } else {
          showToast('❌ ملف JSON غير صالح أو فارغ', 'error');
        }
      }
    } catch (err) {
      showToast('❌ تعذر قراءة الملف المرفق', 'error');
    }
  };
  reader.readAsText(file);
}

