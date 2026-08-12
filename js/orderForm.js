/**
 * وحدة نموذج الطلب المخصص وحاسبة تكلفة الطباعة ثلاثية الأبعاد
 * (Custom 3D Request Form & Interactive Price Estimator)
 */

function initCustomOrderForm() {
  const form = document.getElementById('custom-order-form');
  if (!form) return;

  const lengthInput = document.getElementById('spec-length');
  const widthInput = document.getElementById('spec-width');
  const heightInput = document.getElementById('spec-height');
  const infillInput = document.getElementById('spec-infill');
  const infillValueDisplay = document.getElementById('infill-value');
  const materialSelect = document.getElementById('spec-material');
  const serviceTypeSelect = document.getElementById('service-type');
  const estimatedPriceDisplay = document.getElementById('estimated-price');
  const estimatedTimeDisplay = document.getElementById('estimated-time');

  // أسعار المواد المبدئية لكل 10 سم مكعب (€ / EUR)
  const materialRates = {
    'pla': 0.08,
    'petg': 0.11,
    'resin': 0.22,
    'carbon': 0.28,
    'tpu': 0.16
  };

  // معامل التكلفة حسب نوع الخدمة
  const serviceMultipliers = {
    'print-only': 1.0,
    'model-and-print': 1.6,
    'reverse-engineering': 2.2,
    'digital-file': 0.7
  };

  function calculateEstimate() {
    const l = parseFloat(lengthInput ? lengthInput.value : 10) || 10;
    const w = parseFloat(widthInput ? widthInput.value : 10) || 10;
    const h = parseFloat(heightInput ? heightInput.value : 10) || 10;
    const infill = parseInt(infillInput ? infillInput.value : 20, 10) || 20;
    const materialKey = materialSelect ? materialSelect.value : 'pla';
    const serviceKey = serviceTypeSelect ? serviceTypeSelect.value : 'print-only';

    if (infillValueDisplay) {
      infillValueDisplay.textContent = `${infill}%`;
    }

    // حساب الحجم بالسم3
    const volumeCm3 = (l * w * h) / 1000;
    // الكثافة الفعالة = حجم القشرة + الحشو الداخلي
    const effectiveVolume = volumeCm3 * (0.2 + (infill / 100) * 0.8);

    const baseRate = materialRates[materialKey] || 0.1;
    const serviceMult = serviceMultipliers[serviceKey] || 1.0;

    let price = Math.round(effectiveVolume * baseRate * 12 * serviceMult);
    if (price < 10) price = 10; // الحد الأدنى للطلب باليورو

    // حساب الوقت التقديري بالساعات
    const printHours = Math.ceil(effectiveVolume * 0.15 + 1);
    const days = Math.ceil(printHours / 8);

    if (estimatedPriceDisplay) {
      estimatedPriceDisplay.textContent = `${price} €`;
    }
    if (estimatedTimeDisplay) {
      estimatedTimeDisplay.textContent = days === 1 ? 'خلال 24 ساعة' : `خلال ${days} أيام عمل`;
    }
  }

  // ربط المستمعين للحديرات
  [lengthInput, widthInput, heightInput, infillInput, materialSelect, serviceTypeSelect].forEach(element => {
    if (element) {
      element.addEventListener('input', calculateEstimate);
      element.addEventListener('change', calculateEstimate);
    }
  });

  // الحساب الأولي
  calculateEstimate();

  // معالجة تقديم الطلب
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const clientName = document.getElementById('client-name')?.value || 'عميل';
    const clientPhone = document.getElementById('client-phone')?.value || '';
    const serviceType = serviceTypeSelect?.options[serviceTypeSelect.selectedIndex]?.text || '';
    const material = materialSelect?.options[materialSelect.selectedIndex]?.text || '';
    const priceText = estimatedPriceDisplay?.textContent || '0 €';

    const orderNotes = document.getElementById('client-notes')?.value || 'لا يوجد ملاحظات إضافية';

    // إنشاء رقم طلب فريد
    const orderId = 'ORD-3D-' + Math.floor(100000 + Math.random() * 900000);

    const orderData = {
      id: orderId,
      clientName: clientName,
      clientPhone: clientPhone,
      serviceType: serviceType,
      material: material,
      estimatedPrice: priceText,
      notes: orderNotes
    };

    // حفظ الطلب سحابياً ومحلياً
    if (typeof ShopDB !== 'undefined') {
      ShopDB.saveOrderToCloud(orderData);
    }

    if (typeof showToast === 'function') {
      showToast('🎉 تم إرسال طلب التجسيم المخصص بنجاح وشحنه للسحابة! رقم الطلب: ' + orderId, 'success');
    }

    // إظهار نافذة تأكيد الطلب
    showOrderModal(orderId, clientName, clientPhone, serviceType, material, priceText, orderNotes);
    
    form.reset();
    calculateEstimate();
  });
}

function showOrderModal(orderId, name, phone, service, material, price, notes) {
  let modal = document.getElementById('order-success-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'order-success-modal';
    modal.className = 'modal-backdrop';
    document.body.appendChild(modal);
  }

  const whatsappMsg = encodeURIComponent(
    `مرحباً متجر 3D 👋، أود متابعة طلبي المخصص:\n` +
    `📌 رقم الطلب: ${orderId}\n` +
    `👤 الاسم: ${name}\n` +
    `🛠️ الخدمة: ${service}\n` +
    `💎 المادة: ${material}\n` +
    `💰 السعر التقديري: ${price}\n` +
    `📝 ملاحظات: ${notes}`
  );

  modal.innerHTML = `
    <div class="modal-content glass-card p-6 rounded-2xl max-w-lg mx-auto text-right">
      <div class="flex items-center justify-between mb-4 border-b border-glass pb-3">
        <h3 class="text-2xl font-bold text-cyan-400">🎉 تم استلام الطلب المخصص!</h3>
        <button onclick="closeOrderModal()" class="text-gray-400 hover:text-white text-2xl">&times;</button>
      </div>
      <div class="space-y-3 text-gray-200">
        <p><strong class="text-white">رقم الطلب:</strong> <span class="badge badge-cyan">${orderId}</span></p>
        <p><strong class="text-white">العميل:</strong> ${name}</p>
        <p><strong class="text-white">نوع الخدمة:</strong> ${service}</p>
        <p><strong class="text-white">المادة المختارة:</strong> ${material}</p>
        <p><strong class="text-white">التكلفة التقديرية:</strong> <span class="text-gold-400 font-bold text-xl">${price}</span></p>
        <p class="text-sm text-gray-400 border-t border-glass pt-2">سنباشر مراجعة مواصفات النموذج والبدء في الطباعة/التصميم فضلًا تواصل معنا لتزويدنا بملف 3D إن وجد.</p>
      </div>
      <div class="mt-6 flex flex-col gap-3">
        <a href="https://wa.me/?text=${whatsappMsg}" target="_blank" class="btn btn-whatsapp text-center">
          <i class="fab fa-whatsapp"></i> الإرسال والمتابعة عبر واتساب
        </a>
        <button onclick="closeOrderModal()" class="btn btn-outline">إغلاق النافذة</button>
      </div>
    </div>
  `;

  modal.classList.add('active');
}

function closeOrderModal() {
  const modal = document.getElementById('order-success-modal');
  if (modal) modal.classList.remove('active');
}
