/**
 * Cart.js - JavaScript pro nákupní košík
 * Verze 3.0 - Upravená verze s načítáním dat z cookies
 */

document.addEventListener('DOMContentLoaded', function() {
    // ===== INICIALIZACE PROMĚNNÝCH =====
    let cart = [];
    let currentStep = 'cart';
    window.shippingPrice = 79; // Základní cena dopravy (Zásilkovna)
    window.paymentFee = 0; // Základní cena platby
    let discountAmount = 0; // Sleva
    let appliedCoupon = null; // Aplikovaný kupón
    
    // ===== SELEKTORY ELEMENTŮ =====
    // Sekce
    const cartSection = document.getElementById('cart-section');
    const deliverySection = document.getElementById('delivery-section');
    const contactSection = document.getElementById('contact-section');
    const confirmationSection = document.getElementById('confirmation-section');
    const emptyCartSection = document.getElementById('empty-cart');
    
    // Kroky procesu
    const steps = document.querySelectorAll('.step');
    
    // Tlačítka navigace
    const continueToDeliveryBtn = document.getElementById('continue-to-delivery');
    const backToCartBtn = document.getElementById('back-to-cart');
    const continueToContactBtn = document.getElementById('continue-to-contact');
    const backToDeliveryBtn = document.getElementById('back-to-delivery');
    const completeOrderBtn = document.getElementById('complete-order');
    
    // Položky košíku a souhrn
    const cartItemsContainer = document.querySelector('.cart-items');
    const summaryItemsContainer = document.querySelector('.summary-items');
    const subtotalEl = document.getElementById('subtotal');
    const shippingEl = document.getElementById('shipping');
    const discountEl = document.getElementById('discount');
    const totalEl = document.getElementById('total');
    
    // Doprava a platba
    const deliveryOptions = document.querySelectorAll('input[name="delivery"]');
    const paymentOptions = document.querySelectorAll('input[name="payment"]');
    const summaryShippingEl = document.getElementById('summary-shipping');
    const summaryPaymentEl = document.getElementById('summary-payment');
    const summaryDiscountEl = document.getElementById('summary-discount');
    const summaryTotalEl = document.getElementById('summary-total');
    
    // Formulář a kontrolky
    const differentShippingCheck = document.getElementById('different-shipping');
    const shippingAddressSection = document.getElementById('shipping-address');
    const notificationToast = document.getElementById('notification');
    const loaderOverlay = document.querySelector('.loader-overlay');

    // Exponujeme vybrané funkce do globálního okna pro přístup z event listenerů
    window.currentStep = currentStep;
    window.cart = cart;
    window.goToStep = goToStep;
    window.validateDeliverySelection = validateDeliverySelection;
    window.validateContactForm = validateContactForm;
    window.showNotification = showNotification;
    window.hideLoader = hideLoader;
    window.showLoader = showLoader;
    window.prepareOrderData = prepareOrderData;
    window.updateConfirmationWithOrderData = updateConfirmationWithOrderData;
    window.playOrderConfetti = playOrderConfetti;
    window.saveCart = saveCart;
    window.appliedCoupon = appliedCoupon;
    window.discountAmount = discountAmount;
    window.applyCouponWithApi = applyCouponWithApi;
    window.removeCoupon = removeCoupon;
    window.displayAppliedCoupon = displayAppliedCoupon;
    window.initializeCoupons = initializeCoupons;
    window.calculateSubtotal = calculateSubtotal;
    window.updateAllOrderSummaries = updateAllOrderSummaries;

    if (confirmationSection) {
        confirmationSection.style.display = 'none';
    }
    
    // ===== INICIALIZACE =====
    init();
    
    /**
     * Inicializace aplikace
     */
    function init() {
        console.log('Inicializace košíku...');
        
        // Načtení košíku
        loadCart();
        
        // Vykreslení položek košíku
        renderCartItems();
        
        // Načtení uložených preferencí dopravy a platby
        loadSavedPreferences();
        
        // Nastavení event listenerů
        setupEventListeners();
        
        // Aktualizace zobrazených cen
        updatePrices();
        
        // Inicializace animací pro progress bar
        initProgressBar();
        
        // Aktualizace počítadla položek v košíku
        updateCartCounter();
    
        // Nastavení proklikávání kroků
        setupProgressStepsNavigation();

        // Inicializace kupónů
        initializeCoupons();
    }

    function initializeCoupons() {
        // Přidání obsluhy klávesy Enter v poli pro kupón
        const couponInput = document.getElementById('coupon-code');
        if (couponInput) {
            couponInput.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    applyCouponWithApi();
                }
            });
        }
    }
    
    /**
     * Načtení košíku z cookies (dříve z localStorage)
     */
    function loadCart() {
        // Nové - načtení z cookies
        cart = getCartFromCookies();
        
        if (cart.length === 0) {
            showEmptyCart();
        }
        
        console.log('Načtený košík:', cart);
        window.cart = cart; // Aktualizace globální proměnné
    }

    // Přidej na začátek DOMContentLoaded event listener - smazani košíku
    if (sessionStorage.getItem('orderCompleted') === 'true') {
        // Vymažeme košík
        cart = [];
        window.cart = [];
        
        // Vymažeme cookies
        document.cookie = "cart=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/";
        document.cookie = "cart=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/cart";
        document.cookie = "cart=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/cart.html";
        document.cookie = "cart=[]; path=/";
        
        // Také vyčistíme localStorage
        localStorage.removeItem('cart');
        
        // Dáme uživateli informaci
        console.log("Košík byl vymazán po dokončení objednávky");
        
        // Vymažeme flag
        sessionStorage.removeItem('orderCompleted');
    }
    
    /**
     * Získání košíku z cookies
     */
    function getCartFromCookies() {
        // Projdeme všechny cookies a hledáme 'cart='
        const allCookies = document.cookie.split(';');
        let cartCookie = null;
        
        for (let cookie of allCookies) {
            cookie = cookie.trim();
            if (cookie.startsWith('cart=')) {
                cartCookie = cookie.substring(5); // odřízne 'cart='
                break;
            }
        }
        
        if (cartCookie) {
            try {
                // Důležité: dekódujeme obsah cookie
                const decodedCookie = decodeURIComponent(cartCookie);
                console.log("Nalezena cookie košíku:", decodedCookie);
                
                // Parsujeme jako JSON
                const parsedCart = JSON.parse(decodedCookie);
                
                // Ujistíme se, že je to pole
                if (Array.isArray(parsedCart)) {
                    return parsedCart;
                } else {
                    console.error("Košík není pole:", parsedCart);
                    return [];
                }
            } catch (error) {
                console.error('Chyba při parsování košíku:', error);
                return [];
            }
        }
        
        return [];
    }
    
    /**
     * Uložení košíku do cookies
     */
    function saveCart() {
        // DETEKCE: Pokud je košík prázdný, skutečně ho vymažeme
        if (!cart || cart.length === 0) {
            // V tomto případě nechceme jen nastavit expiraci, 
            // chceme kompletně vymazat cookie
            const paths = ['/', '/cart', '/cart.html', '/index.html', '/green.html', '/red.html', '/white.html', ''];
            paths.forEach(path => {
                document.cookie = `cart=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=${path}`;
            });
            // Také vyčistíme localStorage
            localStorage.removeItem('cart');
            return;
        }
        
        // Normální ukládání košíku, pokud má položky
        const date = new Date();
        date.setTime(date.getTime() + (30 * 24 * 60 * 60 * 1000)); // 30 dní platnost
        
        // Uložení do cookies
        document.cookie = `cart=${encodeURIComponent(JSON.stringify(cart))}; expires=${date.toUTCString()}; path=/; samesite=lax`;
    }

    const autoFillStyle = document.createElement('style');
    autoFillStyle.textContent = `
    .auto-filled {
        background-color: rgba(105, 240, 174, 0.1) !important;
        transition: background-color 1s ease;
        border-color: #69f0ae !important;
        box-shadow: 0 0 5px rgba(105, 240, 174, 0.3);
    }
    
    /* Animace pro zvýraznění automaticky vyplněných polí */
    @keyframes autofillPulse {
        0% { box-shadow: 0 0 5px rgba(105, 240, 174, 0.3); }
        50% { box-shadow: 0 0 15px rgba(105, 240, 174, 0.5); }
        100% { box-shadow: 0 0 5px rgba(105, 240, 174, 0.3); }
    }
    
    .auto-filled {
        animation: autofillPulse 1s ease;
    }
    `;
    document.head.appendChild(autoFillStyle);
    
    /**
     * Nastavení event listenerů
     */
    function setupEventListeners() {
        // Navigační tlačítka mezi sekcemi
        if (continueToDeliveryBtn) {
            continueToDeliveryBtn.addEventListener('click', () => goToStep('delivery'));
        }
        
        if (backToCartBtn) {
            backToCartBtn.addEventListener('click', () => goToStep('cart'));
        }
        
        if (continueToContactBtn) {
            continueToContactBtn.addEventListener('click', () => goToStep('contact'));
        }
        
        if (backToDeliveryBtn) {
            backToDeliveryBtn.addEventListener('click', () => goToStep('delivery'));
        }
        
        if (completeOrderBtn) {
            completeOrderBtn.addEventListener('click', completeOrder);
        }
        
        // Ovládání množství a odstranění položek
        setupCartItemControls();
        
        // Slevový kupón
        const applyBtn = document.getElementById('apply-coupon');
        if (applyBtn) {
            applyBtn.addEventListener('click', applyCouponWithApi);
        }
        
        // Změna způsobu dopravy
        deliveryOptions.forEach(option => {
            option.addEventListener('change', updateShippingPrice);
        });
        
        // Změna způsobu platby
        paymentOptions.forEach(option => {
            option.addEventListener('change', updatePaymentFee);
        });
        
        // Zaškrtávací políčko pro jinou doručovací adresu
        if (differentShippingCheck) {
            differentShippingCheck.addEventListener('change', toggleShippingAddress);
        }
        
        // Zavření notifikace
        const toastCloseBtn = document.querySelector('.toast-close');
        if (toastCloseBtn) {
            toastCloseBtn.addEventListener('click', () => {
                hideNotification();
            });
        }
        
        // Animace pro "Zpět do obchodu" tlačítka
        const backButtons = document.querySelectorAll('.back-button, .back-to-shop-btn');
        backButtons.forEach(button => {
            button.addEventListener('click', function(e) {
                e.preventDefault();
                const targetUrl = this.getAttribute('href');
                
                this.classList.add('clicked');
                
                setTimeout(() => {
                    window.location.href = targetUrl;
                }, 300);
            });
        });
    }
    
    /**
     * Přepnutí zobrazení doručovací adresy
     */
    function toggleShippingAddress() {
        if (shippingAddressSection) {
            if (differentShippingCheck.checked) {
                shippingAddressSection.classList.remove('hidden');
                // Plynulá animace zobrazení
                setTimeout(() => {
                    shippingAddressSection.classList.add('visible');
                }, 10);
            } else {
                shippingAddressSection.classList.remove('visible');
                // Počkáme na dokončení animace
                setTimeout(() => {
                    shippingAddressSection.classList.add('hidden');
                }, 300);
            }
        }
    }
    
    /**
     * Nastavení ovládání položek košíku - upravené pro lepší UI
     */
    function setupCartItemControls() {
        // Klonování a znovupřidání event listenerů, což odstraní všechny stávající event listenery
        
        // Tlačítka pro zvýšení množství
        document.querySelectorAll('.qty-btn.plus').forEach(button => {
            const newButton = button.cloneNode(true);
            button.parentNode.replaceChild(newButton, button);
            
            newButton.addEventListener('click', function(e) {
                e.stopPropagation(); // Zastaví bublání eventu
                const id = parseInt(this.getAttribute('data-id'));
                updateQuantity(id, 1);
            });
        });
        
        // Tlačítka pro snížení množství
        document.querySelectorAll('.qty-btn.minus').forEach(button => {
            const newButton = button.cloneNode(true);
            button.parentNode.replaceChild(newButton, button);
            
            newButton.addEventListener('click', function(e) {
                e.stopPropagation(); // Zastaví bublání eventu
                const id = parseInt(this.getAttribute('data-id'));
                updateQuantity(id, -1);
            });
        });
        
        // Vstupní pole pro přímou úpravu množství
        document.querySelectorAll('input.quantity').forEach(input => {
            const newInput = input.cloneNode(true);
            input.parentNode.replaceChild(newInput, input);
            
            newInput.addEventListener('change', function() {
                const id = parseInt(this.getAttribute('data-id'));
                const newValue = parseInt(this.value);
                
                if (isNaN(newValue) || newValue < 1) {
                    this.value = 1;
                    updateQuantityDirectly(id, 1);
                } else {
                    updateQuantityDirectly(id, newValue);
                }
            });
            
            // Zabránění vložení neplatných hodnot
            newInput.addEventListener('keypress', function(e) {
                if (!/[0-9]/.test(e.key)) {
                    e.preventDefault();
                }
            });
        });
        
        // Tlačítka pro odstranění položky
        document.querySelectorAll('.remove-btn').forEach(button => {
            const newButton = button.cloneNode(true);
            button.parentNode.replaceChild(newButton, button);
            
            newButton.addEventListener('click', function(e) {
                e.stopPropagation(); // Zastaví bublání eventu
                const id = parseInt(this.getAttribute('data-id'));
                removeItem(id);
            });
        });
    }
    
    /**
     * Vykreslení položek košíku v UI s vylepšenou funkcionalitou
     */
    function renderCartItems() {
        // Kontrola, zda jsou potřebné selektory k dispozici
        if (!cartItemsContainer || !summaryItemsContainer) return;
        
        // Vyčištění kontejnerů
        cartItemsContainer.innerHTML = '';
        summaryItemsContainer.innerHTML = '';
        
        // Přidání položek do košíku
        cart.forEach((item, index) => {
            // ID položky je index v poli, abychom zajistili unikátnost
            const itemId = index + 1;
            
            // Vytvoření položky košíku s numerickým vstupem pro množství
            const cartItemHTML = `
                <div class="cart-item" data-id="${itemId}">
                    <div class="item-image">
                        <img src="${item.image}" alt="${item.name}">
                    </div>
                    <div class="item-details">
                        <div class="item-header">
                            <h3>${item.name}</h3>
                            <button class="remove-btn" aria-label="Odstranit položku" data-id="${itemId}"></button>
                        </div>
                        <div class="item-variant">
                            <span class="variant-badge">${(item.weight || item.variant) + (item.weight ? 'g' : '')}</span>
                            <div class="item-properties">
                                <span class="prop"><i class="fas fa-leaf"></i> Premium kvalita</span>
                                <span class="prop"><i class="fas fa-box"></i> Skladem</span>
                            </div>
                        </div>
                        <div class="item-bottom">
                            <div class="quantity-control">
                                <button class="qty-btn minus" data-id="${itemId}">
                                    <i class="fas fa-minus"></i>
                                </button>
                                <input type="number" class="quantity" value="${item.quantity}" min="1" max="99" data-id="${itemId}">
                                <button class="qty-btn plus" data-id="${itemId}">
                                    <i class="fas fa-plus"></i>
                                </button>
                            </div>
                            <div class="item-price">${item.price * item.quantity} Kč</div>
                        </div>
                    </div>
                </div>
            `;
            
            // Přidání do košíku
            cartItemsContainer.innerHTML += cartItemHTML;
            
            // Přidání do souhrnu
            const summaryItemHTML = `
                <div class="summary-item">
                    <img src="${item.image}" alt="${item.name}" class="summary-item-img">
                    <div class="summary-item-details">
                        <span class="summary-item-name">${item.name}</span>
                        <span class="summary-item-variant">${(item.weight || item.variant) + (item.weight ? 'g' : '')} × ${item.quantity}</span>
                    </div>
                    <span class="summary-item-price">${item.price * item.quantity} Kč</span>
                </div>
            `;
            
            // Přidání do souhrnu
            summaryItemsContainer.innerHTML += summaryItemHTML;
        });
        
        // Přidání kupónu do košíku
        if (cart.length > 0) {
            const couponHTML = `
                <div class="coupon-container">
                    <div class="coupon-title">
                        <i class="fas fa-ticket-alt"></i>
                        <span>Slevový kupón</span>
                    </div>
                    <div class="coupon-input-group">
                        <input type="text" id="coupon-code" placeholder="Zadejte slevový kód...">
                        <button id="apply-coupon" class="apply-btn">
                            <span>Použít</span>
                            <i class="fas fa-check"></i>
                        </button>
                    </div>
                </div>
            `;
            
            cartItemsContainer.innerHTML += couponHTML;
            
            // Obnovení event listenerů
            setupCartItemControls();
            
            // Slevový kupón
            const applyBtn = document.getElementById('apply-coupon');
            if (applyBtn) {
                applyBtn.addEventListener('click', applyCouponWithApi);
            }
        }
    }
    
    /**
     * Inicializace progress baru
     */
    function initProgressBar() {
        updateProgressBar('cart');
    }
    
    // Pomocná funkce pro načtení uživatelských dat z cookies
    function loadUserDataFromCookies() {
        console.log("Načítání uživatelských dat z cookies...");
        
        const cookieObj = {};
        document.cookie.split(';').forEach(cookie => {
            const parts = cookie.split('=');
            if (parts.length >= 2) {
                const key = parts[0].trim();
                const value = parts.slice(1).join('=').trim();
                try {
                    cookieObj[key] = decodeURIComponent(value);
                } catch (e) {
                    cookieObj[key] = value;
                }
            }
        });
        
        // Vyplnění formuláře, pokud existují data
        const formFields = {
            'customer_name': 'name',
            'customer_email': 'email',
            'customer_phone': 'phone',
            'customer_address': 'street',
            'customer_city': 'city',
            'customer_zip': 'zip'
        };
        
        let dataLoaded = false;
        
        for (const [cookieKey, fieldId] of Object.entries(formFields)) {
            const field = document.getElementById(fieldId);
            const value = cookieObj[cookieKey];
            
            if (field && value && !field.value) {  // Vyplníme pouze prázdná pole
                console.log(`Vyplňuji pole ${fieldId} hodnotou z cookie ${cookieKey}`);
                field.value = value;
                field.classList.add('auto-filled');
                setTimeout(() => {
                    field.classList.remove('auto-filled');
                }, 2000);
                dataLoaded = true;
            }
        }
        
        // Vyplnění doručovací adresy, pokud existuje
        const shippingFields = {
            'shipping_name': 'shipping-name',
            'shipping_address': 'shipping-street',
            'shipping_city': 'shipping-city',
            'shipping_zip': 'shipping-zip'
        };
        
        let shippingDataPresent = false;
        
        for (const [cookieKey, fieldId] of Object.entries(shippingFields)) {
            const field = document.getElementById(fieldId);
            const value = cookieObj[cookieKey];
            
            if (field && value) {
                field.value = value;
                field.classList.add('auto-filled');
                setTimeout(() => {
                    field.classList.remove('auto-filled');
                }, 2000);
                shippingDataPresent = true;
            }
        }
        
        // Aktivace checkboxu pro jinou doručovací adresu, pokud jsou data pro doručovací adresu
        if (shippingDataPresent) {
            const differentShippingCheck = document.getElementById('different-shipping');
            if (differentShippingCheck) {
                differentShippingCheck.checked = true;
                
                // Zobrazení sekce doručovací adresy
                const shippingAddressSection = document.getElementById('shipping-address');
                if (shippingAddressSection) {
                    shippingAddressSection.classList.remove('hidden');
                    setTimeout(() => {
                        shippingAddressSection.classList.add('visible');
                    }, 10);
                }
            }
        }
        
        // Vyvolání události, že byla načtena uživatelská data
        if (dataLoaded) {
            console.log("Uživatelská data byla úspěšně načtena z cookies");
            document.dispatchEvent(new CustomEvent('userDataLoaded'));
        } else {
            console.log("Žádná uživatelská data nebyla nalezena v cookies");
        }
        
        return dataLoaded;
    }

    // Funkce pro ukládání uživatelských dat do cookies
    if (typeof saveUserDataToCookies !== 'function') {
        // Vytvoření základní implementace, pokud funkce neexistuje
        function saveUserDataToCookies() {
            console.log("Základní implementace saveUserDataToCookies");
            
            // Uložení dat zákazníka
            const formFields = {
                'name': 'customer_name',
                'email': 'customer_email',
                'phone': 'customer_phone',
                'street': 'customer_address',
                'city': 'customer_city',
                'zip': 'customer_zip'
            };
            
            for (const [fieldId, cookieKey] of Object.entries(formFields)) {
                const field = document.getElementById(fieldId);
                if (field && field.value) {
                    setLongCookie(cookieKey, field.value, 90); // 90 dní (3 měsíce)
                }
            }
            
            // Uložení doručovací adresy, pokud se liší
            const differentShippingCheck = document.getElementById('different-shipping');
            if (differentShippingCheck && differentShippingCheck.checked) {
                const shippingFields = {
                    'shipping-name': 'shipping_name',
                    'shipping-street': 'shipping_address',
                    'shipping-city': 'shipping_city',
                    'shipping-zip': 'shipping_zip'
                };
                
                for (const [fieldId, cookieKey] of Object.entries(shippingFields)) {
                    const field = document.getElementById(fieldId);
                    if (field && field.value) {
                        setLongCookie(cookieKey, field.value, 90); // 90 dní
                    }
                }
            }
        }
        
        // Ujistíme se, že funkce je přístupná v globálním rozsahu
        window.saveUserDataToCookies = saveUserDataToCookies;
    }

    function enhancedSaveUserDataToCookies() {
        console.log("Ukládání uživatelských dat do cookies - vylepšená verze");
        
        // Mapování polí formuláře na cookies
        const formFields = {
            'name': 'customer_name',
            'email': 'customer_email',
            'phone': 'customer_phone',
            'company': 'customer_company',
            'street': 'customer_address',
            'city': 'customer_city',
            'zip': 'customer_zip'
        };
        
        // Ukládání fakturačních údajů - pouze vyplněné hodnoty
        for (const [fieldId, cookieKey] of Object.entries(formFields)) {
            const field = document.getElementById(fieldId);
            if (field && field.value.trim()) {
                console.log(`Ukládám ${fieldId} do cookie ${cookieKey}`);
                setLongCookie(cookieKey, field.value.trim(), 90);
            } else if (field) {
                console.log(`Pole ${fieldId} je prázdné, cookie ${cookieKey} nebude nastavena`);
                // Neukládáme prázdné hodnoty, případně můžeme vymazat existující cookie:
                document.cookie = `${cookieKey}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; samesite=lax`;
            }
        }
        
        // Ukládání doručovací adresy, pokud je vyplněna a je zaškrtnuté pole pro jinou doručovací adresu
        const differentShippingCheck = document.getElementById('different-shipping');
        if (differentShippingCheck && differentShippingCheck.checked) {
            const shippingFields = {
                'shipping-name': 'shipping_name',
                'shipping-street': 'shipping_address',
                'shipping-city': 'shipping_city',
                'shipping-zip': 'shipping_zip'
            };
            
            for (const [fieldId, cookieKey] of Object.entries(shippingFields)) {
                const field = document.getElementById(fieldId);
                if (field && field.value.trim()) {
                    console.log(`Ukládám ${fieldId} do cookie ${cookieKey}`);
                    setLongCookie(cookieKey, field.value.trim(), 90);
                } else if (field) {
                    console.log(`Pole ${fieldId} je prázdné, cookie ${cookieKey} nebude nastavena`);
                    // Neukládáme prázdné hodnoty, případně můžeme vymazat existující cookie:
                    document.cookie = `${cookieKey}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; samesite=lax`;
                }
            }
        } else {
            // Pokud není zaškrtnuté pole pro jinou doručovací adresu, vymažeme všechny cookies s doručovací adresou
            console.log("Doručovací adresa není aktivní, mažu všechny související cookies");
            const shippingCookies = ['shipping_name', 'shipping_address', 'shipping_city', 'shipping_zip'];
            for (const cookieKey of shippingCookies) {
                document.cookie = `${cookieKey}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; samesite=lax`;
            }
        }
    }
    
    // Ujistíme se, že funkce enhancedSaveUserDataToCookies je přístupná v globálním rozsahu
    window.enhancedSaveUserDataToCookies = enhancedSaveUserDataToCookies;

    if (typeof window.saveUserDataToCookies === 'function') {
        console.log("Nahrazuji existující funkci saveUserDataToCookies vylepšenou verzí");
        window.saveUserDataToCookies = enhancedSaveUserDataToCookies;
    } else {
        console.warn("Funkce saveUserDataToCookies nebyla nalezena, nastavuji jako vylepšenou verzi");
        window.saveUserDataToCookies = enhancedSaveUserDataToCookies;
    }

    // Funkce pro získání všech cookies jako objektu
    function getAllCookies() {
        const cookieObj = {};
        const cookies = document.cookie.split(';');
        
        for (let cookie of cookies) {
            cookie = cookie.trim();
            if (!cookie) continue;
            
            const [name, ...rest] = cookie.split('=');
            const value = rest.join('=');
            
            try {
                cookieObj[name.trim()] = decodeURIComponent(value);
            } catch (e) {
                cookieObj[name.trim()] = value;
            }
        }
        
        console.log("Získaná data z cookies:", Object.keys(cookieObj));
        return cookieObj;
    }

    // Spolehlivá funkce pro načítání dat z cookies do formuláře
    function fillFormFromCookies() {
        console.log("Začínám vyplňovat formulář z cookies");
        
        // Získání všech cookies
        const cookieData = getAllCookies();
        
        // Mapování cookies na ID polí formuláře
        const fieldMappings = {
            // Fakturační údaje
            'customer_name': 'name',
            'customer_email': 'email',
            'customer_phone': 'phone',
            'customer_company': 'company',
            'customer_address': 'street',
            'customer_city': 'city',
            'customer_zip': 'zip',
            
            // Doručovací údaje
            'shipping_name': 'shipping-name',
            'shipping_address': 'shipping-street',
            'shipping_city': 'shipping-city',
            'shipping_zip': 'shipping-zip'
        };
        
        // Počítadlo vyplněných polí
        let filledFields = 0;
        
        // Sledování, které doručovací údaje jsou vyplněny
        const shippingFields = {
            name: false,
            address: false,
            city: false,
            zip: false
        };
        
        // Projít všechna mapování a vyplnit pole
        Object.entries(fieldMappings).forEach(([cookieKey, fieldId]) => {
            const cookieValue = cookieData[cookieKey];
            const field = document.getElementById(fieldId);
            
            // Kontrola, zda hodnota v cookie existuje, není prázdná nebo "null"
            if (field && cookieValue && cookieValue !== 'null' && cookieValue !== '') {
                console.log(`Vyplňuji pole '${fieldId}' hodnotou z cookie '${cookieKey}'`);
                field.value = cookieValue;
                field.classList.add('cookie-filled');
                
                // Zvýraznění pole
                field.style.transition = "background-color 1s";
                field.style.backgroundColor = "rgba(105, 240, 174, 0.1)";
                field.style.borderColor = "#69f0ae";
                
                // Odstranění zvýraznění po 2 sekundách
                setTimeout(() => {
                    field.style.backgroundColor = "";
                    field.style.borderColor = "";
                }, 2000);
                
                filledFields++;
                
                // Sledování vyplnění doručovacích údajů
                if (fieldId === 'shipping-name') shippingFields.name = true;
                if (fieldId === 'shipping-street') shippingFields.address = true;
                if (fieldId === 'shipping-city') shippingFields.city = true;
                if (fieldId === 'shipping-zip') shippingFields.zip = true;
            }
        });
        
        // Kontrola, zda máme kompletní doručovací údaje
        const hasAllShippingFields = shippingFields.name && shippingFields.address && 
                                    shippingFields.city && shippingFields.zip;
        
        // Aktivace sekce doručovací adresy pouze pokud máme všechna potřebná data
        if (hasAllShippingFields) {
            const differentShippingCheckbox = document.getElementById('different-shipping');
            if (differentShippingCheckbox) {
                console.log("Aktivuji přepínač pro doručovací adresu - máme všechna potřebná data");
                differentShippingCheckbox.checked = true;
                
                // Zobrazení sekce doručovací adresy
                const shippingAddressSection = document.getElementById('shipping-address');
                if (shippingAddressSection) {
                    shippingAddressSection.classList.remove('hidden');
                    setTimeout(() => {
                        shippingAddressSection.classList.add('visible');
                    }, 100);
                } else {
                    console.log("Element shipping-address nebyl nalezen");
                }
            } else {
                console.log("Přepínač different-shipping nebyl nalezen");
            }
        } else {
            console.log("Nemáme všechna potřebná data pro doručovací adresu, sekce zůstane skrytá");
            // Ujistíme se, že přepínač není zaškrtnutý, pokud nemáme všechna data
            const differentShippingCheckbox = document.getElementById('different-shipping');
            if (differentShippingCheckbox) {
                differentShippingCheckbox.checked = false;
            }
        }
        
        console.log(`Vyplněno ${filledFields} polí z cookies`);
        return filledFields > 0;
    }

    function activateShippingAddressIfNeeded() {
        const differentShippingCheckbox = document.getElementById('different-shipping');
        if (differentShippingCheckbox && differentShippingCheckbox.checked) {
            console.log("Aktivuji sekci doručovací adresy");
            
            // Zobrazení sekce doručovací adresy
            const shippingAddressSection = document.getElementById('shipping-address');
            if (shippingAddressSection) {
                shippingAddressSection.classList.remove('hidden');
                setTimeout(() => {
                    shippingAddressSection.classList.add('visible');
                }, 100);
            }
        }
    }

    function retryFillForm(maxRetries = 5, delay = 300) {
        let retries = 0;
        
        function attempt() {
            console.log(`Pokus ${retries + 1} o vyplnění formuláře`);
            
            // Pokud už existuje nějaké pole formuláře, pokusíme se ho vyplnit
            const nameField = document.getElementById('name');
            
            if (nameField) {
                const success = fillFormFromCookies();
                
                if (success) {
                    console.log("Formulář byl úspěšně vyplněn");
                    return;
                }
            } else {
                console.log("Element 'name' ještě není k dispozici, čekám...");
            }
            
            // Pokud jsme neuspěli a máme ještě pokusy, zkusíme to znovu
            retries++;
            if (retries < maxRetries) {
                console.log(`Další pokus za ${delay}ms...`);
                setTimeout(attempt, delay);
            } else {
                console.log("Vyčerpány všechny pokusy o vyplnění formuláře");
            }
        }
        
        // Spustíme první pokus
        attempt();
    }

    // Pomocná funkce pro nastavení cookies s delší expirací
    function setLongCookie(name, value, days) {
        const date = new Date();
        date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
        document.cookie = `${name}=${encodeURIComponent(value)}; expires=${date.toUTCString()}; path=/; samesite=lax`;
    }

    // Pomocná funkce pro přípravu dat objednávky
    function prepareOrderData() {
        // Příprava informací o zákazníkovi
        const customer = {
            name: document.getElementById('name').value,
            email: document.getElementById('email').value,
            phone: document.getElementById('phone').value,
            address: document.getElementById('street').value,
            city: document.getElementById('city').value,
            zip: document.getElementById('zip').value,
            country: 'Česká republika' // Výchozí hodnota
        };
        
        // Kontrola, zda byla vybrána jiná doručovací adresa
        const differentShipping = document.getElementById('different-shipping').checked;
        if (differentShipping) {
            customer.shipping_address = {
                name: document.getElementById('shipping-name').value,
                address: document.getElementById('shipping-street').value,
                city: document.getElementById('shipping-city').value,
                zip: document.getElementById('shipping-zip').value,
                country: 'Česká republika'
            };
        }
        
        // Příprava informací o položkách
        const items = cart.map(item => ({
            id: item.id,
            name: item.name,
            variant: item.variant || item.weight + (item.unit || 'g'),
            price: Number(item.price),  // Zajistíme, že cena je číslo, ne řetězec
            quantity: Number(item.quantity),  // Zajistíme, že množství je číslo, ne řetězec
            total: Number(item.price * item.quantity)  // Zajistíme, že je to číslo
        }));
        
        // Získání vybrané dopravy
        const selectedDelivery = document.querySelector('input[name="delivery"]:checked');
        const shipping = {
            method: selectedDelivery ? selectedDelivery.value : 'zasilkovna',
            price: Number(window.shippingPrice)  // Zajistíme, že je to číslo
        };
        
        // Pokud je vybrána Zásilkovna, přidáme informace o pobočce
        if (shipping.method === 'zasilkovna') {
            const branchId = localStorage.getItem('selectedBranchId');
            const branchName = localStorage.getItem('selectedBranchName');
            const branchAddress = localStorage.getItem('selectedBranchAddress');
            
            if (branchId && branchName) {
                shipping.branch = {
                    id: branchId,
                    name: branchName,
                    address: branchAddress
                };
            }
        }
        
        // Získání vybrané platby
        const selectedPayment = document.querySelector('input[name="payment"]:checked');
        const payment = {
            method: selectedPayment ? selectedPayment.value : 'bank',  // Default to bank transfer
            price: Number(window.paymentFee)  // Zajistíme, že je to číslo
        };
        
        const discount = window.discountAmount || 0;

        // Příprava poznámky
        const note = document.getElementById('note').value;
        
        // Příprava informací o kupónu, pokud byl použit
        const coupon = appliedCoupon ? {
            code: appliedCoupon.code,
            discount: discountAmount
        } : null;
        
        // Sestavení kompletních dat objednávky
        const subtotal = calculateSubtotal();
        const total = calculateTotal();
        
        return {
            customer,
            items,
            shipping,
            payment,
            subtotal: Number(subtotal),
            total: Number(total),
            discount: Number(discount),
            note,
            coupon: appliedCoupon ? {
                code: appliedCoupon.code,
                discount: discountAmount,
                discount_type: appliedCoupon.type,
                discount_value: appliedCoupon.value,
                description: appliedCoupon.description
            } : null
        };
    }
// Funkce pro odeslání objednávky na server  
function completeOrderWithApi() {
    try {
        // Validace formuláře
        if (!validateContactForm()) {
            showNotification('Vyplňte prosím všechny povinné údaje', 'error');
            return;
        }
        
        // Zobrazení loaderu
        showLoader();
        
        // ULOŽENÍ KOŠÍKU PRO PŘÍPAD NEÚSPĚCHU
        const backupCart = JSON.stringify(cart);
        
        // Příprava dat objednávky
        const orderData = prepareOrderData();
        console.log('Připravená data objednávky:', orderData);
        
        // Přidáme informaci o použitém kupónu
        if (window.appliedCoupon) {
            orderData.coupon = {
                code: window.appliedCoupon.code,
                discount: window.discountAmount,
                discount_type: window.appliedCoupon.type,
                discount_value: window.appliedCoupon.value,
                description: window.appliedCoupon.description
            };
        }
        
        // Volání API pro vytvoření objednávky
        fetch('http://127.0.0.1:5000/api/shop/create-order', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(orderData)
        })
        .then(function(response) {
            if (!response.ok) {
                throw new Error('Chyba při odesílání objednávky: ' + response.statusText);
            }
            return response.json();
        })
        .then(function(data) {
            // Aktualizace detailů potvrzení
            if (typeof updateConfirmationWithOrderData === 'function') {
                updateConfirmationWithOrderData(data.order);
            } else if (window.updateConfirmationWithOrderData) {
                window.updateConfirmationWithOrderData(data.order);
            }
            
            // Uložení čísla objednávky do lokálního úložiště pro budoucí reference
            if (data.order.order_number) {
                localStorage.setItem('lastOrderNumber', data.order.order_number);
            }
            
            // Přidáme třídu pro identifikaci dokončené objednávky
            document.body.classList.add('confirmation-page');
            
            // Předběžně skryjeme progress bar
            const header = document.querySelector('header');
            if (header) {
                header.style.display = 'none';
            }
            
            // Přechod na potvrzovací obrazovku
            if (typeof goToStep === 'function') {
                goToStep('confirmation');
            } else if (window.goToStep) {
                window.goToStep('confirmation');
            }
            
            // Skrytí loaderu
            hideLoader();
            
            // Přehrání konfetti efektu pro radost z úspěšné objednávky
            if (typeof playOrderConfetti === 'function') {
                playOrderConfetti();
            } else if (window.playOrderConfetti) {
                window.playOrderConfetti();
            }
            
            // NASTAVÍME FLAG V SESSION STORAGE
            // Pomocné řešení pro reload stránky
            sessionStorage.setItem('orderCompleted', 'true');
            sessionStorage.setItem('lastOrderNumber', data.order.order_number);
        })
        .catch(function(error) {
            // Skrytí loaderu
            hideLoader();
            
            // OBNOVENÍ KOŠÍKU Z BACKUPU PŘI CHYBĚ
            try {
                cart = JSON.parse(backupCart);
                window.cart = cart;
                saveCart();
            } catch (e) {
                console.error('Nepovedlo se obnovit košík', e);
            }
            
            // Zobrazení chyby
            showNotification(error.message || 'Došlo k chybě při dokončování objednávky', 'error');
            console.error('Chyba při odesílání objednávky:', error);
        });
    } catch (error) {
        console.error('Neočekávaná chyba při přípravě dat:', error);
        hideLoader();
        showNotification('Došlo k neočekávané chybě: ' + error.message, 'error');
    }
}

function displayAppliedCoupon(coupon) {
    const couponContainer = document.querySelector('.coupon-container');
    if (!couponContainer || !coupon) return;
    
    // Vyčistit případné existující zobrazení kupónu
    const existingDisplay = couponContainer.querySelector('.coupon-applied');
    if (existingDisplay) {
        existingDisplay.remove();
    }
    
    // Skrýt vstupní pole a tlačítko
    const couponInputGroup = couponContainer.querySelector('.coupon-input-group');
    if (couponInputGroup) {
        couponInputGroup.style.display = 'none';
    }
    
    // Vytvořit element pro zobrazení aplikovaného kupónu
    const couponApplied = document.createElement('div');
    couponApplied.className = 'coupon-applied';
    couponApplied.innerHTML = `
        <div class="coupon-info">
            <span class="coupon-badge">${coupon.code}</span>
            <span class="coupon-description">${coupon.description}</span>
        </div>
        <button type="button" class="remove-coupon-btn" title="Odstranit kupón">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    // Přidat nový element
    couponContainer.appendChild(couponApplied);
    
    // Přidat event listener pro odstranění kupónu
    const removeBtn = couponApplied.querySelector('.remove-coupon-btn');
    if (removeBtn) {
        removeBtn.addEventListener('click', function() {
            // Odstranit kupón
            removeCoupon();
            
            // Zobrazit vstupní pole a tlačítko
            if (couponInputGroup) {
                couponInputGroup.style.display = 'flex';
            }
            
            // Odstranit zobrazení kupónu
            couponApplied.remove();
        });
    }
    
    // Zobrazit řádek slevy v souhrnu
    const discountRows = document.querySelectorAll('.summary-rows .discount');
    discountRows.forEach(row => {
        row.style.display = ''; // Ujistíme se, že je řádek viditelný
    });
}



document.addEventListener('DOMContentLoaded', function() {
    console.log("Připojuji vylepšenou funkci k tlačítku 'Dokončit objednávku'");
    
    // Najít tlačítko
    const completeOrderBtn = document.getElementById('complete-order');
    const confirmOrderBtn = document.getElementById('confirmOrderBtn');
    
    if (completeOrderBtn) {
        // Přímé připojení k tlačítku Dokončit objednávku
        completeOrderBtn.addEventListener('click', function() {
            console.log("Tlačítko 'Dokončit objednávku' bylo kliknuto - přímo spouštím enhancedSaveUserDataToCookies");
            // Volání funkce bez ohledu na validaci
            enhancedSaveUserDataToCookies();
        });
        console.log("Připojeno k tlačítku 'Dokončit objednávku'");
    } else {
        console.warn("Tlačítko 'Dokončit objednávku' nenalezeno");
    }
    
    if (confirmOrderBtn) {
        // Přímé připojení k tlačítku Objednat v modálním okně
        confirmOrderBtn.addEventListener('click', function() {
            console.log("Tlačítko 'Objednat' bylo kliknuto - přímo spouštím enhancedSaveUserDataToCookies");
            // Volání funkce bez ohledu na validaci
            enhancedSaveUserDataToCookies();
        });
        console.log("Připojeno k tlačítku 'Objednat' v modálním okně");
    }
});


window.validateContactForm = function() {
    console.log("Volání nové funkce validateContactForm");
    
    // Zde je vaše základní validační logika
    const requiredFields = [
        document.getElementById('name'),
        document.getElementById('email'),
        document.getElementById('phone'),
        document.getElementById('street'),
        document.getElementById('city'),
        document.getElementById('zip')
    ];
    
    let isValid = true;
    let firstInvalidField = null;
    
    // Kontrola vyplnění povinných polí
    requiredFields.forEach(field => {
        if (field && !field.value.trim()) {
            field.classList.add('error');
            isValid = false;
            
            if (!firstInvalidField) {
                firstInvalidField = field;
            }
            
            // Odstranění error třídy po animaci
            setTimeout(() => {
                field.classList.remove('error');
            }, 1000);
        }
    });
    
    // Kontrola e-mailu
    const emailField = document.getElementById('email');
    if (emailField && emailField.value.trim() && !validateEmail(emailField.value)) {
        emailField.classList.add('error');
        isValid = false;
        
        if (!firstInvalidField) {
            firstInvalidField = emailField;
        }
        
        setTimeout(() => {
            emailField.classList.remove('error');
        }, 1000);
    }
    
    // Kontrola doručovací adresy, pokud je vybrána
    const differentShipping = document.getElementById('different-shipping');
    if (differentShipping && differentShipping.checked) {
        const shippingFields = [
            document.getElementById('shipping-name'),
            document.getElementById('shipping-street'),
            document.getElementById('shipping-city'),
            document.getElementById('shipping-zip')
        ];
        
        shippingFields.forEach(field => {
            if (field && !field.value.trim()) {
                field.classList.add('error');
                isValid = false;
                
                if (!firstInvalidField) {
                    firstInvalidField = field;
                }
                
                setTimeout(() => {
                    field.classList.remove('error');
                }, 1000);
            }
        });
    }
    
    // Pokud existuje neplatné pole, scrollujeme k němu
    if (firstInvalidField) {
        firstInvalidField.focus();
        firstInvalidField.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    
    // Pokud je formulář validní, ukládáme data a přidáme hlasitou informaci v konzoli
    if (isValid) {
        console.log("FORMULÁŘ JE VALIDNÍ - UKLÁDÁM DATA DO COOKIES");
        enhancedSaveUserDataToCookies();
    }
    
    return isValid;
};

// Ujistíme se, že funkce je skutečně definována v globálním rozsahu
window.enhancedSaveUserDataToCookies = enhancedSaveUserDataToCookies;

// Také zkusíme reagovat na přepnutí na záložku "kontakt"
document.addEventListener('click', function(e) {
    // Kontrola, zda bylo kliknuto na tlačítko pro přechod na fakturaci
    if (e.target && (
        e.target.id === 'continue-to-contact' || 
        (e.target.parentElement && e.target.parentElement.id === 'continue-to-contact')
    )) {
        console.log("Kliknuto na tlačítko pro přechod na fakturaci, vyplňuji formulář");
        
        // Počkáme, až se sekce zobrazí a pak vyplníme formulář
        setTimeout(() => {
            fillFormFromCookies();
            activateShippingAddressIfNeeded();
        }, 500);
    }
});

// Rozšíření inicializační funkce o volání API
const originalInit = window.init || function() {};
window.init = function() {
    // Volání původní inicializační funkce
    originalInit.call(this);
    
    // Načtení metod dopravy a platby z API
    loadShippingPaymentMethods();
    
    // Přepsání funkce pro aplikaci kupónu
    const applyBtn = document.getElementById('apply-coupon');
    if (applyBtn) {
        // Odstranění všech existujících event listenerů
        const newApplyBtn = applyBtn.cloneNode(true);
        applyBtn.parentNode.replaceChild(newApplyBtn, applyBtn);
        
        // Přidání nového event listeneru pro volání API
        newApplyBtn.addEventListener('click', applyCouponWithApi);
    }
    
    // Přepsání funkce pro dokončení objednávky
    const completeOrderBtn = document.getElementById('complete-order');
    if (completeOrderBtn) {
        // Odstranění všech existujících event listenerů
        const newCompleteOrderBtn = completeOrderBtn.cloneNode(true);
        completeOrderBtn.parentNode.replaceChild(newCompleteOrderBtn, completeOrderBtn);
        
        // Přidání nového event listeneru pro volání API
        newCompleteOrderBtn.addEventListener('click', function(e) {
            e.preventDefault();
            console.log("Tlačítko 'Dokončit objednávku' bylo kliknuto");
            completeOrderWithApi();
        });
    }
    
    // Sledování změn v metodě dopravy pro aktualizaci kompatibility plateb
    let selectedShippingMethod = 'zasilkovna'; // Výchozí metoda
    document.querySelectorAll('input[name="delivery"]').forEach(input => {
        input.addEventListener('change', function() {
            selectedShippingMethod = this.value;
            
            // Aktualizace kompatibility platebních metod
            document.querySelectorAll('input[name="payment"]').forEach(paymentInput => {
                const paymentCard = paymentInput.closest('.option-card');
                const paymentMethod = paymentInput.value;
                
                // Simulace kompatibility - ve skutečném nasazení by se toto načítalo z API
                let compatible = true;
                if (paymentMethod === 'cod' && selectedShippingMethod === 'pickup') {
                    compatible = false;
                }
                
                paymentCard.classList.toggle('disabled', !compatible);
                paymentInput.disabled = !compatible;
                
                // Pokud je vybraná platba nyní nekompatibilní, zrušíme její výběr
                if (paymentInput.checked && !compatible) {
                    paymentInput.checked = false;
                }
            });
        });
    });
    
    // Sledování, kdy se načtou data o uživateli z cookies
    document.addEventListener('userDataLoaded', function(event) {
        // Pokud existuje předvyplněná pobočka Zásilkovny, aktivujeme příslušné UI
        if (localStorage.getItem('selectedBranchId')) {
            const zasilkovnaRadio = document.querySelector('input[name="delivery"][value="zasilkovna"]');
            if (zasilkovnaRadio) {
                zasilkovnaRadio.checked = true;
                
                // Vyvolání události změny, aby se aktualizoval UI
                const changeEvent = new Event('change');
                zasilkovnaRadio.dispatchEvent(changeEvent);
                
                // Aktualizace Packeta widgetu
                if (window.PacketaWidget && typeof window.PacketaWidget.loadSelectedBranch === 'function') {
                    window.PacketaWidget.loadSelectedBranch();
                }
            }
        }
    });
};

// Funkce pro aktualizaci dostupných platebních metod
function updatePaymentMethodsAvailability() {
    // Získání vybrané metody dopravy
    const selectedDelivery = document.querySelector('input[name="delivery"]:checked');
    if (!selectedDelivery) return;
    
    const deliveryMethod = selectedDelivery.value;
    
    // Najdeme všechny platební metody
    const paymentCards = document.querySelectorAll('.payment-options .option-card');
    
    // Pro každou platební metodu určíme, zda bude povolena
    paymentCards.forEach(card => {
        const radioInput = card.querySelector('input[type="radio"]');
        if (!radioInput) return;
        
        const paymentMethod = radioInput.value;
        let isCompatible = false;
        
        // Určíme, které platební metody povolit pro konkrétní dopravu
        if (deliveryMethod === 'zasilkovna') {
            // Pro Zásilkovnu povolíme bankovní převod a dobírku
            isCompatible = (paymentMethod === 'bank' || paymentMethod === 'cod');
        } 
        else if (deliveryMethod === 'express' || deliveryMethod === 'pickup') {
            // Pro Expresní doručení nebo Osobní odběr povolíme pouze "osobní odběr/expresní doručení"
            isCompatible = (paymentMethod === 'personal-express');
        }
        else if (deliveryMethod === 'ppl') {
            // Pro PPL povolíme bankovní převod a dobírku
            isCompatible = (paymentMethod === 'bank' || paymentMethod === 'cod');
        }
        
        // Najdeme badge "Doporučujeme", pokud existuje
        const recommendedBadge = card.querySelector('.recommended-badge');
        
        // Nastavíme stav karty podle toho, zda je povolena
        if (isCompatible) {
            card.classList.remove('payment-fully-disabled');
            radioInput.disabled = false;
            
            // Odstraníme zprávu o nekompatibilitě, pokud existuje
            const existingOverlay = card.querySelector('.payment-incompatible-overlay');
            if (existingOverlay) {
                existingOverlay.remove();
            }
            
            // Zobrazíme badge "Doporučujeme", pokud existuje
            if (recommendedBadge) {
                recommendedBadge.style.display = '';
            }
        } else {
            card.classList.add('payment-fully-disabled');
            radioInput.disabled = true;
            
            // Skryjeme badge "Doporučujeme", pokud existuje
            if (recommendedBadge) {
                recommendedBadge.style.display = 'none';
            }
            
            // Pokud je zakázaná metoda vybraná, zrušíme výběr
            if (radioInput.checked) {
                radioInput.checked = false;
            }
            
            // Přidáme nebo aktualizujeme zprávu o nekompatibilitě
            let overlay = card.querySelector('.payment-incompatible-overlay');
            if (!overlay) {
                overlay = document.createElement('div');
                overlay.className = 'payment-incompatible-overlay';
                overlay.innerHTML = `
                    <div class="incompatible-content">
                        <i class="fas fa-ban"></i>
                        <span>Tato možnost je nekompatibilní</span>
                    </div>
                `;
                card.appendChild(overlay);
            }
        }
    });
    
    // Zkontrolujeme, zda je nějaká platební metoda vybraná
    const hasSelectedPayment = document.querySelector('.payment-options input[type="radio"]:checked');
    if (!hasSelectedPayment) {
        const firstEnabledPayment = document.querySelector('.payment-options .option-card:not(.payment-fully-disabled) input[type="radio"]');
        if (firstEnabledPayment) {
            firstEnabledPayment.checked = true;
        }
    }
}

// Nastavení event listeneru pro všechny radio buttony dopravy
function setupPaymentRestrictions() {
    // Najdeme všechny radio buttony pro dopravu
    const deliveryRadios = document.querySelectorAll('input[name="delivery"]');
    
    // Odstraníme existující posluchače (pro jistotu)
    deliveryRadios.forEach(radio => {
        const newRadio = radio.cloneNode(true);
        radio.parentNode.replaceChild(newRadio, radio);
    });
    
    // Přidáme nové posluchače
    document.querySelectorAll('input[name="delivery"]').forEach(radio => {
        radio.addEventListener('change', function() {
            updatePaymentMethodsAvailability();
        });
    });
    
    // Spustíme aktualizaci hned při načtení
    updatePaymentMethodsAvailability();
}

// Spustíme nastavení při načtení stránky
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupPaymentRestrictions);
} else {
    setupPaymentRestrictions();
}

// Volání načtení dat z cookies při načtení stránky
document.addEventListener('DOMContentLoaded', function() {
    // Nastavení funkce pro stahování faktur
    setupInvoiceDownload();
    
    // Načteme data ihned
    loadUserDataFromCookies();
    
    // A pro jistotu je zkusíme načíst ještě jednou po 500ms a 1000ms
    setTimeout(loadUserDataFromCookies, 500);
    setTimeout(loadUserDataFromCookies, 1000);
    
    // Nastavení funkce pro stahování faktur
    setTimeout(setupInvoiceDownload, 1000);
}, { once: true });

// Rozšíření validateContactForm pro ukládání dat do cookies
const originalValidateContactForm = window.validateContactForm || function() { return true; };
window.validateContactForm = function() {
    const isValid = originalValidateContactForm.call(this);
    
    if (isValid) {
        // Ukládání dat do cookies
        saveUserDataToCookies();
    }
    
    return isValid;
};


/**
 * Aktualizace progress baru podle aktivního kroku
 */
function updateProgressBar(step) {
    const stepElements = document.querySelectorAll('.step');
    const stepOrder = ['cart', 'delivery', 'contact', 'confirmation'];
    const currentStepIndex = stepOrder.indexOf(step);
    
    stepElements.forEach(element => {
        const stepName = element.getAttribute('data-step');
        const stepIndex = stepOrder.indexOf(stepName);
        
        // Odstranění všech dodatečných tříd
        element.classList.remove('active', 'navigable', 'completed');
        
        if (stepName === step) {
            // Aktuální krok
            element.classList.add('active');
        } else if (stepIndex < currentStepIndex) {
            // Kroky, které už jsme prošli - ty jsou vždy proklikávací a označené jako dokončené
            element.classList.add('navigable', 'completed');
            element.setAttribute('data-tooltip', 'Vrátit se k tomuto kroku');
        } else {
            // Kroky, které ještě přijdou, nejsou proklikávací
            element.setAttribute('data-tooltip', 'Nejprve dokončete předchozí kroky');
        }
    });
    
    // Aktualizace connector lines
    const connectorLines = document.querySelectorAll('.connector-line');
    connectorLines.forEach((line, index) => {
        if (index < currentStepIndex) {
            line.style.width = '100%';
            line.classList.add('completed-line');
        } else {
            line.style.width = '0%';
            line.classList.remove('completed-line');
        }
    });
}

/**
 * Přechod na nový krok objednávky
 */
function goToStep(step) {
    // Kontrola, zda můžeme přejít na další krok
    if (step === 'delivery' && cart.length === 0) {
        showNotification('Váš košík je prázdný', 'error');
        return;
    }

    if (step === 'contact' && !validateDeliverySelection()) {
        showNotification('Vyberte prosím způsob dopravy a platby', 'error');
        return;
    }

    if (step === 'confirmation' && !validateContactForm()) {
        showNotification('Vyplňte prosím všechny povinné údaje', 'error');
        return;
    }

    // Zobrazíme loader pro lepší UX
    showLoader();
    
    // Aktualizace shrnutí objednávky ve všech sekcích před přechodem
    updateAllOrderSummaries();

    // Přechod s malým zpožděním pro plynulejší UX
    setTimeout(() => {
        // Skryjeme všechny sekce
        hideAllSections();

        // Skryjeme progress bar pokud jdeme na confirmation sekci
        if (step === 'confirmation') {
            // Zkusíme najít různé možné kontejnery progress baru
            const header = document.querySelector('header');
            if (header) {
                header.style.display = 'none';
            }
            
            const progressContainer = document.querySelector('.progress-container');
            if (progressContainer) {
                progressContainer.style.display = 'none';
            }
            
            const progressSteps = document.querySelector('.progress-steps');
            if (progressSteps) {
                progressSteps.style.display = 'none';
            }
            
            // Přidáme třídu na tělo dokumentu pro CSS řešení
            document.body.classList.add('confirmation-page');
        } else {
            // Pro ostatní kroky obnovíme zobrazení progress baru
            const header = document.querySelector('header');
            if (header) {
                header.style.display = '';
            }
            
            const progressContainer = document.querySelector('.progress-container');
            if (progressContainer) {
                progressContainer.style.display = '';
            }
            
            const progressSteps = document.querySelector('.progress-steps');
            if (progressSteps) {
                progressSteps.style.display = '';
            }
            
            // Odstraníme třídu z těla dokumentu
            document.body.classList.remove('confirmation-page');
        }

        // Zobrazíme požadovanou sekci
        switch (step) {
            case 'cart':
                cartSection.classList.add('active');
                // Ujistíme se, že sekce s dokončením je skrytá
                if (confirmationSection) confirmationSection.style.display = 'none';
                break;
            case 'delivery':
                deliverySection.classList.add('active');
                // Ujistíme se, že sekce s dokončením je skrytá
                if (confirmationSection) confirmationSection.style.display = 'none';
                break;
            case 'contact':
                contactSection.classList.add('active');
                // Ujistíme se, že sekce s dokončením je skrytá
                if (confirmationSection) confirmationSection.style.display = 'none';
                break;
            case 'confirmation':
                // Pro dokončení objednávky zobrazíme sekci
                if (confirmationSection) confirmationSection.style.display = '';
                confirmationSection.classList.add('active');
                updateConfirmationDetails();
                break;
        }

        // Aktualizace aktuálního kroku
        currentStep = step;
        window.currentStep = currentStep; // Aktualizace globální proměnné

        // Aktualizace progress baru
        updateProgressBar(step);
        
        // Po zobrazení nové sekce znovu aktualizujeme souhrn
        updateAllOrderSummaries();

        // Skryjeme loader
        hideLoader();

        // Scrollujeme na začátek stránky
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    }, 300);
}

/**
 * Skrytí všech sekcí
 */
function hideAllSections() {
    if (cartSection) cartSection.classList.remove('active');
    if (deliverySection) deliverySection.classList.remove('active');
    if (contactSection) contactSection.classList.remove('active');
    if (confirmationSection) confirmationSection.classList.remove('active');
    if (emptyCartSection) emptyCartSection.classList.remove('active');
    
    // Skryj sekci s dokončením objednávky, pokud není aktuální krok "confirmation"
    if (confirmationSection && currentStep !== 'confirmation') {
        confirmationSection.style.display = 'none';
    }
}

/**
 * Zobrazení prázdného košíku
 */
function showEmptyCart() {
    hideAllSections();
    if (emptyCartSection) {
        emptyCartSection.classList.remove('hidden');
        emptyCartSection.classList.add('active');
    }
}

/**
 * Aktualizace množství položky
 */
function updateQuantity(id, change) {
    const index = id - 1; // ID je index + 1
    
    if (index >= 0 && index < cart.length) {
        // Aktualizace množství
        const newQuantity = cart[index].quantity + change;
        
        // Kontrola minimálního množství
        if (newQuantity < 1) {
            confirmAndRemoveItem(id);
            return;
        }
        
        cart[index].quantity = newQuantity;
        
        // Aktualizace UI
        const quantityInput = document.querySelector(`.cart-item[data-id="${id}"] input.quantity`);
        if (quantityInput) {
            quantityInput.value = newQuantity;
            
            // Animace změny
            quantityInput.classList.add('updated');
            setTimeout(() => {
                quantityInput.classList.remove('updated');
            }, 500);
        }
        
        // Aktualizace ceny položky
        updateItemPrice(id);
        
        // Uložení změn
        saveCart();
        
        // Aktualizace cen
        updatePrices();
        updateCartCounter();
        
        // Informování uživatele
        if (change > 0) {
            showNotification('Množství navýšeno', 'success');
        } else {
            showNotification('Množství sníženo', 'info');
        }
    }
}

/**
 * Přímá aktualizace množství položky (z inputu)
 */
function updateQuantityDirectly(id, newQuantity) {
    const index = id - 1; // ID je index + 1
    
    if (index >= 0 && index < cart.length) {
        // Pokud je množství 0 nebo méně, nabídneme odstranění položky
        if (newQuantity <= 0) {
            confirmAndRemoveItem(id);
            return;
        }
        
        // Jinak aktualizujeme množství
        const oldQuantity = cart[index].quantity;
        cart[index].quantity = newQuantity;
        
        // Aktualizace ceny položky
        updateItemPrice(id);
        
        // Uložení změn
        saveCart();
        
        // Aktualizace cen
        updatePrices();
        updateCartCounter();
        
        // Informování uživatele jen při větší změně
        if (newQuantity > oldQuantity + 1) {
            showNotification('Množství aktualizováno', 'success');
        } else if (newQuantity < oldQuantity - 1) {
            showNotification('Množství aktualizováno', 'info');
        }
    }
}

/**
 * Aktualizace zobrazené ceny položky
 */
function updateItemPrice(id) {
    const index = id - 1; // ID je index + 1
    
    if (index >= 0 && index < cart.length) {
        const priceElement = document.querySelector(`.cart-item[data-id="${id}"] .item-price`);
        const summaryVariantElement = document.querySelector(`.summary-item:nth-child(${index + 1}) .summary-item-variant`);
        const summaryPriceElement = document.querySelector(`.summary-item:nth-child(${index + 1}) .summary-item-price`);
        
        if (priceElement) {
            // Animace změny ceny
            priceElement.classList.add('updated');
            priceElement.textContent = `${cart[index].price * cart[index].quantity} Kč`;
            
            setTimeout(() => {
                priceElement.classList.remove('updated');
            }, 500);
        }
        
        // Aktualizace souhrnu
        if (summaryVariantElement) {
            summaryVariantElement.textContent = `${cart[index].weight || cart[index].variant} × ${cart[index].quantity}`;
        }
        
        if (summaryPriceElement) {
            summaryPriceElement.textContent = `${cart[index].price * cart[index].quantity} Kč`;
        }
    }
}

/**
 * Potvrzení a odstranění položky
 */
function confirmAndRemoveItem(id) {
    if (confirm('Opravdu chcete odstranit tuto položku z košíku?')) {
        removeItem(id);
    } else {
        // Obnovení původního množství v UI (min. 1)
        const index = id - 1; // ID je index + 1
        if (index >= 0 && index < cart.length) {
            const quantityInput = document.querySelector(`.cart-item[data-id="${id}"] input.quantity`);
            if (quantityInput) {
                quantityInput.value = cart[index].quantity;
            }
        }
    }
}

/**
 * Odstranění položky z košíku
 */
function removeItem(id) {
    const index = id - 1; // ID je index + 1
    
    if (index >= 0 && index < cart.length) {
        const itemName = cart[index].name;
        
        // Animace odstranění položky
        const itemElement = document.querySelector(`.cart-item[data-id="${id}"]`);
        if (itemElement) {
            itemElement.style.height = `${itemElement.offsetHeight}px`;
            itemElement.classList.add('removing');
            
            setTimeout(() => {
                // Odstranění z pole
                cart.splice(index, 1);
                
                // Uložení změn a aktualizace UI
                saveCart();
                
                // Kontrola, zda košík není prázdný
                if (cart.length === 0) {
                    showEmptyCart();
                } else {
                    // Překreslení košíku
                    renderCartItems();
                    updatePrices();
                    updateCartCounter();
                }
                
                // Informování uživatele
                showNotification(`Položka "${itemName}" byla odstraněna z košíku`, 'error');
            }, 300);
        }
    }
}

/**
 * Aktualizace počítadla položek v košíku
 */
function updateCartCounter() {
    const totalItems = cart.reduce((total, item) => total + item.quantity, 0);
    document.querySelectorAll('.cart-count').forEach(counter => {
        counter.textContent = totalItems;
    });
}

/**
 * Aktualizace všech zobrazených cen
 */
function updatePrices() {
    // Výpočet mezisoučtu
    const subtotal = calculateSubtotal();
    
    // Výpočet celkové ceny
    const total = calculateTotal();
    
    // Kontrola, zda byla vybrána metoda dopravy
    const deliverySelected = document.querySelector('input[name="delivery"]:checked');
    const isDeliverySelected = deliverySelected !== null;
    
    // Text pro dopravu - pokud nebyla vybrána, zobrazíme "Doprava: X Kč"
    const shippingText = !isDeliverySelected ? 
        'X Kč' : 
        (window.shippingPrice === 0 ? 'Zdarma' : `${window.shippingPrice} Kč`);
    
    // Aktualizace zobrazených cen v košíku
    if (subtotalEl) subtotalEl.textContent = `${subtotal} Kč`;
    if (shippingEl) shippingEl.textContent = shippingText;
    if (discountEl) discountEl.textContent = discountAmount > 0 ? `-${discountAmount} Kč` : '0 Kč';
    if (totalEl) totalEl.textContent = `${total} Kč`;
    
    // Aktualizace cen v souhrnu dopravy
    if (summaryShippingEl) summaryShippingEl.textContent = shippingText;
    if (summaryPaymentEl) summaryPaymentEl.textContent = window.paymentFee === 0 ? '0 Kč' : `${window.paymentFee} Kč`;
    if (summaryDiscountEl) summaryDiscountEl.textContent = discountAmount > 0 ? `-${discountAmount} Kč` : '0 Kč';
    if (summaryTotalEl) summaryTotalEl.textContent = `${total} Kč`;
    updateAllOrderSummaries();
}

/**
* Funkce pro aktualizaci všech shrnutí objednávky napříč sekcemi
* Tato funkce zajistí synchronizaci cen ve všech souhrných objednávky
*/
function updateAllOrderSummaries() {
    // Výpočet mezisoučtu
    const subtotal = calculateSubtotal();
    
    // Kontrola, zda byla vybrána metoda dopravy
    const deliverySelected = document.querySelector('input[name="delivery"]:checked');
    const isDeliverySelected = deliverySelected !== null;
    
    // Kontrola, zda byla vybrána metoda platby
    const paymentSelected = document.querySelector('input[name="payment"]:checked');
    const isPaymentSelected = paymentSelected !== null;
    
    // Texty pro dopravu a platbu
    const shippingText = !isDeliverySelected ? 
        'Vyberte dopravu' : 
        (window.shippingPrice === 0 ? 'Zdarma' : `${window.shippingPrice} Kč`);
    
    const paymentText = !isPaymentSelected ? 
        'Vyberte Platbu' :  // Text pro nevybranou platbu
        (window.paymentFee === 0 ? 'Zdarma' : `${window.paymentFee} Kč`);
    
    // Výpočet celkové ceny
    const total = calculateTotal();
    
    // Najdeme všechny řádky se slevou
    const discountRows = document.querySelectorAll('.summary-rows .discount');
    
    // OPRAVA: Získání aktuální hodnoty slevy z globální proměnné
    const discountAmount = window.discountAmount || 0;
    
    // Zobrazit nebo skrýt řádky se slevou podle toho, zda je sleva uplatněna
    if (discountAmount > 0) {
        // Pokud je sleva uplatněna, zobrazíme řádky
        discountRows.forEach(row => {
            row.style.display = ''; // Zobrazit řádek
        });
    } else {
        // Pokud není sleva uplatněna, skryjeme řádky
        discountRows.forEach(row => {
            row.style.display = 'none';
        });
    }
    
    // Najdeme všechny elementy pro shrnutí objednávky ve všech sekcích
    const allSubtotalElements = document.querySelectorAll('.summary-rows .summary-row:first-child span:last-child');
    const allShippingElements = document.querySelectorAll('.summary-rows .summary-row:nth-child(2) span:last-child, #summary-shipping');
    const allPaymentElements = document.querySelectorAll('.summary-rows .summary-row:nth-child(3) span:last-child, #summary-payment');
    const allDiscountElements = document.querySelectorAll('.summary-rows .discount span:last-child, #summary-discount');
    const allTotalElements = document.querySelectorAll('.summary-total span:last-child, #summary-total');

    // Aktualizace cen v hlavním košíku
    const subtotalEl = document.getElementById('subtotal');
    const shippingEl = document.getElementById('shipping');
    const discountEl = document.getElementById('discount');
    const totalEl = document.getElementById('total');
    
    if (subtotalEl) subtotalEl.textContent = `${subtotal} Kč`;
    if (shippingEl) shippingEl.textContent = shippingText;

    // Aktualizace způsobu platby v hlavním košíku
    const paymentEl = document.getElementById('payment');
    if (paymentEl) paymentEl.textContent = paymentText;

    if (discountEl) {
        // Pokud je sleva, zobrazíme řádek
        const discountRow = discountEl.closest('.summary-row');
        if (discountRow) {
            discountRow.style.display = discountAmount > 0 ? '' : 'none';
        }
        discountEl.textContent = discountAmount > 0 ? `-${discountAmount} Kč` : '0 Kč';
    }
    if (totalEl) totalEl.textContent = `${total} Kč`;

    // Aktualizace všech nalezených elementů
    allSubtotalElements.forEach(element => {
        element.textContent = `${subtotal} Kč`;
    });

    allShippingElements.forEach(element => {
        element.textContent = shippingText;
    });

    allPaymentElements.forEach(element => {
        element.textContent = paymentText;
    });

    allDiscountElements.forEach(element => {
        element.textContent = discountAmount > 0 ? `-${discountAmount} Kč` : '0 Kč';
    });

    allTotalElements.forEach(element => {
        element.textContent = `${total} Kč`;
    });
    
    // Aktualizace hodnoty v modálním okně pro potvrzení objednávky, pokud existuje
    const modalTotalPrice = document.getElementById('modal-total-price');
    if (modalTotalPrice) {
        modalTotalPrice.textContent = `${total} Kč`;
    }
}

/**
* Rozšíření funkcí o ukládání a načítání preferované dopravy a platby
*/

// Funkce pro uložení výběru dopravy do localStorage
function saveShippingMethod(method) {
if (method) {
    localStorage.setItem('preferredShipping', method);
}
}

// Funkce pro uložení výběru platby do localStorage
function savePaymentMethod(method) {
if (method) {
    localStorage.setItem('preferredPayment', method);
}
}

// Funkce pro načtení a aplikaci uložených preferencí
function loadSavedPreferences() {
// Načtení preferovaného způsobu dopravy
const savedShipping = localStorage.getItem('preferredShipping');
if (savedShipping) {
    const shippingInput = document.querySelector(`input[name="delivery"][value="${savedShipping}"]`);
    if (shippingInput) {
        shippingInput.checked = true;
        // Aktualizace ceny dopravy
        updateShippingPrice();
    }
}

// Načtení preferovaného způsobu platby
const savedPayment = localStorage.getItem('preferredPayment');
if (savedPayment) {
    const paymentInput = document.querySelector(`input[name="payment"][value="${savedPayment}"]`);
    if (paymentInput) {
        paymentInput.checked = true;
        // Aktualizace poplatku za platbu
        updatePaymentFee();
    }
}

// Aktualizace cen
updatePrices();
}

/**
* Výpočet mezisoučtu
*/
function calculateSubtotal() {
    return cart.reduce((total, item) => total + (item.price * item.quantity), 0);
}

/**
* Výpočet celkové ceny
*/
function calculateTotal() {
    const subtotal = calculateSubtotal();

    // Get selected shipping and payment
    const deliverySelected = document.querySelector('input[name="delivery"]:checked');
    const paymentSelected = document.querySelector('input[name="payment"]:checked');

    // Only add prices if methods are selected
    const actualShippingPrice = deliverySelected ? window.shippingPrice : 0;
    const actualPaymentFee = paymentSelected ? window.paymentFee : 0;

    // Důležitá oprava - ujistíme se, že window.discountAmount je definované
    // a použijeme správnou globální proměnnou
    const discountValue = typeof window.discountAmount !== 'undefined' ? window.discountAmount : 0;
    
    // Make sure discount doesn't exceed the subtotal
    const safeDiscountAmount = Math.min(discountValue, subtotal);

    // Calculate total and ensure it's not negative
    const calculatedTotal = subtotal + actualShippingPrice + actualPaymentFee - safeDiscountAmount;
    
    console.log("Total calculation:", { 
        subtotal, 
        actualShippingPrice, 
        actualPaymentFee, 
        discountAmount: safeDiscountAmount, 
        calculatedTotal 
    });
    
    return Math.max(calculatedTotal, 0); // Prevent negative totals
}

/**
* Aktualizace ceny dopravy podle vybrané metody
*/
function updateShippingPrice() {
const selectedDelivery = document.querySelector('input[name="delivery"]:checked');

if (selectedDelivery) {
    const value = selectedDelivery.value;
    
    switch (value) {
        case 'zasilkovna':
            window.shippingPrice = 79;
            break;
        case 'ppl':
            window.shippingPrice = 89;
            break;
        case 'express':
            window.shippingPrice = 149;
            break;
        case 'pickup':
            window.shippingPrice = 0;
            break;
        default:
            window.shippingPrice = 0;
    }
    
    // Uložení vybrané metody
    saveShippingMethod(value);
} else {
    // Pokud není nic vybráno, nastavíme cenu na 0
    window.shippingPrice = 0;
}

// Aktualizace cen
updatePrices();
}

/**
* Aktualizace poplatku za platbu podle vybrané metody
*/
function updatePaymentFee() {
const selectedPayment = document.querySelector('input[name="payment"]:checked');

if (selectedPayment) {
    const value = selectedPayment.value;
    
    switch (value) {
        case 'card':
        case 'bank':
            window.paymentFee = 0;
            break;
        case 'cod':
            window.paymentFee = 39;
            break;
        default:
            window.paymentFee = 0;
    }
    
    // Uložení vybrané metody
    savePaymentMethod(value);
} else {
    // Pokud není nic vybráno, nastavíme poplatek na 0
    window.paymentFee = 0;
}

// Aktualizace cen
updatePrices();
}
    /**
    * Odstranění slevového kupónu
    */
    function removeCoupon() {
        // Resetování slevy v globálních proměnných
        window.discountAmount = 0;
        window.appliedCoupon = null;
        
        console.log("Kupón byl odstraněn:", {
            appliedCoupon: window.appliedCoupon,
            discountAmount: window.discountAmount
        });
        
        // Aktualizace cen
        updateAllOrderSummaries();
        
        // Resetování pole pro zadání kupónu
        const couponInput = document.getElementById('coupon-code');
        if (couponInput) {
            couponInput.value = '';
            couponInput.placeholder = 'Zadejte slevový kód...';
        }
        
        // Skrytí řádku se slevou
        const discountRows = document.querySelectorAll('.summary-rows .discount');
        discountRows.forEach(row => {
            row.style.display = 'none';
        });
        
        // Zobrazení vstupního pole pro kupón
        const couponInputGroup = document.querySelector('.coupon-input-group');
        if (couponInputGroup) {
            couponInputGroup.style.display = 'flex';
        }
        
        // Odstranění zobrazení aplikovaného kupónu
        const couponApplied = document.querySelector('.coupon-applied');
        if (couponApplied) {
            couponApplied.remove();
        }
        
        // Informování uživatele
        showNotification('Slevový kupón byl odstraněn', 'info');
    }
    
    /**
     * Validace výběru dopravy a platby
     */
    function validateDeliverySelection() {
        const deliverySelected = document.querySelector('input[name="delivery"]:checked');
        const paymentSelected = document.querySelector('input[name="payment"]:checked');
        
        return deliverySelected && paymentSelected;
    }
    
    /**
     * Validace kontaktního formuláře
     */
    function validateContactForm() {
        const requiredFields = [
            document.getElementById('name'),
            document.getElementById('email'),
            document.getElementById('phone'),
            document.getElementById('street'),
            document.getElementById('city'),
            document.getElementById('zip')
        ];
        
        let isValid = true;
        let firstInvalidField = null;
        
        // Kontrola vyplnění povinných polí
        requiredFields.forEach(field => {
            if (field && !field.value.trim()) {
                field.classList.add('error');
                isValid = false;
                
                if (!firstInvalidField) {
                    firstInvalidField = field;
                }
                
                // Odstranění error třídy po animaci
                setTimeout(() => {
                    field.classList.remove('error');
                }, 1000);
            }
        });
        
        // Kontrola e-mailu
        const emailField = document.getElementById('email');
        if (emailField && emailField.value.trim() && !validateEmail(emailField.value)) {
            emailField.classList.add('error');
            isValid = false;
            
            if (!firstInvalidField) {
                firstInvalidField = emailField;
            }
            
            setTimeout(() => {
                emailField.classList.remove('error');
            }, 1000);
        }
        
        // Kontrola doručovací adresy, pokud je vybrána
        const differentShipping = document.getElementById('different-shipping');
        if (differentShipping && differentShipping.checked) {
            const shippingFields = [
                document.getElementById('shipping-name'),
                document.getElementById('shipping-street'),
                document.getElementById('shipping-city'),
                document.getElementById('shipping-zip')
            ];
            
            shippingFields.forEach(field => {
                if (field && !field.value.trim()) {
                    field.classList.add('error');
                    isValid = false;
                    
                    if (!firstInvalidField) {
                        firstInvalidField = field;
                    }
                    
                    setTimeout(() => {
                        field.classList.remove('error');
                    }, 1000);
                }
            });
        }
        
        // Pokud existuje neplatné pole, scrollujeme k němu
        if (firstInvalidField) {
            firstInvalidField.focus();
            firstInvalidField.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        
        return isValid;
    }
    
    /**
     * Validace e-mailové adresy
     */
    function validateEmail(email) {
        const re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
        return re.test(String(email).toLowerCase());
    }
    
    /**
     * Dokončení objednávky
     */
    function completeOrder() {
        // Validace formuláře
        if (!validateContactForm()) {
            showNotification('Vyplňte prosím všechny povinné údaje', 'error');
            return;
        }
        
        // Zobrazení loaderu
        showLoader();
        
        // Příprava dat objednávky
        const orderData = prepareOrderData();
        console.log('Připravená data objednávky:', orderData);
        
        // Volání API pro vytvoření objednávky
        API.createOrder(orderData)
            .then(response => {
                // Aktualizace detailů potvrzení
                updateConfirmationWithOrderData(response.order);
                
                // Uložení čísla objednávky do lokálního úložiště pro budoucí reference
                localStorage.setItem('lastOrderNumber', response.order.order_number);
                
                // Přidáme třídu pro identifikaci dokončené objednávky
                document.body.classList.add('confirmation-page');
                
                // Předběžně skryjeme progress bar
                const header = document.querySelector('header');
                if (header) {
                    header.style.display = 'none';
                }
                
                // Přechod na potvrzovací obrazovku
                goToStep('confirmation');
                
                // VYMAZÁNÍ KOŠÍKU - PŘÍMÝ PŘÍSTUP
                // 1. Resetování globální proměnné
                cart = [];
                window.cart = [];
                
                // 2. Vymazání cookies
                document.cookie = "cart=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
                document.cookie = "cart=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/cart;";
                document.cookie = "cart=[]; path=/;"; // nastavení prázdného pole
                
                // 3. Uložení prázdné cookie v localStorage
                localStorage.removeItem('cart');
                
                // Skrytí loaderu
                hideLoader();
                
                // 4. Nastavení časovače pro reload stránky po 5 sekundách od dokončení objednávky
                setTimeout(() => {
                    // Uložíme do session storage, že jsme právě dokončili objednávku
                    sessionStorage.setItem('orderJustCompleted', 'true');
                    sessionStorage.setItem('lastOrderNumber', response.order.order_number);
                    
                    // Vynucené přesměrování na index.html (nebo jinou stránku) po dokončení
                    if (window.location.pathname.includes('cart.html')) {
                        window.location.href = "index.html";
                    }
                }, 5000);
                
                // Přehrání konfetti efektu pro radost z úspěšné objednávky
                playOrderConfetti();
            })
            .catch(error => {
                // Skrytí loaderu
                hideLoader();
                
                // Zobrazení chyby
                showNotification(error.message || 'Došlo k chybě při dokončování objednávky', 'error');
                console.error('Chyba při odesílání objednávky:', error);
            });
    }
    
    /**
     * Aktualizace detailů potvrzení s daty z API
     */
    function updateConfirmationWithOrderData(order) {
        // Nastavení čísla objednávky
        const confirmationInfo = document.querySelector('.confirmation-info strong');
        if (confirmationInfo) {
            confirmationInfo.textContent = `#${order.order_number}`;
        }
        
        // Nastavení emailu
        const emailField = document.getElementById('email');
        const confirmationEmail = document.getElementById('confirmation-email-address');
        if (emailField && confirmationEmail) {
            confirmationEmail.textContent = emailField.value;
        }
        
        // Custom handling for Zásilkovna branch
        if (order.shipping && order.shipping.method === 'zasilkovna' && order.shipping.branch) {
            const orderShippingEl = document.getElementById('order-shipping');
            if (orderShippingEl) {
                orderShippingEl.textContent = `Zásilkovna - ${order.shipping.branch.name}`;
                if (order.shipping.branch.address) {
                    orderShippingEl.textContent += ` (${order.shipping.branch.address})`;
                }
            }
        } else {
            // Ostatní detaily můžeme aktualizovat pomocí standardní funkce
            updateConfirmationDetails();
        }
        
        // Update payment method display
        const orderPaymentEl = document.getElementById('order-payment');
        if (orderPaymentEl && order.payment && order.payment.method) {
            if (order.payment && order.payment.method === 'bank') {
                showBankTransferDetails(order);
            } else if (order.payment.method === 'card') {
                orderPaymentEl.textContent = 'Online platba kartou';
            } else if (order.payment.method === 'cod') {
                orderPaymentEl.textContent = 'Dobírka';
            }
        }
        
        // Update total price display
        const orderTotalEl = document.getElementById('order-total');
        if (orderTotalEl && order.total) {
            orderTotalEl.textContent = `${order.total} Kč`;
        }
        
        // Set variable symbol (order number) for bank account
        const variableSymbolEl = document.getElementById('variable-symbol');
        if (variableSymbolEl) {
            const shortVS = order.order_number.toString().slice(0, 8) + order.order_number.toString().slice(-2);
            variableSymbolEl.textContent = shortVS;
        }
        
        // Set payment amount 
        const paymentAmountEl = document.getElementById('payment-amount');
        if (paymentAmountEl && order.total) {
            paymentAmountEl.textContent = `${order.total} Kč`;
        }
        
        // Create download invoice button event listener with secured download
        const downloadInvoiceBtn = document.getElementById('download-invoice-btn');
        if (downloadInvoiceBtn) {
            // Odstranění všech existujících event listenerů pomocí klonování
            const newDownloadBtn = downloadInvoiceBtn.cloneNode(true);
            downloadInvoiceBtn.parentNode.replaceChild(newDownloadBtn, downloadInvoiceBtn);
            
            // Uložení informací o objednávce do lokálního úložiště
            localStorage.setItem('lastOrderNumber', order.order_number);
            
            // Přidání nového event listeneru s opravou
            newDownloadBtn.addEventListener('click', function(e) {
                e.preventDefault();
                
                // Zobrazení loaderu
                showLoader();
                
                // Použijeme číslo objednávky pro získání/vytvoření faktury
                fetch(`/api/invoices/${order.order_number}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                })
                .then(response => response.json())
                .then(data => {
                    if (data.status === 'success' && data.invoice) {
                        // Spustíme stahování faktury
                        window.location.href = `/api/invoices/${data.invoice.invoice_number}/download`;
                        
                        // Skryjeme loader po krátké prodlevě
                        setTimeout(() => {
                            hideLoader();
                        }, 1000);
                    } else {
                        hideLoader();
                        showNotification(data.message || 'Nepodařilo se získat fakturu', 'error');
                    }
                })
                .catch(error => {
                    hideLoader();
                    console.error('Chyba při získávání faktury:', error);
                    showNotification('Došlo k chybě při přístupu k faktuře', 'error');
                });
            });
        }
        
        // Zobrazení informace o slevě, pokud byla použita
        if (order.discount && order.discount > 0) {
            const orderDetails = document.querySelector('.order-details');
            if (orderDetails) {
                // Kontrola, zda již existuje řádek se slevou
                let discountRow = orderDetails.querySelector('.detail-row.discount');
                
                if (!discountRow) {
                    // Vytvoříme nový řádek se slevou
                    discountRow = document.createElement('div');
                    discountRow.className = 'detail-row discount';
                    discountRow.innerHTML = `
                        <span>Sleva:</span>
                        <span id="order-discount">-${order.discount} Kč</span>
                    `;
                    
                    // Vložíme řádek před celkovou cenu
                    const totalRow = orderDetails.querySelector('.detail-row:last-child');
                    if (totalRow) {
                        orderDetails.insertBefore(discountRow, totalRow);
                    } else {
                        orderDetails.appendChild(discountRow);
                    }
                } else {
                    // Aktualizujeme existující řádek
                    const discountValue = discountRow.querySelector('span:last-child');
                    if (discountValue) {
                        discountValue.textContent = `-${order.discount} Kč`;
                    }
                }
            }
        }
    }

    /**
    * Show bank transfer details and generate QR code
    */
    
    function showBankTransferDetails(order) {
        const qrSection = document.querySelector('.qr-code-container');
        if (qrSection) {
            qrSection.style.display = 'block';
        }
    
        // Zpráva do QR
        const message = `Objednávka číslo #${order.order_number}`;
    
        // Zkrácený variabilní symbol
        const shortVS = order.order_number.toString().slice(0, 8) + order.order_number.toString().slice(-2);
    
        // Nastavíme zkrácený VS do HTML
        const vsElement = document.getElementById('variable-symbol');
        if (vsElement) {
            const shortVS = order.order_number.toString().slice(0, 8) + order.order_number.toString().slice(-2);
            vsElement.textContent = shortVS;
        }
    
        // Nastavíme částku
        const amountElement = document.getElementById('payment-amount');
        if (amountElement) {
            amountElement.textContent = `${parseFloat(order.total).toFixed(2)} Kč`;
        }
    
        generatePaymentQR(order.order_number, order.total);
    }    

    /**
    * Generuje QR kód pro platbu podle českého standardu QR plateb
    * @param {string} variableSymbol - Variabilní symbol (číslo objednávky)
    * @param {number} amount - Částka k úhradě
    * @param {string} [message] - Nepovinná zpráva pro příjemce
    */
    function generatePaymentQR(orderId, amount) {
        const iban = 'CZ1830300000002411153019';
        const formattedAmount = parseFloat(amount).toFixed(2);
    
        // Zpráva pro příjemce
        const message = `Objednávka číslo #${orderId}`;
    
        // Variabilní symbol = první 8 číslic + poslední 2
        const shortVS = orderId.toString().slice(0, 8) + orderId.toString().slice(-2);
    
        const qrData = `SPD*1.0*ACC:${iban}*AM:${formattedAmount}*CC:CZK*MSG:${message}*X-VS:${shortVS}`;
    
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?` +
                      `data=${encodeURIComponent(qrData)}` +
                      `&size=200x200&ecc=M&margin=10&color=000000&bgcolor=FFFFFF&format=png`;
    
        const qrElement = document.getElementById('payment-qr-code');
        if (qrElement) {
            qrElement.src = qrUrl;
            qrElement.alt = `QR kód pro platbu ${formattedAmount} Kč`;
        }
    }    

    /**
     * Přehrání efektu konfetti při úspěšné objednávce
     */
    function playOrderConfetti() {
        // Vytvoření konfetti efektu
        const confettiCount = 200;
        const colors = ['#00e676', '#1de9b6', '#69f0ae', '#b2ff59', '#eeff41'];
        
        for (let i = 0; i < confettiCount; i++) {
            const confetti = document.createElement('div');
            confetti.className = 'confetti';
            confetti.style.background = colors[Math.floor(Math.random() * colors.length)];
            confetti.style.left = Math.random() * 100 + 'vw';
            confetti.style.animationDuration = (Math.random() * 3 + 2) + 's';
            confetti.style.animationDelay = Math.random() * 2 + 's';
            document.body.appendChild(confetti);
            
            // Odstranění konfetti po animaci
            setTimeout(() => {
                confetti.remove();
            }, 5000);
        }
    }
    
    /**
     * Aktualizace detailů v potvrzovací obrazovce
     */
    function updateConfirmationDetails() {
        // Aktuální datum a čas
        const now = new Date();
        const formattedDate = `${now.getDate()}. ${now.getMonth() + 1}. ${now.getFullYear()}, ${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}`;
        
        // Email z formuláře
        const email = document.getElementById('email')?.value || 'vase@email.cz';
        
        // Způsob dopravy
        const deliveryOption = document.querySelector('input[name="delivery"]:checked');
        let deliveryText = 'Zásilkovna';
        
        if (deliveryOption) {
            switch (deliveryOption.value) {
                case 'zasilkovna': 
                    // Check if we have branch info for Zásilkovna
                    const branchName = localStorage.getItem('selectedBranchName');
                    const branchAddress = localStorage.getItem('selectedBranchAddress');
                    
                    if (branchName) {
                        deliveryText = `Zásilkovna - ${branchName}`;
                        if (branchAddress) {
                            deliveryText += ` (${branchAddress})`;
                        }
                    } else {
                        deliveryText = 'Zásilkovna';
                    }
                    break;
                case 'ppl': 
                    deliveryText = 'PPL - doručení na adresu'; 
                    break;
                case 'express': 
                    deliveryText = 'Expresní doručení'; 
                    break;
                case 'pickup': 
                    deliveryText = 'Osobní odběr'; 
                    break;
            }
        }
        
        // Způsob platby
        const paymentOption = document.querySelector('input[name="payment"]:checked');
        let paymentText = 'Online platba kartou';
        if (paymentOption) {
            switch (paymentOption.value) {
                case 'card': paymentText = 'Online platba kartou'; break;
                case 'bank': paymentText = 'Bankovní převod'; break;
                case 'cod': paymentText = 'Dobírka'; break;
            }
        }
        
        // Celková cena
        const total = calculateTotal();
        
        // Aktualizace prvků v DOM
        const emailEl = document.getElementById('confirmation-email-address');
        if (emailEl) emailEl.textContent = email;
        
        const orderDateEl = document.getElementById('order-date');
        if (orderDateEl) orderDateEl.textContent = formattedDate;
        
        const orderShippingEl = document.getElementById('order-shipping');
        if (orderShippingEl) orderShippingEl.textContent = deliveryText;
        
        const orderPaymentEl = document.getElementById('order-payment');
        if (orderPaymentEl) orderPaymentEl.textContent = paymentText;
        
        const orderTotalEl = document.getElementById('order-total');
        if (orderTotalEl) orderTotalEl.textContent = `${total} Kč`;
    }
    
    /**
     * Zobrazení loaderu
     */
    function showLoader() {
        if (loaderOverlay) {
            loaderOverlay.classList.add('show');
            document.body.style.overflow = 'hidden'; // Zablokování scrollování
        }
    }
    
    /**
     * Skrytí loaderu
     */
    function hideLoader() {
        if (loaderOverlay) {
            loaderOverlay.classList.remove('show');
            document.body.style.overflow = ''; // Povolení scrollování
        }
    }
    
    /**
     * Zobrazení notifikace
     */
    function showNotification(message, type = 'success') {
        if (!notificationToast) return;
        
        // Nastavení typu notifikace
        notificationToast.className = 'toast-notification';
        notificationToast.classList.add(type);
        
        // Nastavení ikony podle typu
        const iconElement = notificationToast.querySelector('.toast-icon i');
        if (iconElement) {
            iconElement.className = '';
            switch (type) {
                case 'success':
                    iconElement.classList.add('fas', 'fa-check-circle');
                    break;
                case 'error':
                    iconElement.classList.add('fas', 'fa-times-circle');
                    break;
                case 'warning':
                    iconElement.classList.add('fas', 'fa-exclamation-circle');
                    break;
                default:
                    iconElement.classList.add('fas', 'fa-info-circle');
                    break;
            }
        }
        
        // Nastavení textu
        const messageElement = notificationToast.querySelector('.toast-message');
        if (messageElement) {
            messageElement.textContent = message;
        }
        
        // Zobrazení notifikace
        notificationToast.classList.add('show');
        
        // Reset předchozího časovače
        if (window.toastTimer) {
            clearTimeout(window.toastTimer);
        }
        
        // Automatické skrytí po 3 sekundách
        window.toastTimer = setTimeout(() => {
            hideNotification();
        }, 3000);
    }
    
    /**
     * Skrytí notifikace
     */
    function hideNotification() {
        if (notificationToast) {
            notificationToast.classList.remove('show');
        }
    }

    /**
     * Nastavení proklikávání kroků v progress baru
     * Tato verze používá vylepšený přístup s event delegation
     */
    function setupProgressStepsNavigation() {
        // Najdeme progress-steps container a přidáme event listener
        const progressSteps = document.querySelector('.progress-steps');
        if (!progressSteps) return;
        
        // Odstraníme existující event listenery pomocí klonování
        const newProgressSteps = progressSteps.cloneNode(true);
        progressSteps.parentNode.replaceChild(newProgressSteps, progressSteps);
        
        // Přidáme nový click event přímo na container pro delegaci události
        newProgressSteps.addEventListener('click', function(event) {
            // Najdeme nejbližší step element k místu kliknutí
            const clickedStep = event.target.closest('.step');
            if (!clickedStep) return; // Klikli jsme mimo step
            
            // Získáme cílový krok
            const targetStep = clickedStep.getAttribute('data-step');
            if (!targetStep) return; // Chybí data-step attribute
            
            // Speciální případ - krok "confirmation" je vždy nepřístupný přes progress bar
            if (targetStep === 'confirmation') {
                showNotification('Pro dokončení objednávky použijte tlačítko "Dokončit objednávku"', 'warning');
                return;
            }
            
            console.log('Kliknuto na krok:', targetStep);
            
            // Získáme indexy pro porovnání
            const stepOrder = ['cart', 'delivery', 'contact', 'confirmation'];
            const currentStepIndex = stepOrder.indexOf(currentStep);
            const targetStepIndex = stepOrder.indexOf(targetStep);
            
            // Klikli jsme na aktuální krok - nic neděláme
            if (targetStep === currentStep) return;
            
            // Klikli jsme na krok, kterým jsme již prošli - povolíme návrat
            if (targetStepIndex < currentStepIndex) {
                console.log('Navigace zpět na', targetStep);
                goToStep(targetStep);
                return;
            }
            
            // Klikli jsme na další krok v pořadí - kontrolujeme podmínky
            if (targetStepIndex === currentStepIndex + 1) {
                if (targetStep === 'delivery' && cart.length === 0) {
                    showNotification('Váš košík je prázdný', 'error');
                    return;
                }
                
                if (targetStep === 'contact' && !validateDeliverySelection()) {
                    showNotification('Vyberte prosím způsob dopravy a platby', 'error');
                    return;
                }
                
                console.log('Navigace vpřed na', targetStep);
                goToStep(targetStep);
                return;
            }
            
            // Klikli jsme na krok, který je příliš daleko v budoucnosti
            showNotification('Nejprve dokončete předchozí kroky', 'warning');
        });
        
        // Vizuální indikace klikatelnosti
        const steps = newProgressSteps.querySelectorAll('.step');
        steps.forEach(step => {
            // Vizuální indikace klikatelnosti podle aktuálního kroku
            const stepName = step.getAttribute('data-step');
            const stepIndex = stepOrder.indexOf(stepName);
            const currentStepIndex = stepOrder.indexOf(currentStep);
            
            // Speciální případ pro krok "confirmation" - vždy ho označíme jako nepřístupný
            if (stepName === 'confirmation') {
                step.style.cursor = 'not-allowed';
                step.classList.add('disabled');
                step.setAttribute('title', 'Pro dokončení objednávky použijte tlačítko "Dokončit objednávku"');
            } else if (stepIndex <= currentStepIndex) {
                step.style.cursor = 'pointer';
            } else {
                step.style.cursor = 'not-allowed';
            }
            
            // Přidáme tooltip
            if (stepName !== 'confirmation') {
                step.setAttribute('title', stepIndex < currentStepIndex ? 
                    'Klikněte pro návrat k tomuto kroku' : 
                    (stepIndex === currentStepIndex ? 'Aktuální krok' : 'Nejprve dokončete předchozí kroky'));
            }
        });
    }
    
    // Přidání CSS stylů pro animace a efekty a také skrytí progress baru na stránce potvrzení
    const styleEl = document.createElement('style');
    styleEl.textContent = `
        @keyframes confettiFall {
            0% { transform: translateY(-100vh) rotate(0deg); }
            100% { transform: translateY(100vh) rotate(360deg); }
        }
        
        .confetti {
            position: fixed;
            top: -10px;
            width: 10px;
            height: 10px;
            border-radius: 50%;
            animation: confettiFall linear forwards;
            z-index: 9999;
            pointer-events: none;
        }
        
        input.quantity.updated,
        .item-price.updated {
            animation: pulse 0.5s ease;
        }
        
        @keyframes pulse {
            0% { transform: scale(1); }
            50% { transform: scale(1.1); opacity: 0.8; }
            100% { transform: scale(1); }
        }
        
        .removing {
            transform: translateX(50px);
            opacity: 0;
            transition: transform 0.3s ease, opacity 0.3s ease, height 0.3s ease 0.3s;
            height: 0 !important;
            overflow: hidden;
            margin: 0;
            padding: 0;
        }
        
        .success {
            border-color: var(--success) !important;
            animation: successPulse 0.5s ease;
        }
        
        @keyframes successPulse {
            0% { box-shadow: 0 0 0 0 rgba(76, 175, 80, 0.4); }
            50% { box-shadow: 0 0 0 10px rgba(76, 175, 80, 0.2); }
            100% { box-shadow: 0 0 0 0 rgba(76, 175, 80, 0); }
        }
        
        .clicked {
            transform: translateX(-15px);
            opacity: 0.8;
            transition: transform 0.3s ease, opacity 0.3s ease;
        }
        
        #shipping-address {
            max-height: 0;
            overflow: hidden;
            opacity: 0;
            transform: translateY(-20px);
            transition: max-height 0.5s ease, opacity 0.3s ease, transform 0.3s ease;
        }
        
        #shipping-address.visible {
            max-height: 1000px;
            opacity: 1;
            transform: translateY(0);
        }
        
        /* Styly pro dokončené kroky */
        .step.completed .step-icon {
            background: linear-gradient(45deg, var(--primary), var(--secondary));
            box-shadow: 0 0 15px rgba(0, 230, 118, 0.5);
            border-color: var(--primary);
        }
        
        .step.completed .step-icon i {
            color: var(--dark);
        }
        
        .step.completed .step-text {
            color: var(--primary);
            font-weight: 600;
        }
        
        /* Styly pro spojovací čáry dokončených kroků */
        .completed-line {
            background: linear-gradient(to right, var(--primary), var(--secondary)) !important;
            box-shadow: 0 0 10px rgba(0, 230, 118, 0.3);
        }
        
        /* Hover efekty pro kroky */
        .step.active:hover, .step.completed:hover {
            transform: translateY(-3px);
            transition: transform 0.3s ease;
        }
        
        .step-icon {
            transition: transform 0.3s ease, background 0.3s ease, box-shadow 0.3s ease;
        }
        
        .step.active:hover .step-icon, .step.completed:hover .step-icon {
            transform: scale(1.1);
            box-shadow: 0 0 20px rgba(0, 230, 118, 0.7);
        }
        
        /* Skrytí progress baru na stránce potvrzení objednávky */
        #confirmation-section.active ~ header,
        #confirmation-section.active ~ .progress-container,
        #confirmation-section.active ~ .progress-steps,
        body.confirmation-page header,
        body.confirmation-page .progress-container,
        body.confirmation-page .progress-steps {
            display: none !important;
        }
    `;
    document.head.appendChild(styleEl);
});

/**
 * Funkce pro zabezpečené stažení faktury
 * Přidejte tuto funkci do souboru Cart.js
 */
function secureDownloadInvoice(invoiceNumber, orderNumber) {
    // Zobrazení loaderu
    showLoader();
    
    // Nejprve získáme token pro stažení faktury
    fetch(`/api/invoices/${invoiceNumber}/get-download-token`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            order_number: orderNumber
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'success' && data.token) {
            // Pokud jsme získali token, vytvoříme odkaz pro stažení a automaticky ho klikneme
            const downloadUrl = `/api/invoices/${invoiceNumber}/download?token=${encodeURIComponent(data.token)}`;
            
            // Vytvoření dočasného odkazu pro stažení
            const downloadLink = document.createElement('a');
            downloadLink.href = downloadUrl;
            downloadLink.download = `Faktura-${invoiceNumber}.pdf`;
            downloadLink.style.display = 'none';
            document.body.appendChild(downloadLink);
            
            // Kliknutí na odkaz a spuštění stahování
            downloadLink.click();
            
            // Odstranění odkazu po stažení
            setTimeout(() => {
                document.body.removeChild(downloadLink);
                hideLoader();
            }, 1000);
        } else {
            hideLoader();
            showNotification(data.message || 'Nepodařilo se získat token pro stažení faktury', 'error');
        }
    })
    .catch(error => {
        hideLoader();
        console.error('Chyba při získávání tokenu:', error);
        showNotification('Došlo k chybě při stahování faktury', 'error');
    });
}

/**
 * Upravená funkce pro aktualizaci detailů o objednávce v potvrzovacím okně
 * Upravte stávající funkci updateConfirmationWithOrderData v Cart.js
 */
function updateConfirmationWithOrderData(order) {
    // Nastavení čísla objednávky
    const confirmationInfo = document.querySelector('.confirmation-info strong');
    if (confirmationInfo) {
        confirmationInfo.textContent = `#${order.order_number}`;
    }
    
    // Nastavení emailu
    const emailField = document.getElementById('email');
    const confirmationEmail = document.getElementById('confirmation-email-address');
    if (emailField && confirmationEmail) {
        confirmationEmail.textContent = emailField.value;
    }
    
    // Custom handling for Zásilkovna branch
    if (order.shipping && order.shipping.method === 'zasilkovna' && order.shipping.branch) {
        const orderShippingEl = document.getElementById('order-shipping');
        if (orderShippingEl) {
            orderShippingEl.textContent = `Zásilkovna - ${order.shipping.branch.name}`;
            if (order.shipping.branch.address) {
                orderShippingEl.textContent += ` (${order.shipping.branch.address})`;
            }
        }
    } else {
        // Ostatní detaily můžeme aktualizovat pomocí standardní funkce
        updateConfirmationDetails();
    }
    
    // Update payment method display
    const orderPaymentEl = document.getElementById('order-payment');
    if (orderPaymentEl && order.payment && order.payment.method) {
        if (order.payment && order.payment.method === 'bank') {
            showBankTransferDetails(order);
        } else if (order.payment.method === 'card') {
            orderPaymentEl.textContent = 'Online platba kartou';
        } else if (order.payment.method === 'cod') {
            orderPaymentEl.textContent = 'Dobírka';
        }
    }
    
    // Update total price display
    const orderTotalEl = document.getElementById('order-total');
    if (orderTotalEl && order.total) {
        orderTotalEl.textContent = `${order.total} Kč`;
    }
    
    // Set variable symbol (order number) for bank account
    const variableSymbolEl = document.getElementById('variable-symbol');
    if (variableSymbolEl) {
        const shortVS = order.order_number.toString().slice(0, 8) + order.order_number.toString().slice(-2);
        variableSymbolEl.textContent = shortVS;
    }
    
    // Set payment amount 
    const paymentAmountEl = document.getElementById('payment-amount');
    if (paymentAmountEl && order.total) {
        paymentAmountEl.textContent = `${order.total} Kč`;
    }
    
    // Create download invoice button event listener with secured download
    const downloadInvoiceBtn = document.getElementById('download-invoice-btn');
    if (downloadInvoiceBtn) {
        // Odstranění všech existujících event listenerů pomocí klonování
        const newDownloadBtn = downloadInvoiceBtn.cloneNode(true);
        downloadInvoiceBtn.parentNode.replaceChild(newDownloadBtn, downloadInvoiceBtn);
        
        // Uložení informací o objednávce do lokálního úložiště
        localStorage.setItem('lastOrderNumber', order.order_number);
        
        // Přidání nového event listeneru s opravou
        newDownloadBtn.addEventListener('click', function(e) {
            e.preventDefault();
            
            // Zobrazení loaderu
            showLoader();
            
            // Použijeme číslo objednávky pro získání/vytvoření faktury
            fetch(`/api/invoices/${order.order_number}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            })
            .then(response => response.json())
            .then(data => {
                if (data.status === 'success' && data.invoice) {
                    // Spustíme stahování faktury
                    window.location.href = `/api/invoices/${data.invoice.invoice_number}/download`;
                    
                    // Skryjeme loader po krátké prodlevě
                    setTimeout(() => {
                        hideLoader();
                    }, 1000);
                } else {
                    hideLoader();
                    showNotification(data.message || 'Nepodařilo se získat fakturu', 'error');
                }
            })
            .catch(error => {
                hideLoader();
                console.error('Chyba při získávání faktury:', error);
                showNotification('Došlo k chybě při přístupu k faktuře', 'error');
            });
        });
    }
}

let isDownloadSetup = false; // Globální flag pro kontrolu inicializace

function setupInvoiceDownload() {
    // Kontrola, zda už není inicializováno
    if (isDownloadSetup) return;
    
    const downloadBtn = document.getElementById('download-invoice-btn');
    if (!downloadBtn) return;
    
    isDownloadSetup = true; // Nastavíme flag
    
    // Odstranění všech existujících event listenerů
    const newBtn = downloadBtn.cloneNode(true);
    downloadBtn.parentNode.replaceChild(newBtn, downloadBtn);

    newBtn.addEventListener('click', async function(e) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        
        showLoader();
        
        try {
            // 1. Získání čísla objednávky
            const orderNumberElement = document.querySelector('.confirmation-info strong');
            if (!orderNumberElement) {
                throw new Error('Číslo objednávky nebylo nalezeno');
            }
            
            const orderNumber = orderNumberElement.textContent.replace('#', '').trim();
            
            // 2. Explicitní URL pro backend
            const backendUrl = 'http://127.0.0.1:5000';
            
            // 3. Získání faktury
            const invoiceResponse = await fetch(`${backendUrl}/api/invoices/${orderNumber}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            const invoiceData = await invoiceResponse.json();
            
            if (invoiceData.status !== 'success' || !invoiceData.invoice) {
                throw new Error(invoiceData.message || 'Nepodařilo se získat fakturu');
            }
            
            const invoiceNumber = invoiceData.invoice.invoice_number;
            
            // 4. Získání download tokenu
            const tokenResponse = await fetch(`${backendUrl}/api/invoices/${invoiceNumber}/get-download-token`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    order_number: orderNumber
                })
            });
            
            const tokenData = await tokenResponse.json();
            
            if (tokenData.status !== 'success' || !tokenData.token) {
                throw new Error(tokenData.message || 'Nepodařilo se získat token pro stažení');
            }
            
            // 5. Vytvoření dočasného odkazu pro stahování
            const downloadUrl = `${backendUrl}/api/invoices/${invoiceNumber}/download?token=${encodeURIComponent(tokenData.token)}`;
            
            // 6. Vytvoření skrytého iframe pro stahování
            const iframe = document.createElement('iframe');
            iframe.style.display = 'none';
            iframe.src = downloadUrl;
            document.body.appendChild(iframe);
            
            // 7. Alternativní metoda pro prohlížeče, které blokují iframe
            setTimeout(() => {
                const link = document.createElement('a');
                link.href = downloadUrl;
                link.download = `faktura-${invoiceNumber}.pdf`;
                link.style.display = 'none';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            }, 100);
            
            // 8. Úklid a notifikace
            setTimeout(() => {
                if (document.body.contains(iframe)) {
                    document.body.removeChild(iframe);
                }
                hideLoader();
                showNotification('Faktura byla stažena', 'success');
            }, 2000);
            
        } catch (error) {
            console.error('Chyba při stahování faktury:', error);
            hideLoader();
            showNotification(error.message || 'Došlo k chybě při stahování faktury', 'error');
        }
    });
}

/**
 * Funkce pro vytvoření faktury, pokud ještě neexistuje
 */
function createAndDownloadInvoice(orderNumber) {
    showLoader();
    
    // Voláme API pro vytvoření faktury
    fetch(`/api/invoices/${orderNumber}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'success' && data.invoice) {
            // Pokud se faktura úspěšně vytvořila nebo již existovala, stáhneme ji
            secureDownloadInvoice(data.invoice.invoice_number, orderNumber);
        } else {
            hideLoader();
            showNotification(data.message || 'Nepodařilo se vytvořit fakturu', 'error');
        }
    })
    .catch(error => {
        hideLoader();
        console.error('Chyba při vytváření faktury:', error);
        showNotification('Došlo k chybě při vytváření faktury', 'error');
    });
}

// Načtení metod dopravy a platby z API
async function loadShippingPaymentMethods() {
    try {
        const response = await fetch(API.baseUrl + '/shipping-payment-methods');
        
        if (!response.ok) {
            console.warn('Nepodařilo se načíst metody dopravy a platby z API');
            return;
        }
        
        const data = await response.json();
        
        if (data.status === 'success') {
            console.log('Metody dopravy a platby byly úspěšně načteny z API');
        }
    } catch (error) {
        console.error('Chyba při načítání metod dopravy a platby:', error);
    }
}

// Volání API pro ověření slevového kupónu
/**
 * Oprava pro chybu "appliedCoupon is not defined"
 * Tento kód by měl být umístěn hned na začátku Cart.js souboru 
 * v sekci inicializace proměnných (kolem řádku 8)
 */

// ...pokračování stávajícího kódu...

/**
 * Funkce applyCouponWithApi, která nyní kontroluje existenci proměnných
 */
function applyCouponWithApi() {
    const couponInput = document.getElementById('coupon-code');
    
    if (!couponInput || !couponInput.value.trim()) {
        showNotification('Zadejte prosím slevový kód', 'warning');
        return;
    }
    
    const couponCode = couponInput.value.trim().toUpperCase();
    
    // Kontrola, zda již nebyl použit tento kupón
    if (window.appliedCoupon && window.appliedCoupon.code === couponCode) {
        showNotification('Tento kupón již byl použit', 'warning');
        return;
    }
    
    // Vypočítání aktuálního mezisoučtu
    const subtotal = calculateSubtotal();
    
    // Získání emailu zákazníka, pokud je vyplněn
    const emailField = document.getElementById('email');
    const customerEmail = emailField ? emailField.value : null;
    
    // Zobrazení loaderu
    showLoader();
    
    // Volání API pro ověření kupónu
    fetch('http://127.0.0.1:5000/api/shop/verify-coupon', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        },
        body: JSON.stringify({
            code: couponCode,
            subtotal: subtotal,
            customer_email: customerEmail
        })
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Neplatný slevový kód');
        }
        return response.json();
    })
    .then(data => {
        hideLoader();
        
        if (data.status === 'success') {
            // Nastavení globální proměnné s informacemi o kupónu
            window.appliedCoupon = data.coupon;
            
            // Nastavení slevy jako globální proměnné
            window.discountAmount = data.coupon.discount;
            
            // Vymazání vstupního pole
            couponInput.value = '';
            couponInput.placeholder = `Kupón ${data.coupon.code} aplikován (${data.coupon.description})`;
            couponInput.classList.add('success');
            setTimeout(() => {
                couponInput.classList.remove('success');
            }, 1500);
            
            // Aktualizace cen
            updateAllOrderSummaries();
            
            // Zobrazení aplikovaného kupónu
            displayAppliedCoupon(data.coupon);
            
            // Zobrazení notifikace
            showNotification(data.message || 'Sleva byla úspěšně aplikována', 'success');
            
            // Pro jistotu zalogujeme nastavené hodnoty
            console.log("Sleva byla nastavena:", {
                appliedCoupon: window.appliedCoupon,
                discountAmount: window.discountAmount
            });
        } else {
            couponInput.classList.add('error');
            setTimeout(() => {
                couponInput.classList.remove('error');
            }, 500);
            showNotification(data.message || 'Neplatný slevový kód', 'error');
        }
    })
    .catch(error => {
        hideLoader();
        console.error('Chyba při ověřování kupónu:', error);
        
        couponInput.classList.add('error');
        setTimeout(() => {
            couponInput.classList.remove('error');
        }, 500);
        
        showNotification('Tento slevový kód neexistuje.', 'error');
    });
}

// Přidej tuto funkci pro inicializaci kupónů při načtení stránky
function initCoupons() {
    // Přidání obsluhy klávesy Enter v poli pro kupón
    const couponInput = document.getElementById('coupon-code');
    if (couponInput) {
        couponInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                applyCouponWithApi(); // Změna zde
            }
        });
    }
}

/**
 * Kód pro integraci modálního okna do stávajícího Cart.js
 * Tento kód by měl být vložen na konec souboru Cart.js
 */

// Inicializace funkcí pro modální okno při načtení stránky
document.addEventListener('DOMContentLoaded', function() {
    // Reference na elementy
    const orderConfirmationModal = document.getElementById('orderConfirmationModal');
    const closeConfirmationModal = document.getElementById('closeConfirmationModal');
    const cancelOrderBtn = document.getElementById('cancelOrderBtn');
    const confirmOrderBtn = document.getElementById('confirmOrderBtn');
    const termsCheckbox = document.getElementById('terms-agreement-checkbox');
    const modalTotalPrice = document.getElementById('modal-total-price');
    const modalShippingMethod = document.getElementById('modal-shipping-method');
    const modalPaymentMethod = document.getElementById('modal-payment-method');

    function nukeCart() {
        console.log("Spouštím TOTÁLNÍ reset košíku");
        
        // 1. COOKIES
        // Procházíme všechny cookies
        const allCookies = document.cookie.split(';');
        for (let i = 0; i < allCookies.length; i++) {
            const cookie = allCookies[i].trim();
            if (cookie.startsWith('cart=')) {
                // Našli jsme cookie košíku - Smazat na všech cestách
                const paths = ['/', '/cart', '/cart.html', '/index.html', '/green.html', '/red.html', '/white.html', ''];
                paths.forEach(path => {
                    document.cookie = `cart=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=${path}`;
                });
                break;
            }
        }
        
        // 2. LOKÁLNÍ A SESSION STORAGE
        localStorage.removeItem('cart');
        sessionStorage.removeItem('cart');
        
        // 3. GLOBÁLNÍ PROMĚNNÉ
        cart = [];
        window.cart = [];
        
        // 4. AKTUALIZACE UI
        // Pokud jsme na stránce košíku
        const cartItemsContainer = document.querySelector('.cart-items');
        if (cartItemsContainer) {
            cartItemsContainer.innerHTML = '';
        }
        
        const summaryItemsContainer = document.querySelector('.summary-items');
        if (summaryItemsContainer) {
            summaryItemsContainer.innerHTML = '';
        }
        
        // Aktualizace počítadla
        const cartCountElements = document.querySelectorAll('.cart-count');
        cartCountElements.forEach(element => {
            element.textContent = '0';
        });
        
        // Na konci vraťme nějakou hodnotu
        return true;
    }
    
    // Získání původního tlačítka pro dokončení objednávky
    const completeOrderBtn = document.getElementById('complete-order');
    
    if (completeOrderBtn) {
        // Nahrazení původního textu
        const spanElement = completeOrderBtn.querySelector('span');
        if (spanElement) {
            spanElement.textContent = 'Dokončit objednávku';
        }
        
        // Vytvoření nového tlačítka, které nahradí původní (pro odstranění všech existujících event listenerů)
        const newCompleteOrderBtn = completeOrderBtn.cloneNode(true);
        completeOrderBtn.parentNode.replaceChild(newCompleteOrderBtn, completeOrderBtn);
        
        // Přidání event listeneru pro otevření modálu
        newCompleteOrderBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            // Nejprve zkontrolujeme validaci formuláře před otevřením modálu
            if (!validateContactForm()) {
                showNotification('Vyplňte prosím všechny povinné údaje', 'error');
                return;
            }
            
            // Načtení aktuálních dat pro zobrazení v modálu
            updateModalContent();
            
            // Zobrazení modálu
            showOrderConfirmationModal();
        });
    }
    
    // Zavření modálu
    if (closeConfirmationModal) {
        closeConfirmationModal.addEventListener('click', hideOrderConfirmationModal);
    }
    
    // Zrušení dokončení objednávky
    if (cancelOrderBtn) {
        cancelOrderBtn.addEventListener('click', hideOrderConfirmationModal);
    }
    
    // Potvrzení objednávky
    if (confirmOrderBtn) {
        confirmOrderBtn.addEventListener('click', function() {
            // Skrytí modálu
            hideOrderConfirmationModal();
            
            // Zobrazení loaderu
            showLoader();
            
            // Simulace načítání pro lepší UX
            setTimeout(function() {
                // Zavolání funkce pro dokončení objednávky - zde musíme použít správnou funkci podle existujícího kódu
                // Pokud existuje globální funkce completeOrderWithApi, použijeme ji
                if (typeof completeOrderWithApi === 'function') {
                    completeOrderWithApi();
                    nukeCart();
                } 
                // Pokud existuje metoda v okně
                else if (window.completeOrderWithApi) {
                    window.completeOrderWithApi();
                    nukeCart();
                } 
                // Pokud existuje originální funkce pro dokončení objednávky
                else if (typeof completeOrder === 'function') {
                    completeOrder();
                    nukeCart();
                }
                // Záložní řešení - snažíme se volat metodu z okna
                else if (window.completeOrder) {
                    window.completeOrder();
                    nukeCart();
                }
            }, 500);
        });
    }
    
    // Kontrola zaškrtnutí podmínek pro aktivaci tlačítka
    if (termsCheckbox) {
        termsCheckbox.addEventListener('change', function() {
            confirmOrderBtn.disabled = !this.checked;
        });
    }
    
    // Zavření modálu při kliknutí mimo obsah
    if (orderConfirmationModal) {
        orderConfirmationModal.addEventListener('click', function(e) {
            if (e.target === orderConfirmationModal) {
                hideOrderConfirmationModal();
            }
        });
    }
    
    // Zavření modálu při stisku klávesy Escape
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && orderConfirmationModal && orderConfirmationModal.classList.contains('show')) {
            hideOrderConfirmationModal();
        }
    });
    
    // Definice pomocných funkcí pokud ještě neexistují v globálním scope
    if (!window.showOrderConfirmationModal) {
        window.showOrderConfirmationModal = showOrderConfirmationModal;
    }
    
    if (!window.hideOrderConfirmationModal) {
        window.hideOrderConfirmationModal = hideOrderConfirmationModal;
    }
    
    if (!window.updateModalContent) {
        window.updateModalContent = updateModalContent;
    }
});

/**
 * Funkce pro aktualizaci obsahu modálu podle aktuálních dat
 */
function updateModalContent() {
    const modalTotalPrice = document.getElementById('modal-total-price');
    const modalShippingMethod = document.getElementById('modal-shipping-method');
    const modalPaymentMethod = document.getElementById('modal-payment-method');
    
    // Získání celkové ceny
    const totalEl = document.getElementById('total');
    const total = totalEl ? totalEl.textContent : '0 Kč';
    if (modalTotalPrice) {
        modalTotalPrice.textContent = total;
    }
    
    // Získání způsobu dopravy
    const deliverySelected = document.querySelector('input[name="delivery"]:checked');
    if (deliverySelected && modalShippingMethod) {
        let shippingMethodText = 'Nedefinováno';
        
        switch (deliverySelected.value) {
            case 'zasilkovna':
                // Kontrola, zda existuje vybraná pobočka Zásilkovny
                const branchName = localStorage.getItem('selectedBranchName');
                if (branchName) {
                    shippingMethodText = `Zásilkovna - ${branchName}`;
                } else {
                    shippingMethodText = 'Zásilkovna';
                }
                break;
            case 'ppl':
                shippingMethodText = 'PPL - doručení na adresu';
                break;
            case 'express':
                shippingMethodText = 'Expresní doručení';
                break;
            case 'pickup':
                shippingMethodText = 'Osobní odběr';
                break;
        }
        
        modalShippingMethod.textContent = shippingMethodText;
    }
    
    // Získání způsobu platby
    const paymentSelected = document.querySelector('input[name="payment"]:checked');
    if (paymentSelected && modalPaymentMethod) {
        let paymentMethodText = 'Nedefinováno';
        
        switch (paymentSelected.value) {
            case 'card':
                paymentMethodText = 'Online platba kartou';
                break;
            case 'bank':
                paymentMethodText = 'Bankovní převod';
                break;
            case 'cod':
                paymentMethodText = 'Dobírka';
                break;
        }
        
        modalPaymentMethod.textContent = paymentMethodText;
    }
}

/**
 * Funkce pro zobrazení modálu
 */
function showOrderConfirmationModal() {
    const orderConfirmationModal = document.getElementById('orderConfirmationModal');
    if (!orderConfirmationModal) return;
    
    orderConfirmationModal.classList.add('show');
    document.body.style.overflow = 'hidden'; // Zablokuje scrollování stránky
    
    // Reset checkboxu
    const termsCheckbox = document.getElementById('terms-agreement-checkbox');
    const confirmOrderBtn = document.getElementById('confirmOrderBtn');
    
    if (termsCheckbox) {
        termsCheckbox.checked = false;
    }
    
    if (confirmOrderBtn) {
        confirmOrderBtn.disabled = true;
    }
    
    // Přidání animace
    const modalContent = orderConfirmationModal.querySelector('.modal-content');
    if (modalContent) {
        modalContent.classList.add('animate-in');
    }
}

/**
 * Funkce pro skrytí modálu
 */
function hideOrderConfirmationModal() {
    const orderConfirmationModal = document.getElementById('orderConfirmationModal');
    if (!orderConfirmationModal) return;
    
    const modalContent = orderConfirmationModal.querySelector('.modal-content');
    
    if (modalContent) {
        modalContent.classList.remove('animate-in');
        modalContent.classList.add('animate-out');
        
        // Počkáme na dokončení animace před skrytím modálu
        setTimeout(function() {
            orderConfirmationModal.classList.remove('show');
            document.body.style.overflow = ''; // Povolíme scrollování stránky
            modalContent.classList.remove('animate-out');
        }, 300);
    } else {
        orderConfirmationModal.classList.remove('show');
        document.body.style.overflow = ''; // Povolíme scrollování stránky
    }
}

/**
 * Jednoduchá implementace funkce completeOrderWithApi pro případ, že není definována.
 * Tato funkce bude použita pouze pokud neexistuje originální implementace.
 */
if (typeof completeOrderWithApi !== 'function' && typeof window.completeOrderWithApi !== 'function') {
    window.completeOrderWithApi = function() {
        try {
            // Validace formuláře
            if (!validateContactForm()) {
                showNotification('Vyplňte prosím všechny povinné údaje', 'error');
                return;
            }
            
            // Zobrazení loaderu
            showLoader();
            
            // Příprava dat objednávky
            const orderData = prepareOrderData();
            console.log('Připravená data objednávky:', orderData);
            
            // Pokud existuje API objekt s baseUrl a metodou createOrder
            if (window.API && typeof window.API.createOrder === 'function') {
                API.createOrder(orderData)
                .then(function(response) {
                    processOrderResponse(response);
                })
                .catch(function(error) {
                    // Skrytí loaderu
                    hideLoader();
                    
                    // Zobrazení chyby
                    showNotification(error.message || 'Došlo k chybě při dokončování objednávky', 'error');
                    console.error('Chyba při odesílání objednávky:', error);
                });
            } 
            // Alternativní volání API pomocí fetch
            else {
                // Zkusíme použít výchozí URL pokud není definována
                //const apiBaseUrl = (window.API && window.API.baseUrl) ? window.API.baseUrl : '/api/shop';
                
                fetch('http://127.0.0.1:5000/api/shop/create-order', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify(orderData)
                })
                .then(function(response) {
                    if (!response.ok) {
                        throw new Error('Chyba při odesílání objednávky: ' + response.statusText);
                    }
                    return response.json();
                })
                .then(function(data) {
                    processOrderResponse(data);
                })
                .catch(function(error) {
                    // Skrytí loaderu
                    hideLoader();
                    
                    // Zobrazení chyby
                    showNotification(error.message || 'Došlo k chybě při dokončování objednávky', 'error');
                    console.error('Chyba při odesílání objednávky:', error);
                });
            }
        } catch (error) {
            console.error('Neočekávaná chyba při přípravě dat:', error);
            hideLoader();
            showNotification('Došlo k neočekávané chybě: ' + error.message, 'error');
        }
    };
    
    /**
     * Pomocná funkce pro zpracování odpovědi z API
     */
    function processOrderResponse(data) {
        const order = data.order || data;
        
        // Aktualizace detailů potvrzení
        if (typeof updateConfirmationWithOrderData === 'function') {
            updateConfirmationWithOrderData(order);
        } else if (window.updateConfirmationWithOrderData) {
            window.updateConfirmationWithOrderData(order);
        }
        
        // Uložení čísla objednávky do lokálního úložiště pro budoucí reference
        if (order.order_number) {
            localStorage.setItem('lastOrderNumber', order.order_number);
        }
        
        // Přidáme třídu pro identifikaci dokončené objednávky
        document.body.classList.add('confirmation-page');
        
        // Předběžně skryjeme progress bar
        const header = document.querySelector('header');
        if (header) {
            header.style.display = 'none';
        }
        
        // Přechod na potvrzovací obrazovku
        if (typeof goToStep === 'function') {
            goToStep('confirmation');
        } else if (window.goToStep) {
            window.goToStep('confirmation');
        }
        
        // Skrytí loaderu
        hideLoader();
        
        // Přehrání konfetti efektu pro radost z úspěšné objednávky
        if (typeof playOrderConfetti === 'function') {
            playOrderConfetti();
        } else if (window.playOrderConfetti) {
            window.playOrderConfetti();
        }
        
        // Pokud je platba kartou, přesměrujeme uživatele na platební bránu
        if (order.payment && order.payment.method === 'card' && data.payment_url) {
            setTimeout(function() {
                window.location.href = data.payment_url;
            }, 3000);
        }
    }
}

/**
 * Packeta Widget Integration
 * Přidejte tento kód na konec souboru Cart.js
 */

// Globální objekt pro Packeta integraci
const PacketaWidget = {
    apiKey: '5dee37ef7ba3dcde', // Váš API klíč Zásilkovny
    
    // Inicializace widgetu
    init: function() {
        // Kontrola, zda je vybrána Zásilkovna při načtení stránky
        const zasilkovnaSelected = document.querySelector('input[name="delivery"][value="zasilkovna"]:checked');
        if (zasilkovnaSelected) {
            this.setupWidgetUI();
            this.loadSelectedBranch();
        }
        
        // Přidání event listenerů pro změnu způsobu dopravy
        const deliveryOptions = document.querySelectorAll('input[name="delivery"]');
        deliveryOptions.forEach(option => {
            option.addEventListener('change', () => {
                if (option.value === 'zasilkovna') {
                    this.setupWidgetUI();
                    this.loadSelectedBranch();
                }
            });
        });
        
        // Rozšíření validační funkce pro kontrolu vybrané pobočky
        const originalValidateDelivery = window.validateDeliverySelection || function() { return true; };
        window.validateDeliverySelection = function() {
            const deliverySelected = document.querySelector('input[name="delivery"]:checked');
            const paymentSelected = document.querySelector('input[name="payment"]:checked');
            
            // Základní validace
            if (!deliverySelected || !paymentSelected) {
                return false;
            }
            
            // Speciální validace pro Zásilkovnu
            if (deliverySelected.value === 'zasilkovna') {
                const branchId = localStorage.getItem('selectedBranchId');
                if (!branchId) {
                    window.showNotification('Pro doručení Zásilkovnou vyberte prosím výdejní místo', 'warning');
                    
                    // Zvýrazní tlačítko pro výběr pobočky
                    const selectButton = document.getElementById('packeta-select-branch');
                    if (selectButton) {
                        selectButton.classList.add('pulse');
                        setTimeout(() => {
                            selectButton.classList.remove('pulse');
                        }, 3000);
                    }
                    
                    return false;
                }
            }
            
            return true;
        };
        
        // Rozšíření funkce pro aktualizaci údajů v potvrzení objednávky
        const originalUpdateConfirmation = window.updateConfirmationDetails || function() {};
        window.updateConfirmationDetails = function() {
            // Nejdřív zavoláme původní funkci
            if (typeof originalUpdateConfirmation === 'function') {
                originalUpdateConfirmation();
            }
            
            // Pak rozšíříme o informace z Packeta widgetu
            const deliveryOption = document.querySelector('input[name="delivery"]:checked');
            if (deliveryOption && deliveryOption.value === 'zasilkovna') {
                const branchName = localStorage.getItem('selectedBranchName');
                const orderShippingEl = document.getElementById('order-shipping');
                if (orderShippingEl && branchName) {
                    orderShippingEl.textContent = `Zásilkovna - ${branchName}`;
                }
            }
        };
        
        // Přidání globálního event listeneru pro tlačítka změny výdejního místa
        document.addEventListener('click', (e) => {
            // Kontrola, zda kliknutí bylo na některé z tlačítek pro změnu výdejního místa
            if (
                e.target.id === 'packeta-select-branch' || 
                e.target.id === 'packeta-change-branch' ||
                (e.target.parentElement && (
                    e.target.parentElement.id === 'packeta-select-branch' ||
                    e.target.parentElement.id === 'packeta-change-branch'
                ))
            ) {
                e.preventDefault();
                e.stopPropagation();
                this.openWidget();
                return false;
            }
        });
        
        // Skrytí sekce s potvrzením objednávky při inicializaci
        const confirmationSection = document.getElementById('confirmation-section');
        if (confirmationSection) {
            confirmationSection.style.display = 'none';
            confirmationSection.classList.remove('active');
        }
    },
    
    // Příprava UI komponenty pro widget
    setupWidgetUI: function() {
        const deliveryOption = document.querySelector('.option-card[for="delivery-1"]');
        if (!deliveryOption) return;
        
        // Kontrola, zda již existuje widgetUI
        let widgetUI = deliveryOption.querySelector('.packeta-widget-ui');
        if (widgetUI) return;
        
        // Vytvoření UI komponenty
        widgetUI = document.createElement('div');
        widgetUI.className = 'packeta-widget-ui';
        widgetUI.innerHTML = `
            <div class="packeta-info">
                <p>Pro doručení na výdejní místo Zásilkovny je nutné vybrat konkrétní pobočku.</p>
                <div id="packeta-selected-branch" class="packeta-selected hidden">
                    <div class="packeta-branch-detail">
                        <i class="fas fa-map-marker-alt"></i>
                        <div>
                            <strong id="packeta-branch-name">Žádná pobočka nebyla vybrána</strong>
                            <span id="packeta-branch-address"></span>
                            <button type="button" id="packeta-change-branch" class="packeta-change-branch">Změnit výdejní místo</button>
                        </div>
                    </div>
                </div>
            </div>
            <button type="button" id="packeta-select-branch" class="packeta-branch-btn">
                <i class="fas fa-map-marked-alt"></i>
                <span>Vybrat výdejní místo</span>
            </button>
        `;
        
        // Vložení UI do DOM
        const optionBody = deliveryOption.querySelector('.option-body');
        if (optionBody) {
            optionBody.appendChild(widgetUI);
        }
    },
    
    // Otevření widgetu pro výběr výdejního místa
    openWidget: function() {
        // Kontrola, zda je knihovna načtena
        if (!window.Packeta) {
            console.error('Packeta Widget knihovna není načtena');
            return;
        }
        
        // Konfigurace widgetu
        const options = {
            language: 'cs',
            country: 'cz',
            webUrl: window.location.hostname || 'www.sajrajt.cz',
            appIdentity: 'sajrajt-1.0'
        };
        
        // Callback funkce
        const callback = (point) => {
            if (point) {
                this.saveSelectedBranch(point);
            } else {
                console.log('Výběr pobočky byl zrušen');
            }
        };
        
        // Zobrazení widgetu
        Packeta.Widget.pick(this.apiKey, callback, options);
    },
    
    // Uložení vybrané pobočky
    saveSelectedBranch: function(point) {
        // Uložení údajů do localStorage
        localStorage.setItem('selectedBranchId', point.id);
        localStorage.setItem('selectedBranchName', point.name);
        localStorage.setItem('selectedBranchAddress', `${point.street}, ${point.city}, ${point.zip}`);
        
        // Zobrazení vybrané pobočky v UI
        const branchNameEl = document.getElementById('packeta-branch-name');
        const branchAddressEl = document.getElementById('packeta-branch-address');
        const selectedBranchEl = document.getElementById('packeta-selected-branch');
        const selectButton = document.getElementById('packeta-select-branch');
        
        if (branchNameEl && branchAddressEl && selectedBranchEl) {
            branchNameEl.textContent = point.name;
            branchAddressEl.textContent = `${point.street}, ${point.city}, ${point.zip}`;
            selectedBranchEl.classList.remove('hidden');
            
            // Změna textu tlačítka
            if (selectButton) {
                selectButton.innerHTML = `
                    <i class="fas fa-edit"></i>
                    <span>Změnit výdejní místo</span>
                `;
            }
        }
        
        // Přidání skrytých polí do formuláře
        this.addBranchInfoToForm(point);
        
        // Zobrazení notifikace
        if (window.showNotification) {
            window.showNotification(`Vybráno výdejní místo "${point.name}"`, 'success');
        }
    },
    
    // Načtení uložené pobočky
    loadSelectedBranch: function() {
        const branchId = localStorage.getItem('selectedBranchId');
        const branchName = localStorage.getItem('selectedBranchName');
        const branchAddress = localStorage.getItem('selectedBranchAddress');
        
        if (branchId && branchName) {
            const branchNameEl = document.getElementById('packeta-branch-name');
            const branchAddressEl = document.getElementById('packeta-branch-address');
            const selectedBranchEl = document.getElementById('packeta-selected-branch');
            const selectButton = document.getElementById('packeta-select-branch');
            
            if (branchNameEl && branchAddressEl && selectedBranchEl) {
                branchNameEl.textContent = branchName;
                branchAddressEl.textContent = branchAddress || '';
                selectedBranchEl.classList.remove('hidden');
                
                // Změna textu tlačítka
                if (selectButton) {
                    selectButton.innerHTML = `
                        <i class="fas fa-edit"></i>
                        <span>Změnit výdejní místo</span>
                    `;
                }
            }
            
            // Přidání informací o pobočce do formuláře
            const point = {
                id: branchId,
                name: branchName,
                street: branchAddress ? branchAddress.split(',')[0].trim() : '',
                city: branchAddress ? branchAddress.split(',')[1].trim() : '',
                zip: branchAddress ? branchAddress.split(',')[2].trim() : '',
                country: 'cz'
            };
            
            this.addBranchInfoToForm(point);
        }
    },
    
    // Přidání informací o pobočce jako skrytá pole do formuláře
    addBranchInfoToForm: function(point) {
        // Odstranění existujících skrytých polí
        const existingFields = document.querySelectorAll('.packeta-hidden-field');
        existingFields.forEach(field => field.remove());
        
        // Vytvoření nových skrytých polí
        const contactForm = document.querySelector('.contact-form');
        if (contactForm) {
            const hiddenFields = [
                { name: 'branch_id', value: point.id },
                { name: 'branch_name', value: point.name },
                { name: 'branch_street', value: point.street },
                { name: 'branch_city', value: point.city },
                { name: 'branch_zip', value: point.zip },
                { name: 'branch_country', value: point.country }
            ];
            
            hiddenFields.forEach(field => {
                const input = document.createElement('input');
                input.type = 'hidden';
                input.name = field.name;
                input.value = field.value;
                input.className = 'packeta-hidden-field';
                contactForm.appendChild(input);
            });
        }
    }
};

// Přidání inicializace Packeta do DOMContentLoaded event
document.addEventListener('DOMContentLoaded', function() {
    // Inicializace Packeta widgetu
    PacketaWidget.init();
});

/**
 * Rozšíření pro komunikaci s API
 * Tato sekce rozšiřuje Cart.js o komunikaci s backend API
 */

// Pomocné funkce pro volání API
const API = {
    // Základní URL pro API
    baseUrl: 'http://127.0.0.1:5000/api/shop',
    
    // Pomocná metoda pro AJAX požadavky
    async request(endpoint, method = 'GET', data = null) {
        const url = `${this.baseUrl}${endpoint}`;
        const options = {
            method,
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            credentials: 'include' // Zahrnout cookies
        };
        
        if (data) {
            options.body = JSON.stringify(data);
        }
        
        try {
            const response = await fetch(url, options);
            const result = await response.json();
            
            if (!response.ok) {
                throw new Error(result.message || 'Došlo k chybě při komunikaci se serverem');
            }
            
            return result;
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    },
    
    // Metoda pro ověření slevového kódu
    async verifyCoupon(code, subtotal, customerEmail = null) {
        return this.request('/verify-coupon', 'POST', {
            code,
            subtotal,
            customer_email: customerEmail
        });
    },
    
    // Metoda pro vytvoření objednávky
    async createOrder(orderData) {
        return this.request('/create-order', 'POST', orderData);
    },
    
    // Metoda pro získání aktuálních cen dopravy a platby
    async getShippingPaymentMethods() {
        return this.request('/shipping-payment-methods');
    },
    
    // Metoda pro získání dostupných produktů
    async getProducts() {
        return this.request('/products');
    }
};