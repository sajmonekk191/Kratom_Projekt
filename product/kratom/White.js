document.addEventListener('DOMContentLoaded', function() {
    // Cache DOM elements
    const thumbnails = document.querySelectorAll('.thumbnail');
    const mainImage = document.getElementById('main-image');
    const prevBtn = document.querySelector('.prev');
    const nextBtn = document.querySelector('.next');
    const weightOptions = document.querySelectorAll('.weight-option');
    const priceDisplay = document.querySelector('.price');
    const minusBtn = document.querySelector('.minus');
    const plusBtn = document.querySelector('.plus');
    const quantityInput = document.querySelector('.quantity-input');
    const addToCartBtn = document.querySelector('.add-to-cart');
    const cartNotification = document.getElementById('cart-notification');
    const effectContainer = document.querySelector('.effect-indicators-container');
    
    // ====== Image Gallery Functions ======
    
    /**
     * Handle thumbnail click to change main image
     */
    function initThumbnailGallery() {
        thumbnails.forEach(thumb => {
            thumb.addEventListener('click', function() {
                // Update active thumbnail
                thumbnails.forEach(t => t.classList.remove('active'));
                this.classList.add('active');
                
                // Update main image with fade effect
                const newImageSrc = this.getAttribute('data-image');
                mainImage.style.opacity = 0;
                
                setTimeout(() => {
                    mainImage.src = newImageSrc;
                    mainImage.style.opacity = 1;
                }, 200);
            });
        });
    }
    
    /**
     * Initialize arrow navigation for gallery
     */
    function initGalleryNavigation() {
        // Navigate to previous image
        prevBtn.addEventListener('click', function() {
            const activeThumb = document.querySelector('.thumbnail.active');
            const prevThumb = activeThumb.previousElementSibling || thumbnails[thumbnails.length - 1];
            prevThumb.click();
        });
        
        // Navigate to next image
        nextBtn.addEventListener('click', function() {
            const activeThumb = document.querySelector('.thumbnail.active');
            const nextThumb = activeThumb.nextElementSibling || thumbnails[0];
            nextThumb.click();
        });
        
        // Keyboard navigation
        document.addEventListener('keydown', function(e) {
            if (e.key === 'ArrowLeft') {
                prevBtn.click();
            } else if (e.key === 'ArrowRight') {
                nextBtn.click();
            }
        });
    }

    /**
    * Inicializace sticky přepínače typů kratomu 
    */
    function initStickyKratomSwitcher() {
        const kratomBtns = document.querySelectorAll('.kratom-btn');
        const stickySwitcher = document.querySelector('.kratom-sticky-switcher');
        const currentPage = window.location.pathname.split('/').pop().split('.')[0].toLowerCase();
        
        if (!stickySwitcher || !kratomBtns.length) return;
        
        // Nastavíme aktivní typ podle aktuální stránky
        kratomBtns.forEach(btn => {
            const btnType = btn.getAttribute('data-type');
            
            // Kontrola, jestli je tento typ aktivní podle URL
            if (currentPage.includes(btnType.toLowerCase())) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
            
            // Přidáme plynulý přechod mezi stránkami
            btn.addEventListener('click', function(e) {
                if (!this.classList.contains('active')) {
                    e.preventDefault();
                    
                    const targetUrl = this.getAttribute('href');
                    
                    // Vizuální zpětná vazba
                    kratomBtns.forEach(b => b.classList.remove('active'));
                    this.classList.add('active');
                    
                    // Přidáme třídy pro přechodovou animaci
                    stickySwitcher.classList.add('transitioning');
                    document.body.classList.add('page-transitioning');
                    
                    // Krátké zpoždění před přechodem na novou stránku
                    setTimeout(() => {
                        window.location.href = targetUrl;
                    }, 250);
                }
            });
        });
        
        // Přidáme změnu velikosti při scrollování
        let lastScrollTop = 0;
        let scrollTimeout;
        
        window.addEventListener('scroll', () => {
            const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
            
            // Vyčistíme předchozí timeout
            clearTimeout(scrollTimeout);
            
            // Pokud scrollujeme dolů, zmenšíme přepínač
            if (scrollTop > lastScrollTop && scrollTop > 200) {
                stickySwitcher.classList.add('minimized');
            } else {
                // Při scrollování nahoru vrátíme původní velikost
                stickySwitcher.classList.remove('minimized');
            }
            
            // Po 1.5 sekundě nečinnosti vždy vrátíme původní velikost
            scrollTimeout = setTimeout(() => {
                stickySwitcher.classList.remove('minimized');
            }, 1500);
            
            lastScrollTop = scrollTop;
        }, { passive: true });
        
        // Přidáme CSS styly pro přechod mezi stránkami
        if (!document.getElementById('kratom-transition-styles')) {
            const styleEl = document.createElement('style');
            styleEl.id = 'kratom-transition-styles';
            styleEl.textContent = `
                body.page-transitioning {
                    opacity: 0.9;
                    transition: opacity 0.25s ease;
                }
            `;
            document.head.appendChild(styleEl);
        }
    }
    
    // ====== Product Options Functions ======
    
    /**
     * Initialize weight option selection
     */
    function initWeightSelection() {
        weightOptions.forEach(option => {
            option.addEventListener('click', function() {
                // Update active weight option
                weightOptions.forEach(opt => opt.classList.remove('active'));
                this.classList.add('active');
                
                // Update price with animation
                const newPrice = this.getAttribute('data-price');
                updatePrice(newPrice);
            });
        });
    }
    
    /**
     * Update price with animation
     */
    function updatePrice(newPrice) {
        // Animate price change
        priceDisplay.style.transform = 'scale(1.1)';
        priceDisplay.textContent = newPrice;
        
        setTimeout(() => {
            priceDisplay.style.transform = 'scale(1)';
        }, 200);
    }
    
    /**
     * Initialize quantity selector
     */
    function initQuantitySelector() {
        // Decrease quantity
        minusBtn.addEventListener('click', function() {
            let currentValue = parseInt(quantityInput.value);
            if (currentValue > 1) {
                quantityInput.value = currentValue - 1;
            }
        });
        
        // Increase quantity
        plusBtn.addEventListener('click', function() {
            let currentValue = parseInt(quantityInput.value);
            if (currentValue < 10) {
                quantityInput.value = currentValue + 1;
            }
        });
        
        // Validate input manually
        quantityInput.addEventListener('change', function() {
            let value = parseInt(this.value);
            if (isNaN(value) || value < 1) {
                this.value = 1;
            } else if (value > 10) {
                this.value = 10;
            }
        });
    }
    
    // ====== Cart Functions ======
    
    /**
     * Get cart from cookies
     */
    function getCartFromCookies() {
        try {
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
            
            if (!cartCookie || cartCookie === "" || cartCookie === "undefined" || cartCookie === "[]") {
                return [];
            }
            
            // Důležité: dekódujeme obsah cookie
            try {
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
                // Automatická oprava poškozeného košíku
                document.cookie = "cart=[]; path=/;";
                return [];
            }
        } catch (error) {
            console.error('Neočekávaná chyba při načítání košíku:', error);
            return [];
        }
    }
    
    /**
     * Save cart to cookies
     */
    function saveCartToCookies(cart) {
        const date = new Date();
        date.setTime(date.getTime() + (30 * 24 * 60 * 60 * 1000)); // 30 days expiration
        document.cookie = `cart=${encodeURIComponent(JSON.stringify(cart))}; expires=${date.toUTCString()}; path=/; samesite=lax`;
    }
    
    /**
     * Update cart counter
     */
    function updateCartCounter() {
        const cart = getCartFromCookies();
        const totalItems = cart.reduce((total, item) => total + item.quantity, 0);
        document.querySelectorAll('.cart-counter').forEach(counter => {
            counter.textContent = totalItems;
        });
    }
    
    /**
     * Add current product to cart with animation
     */
    function addToCart() {
        // Button animation
        addToCartBtn.classList.add('success');
        
        // Create floating cart icon
        const floatingIcon = document.createElement('div');
        floatingIcon.classList.add('floating-cart');
        floatingIcon.innerHTML = '<i class="fas fa-shopping-cart"></i>';
        floatingIcon.style.top = '50%';
        floatingIcon.style.left = '50%';
        addToCartBtn.appendChild(floatingIcon);
        
        // Remove elements after animation completes
        setTimeout(() => {
            if (floatingIcon && floatingIcon.parentNode) {
                floatingIcon.parentNode.removeChild(floatingIcon);
            }
            addToCartBtn.classList.remove('success');
        }, 2000);
        
        // Get product details
        const selectedWeight = document.querySelector('.weight-option.active').dataset.weight;
        const selectedPrice = document.querySelector('.weight-option.active').dataset.price;
        const quantity = parseInt(document.querySelector('.quantity-input').value);
        const productName = document.querySelector('h1').textContent.trim();
        const productImage = document.getElementById('main-image').src;
        
        const cart = getCartFromCookies();
        
        // Check if this product with same weight is already in cart
        const existingItemIndex = cart.findIndex(item => 
            item.name === productName && item.weight === selectedWeight
        );
        
        if (existingItemIndex !== -1) {
            // Update quantity if item exists
            cart[existingItemIndex].quantity += quantity;
        } else {
            // Add new item to cart
            cart.push({
                name: productName,
                weight: selectedWeight,
                price: selectedPrice,
                quantity: quantity,
                image: productImage
            });
        }
        
        saveCartToCookies(cart);
        updateCartCounter();
        
        // Show notification
        showNotification();
    }
    
    /**
     * Show notification toast
     */
    function showNotification() {
        if (cartNotification) {
            cartNotification.classList.add('show');
            
            setTimeout(() => {
                cartNotification.classList.remove('show');
            }, 3000);
        }
    }
    
    /**
     * Animate effect bars on scroll
     */
    function animateEffectBars() {
        if (effectContainer) {
            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        setTimeout(() => {
                            entry.target.classList.add('animated');
                        }, 300);
                        observer.unobserve(entry.target);
                    }
                });
            }, { threshold: 0.3 });
            
            observer.observe(effectContainer);
        }
    }
    
    /**
     * Create mouse trail effect
     */
    function createMouseTrailEffect() {
        const trails = [];
        const trailCount = 5;
        
        // Create trail elements
        for (let i = 0; i < trailCount; i++) {
            const trail = document.createElement('div');
            trail.classList.add('cursor-trail');
            trail.style.opacity = (1 - i * 0.15).toString();
            trail.style.width = (10 - i).toString() + 'px';
            trail.style.height = (10 - i).toString() + 'px';
            document.body.appendChild(trail);
            trails.push({
                element: trail,
                x: 0,
                y: 0,
                delay: i * 2
            });
        }
        
        // Track mouse movement
        document.addEventListener('mousemove', (e) => {
            trails.forEach((trail, index) => {
                setTimeout(() => {
                    trail.x = e.clientX;
                    trail.y = e.clientY;
                    trail.element.style.left = trail.x + 'px';
                    trail.element.style.top = trail.y + 'px';
                }, index * 40);
            });
        });
    }
    
    // ====== Initialization ======
    
    /**
     * Initialize all functionality
     */
    function init() {
        // Initialize gallery
        initThumbnailGallery();
        initGalleryNavigation();
        
        // Initialize product options
        initWeightSelection();
        initQuantitySelector();

        initStickyKratomSwitcher();
        
        // Set default weight option (100g)
        if (weightOptions.length > 0) {
            weightOptions[1].click();
        }
        
        // Initialize cart
        updateCartCounter();
        
        // Add to cart button
        if (addToCartBtn) {
            addToCartBtn.addEventListener('click', addToCart);
        }
        
        // Animation effects
        animateEffectBars();
        createMouseTrailEffect();

        // Add lazy loading to images that are not visible initially
        const lazyImages = document.querySelectorAll('.thumbnail:not(.active) img');
        if ('loading' in HTMLImageElement.prototype) {
            lazyImages.forEach(img => {
                img.loading = 'lazy';
            });
        }
    }
    
    // Initialize everything
    init();
});