/**
 * محرك قاعدة البيانات المحترفة (IndexedDB, LocalStorage & Cloud Database Manager)
 * يضمن حفظ المنتجات، الصور، والطلبات سحابياً ومحلياً مع المزامنة الفورية (Real-time Sync) للجميع
 */

const DB_NAME = 'Arabic3DWebshopDB';
const DB_VERSION = 1;
const CLOUD_CONFIG_KEY = 'arabic_3d_cloud_db_config';

// الإعدادات السحابية الافتراضية المفتوحة لكل الأجهزة (Zero-Config Public Shared Cloud Backend)
const PUBLIC_SHARED_CLOUD_URL = 'https://kvdb.io/webshop3d_arabic_shared_db_2026';

const DEFAULT_CLOUD_CONFIG = {
  enabled: true,
  type: 'public_cloud',
  firebaseUrl: PUBLIC_SHARED_CLOUD_URL,
  apiKey: '',
  authDomain: '',
  projectId: 'webshop-3d-shared',
  storageBucket: '',
  messagingSenderId: '',
  appId: ''
};

class ShopDatabase {
  constructor() {
    this.db = null;
    this.isReady = false;
    this.isCloudConnected = false;
    this.cloudConfig = this.loadCloudConfig();
    this.cloudListeners = [];
    this.firebaseApp = null;
    this.firebaseDb = null;
    this.pollInterval = null;
    this.lastSyncHash = '';
  }

  /**
   * تهيئة قاعدة البيانات المحلية IndexedDB وربط قاعدة البيانات السحابية
   */
  async init() {
    // 1. تهيئة IndexedDB المحلية أولاً
    await this.initIndexedDB();

    // 2. تهيئة قاعدة البيانات السحابية
    await this.initCloudDB();

    return this.isReady;
  }

  /**
   * تهيئة IndexedDB
   */
  async initIndexedDB() {
    return new Promise((resolve) => {
      if (!window.indexedDB) {
        console.warn("IndexedDB غير مدعوم في هذا المتصفح، سيتم استخدام localStorage كبديل محلي.");
        this.isReady = false;
        resolve(false);
        return;
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = (event) => {
        console.error("خطأ في فتح قاعدة البيانات المحلية IndexedDB:", event.target?.error);
        this.isReady = false;
        resolve(false);
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        this.isReady = true;
        console.log("✅ تم الاتصال بقاعدة البيانات المحلية IndexedDB بنجاح.");
        resolve(true);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        if (!db.objectStoreNames.contains('products')) {
          const productsStore = db.createObjectStore('products', { keyPath: 'id' });
          productsStore.createIndex('category', 'category', { unique: false });
        }
        if (!db.objectStoreNames.contains('media')) {
          db.createObjectStore('media', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('orders')) {
          db.createObjectStore('orders', { keyPath: 'id' });
        }
      };
    });
  }

  /**
   * تحميل الإعدادات السحابية من LocalStorage
   */
  loadCloudConfig() {
    try {
      const saved = localStorage.getItem(CLOUD_CONFIG_KEY);
      if (saved) {
        return { ...DEFAULT_CLOUD_CONFIG, ...JSON.parse(saved) };
      }
    } catch (e) {}
    return { ...DEFAULT_CLOUD_CONFIG };
  }

  /**
   * حفظ الإعدادات السحابية
   */
  saveCloudConfig(config) {
    this.cloudConfig = { ...this.cloudConfig, ...config };
    localStorage.setItem(CLOUD_CONFIG_KEY, JSON.stringify(this.cloudConfig));
    this.initCloudDB();
  }

  /**
   * تهيئة قاعدة البيانات السحابية (Firebase SDK أو Public Cloud REST API)
   */
  async initCloudDB() {
    if (!this.cloudConfig.enabled) {
      this.isCloudConnected = false;
      this.updateCloudStatusUI('disabled', 'قاعدة بيانات محلية 📱');
      return;
    }

    // 1. محاولة Firebase Realtime DB إن كانت القيمة تحتوي firebaseio.com ورغبة المستخدم
    if (this.cloudConfig.firebaseUrl && this.cloudConfig.firebaseUrl.includes('firebaseio.com')) {
      try {
        if (typeof firebase !== 'undefined' && firebase.database) {
          if (!firebase.apps || firebase.apps.length === 0) {
            const fbConfig = {
              databaseURL: this.cloudConfig.firebaseUrl,
              apiKey: this.cloudConfig.apiKey || "demo-key",
              projectId: this.cloudConfig.projectId || "demo-project"
            };
            this.firebaseApp = firebase.initializeApp(fbConfig);
          } else {
            this.firebaseApp = firebase.apps[0];
          }
          this.firebaseDb = firebase.database();
          this.setupFirebaseRealtimeListener();
          this.isCloudConnected = true;
          this.updateCloudStatusUI('connected', 'سحابي متصل (مباشر 🌐)');
          console.log("☁️ تم الاتصال بقاعدة البيانات السحابية Firebase بنجاح.");
          return;
        }
      } catch (err) {
        console.warn("⚠️ تعذر الاتصال بـ Firebase SDK:", err);
      }
    }

    // 2. استخدام الخادم السحابي المشترك السريع (Shared Public Cloud DB)
    await this.initPublicCloudREST();
  }

  /**
   * إعداد الاستماع الفوري للتغييرات السحابية عبر Firebase Realtime DB
   */
  setupFirebaseRealtimeListener() {
    if (!this.firebaseDb) return;
    try {
      const productsRef = this.firebaseDb.ref('products');
      productsRef.on('value', (snapshot) => {
        const data = snapshot.val();
        if (data) {
          let productsList = [];
          if (Array.isArray(data)) {
            productsList = data.filter(Boolean);
          } else if (typeof data === 'object') {
            productsList = Object.values(data);
          }

          if (productsList.length > 0) {
            console.log("🔄 استلام تحديثات سحابية فورية للمنتجات من Firebase:", productsList.length);
            this.syncCloudProductsToLocal(productsList);
            this.notifyCloudListeners(productsList);
          }
        }
      });
    } catch (e) {
      console.error("خطأ في ربط الاستماع الفوري بالسحابة:", e);
    }
  }

  /**
   * تهيئة واستجابة الخادم السحابي العام المشترك
   */
  async initPublicCloudREST() {
    const cloudUrl = this.getCloudProductsUrl();
    try {
      const response = await fetch(cloudUrl, { method: 'GET', cache: 'no-cache' });
      if (response.ok || response.status === 404) {
        this.isCloudConnected = true;
        this.updateCloudStatusUI('connected', 'سحابي متصل (مباشر 🌐)');
        console.log("☁️ تم تأكيد المزامنة مع قاعدة البيانات السحابية العامة.");

        // جلب البيانات الأولية
        await this.fetchProductsFromCloudREST();

        // تفعيل التناوب الدوري كل 4 ثوانٍ لضمان استلام التعديلات فوراً على أي جهاز آخر!
        if (this.pollInterval) clearInterval(this.pollInterval);
        this.pollInterval = setInterval(() => this.fetchProductsFromCloudREST(), 4000);
      } else {
        throw new Error('Cloud HTTP status ' + response.status);
      }
    } catch (err) {
      this.isCloudConnected = false;
      this.updateCloudStatusUI('local', 'قاعدة بيانات محلية 📱');
      console.log("ℹ️ يتعذر الوصول للسحابة، يعمل المتجر محلياً.");
    }
  }

  /**
   * إرجاع رابط المنتجات السحابي
   */
  getCloudProductsUrl() {
    const url = this.cloudConfig.firebaseUrl || PUBLIC_SHARED_CLOUD_URL;
    if (url.includes('firebaseio.com')) {
      return `${url}/products.json`;
    }
    if (url.endsWith('/products')) return url;
    return `${url.replace(/\/+$/, '')}/products`;
  }

  /**
   * جلب المنتجات من خادم السحابة المباشر
   */
  async fetchProductsFromCloudREST() {
    const url = this.getCloudProductsUrl();
    try {
      const res = await fetch(`${url}?t=${Date.now()}`, { cache: 'no-cache' });
      if (!res.ok) return null;
      let data = await res.json();
      if (!data) return null;

      let list = Array.isArray(data) ? data.filter(Boolean) : Object.values(data);
      if (list && list.length > 0) {
        const hash = JSON.stringify(list.map(p => p.id + p.price + (p.imageUrl ? p.imageUrl.length : 0)));
        if (hash !== this.lastSyncHash) {
          this.lastSyncHash = hash;
          console.log("⚡ تحديث تلقائي للمنتجات من الجهاز الآخر! عدد المنتجات:", list.length);
          this.syncCloudProductsToLocal(list);
          this.notifyCloudListeners(list);
        }
        return list;
      }
    } catch (e) {}
    return null;
  }

  /**
   * مزامنة المنتجات القادمة من السحابة في IndexedDB & LocalStorage
   */
  syncCloudProductsToLocal(productsList) {
    try {
      localStorage.setItem("arabic_3d_webshop_products", JSON.stringify(productsList));
      if (this.isReady && this.db) {
        const transaction = this.db.transaction(['products'], 'readwrite');
        const store = transaction.objectStore('products');
        for (const p of productsList) {
          if (p && p.id) store.put(p);
        }
      }
    } catch (e) {}
  }

  /**
   * إضافة مستمع للتغييرات اللحظية للمنتجات السحابية
   */
  onCloudProductsUpdated(callback) {
    if (typeof callback === 'function') {
      this.cloudListeners.push(callback);
    }
  }

  /**
   * إشعار الكود الرئيسي بحدوث تحديثات سحابية
   */
  notifyCloudListeners(productsList) {
    for (const listener of this.cloudListeners) {
      try {
        listener(productsList);
      } catch (e) {
        console.error("Error notifying listener", e);
      }
    }
  }

  /**
   * جلب كافة المنتجات (السحابة أولاً، ثم IndexedDB، ثم LocalStorage)
   */
  async getAllProducts() {
    // 1. محاولة الجلب السحابي المباشر
    if (this.isCloudConnected) {
      const cloudProducts = await this.fetchProductsFromCloudREST();
      if (cloudProducts && cloudProducts.length > 0) {
        return cloudProducts;
      }
    }

    // 2. محاولة الجلب من IndexedDB المحلية
    if (this.isReady && this.db) {
      const localIndexedProducts = await new Promise((resolve) => {
        try {
          const transaction = this.db.transaction(['products'], 'readonly');
          const store = transaction.objectStore('products');
          const request = store.getAll();
          request.onsuccess = () => resolve(request.result && request.result.length > 0 ? request.result : null);
          request.onerror = () => resolve(null);
        } catch (e) {
          resolve(null);
        }
      });

      if (localIndexedProducts) {
        return localIndexedProducts;
      }
    }

    // 3. محاولة الجلب من LocalStorage
    return this.getProductsFromLocalStorage();
  }

  /**
   * حفظ أو تحديث منتج في قاعدة البيانات السحابية والمحلية
   */
  async saveProduct(product) {
    if (!product || !product.id) return false;

    // 1. التحديث المحلي السريع
    const local = this.getProductsFromLocalStorage();
    const idx = local.findIndex(p => p.id === product.id);
    if (idx >= 0) local[idx] = product;
    else local.unshift(product);
    localStorage.setItem("arabic_3d_webshop_products", JSON.stringify(local));

    if (this.isReady && this.db) {
      try {
        const transaction = this.db.transaction(['products'], 'readwrite');
        const store = transaction.objectStore('products');
        store.put(product);
      } catch (e) {}
    }

    await this.saveProductToCloud(product);
    return true;
  }

  /**
   * رفع ومزامنة الكتالوج الكامل إلى السحابة
   */
  async syncAllProductsToCloud(productsList) {
    const list = (productsList && productsList.length > 0) ? productsList : this.getProductsFromLocalStorage();
    if (!list || list.length === 0) return false;

    // 1. التحديث المحلي السريع
    this.syncCloudProductsToLocal(list);

    // 2. التحديث في Firebase SDK إن وجد
    if (this.firebaseDb) {
      try {
        await this.firebaseDb.ref('products').set(list);
        console.log("☁️ تم رفع الكتالوج بالكامل إلى Firebase SDK بنجاح.");
        return true;
      } catch (e) {}
    }

    // 3. التحديث عبر REST API
    const cloudUrl = this.getCloudProductsUrl();
    try {
      if (cloudUrl.includes('firebaseio.com')) {
        const res = await fetch(cloudUrl, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(list)
        });
        if (res.ok) return true;
      } else {
        const res = await fetch(cloudUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(list)
        });
        if (res.ok || res.status === 201) return true;
      }
    } catch (e) {
      console.error("خطأ في رفع الكتالوج للسحابة:", e);
    }
    return false;
  }

  /**
   * رفع منتج إلى السحابة (Firebase SDK أو REST Public Cloud API)
   */
  async saveProductToCloud(product) {
    // استخدام Firebase SDK إن وجد
    if (this.firebaseDb) {
      try {
        await this.firebaseDb.ref(`products/${product.id}`).set(product);
        console.log(`☁️ تم حفظ المنتج "${product.name}" في Firebase Realtime DB بنجاح.`);
        return true;
      } catch (e) {
        console.warn("فشل الحفظ عبر SDK، جاري استخدام REST API...", e);
      }
    }

    const cloudUrl = this.getCloudProductsUrl();
    if (cloudUrl.includes('firebaseio.com')) {
      try {
        const url = `${this.cloudConfig.firebaseUrl}/products/${product.id}.json`;
        const res = await fetch(url, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(product)
        });
        if (res.ok) {
          console.log(`☁️ تم حفظ المنتج "${product.name}" في السحابة عبر Firebase REST.`);
          return true;
        }
      } catch (e) {}
    } else {
      // رفع كتالوج المنتجات المحترفة بالكامل للسحابة العامة
      try {
        const localProducts = this.getProductsFromLocalStorage();
        const res = await fetch(cloudUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(localProducts)
        });
        if (res.ok) {
          console.log(`☁️ تم حفظ ومزامنة الكتالوج بالسحابة العامة بنجاح.`);
          return true;
        }
      } catch (e) {
        console.error("خطأ في رفع المنتج للسحابة العامة:", e);
      }
    }
    return false;
  }

  /**
   * حذف منتج من قاعدة البيانات المحية والسحابية
   */
  async deleteProduct(productId) {
    if (!productId) return false;

    // 1. الحذف المحلي
    const local = this.getProductsFromLocalStorage().filter(p => p.id !== productId);
    localStorage.setItem("arabic_3d_webshop_products", JSON.stringify(local));

    if (this.isReady && this.db) {
      try {
        const transaction = this.db.transaction(['products'], 'readwrite');
        const store = transaction.objectStore('products');
        store.delete(productId);
      } catch (e) {}
    }

    // 2. الحذف من السحابة
    await this.deleteProductFromCloud(productId);
    return true;
  }

  /**
   * حذف منتج من السحابة (Firebase SDK أو REST API)
   */
  async deleteProductFromCloud(productId) {
    if (this.firebaseDb) {
      try {
        await this.firebaseDb.ref(`products/${productId}`).remove();
        console.log(`🗑️ تم حذف المنتج من Firebase Realtime DB بنجاح.`);
        return true;
      } catch (e) {}
    }

    const cloudUrl = this.getCloudProductsUrl();
    if (cloudUrl.includes('firebaseio.com')) {
      try {
        const url = `${this.cloudConfig.firebaseUrl}/products/${productId}.json`;
        await fetch(url, { method: 'DELETE' });
        console.log(`🗑️ تم حذف المنتج من السحابة عبر REST API.`);
        return true;
      } catch (e) {}
    } else {
      try {
        const localProducts = this.getProductsFromLocalStorage().filter(p => p.id !== productId);
        await fetch(cloudUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(localProducts)
        });
        console.log(`🗑️ تم الحذف من السحابة العامة بنجاح.`);
        return true;
      } catch (e) {}
    }
    return false;
  }

  /**
   * حفظ طلب أو فاتورة في السحابة للادارة
   */
  async saveOrderToCloud(orderData) {
    const orderId = orderData.id || ('order_' + Date.now());
    orderData.id = orderId;
    orderData.createdAt = new Date().toISOString();

    // حفظ محلي
    try {
      const savedOrders = JSON.parse(localStorage.getItem('arabic_3d_orders') || '[]');
      savedOrders.unshift(orderData);
      localStorage.setItem('arabic_3d_orders', JSON.stringify(savedOrders));
    } catch (e) {}

    // حفظ سحابي
    if (this.firebaseDb) {
      try {
        await this.firebaseDb.ref(`orders/${orderId}`).set(orderData);
      } catch (e) {}
    } else if (this.cloudConfig.firebaseUrl) {
      try {
        const url = `${this.cloudConfig.firebaseUrl}/orders/${orderId}.json`;
        await fetch(url, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(orderData)
        });
      } catch (e) {}
    }
  }

  /**
   * زراعة البيانات المبدئية في السحابة وقاعدة البيانات المحلية
   */
  async seedInitialProducts(productsList) {
    // زراعة محلية
    this.syncCloudProductsToLocal(productsList);

    // زراعة سحابية إن كانت السحابة فارغة
    if (this.isCloudConnected) {
      const existing = await this.fetchProductsFromCloudREST();
      if (!existing || existing.length === 0) {
        console.log("🌱 زراعة المنتجات الأولية في قاعدة البيانات السحابية...");
        for (const p of productsList) {
          await this.saveProductToCloud(p);
        }
      }
    }
  }

  /**
   * تحويل قراءة ملف صورة إلى نص Base64
   */
  async processImageFile(file) {
    return new Promise((resolve, reject) => {
      if (!file) {
        resolve(null);
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(e);
      reader.readAsDataURL(file);
    });
  }

  /**
   * قراءة المنتجات الاحتياطية من LocalStorage
   */
  getProductsFromLocalStorage() {
    const saved = localStorage.getItem("arabic_3d_webshop_products");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {}
    }
    return typeof initialProducts !== 'undefined' ? initialProducts : [];
  }

  /**
   * تحديث شارة حالة الاتصال بالسحابة في واجهة المستخدم
   */
  updateCloudStatusUI(status, labelText) {
    const icon = document.getElementById('cloud-status-icon');
    const text = document.getElementById('cloud-status-text');
    const btn = document.getElementById('cloud-status-nav-btn');

    if (text) text.textContent = labelText;
    if (icon) {
      if (status === 'connected') {
        icon.className = 'w-2 h-2 rounded-full bg-emerald-400 animate-pulse';
      } else if (status === 'disabled') {
        icon.className = 'w-2 h-2 rounded-full bg-gray-400';
      } else {
        icon.className = 'w-2 h-2 rounded-full bg-amber-400';
      }
    }
    if (btn) {
      if (status === 'connected') {
        btn.className = 'text-xs py-1 px-3 rounded-full border border-emerald-500/40 text-emerald-300 bg-emerald-950/30 hover:bg-emerald-900/50 transition-colors cursor-pointer flex items-center gap-1.5';
      } else {
        btn.className = 'text-xs py-1 px-3 rounded-full border border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/10 transition-colors cursor-pointer flex items-center gap-1.5';
      }
    }
  }

  /**
   * تصدير قاعدة البيانات بالكامل كملف JSON
   */
  async exportDatabaseJSON() {
    const products = await this.getAllProducts();
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(products, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `3D_Webshop_Backup_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  }
}

// إنشاء نسخة عامة من محرك قاعدة البيانات
const ShopDB = new ShopDatabase();

