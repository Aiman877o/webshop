// بيانات المنتجات الأصلية لعالم التجسيم ثلاثي الأبعاد (Initial 3D Products Catalog)
const initialProducts = [
  {
    id: "p1",
    name: "مزهرية هندسية ملتوية (Twisted Wave Vase)",
    category: "decor",
    categoryName: "مجسمات وديكورات",
    price: 39,
    rating: 4.9,
    reviewsCount: 28,
    meshType: "vase",
    defaultColor: "#C5A059",
    imageUrl: "https://images.unsplash.com/photo-1612196808214-b7e239e5f6b7?auto=format&fit=crop&w=800&q=80",
    material: "PLA Silk +",
    dimensions: "12 × 12 × 24 سم",
    weight: "220 غرام",
    description: "مزهرية ذات تصميم لولبي عصري مطبوعة بدقة عالية بتقنية الطباعة ثلاثية الأبعاد FDM، تضفي لمسة فنية مستقبليات على ديكور المنزل واللمسات المكتبية.",
    isFeatured: true,
    badge: "الأكثر مبيعاً",
    tags: ["ديكور", "مزهرية", "طباعة3D"]
  },
  {
    id: "p2",
    name: "خوذة السايبربوك المستقبلي (Cyberpunk Helmet Shell)",
    category: "decor",
    categoryName: "مجسمات وديكورات",
    price: 149,
    rating: 5.0,
    reviewsCount: 42,
    meshType: "helmet",
    defaultColor: "#3A4656",
    imageUrl: "https://images.unsplash.com/photo-1578632767115-351597cf2477?auto=format&fit=crop&w=800&q=80",
    material: "ABS + Resin Finish",
    dimensions: "26 × 24 × 28 سم",
    weight: "650 غرام",
    description: "مجسم خوذة مستقبلية تفاعلية مزودة بتفاصيل نيون وأسطح عاكسة، مصممة لعشاق ألعاب الفيديو والمعارض والمجسمات العصرية.",
    isFeatured: true,
    badge: "جديد",
    tags: ["سايبربوك", "خوذة", "ديكور"]
  },
  {
    id: "p3",
    name: "مصباح الزخرفة العربية النيون (Arabesque Lantern 3D)",
    category: "arabesque",
    categoryName: "زخارف وعمارة عربية",
    price: 79,
    rating: 4.8,
    reviewsCount: 35,
    meshType: "lantern",
    defaultColor: "#D4B886",
    imageUrl: "https://images.unsplash.com/photo-1514517521153-1be72277b32f?auto=format&fit=crop&w=800&q=80",
    material: "PETG Gold Metal Fill",
    dimensions: "15 × 15 × 30 سم",
    weight: "380 غرام",
    description: "تحفة فنية تجمع بين الأصالة العربية والتقنية ثلاثية الأبعاد. تنبعث منها أنماط ضوئية هندسية عند إضافة إضاءة LED داخلية.",
    isFeatured: true,
    badge: "مميز",
    tags: ["عربي", "إضاءة", "زخارف"]
  },
  {
    id: "p4",
    name: "مجموعة التروس الميكانيكية (Precision Gear Set)",
    category: "mechanical",
    categoryName: "قطع ميكانيكية",
    price: 49,
    rating: 4.7,
    reviewsCount: 19,
    meshType: "gears",
    defaultColor: "#7A8B99",
    imageUrl: "https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=800&q=80",
    material: "Carbon Fiber Nylon",
    dimensions: "18 × 18 × 8 سم",
    weight: "310 غرام",
    description: "نظام تروس ميكانيكية متداخلة ومتحركة فائقة المتانة مصممة للاختبارات الهندسة والمشاريع التقنية والديكور الميكانيكي التفاعلي.",
    isFeatured: false,
    badge: "صناعي",
    tags: ["تروس", "هندسة", "ميكانيك"]
  },
  {
    id: "p5",
    name: "ميدالية مفاتيح باسم مخصص (Custom Arabic Keychain 3D)",
    category: "accessories",
    categoryName: "إكسسوارات ومجوهرات",
    price: 12,
    rating: 4.9,
    reviewsCount: 110,
    meshType: "keychain",
    defaultColor: "#4A6B5D",
    imageUrl: "https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=800&q=80",
    material: "Flex TPU / Resin",
    dimensions: "7 × 3 × 0.8 سم",
    weight: "25 غرام",
    description: "ميدالية مخصصة مطبوعة بطبقات بارزة ثلاثية الأبعاد بأسماء أو شعارات حسب الطلب مع مقاومة عالية للصدمات والخدش.",
    isFeatured: false,
    badge: "تخصيص كامل",
    tags: ["ميدالية", "هدايا", "تخصيص"]
  },
  {
    id: "p6",
    name: "التنين المفصلي التفاعلي (Articulated Crystal Dragon)",
    category: "decor",
    categoryName: "مجسمات وديكورات",
    price: 35,
    rating: 5.0,
    reviewsCount: 64,
    meshType: "dragon",
    defaultColor: "#E2E8F0",
    imageUrl: "https://images.unsplash.com/photo-1566576912321-d58ddd7a6088?auto=format&fit=crop&w=800&q=80",
    material: "Silk Rainbow PLA",
    dimensions: "45 × 8 × 6 سم",
    weight: "290 غرام",
    description: "مجسم تنين كريستالي مرن مئة بالمئة مطبوع كقطعة واحدة متصلة ومفصلية بدون تجميع. حركة انسيابية وتفاصيل قشور مبهرة.",
    isFeatured: true,
    badge: "رائج جدًا",
    tags: ["تنين", "مجسم مرن", "ألعاب"]
  },
  {
    id: "p7",
    name: "ملف 3D: نموذج برج التكنولوجيا (Digital Tower STL Model)",
    category: "digital",
    categoryName: "ملفات ثلاثية الأبعاد",
    price: 19,
    rating: 4.6,
    reviewsCount: 15,
    meshType: "tower",
    defaultColor: "#8C7853",
    imageUrl: "https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=800&q=80",
    material: "ملف رقمي STL / OBJ / STEP",
    dimensions: "جاهز للطباعة",
    weight: "تحميل فوري",
    description: "ملف ثلاثي الأبعاد احترافي جاهز للطباعة على كافة طابعات 3D. يتضمن إعدادات السلايسر G-code وجاهزية مباشرة بدون خيوط دعم.",
    isFeatured: false,
    badge: "تحميل فوري",
    tags: ["STL", "ملف3D", "تصميم"]
  },
  {
    id: "p8",
    name: "خاتم بكرة هندسي متداخل (Kinetic Spinner Ring)",
    category: "accessories",
    categoryName: "إكسسوارات ومجوهرات",
    price: 29,
    rating: 4.8,
    reviewsCount: 37,
    meshType: "ring",
    defaultColor: "#D4AF37",
    imageUrl: "https://images.unsplash.com/photo-1605100804763-247f67b3557e?auto=format&fit=crop&w=800&q=80",
    material: "SLA Castable Resin",
    dimensions: "مقاسات متعددة",
    weight: "15 غرام",
    description: "خاتم عصري يحتوي حلقة جانبية قابلة للتدوير ومصممة بدقة المايكرون عبر طباعة الرغوة الضوئية High-Detail SLA Resin.",
    isFeatured: false,
    badge: "دقة دقيقة",
    tags: ["خاتم", "مجوهرات", "SLA"]
  },
  {
    id: "p9",
    name: "طبلة إيقاعية فاخرة (3D Arabic Percussion Drum)",
    category: "arabesque",
    categoryName: "زخارف وعمارة عربية",
    price: 65,
    rating: 4.9,
    reviewsCount: 53,
    meshType: "drum",
    defaultColor: "#C5A059",
    imageUrl: "https://images.unsplash.com/photo-1519892300165-cb5542fb47c7?auto=format&fit=crop&w=800&q=80",
    material: "PLA Wood Fill + Brass",
    dimensions: "20 × 20 × 25 سم",
    weight: "450 غرام",
    description: "مجسم طبلة إيقاعية عربية فاخرة ثلاثية الأبعاد مزودة بأعواد طباعة خشبية وهيكل من البراس النحاسي. تفاعلية صوتية وبصرية فريدة.",
    isFeatured: true,
    badge: "جديد حظوة",
    tags: ["طبل", "إيقاع", "موسيقى", "عربي"]
  }
];

// جلب المنتجات من قاعدة البيانات السحابية (Cloud DB) أو IndexedDB أو LocalStorage
async function getProductsDataAsync() {
  if (typeof ShopDB !== 'undefined') {
    const products = await ShopDB.getAllProducts();
    if (products && products.length > 0) {
      return products;
    }
    // زراعة الكتالوج الأولي في قاعدة البيانات السحابية والمحلية
    await ShopDB.seedInitialProducts(initialProducts);
  }
  return initialProducts;
}

// دالة متوافقة لجلب البيانات التزامنية
function getProductsData() {
  const saved = localStorage.getItem("arabic_3d_webshop_products");
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch (e) {}
  }
  return initialProducts;
}

// حفظ مجموعة المنتجات في LocalStorage
function saveProductsData(products) {
  try {
    localStorage.setItem("arabic_3d_webshop_products", JSON.stringify(products));
  } catch (e) {
    console.error("خطأ في حفظ المنتجات في LocalStorage:", e);
  }
}

// حفظ أو تحديث منتج في قاعدة البيانات السحابية والمحلية
async function saveProductToDB(product) {
  if (typeof ShopDB !== 'undefined') {
    await ShopDB.saveProduct(product);
  }
}

// حذف منتج من قاعدة البيانات السحابية والمحلية
async function deleteProductFromDB(productId) {
  if (typeof ShopDB !== 'undefined') {
    await ShopDB.deleteProduct(productId);
  }
}
