/**
 * محرك الرسوميات ثلاثية الأبعاد Three.js (3D Rendering Engine)
 * يتكفل بتوليد النماذج والتحكم بالخامات والتدوير والإضاءة
 */

class WebGL3DViewer {
  constructor(containerId, options = {}) {
    this.container = typeof containerId === 'string' ? document.getElementById(containerId) : containerId;
    if (!this.container) return;

    this.options = Object.assign({
      meshType: 'vase',
      color: '#C5A059',
      wireframe: false,
      autoRotate: true,
      metalness: 0.4,
      roughness: 0.2,
      cameraZ: 4.5,
      materialPreset: 'metal'
    }, options);

    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.meshGroup = null;
    this.currentMesh = null;
    this.material = null;
    this.animationFrameId = null;

    // حالة التحكم بالسحب لتدوير المجسم (Pointer Orbit Controls)
    this.isDragging = false;
    this.previousMousePosition = { x: 0, y: 0 };
    this.targetRotation = { x: 0, y: 0 };

    this.init();
  }

  init() {
    if (!this.container) return;
    this.container.innerHTML = '';

    const width = this.container.clientWidth || 300;
    const height = this.container.clientHeight || 300;

    // 1. المشهد (Scene)
    this.scene = new THREE.Scene();

    // 2. الكاميرا (Camera)
    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    this.camera.position.set(0, 1.2, this.options.cameraZ);
    this.camera.lookAt(0, 0, 0);

    // 3. المحرك (Renderer)
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.appendChild(this.renderer.domElement);

    // 4. الإضاءة الكلاسيكية الدافئة (Warm Lighting)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    this.scene.add(ambientLight);

    const mainLight = new THREE.DirectionalLight(0xfff8ee, 1.1);
    mainLight.position.set(5, 8, 5);
    mainLight.castShadow = true;
    this.scene.add(mainLight);

    const warmGoldRimLight = new THREE.PointLight(0xc5a059, 1.8, 10);
    warmGoldRimLight.position.set(-4, -2, -3);
    this.scene.add(warmGoldRimLight);

    const warmIvoryRimLight = new THREE.PointLight(0xe5d3b3, 1.5, 10);
    warmIvoryRimLight.position.set(4, -3, 3);
    this.scene.add(warmIvoryRimLight);

    // 5. إنشاء المجموعة والخامة (Mesh Group & Material)
    this.meshGroup = new THREE.Group();
    this.scene.add(this.meshGroup);

    this.material = new THREE.MeshStandardMaterial({
      color: new THREE.Color(this.options.color),
      metalness: this.options.metalness,
      roughness: this.options.roughness,
      wireframe: this.options.wireframe,
      side: THREE.DoubleSide
    });

    // 6. بناء المجسم حسب النوع
    this.buildGeometry(this.options.meshType);

    // 7. إعداد أحداث الفأرة واللمس (Interaction Events)
    this.setupInteractions();

    // 8. مواءمة الحجم عند تغيير الشاشة (Resize Listener)
    this.onResize = this.onResize.bind(this);
    window.addEventListener('resize', this.onResize);

    // 9. بدء التحديث والتأثيرات (Animation Loop)
    this.animate();
  }

  buildGeometry(type) {
    // تنظيف المجسم السابق إن وجد
    while (this.meshGroup.children.length > 0) {
      const obj = this.meshGroup.children[0];
      if (obj.geometry) obj.geometry.dispose();
      this.meshGroup.remove(obj);
    }

    let geom;
    switch (type) {
      case 'vase': {
        // مزهرية هندسية لولبية
        const points = [];
        for (let i = 0; i < 15; i++) {
          const y = (i - 7) * 0.15;
          const r = Math.sin(i * 0.4) * 0.4 + 0.65;
          points.push(new THREE.Vector2(r, y));
        }
        geom = new THREE.LatheGeometry(points, 32);
        // إضافة ملتوى لولبي للسطح
        const pos = geom.attributes.position;
        for (let i = 0; i < pos.count; i++) {
          const y = pos.getY(i);
          const x = pos.getX(i);
          const z = pos.getZ(i);
          const angle = y * 1.5;
          pos.setX(i, x * Math.cos(angle) - z * Math.sin(angle));
          pos.setZ(i, x * Math.sin(angle) + z * Math.cos(angle));
        }
        geom.computeVertexNormals();
        break;
      }

      case 'helmet': {
        // خوذة مستقبليات
        geom = new THREE.IcosahedronGeometry(1.2, 3);
        const pos = geom.attributes.position;
        for (let i = 0; i < pos.count; i++) {
          const y = pos.getY(i);
          const x = pos.getX(i);
          const z = pos.getZ(i);
          if (z > 0.4 && Math.abs(y) < 0.4) {
            pos.setZ(i, z * 1.15); // قناع أمامي عاكس
          }
          if (y < -0.5) {
            pos.setY(i, y * 0.8);
          }
        }
        geom.computeVertexNormals();
        break;
      }

      case 'lantern': {
        // فانوس أو مصباح زخرفي ثلاثي الأبعاد
        const group = new THREE.Group();
        // قاعدة المصباح
        const baseGeom = new THREE.CylinderGeometry(0.8, 1, 0.4, 8);
        const baseMesh = new THREE.Mesh(baseGeom, this.material);
        baseMesh.position.y = -1;
        group.add(baseMesh);

        // الهيكل الرئيسي للزخرفة
        const bodyGeom = new THREE.CylinderGeometry(0.7, 0.7, 1.4, 6);
        const bodyMesh = new THREE.Mesh(bodyGeom, this.material);
        group.add(bodyMesh);

        // السقف الهرمي
        const topGeom = new THREE.ConeGeometry(0.9, 0.8, 6);
        const topMesh = new THREE.Mesh(topGeom, this.material);
        topMesh.position.y = 1.1;
        group.add(topMesh);

        this.meshGroup.add(group);
        return;
      }

      case 'gears': {
        // تروس ميكانيكية متداخلة
        const group = new THREE.Group();
        
        const createGear = (radius, teeth, depth, colorHex, posX, posY, posZ) => {
          const shape = new THREE.Shape();
          const numTeeth = teeth;
          for (let i = 0; i < numTeeth; i++) {
            const a1 = (i / numTeeth) * Math.PI * 2;
            const a2 = ((i + 0.3) / numTeeth) * Math.PI * 2;
            const a3 = ((i + 0.5) / numTeeth) * Math.PI * 2;
            const a4 = ((i + 0.8) / numTeeth) * Math.PI * 2;

            const r1 = radius;
            const r2 = radius + 0.2;

            if (i === 0) shape.moveTo(Math.cos(a1) * r1, Math.sin(a1) * r1);
            shape.lineTo(Math.cos(a2) * r2, Math.sin(a2) * r2);
            shape.lineTo(Math.cos(a3) * r2, Math.sin(a3) * r2);
            shape.lineTo(Math.cos(a4) * r1, Math.sin(a4) * r1);
          }
          // فتحة مركزية
          const hole = new THREE.Path();
          hole.absarc(0, 0, radius * 0.4, 0, Math.PI * 2, true);
          shape.holes.push(hole);

          const extrudeSettings = { depth: depth, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: 0.03, bevelThickness: 0.03 };
          const g = new THREE.ExtrudeGeometry(shape, extrudeSettings);
          const mat = this.material.clone();
          mat.color = new THREE.Color(colorHex || this.options.color);
          const m = new THREE.Mesh(g, mat);
          m.position.set(posX, posY, posZ);
          return m;
        };

        const gear1 = createGear(0.8, 12, 0.25, this.options.color, -0.4, 0, 0);
        const gear2 = createGear(0.5, 8, 0.2, '#00F0FF', 0.8, 0.5, 0);
        gear2.rotation.z = 0.2;

        group.add(gear1);
        group.add(gear2);
        this.meshGroup.add(group);
        return;
      }

      case 'keychain': {
        // ميدالية مفاتيح مخصصة
        geom = new THREE.BoxGeometry(2, 0.8, 0.15);
        // نضع شعار أو أجزاء تفاعلية فوقها
        const group = new THREE.Group();
        const base = new THREE.Mesh(geom, this.material);
        group.add(base);

        // حلقة الميدالية
        const ringGeom = new THREE.TorusGeometry(0.3, 0.05, 16, 32);
        const ringMesh = new THREE.Mesh(ringGeom, this.material);
        ringMesh.position.set(-1.2, 0, 0);
        group.add(ringMesh);

        this.meshGroup.add(group);
        return;
      }

      case 'dragon': {
        // تنين مفصلي كريستالي
        const group = new THREE.Group();
        const segments = 9;
        for (let i = 0; i < segments; i++) {
          const size = 0.5 * Math.sin((i / segments) * Math.PI) + 0.2;
          const g = new THREE.OctahedronGeometry(size, 2);
          const m = new THREE.Mesh(g, this.material);
          m.position.x = (i - segments / 2) * 0.35;
          m.position.y = Math.sin(i * 0.6) * 0.2;
          group.add(m);
        }
        this.meshGroup.add(group);
        return;
      }

      case 'ring': {
        // خاتم متداخل
        geom = new THREE.TorusGeometry(0.9, 0.25, 24, 48);
        break;
      }

      case 'tower': {
        // برج تكنولوجيا
        geom = new THREE.CylinderGeometry(0.2, 0.9, 2.2, 4);
        break;
      }

      case 'drum': {
        // طبلة / طبل ثلاثي الأبعاد (3D Drum)
        const group = new THREE.Group();
        
        // جسم الطبل الرئيسي (Drum Body Cylinder)
        const bodyGeom = new THREE.CylinderGeometry(1.0, 0.95, 1.3, 32);
        const bodyMesh = new THREE.Mesh(bodyGeom, this.material);
        group.add(bodyMesh);

        // إطار حماية علوي وسفلي (Drum Rims / Metallic Rings)
        const ringGeom = new THREE.TorusGeometry(1.02, 0.05, 16, 32);
        const rimMat = this.material.clone();
        rimMat.metalness = 0.9;
        rimMat.roughness = 0.1;

        const topRing = new THREE.Mesh(ringGeom, rimMat);
        topRing.rotation.x = Math.PI / 2;
        topRing.position.y = 0.65;
        group.add(topRing);

        const bottomRing = new THREE.Mesh(ringGeom, rimMat);
        bottomRing.rotation.x = Math.PI / 2;
        bottomRing.position.y = -0.65;
        group.add(bottomRing);

        // غشاء/جلدة الطبل العلوية (Drum Head Membrane)
        const headGeom = new THREE.CylinderGeometry(0.98, 0.98, 0.02, 32);
        const headMat = new THREE.MeshStandardMaterial({
          color: new THREE.Color('#FAF9F6'),
          roughness: 0.6,
          metalness: 0.1,
          side: THREE.DoubleSide
        });
        const headMesh = new THREE.Mesh(headGeom, headMat);
        headMesh.position.y = 0.66;
        group.add(headMesh);

        // عودا الإيقاع (Drum Sticks)
        const stickGeom = new THREE.CylinderGeometry(0.025, 0.015, 1.4, 12);
        const tipGeom = new THREE.SphereGeometry(0.05, 12, 12);
        
        const stick1 = new THREE.Group();
        const s1Mesh = new THREE.Mesh(stickGeom, rimMat);
        const tip1Mesh = new THREE.Mesh(tipGeom, this.material);
        tip1Mesh.position.y = 0.7;
        stick1.add(s1Mesh, tip1Mesh);
        stick1.rotation.z = Math.PI / 4;
        stick1.position.set(-0.55, 0.75, 0.2);
        group.add(stick1);

        const stick2 = new THREE.Group();
        const s2Mesh = new THREE.Mesh(stickGeom, rimMat);
        const tip2Mesh = new THREE.Mesh(tipGeom, this.material);
        tip2Mesh.position.y = 0.7;
        stick2.add(s2Mesh, tip2Mesh);
        stick2.rotation.z = -Math.PI / 4;
        stick2.position.set(0.55, 0.75, 0.2);
        group.add(stick2);

        this.meshGroup.add(group);
        return;
      }

      default: {
        geom = new THREE.TorusKnotGeometry(0.8, 0.25, 100, 16);
        break;
      }
    }

    if (geom) {
      this.currentMesh = new THREE.Mesh(geom, this.material);
      this.meshGroup.add(this.currentMesh);
    }
  }

  setupInteractions() {
    const dom = this.renderer.domElement;

    const onPointerDown = (e) => {
      this.isDragging = true;
      this.previousMousePosition = {
        x: e.clientX || (e.touches && e.touches[0].clientX) || 0,
        y: e.clientY || (e.touches && e.touches[0].clientY) || 0
      };
      
      // إذا كان المجسم طبلة، شغل صوت إيقاعي بسيط تفاعلي Web Audio
      if (this.options.meshType === 'drum') {
        this.playDrumSound();
      }
    };


    const onPointerMove = (e) => {
      if (!this.isDragging) return;
      const clientX = e.clientX || (e.touches && e.touches[0].clientX) || 0;
      const clientY = e.clientY || (e.touches && e.touches[0].clientY) || 0;

      const deltaX = clientX - this.previousMousePosition.x;
      const deltaY = clientY - this.previousMousePosition.y;

      this.meshGroup.rotation.y += deltaX * 0.01;
      this.meshGroup.rotation.x += deltaY * 0.01;

      this.previousMousePosition = { x: clientX, y: clientY };
    };

    const onPointerUp = () => {
      this.isDragging = false;
    };

    dom.addEventListener('mousedown', onPointerDown);
    dom.addEventListener('mousemove', onPointerMove);
    window.addEventListener('mouseup', onPointerUp);

    dom.addEventListener('touchstart', onPointerDown, { passive: true });
    dom.addEventListener('touchmove', onPointerMove, { passive: true });
    window.addEventListener('touchend', onPointerUp);

    // زوم العجلة (Zoom)
    dom.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.camera.position.z += e.deltaY * 0.003;
      this.camera.position.z = Math.max(2.0, Math.min(8.0, this.camera.position.z));
    }, { passive: false });
  }

  playDrumSound() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(140, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(30, ctx.currentTime + 0.25);

      gain.gain.setValueAtTime(1.0, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    } catch (e) {}
  }

  setColor(hexColor) {
    if (this.material) {
      this.material.color.set(hexColor);
    }
  }

  setMaterialPreset(preset) {
    if (!this.material) return;
    switch (preset) {
      case 'gold':
        this.material.metalness = 0.9;
        this.material.roughness = 0.15;
        break;
      case 'carbon':
        this.material.metalness = 0.2;
        this.material.roughness = 0.8;
        break;
      case 'neon':
        this.material.metalness = 0.1;
        this.material.roughness = 0.1;
        break;
      case 'resin':
        this.material.metalness = 0.0;
        this.material.roughness = 0.05;
        this.material.transparent = true;
        this.material.opacity = 0.85;
        break;
      default:
        this.material.metalness = 0.4;
        this.material.roughness = 0.3;
        break;
    }
  }

  toggleWireframe(wireframe) {
    if (this.material) {
      this.material.wireframe = wireframe !== undefined ? wireframe : !this.material.wireframe;
    }
  }

  toggleAutoRotate(enable) {
    this.options.autoRotate = enable !== undefined ? enable : !this.options.autoRotate;
  }

  onResize() {
    if (!this.container || !this.renderer || !this.camera) return;
    const width = this.container.clientWidth || 300;
    const height = this.container.clientHeight || 300;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  animate() {
    this.animationFrameId = requestAnimationFrame(() => this.animate());

    if (this.options.autoRotate && !this.isDragging && this.meshGroup) {
      this.meshGroup.rotation.y += 0.008;
    }

    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  }

  destroy() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    window.removeEventListener('resize', this.onResize);

    if (this.scene) {
      this.scene.traverse((child) => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach(m => m.dispose());
          } else {
            child.material.dispose();
          }
        }
      });
    }

    if (this.renderer && this.renderer.domElement && this.container) {
      if (this.container.contains(this.renderer.domElement)) {
        this.container.removeChild(this.renderer.domElement);
      }
      this.renderer.dispose();
    }
  }
}
