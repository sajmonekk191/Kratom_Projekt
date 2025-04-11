/**
 * Cart.js - JavaScript pro nákupní košík
 * Verze 3.0 - Upravená verze s načítáním dat z cookies
 */

document.addEventListener('DOMContentLoaded', function() {
    // ===== INICIALIZACE PROMĚNNÝCH =====
    let cart = [];
    let currentStep = 'cart';
    let shippingPrice = 79; // Základní cena dopravy (Zásilkovna)
    let paymentFee = 0; // Základní cena platby
    let discountAmount = 0; // Sleva
    let appliedCoupon = ''; // Aplikovaný kupón
    
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
    
    /**
     * Získání košíku z cookies
     */
    function getCartFromCookies() {
        const cookieValue = document.cookie
            .split('; ')
            .find(row => row.startsWith('cart='));
        
        if (cookieValue) {
            try {
                return JSON.parse(decodeURIComponent(cookieValue.split('=')[1]));
            } catch (error) {
                console.error('Chyba při načítání košíku z cookies:', error);
                return [];
            }
        }
        
        return [];
    }
    
    /**
     * Uložení košíku do cookies
     */
    function saveCart() {
        const date = new Date();
        date.setTime(date.getTime() + (30 * 24 * 60 * 60 * 1000)); // 30 dní platnost
        document.cookie = `cart=${encodeURIComponent(JSON.stringify(cart))}; expires=${date.toUTCString()}; path=/; samesite=lax`;
    }
    
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
            applyBtn.addEventListener('click', applyCoupon);
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
                applyBtn.addEventListener('click', applyCoupon);
            }
        }
    }
    
    /**
     * Inicializace progress baru
     */
    function initProgressBar() {
        updateProgressBar('cart');
    }
    
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
            (shippingPrice === 0 ? 'Zdarma' : `${shippingPrice} Kč`);
        
        // Aktualizace zobrazených cen v košíku
        if (subtotalEl) subtotalEl.textContent = `${subtotal} Kč`;
        if (shippingEl) shippingEl.textContent = shippingText;
        if (discountEl) discountEl.textContent = discountAmount > 0 ? `-${discountAmount} Kč` : '0 Kč';
        if (totalEl) totalEl.textContent = `${total} Kč`;
        
        // Aktualizace cen v souhrnu dopravy
        if (summaryShippingEl) summaryShippingEl.textContent = shippingText;
        if (summaryPaymentEl) summaryPaymentEl.textContent = paymentFee === 0 ? '0 Kč' : `${paymentFee} Kč`;
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
            (shippingPrice === 0 ? 'Zdarma' : `${shippingPrice} Kč`);
        
        const paymentText = !isPaymentSelected ? 
            'Vyberte Platbu' :  // Text pro nevybranou platbu
            (paymentFee === 0 ? 'Zdarma' : `${paymentFee} Kč`);
        
        // Výpočet celkové ceny
        const total = calculateTotal();
        
        // Najdeme všechny řádky se slevou
        const discountRows = document.querySelectorAll('.summary-rows .discount');
        
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
        
        // Zjistíme, zda je vybraná doprava
        const deliverySelected = document.querySelector('input[name="delivery"]:checked');
        // Zjistíme, zda je vybraná platba
        const paymentSelected = document.querySelector('input[name="payment"]:checked');
        
        // Cena dopravy se připočítá pouze pokud byla vybrána
        const actualShippingPrice = deliverySelected ? shippingPrice : 0;
        
        // Cena platby se připočítá pouze pokud byla vybrána
        const actualPaymentFee = paymentSelected ? paymentFee : 0;
        
        // Celková cena
        return subtotal + actualShippingPrice + actualPaymentFee - discountAmount;
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
                    shippingPrice = 79;
                    break;
                case 'ppl':
                    shippingPrice = 89;
                    break;
                case 'express':
                    shippingPrice = 149;
                    break;
                case 'pickup':
                    shippingPrice = 0;
                    break;
                default:
                    shippingPrice = 0;
            }
            
            // Uložení vybrané metody
            saveShippingMethod(value);
        } else {
            // Pokud není nic vybráno, nastavíme cenu na 0
            shippingPrice = 0;
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
                    paymentFee = 0;
                    break;
                case 'cod':
                    paymentFee = 39;
                    break;
                default:
                    paymentFee = 0;
            }
            
            // Uložení vybrané metody
            savePaymentMethod(value);
        } else {
            // Pokud není nic vybráno, nastavíme poplatek na 0
            paymentFee = 0;
        }
        
        // Aktualizace cen
        updatePrices();
    }
    
    /**
     * Aplikace slevového kupónu
     */

    function applyCoupon() {
        const couponInput = document.getElementById('coupon-code');
        
        if (!couponInput || !couponInput.value.trim()) {
            showNotification('Zadejte prosím slevový kód', 'warning');
            return;
        }
        
        const couponCode = couponInput.value.trim().toUpperCase();
        
        // Kontrola, zda již nebyl použit tento kupón
        if (appliedCoupon === couponCode) {
            showNotification('Tento kupón již byl použit', 'warning');
            return;
        }
        
        // Simulace ověření kupónu (v reálné aplikaci by bylo napojeno na API)
        showLoader();
        
        setTimeout(() => {
            hideLoader();
            
            // Ověření platnosti kupónu
            switch (couponCode) {
                case 'KRATOM10':
                    // 10% sleva
                    discountAmount = Math.round(calculateSubtotal() * 0.1);
                    appliedCoupon = couponCode;
                    showNotification('Sleva 10% byla aplikována', 'success');
                    break;
                
                case 'DOPRAVAZDARMA':
                    // Doprava zdarma
                    discountAmount = shippingPrice;
                    appliedCoupon = couponCode;
                    showNotification('Doprava zdarma byla aplikována', 'success');
                    break;
                
                case 'SAJRAJT2025':
                    // 15% sleva
                    discountAmount = Math.round(calculateSubtotal() * 0.15);
                    appliedCoupon = couponCode;
                    showNotification('Sleva 15% byla aplikována', 'success');
                    break;
                
                default:
                    showNotification('Neplatný slevový kód', 'error');
                    couponInput.classList.add('error');
                    setTimeout(() => {
                        couponInput.classList.remove('error');
                    }, 500);
                    return;
            }
            
            // Vymazání vstupního pole
            couponInput.value = '';
            couponInput.placeholder = `Kupón ${couponCode} aplikován`;
            couponInput.classList.add('success');
            setTimeout(() => {
                couponInput.classList.remove('success');
            }, 1500);
            
            // Aktualizace cen
            updateAllOrderSummaries();
            
            // Efekt zvýraznění slevy
            const discountElements = document.querySelectorAll('.summary-rows .discount span:last-child');
            discountElements.forEach(element => {
                element.style.color = 'var(--success)';
                element.style.transition = 'color 0.3s ease';
                
                setTimeout(() => {
                    element.style.color = '';
                }, 1500);
            });
        }, 800);
    }

    /**
    * Odstranění slevového kupónu
    */

    function removeCoupon() {
        if (appliedCoupon) {
            // Resetování slevy
            discountAmount = 0;
            appliedCoupon = '';
            
            // Aktualizace cen
            updateAllOrderSummaries();
            
            // Resetování pole pro zadání kupónu
            const couponInput = document.getElementById('coupon-code');
            if (couponInput) {
                couponInput.value = '';
                couponInput.placeholder = 'Zadejte slevový kód...';
            }
            
            // Informování uživatele
            showNotification('Slevový kupón byl odstraněn', 'info');
        }
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
        
        // Simulace odeslání objednávky (v reálné aplikaci by se odesílalo na server)
        setTimeout(() => {
            // Aktualizace detailů potvrzení
            updateConfirmationDetails();
            
            // Přidáme třídu pro identifikaci dokončené objednávky
            document.body.classList.add('confirmation-page');
            
            // Předběžně skryjeme progress bar - zvýšíme šanci, že to zachytíme okamžitě
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
            
            // Přechod na potvrzovací obrazovku
            goToStep('confirmation');
            
            // Dodatečné skrytí pro jistotu po přechodu
            setTimeout(() => {
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
            }, 500);
            
            // Skrytí loaderu
            hideLoader();
            
            // Vyčištění košíku
            cart = [];
            saveCart();
            
            // Přehrání konfetti efektu pro radost z úspěšné objednávky
            playOrderConfetti();
        }, 1500);
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
                case 'zasilkovna': deliveryText = 'Zásilkovna'; break;
                case 'ppl': deliveryText = 'PPL - doručení na adresu'; break;
                case 'express': deliveryText = 'Expresní doručení'; break;
                case 'pickup': deliveryText = 'Osobní odběr'; break;
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