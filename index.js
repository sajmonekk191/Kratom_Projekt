/**
 * Sajrajt.cz - Enhanced JavaScript
 * Komplexní řešení pro animace a interaktivní prvky na webu
 */

document.addEventListener('DOMContentLoaded', () => {
    // Inicializace všech funkcí po načtení dokumentu
    initPreloader();
    initHeaderEffects();
    initSmoothScroll();
    initBackToTop();
    initScrollProgress();
    initFaqAccordion();
    initFormInteractions();
    initParticleCanvas();
    initScrollAnimations();
    initTiltEffect();
    initLeafAnimation();
    initGlitchEffect();
    initProductIndicators();
    
    // Pokročilá funkcionalita pro desktopové prohlížeče
    if (window.innerWidth > 768) {
        initParallaxEffect();
    }
});

/**
 * Preloader - zobrazí se při načítání stránky
 */
function initPreloader() {
    const preloader = document.querySelector('.preloader');
    
    if (!preloader) return;
    
    // Zobrazujeme preloader na minimálně 800ms pro vizuální efekt
    setTimeout(() => {
        preloader.classList.add('hidden');
        
        // Až po skrytí preloaderu spustíme animace průhlednosti obsahu
        setTimeout(() => {
            document.body.classList.add('loaded');
        }, 500);
    }, 800);
}

/**
 * Efekty pro header - změna stylu při scrollování
 */
function initHeaderEffects() {
    const header = document.querySelector('.main-header');
    const progressBar = document.querySelector('.header-progress-bar');
    let lastScrollY = 0;
    
    if (!header) return;
    
    // Funkce pro aktualizaci stavu headeru
    function updateHeader() {
        const scrollY = window.scrollY;
        
        // Přidání třídy scrolled při odscrollování
        if (scrollY > 50) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
        
        // Skrytí/zobrazení headeru při rychlém scrollování
        if (scrollY > lastScrollY + 50 && scrollY > 500) {
            header.classList.add('header-hidden');
        } else if (scrollY < lastScrollY - 10 || scrollY < 300) {
            header.classList.remove('header-hidden');
        }
        
        lastScrollY = scrollY;
        
        // Aktualizace progress baru podle výšky stránky
        if (progressBar) {
            const scrollPercent = (scrollY / (document.body.scrollHeight - window.innerHeight)) * 100;
            progressBar.style.width = `${scrollPercent}%`;
        }
    }
    
    // Registrace události scroll s throttle pro optimalizaci výkonu
    let scrollTimeout;
    window.addEventListener('scroll', () => {
        if (!scrollTimeout) {
            scrollTimeout = setTimeout(() => {
                updateHeader();
                scrollTimeout = null;
            }, 10); // Vyšší hodnota = lepší výkon, nižší = plynulejší animace
        }
    });
    
    // Počáteční aktualizace
    updateHeader();
}

/**
 * Smooth scroll to products section with offset
 */
function initProductsButtonScroll() {
    const viewProductsBtn = document.getElementById('view-products-btn');
    
    if (!viewProductsBtn) return;
    
    viewProductsBtn.addEventListener('click', function(e) {
        e.preventDefault();
        
        const targetId = this.getAttribute('href');
        const targetElement = document.querySelector(targetId);
        
        if (!targetElement) return;
        
        // Calculate offset position (30px below the section)
        const offset = 30;
        const targetPosition = targetElement.getBoundingClientRect().top + window.pageYOffset;
        const offsetPosition = targetPosition - offset;
        
        // Smooth scroll to the calculated position
        window.scrollTo({
            top: offsetPosition,
            behavior: 'smooth'
        });
    });
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    initProductsButtonScroll();
});

document.addEventListener('DOMContentLoaded', function() {
    const scrollIndicator = document.getElementById('scroll-indicator');
    
    if (scrollIndicator) {
        scrollIndicator.addEventListener('click', function() {
            // Scroll to the #About section
            const aboutSection = document.getElementById('About');
            
            if (aboutSection) {
                aboutSection.scrollIntoView({ 
                    behavior: 'smooth' 
                });
            } else {
                // If no #About section, scroll down a page's worth
                window.scrollTo({
                    top: window.innerHeight,
                    behavior: 'smooth'
                });
            }
        });
        
        // Hide the scroll indicator when scrolled down
        window.addEventListener('scroll', function() {
            if (window.scrollY > window.innerHeight / 2) {
                scrollIndicator.style.opacity = '0';
                scrollIndicator.style.pointerEvents = 'none';
            } else {
                scrollIndicator.style.opacity = '1';
                scrollIndicator.style.pointerEvents = 'auto';
            }
        });
    }
});

// Přidání jiskřivého efektu k částicím
document.addEventListener('DOMContentLoaded', function() {
    // Najít všechny částice
    const particles = document.querySelectorAll('.particle');
    
    // Pro každou částici přidat jiskry
    particles.forEach(particle => {
        // Vytvořit 15 jisker pro každou částici
        for (let i = 0; i < 15; i++) {
            const sparkle = document.createElement('div');
            sparkle.classList.add('sparkle');
            
            // Náhodné umístění v rámci částice
            const top = Math.random() * 100 + '%';
            const left = Math.random() * 100 + '%';
            
            sparkle.style.top = top;
            sparkle.style.left = left;
            
            // Náhodná animace
            const duration = 0.5 + Math.random() * 1.5; // 0.5-2s
            const delay = Math.random() * 5; // 0-5s
            
            sparkle.style.animation = `sparkle ${duration}s ease-in-out ${delay}s infinite`;
            
            // Přidat do částice
            particle.appendChild(sparkle);
        }
    });
});

// Přidat klíčové snímky pro jiskry
const style = document.createElement('style');
style.textContent = `
@keyframes sparkle {
    0%, 100% {
        opacity: 0;
        transform: scale(0);
    }
    50% {
        opacity: 1;
        transform: scale(1);
    }
}
`;
document.head.appendChild(style);

function updateCartBadge() {
    // Získat element košíku
    const cartBadge = document.querySelector('.cart-badge');
    if (!cartBadge) return;
    
    // Získat položky košíku z cookies
    const cartItems = getCartFromCookies();
    
    // Spočítat celkový počet položek (součet všech quantities)
    const totalItems = cartItems.reduce((total, item) => total + (parseInt(item.quantity) || 1), 0);
    
    // Aktualizovat text počítadla
    cartBadge.textContent = totalItems;
    
    // Přidat nebo odebrat třídu 'active' podle počtu položek
    if (totalItems > 0) {
        cartBadge.classList.add('active');
    } else {
        cartBadge.classList.remove('active');
    }
}

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

// Spustit aktualizaci počítadla po načtení stránky
document.addEventListener('DOMContentLoaded', function() {
    updateCartBadge();
});

/**
 * Plynulé scrollování na kotvy
 */
function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const targetId = this.getAttribute('href');
            
            if (targetId === '#') return;
            
            e.preventDefault();
            const targetElement = document.querySelector(targetId);
            
            if (!targetElement) return;
            
            // Speciální offset pro products sekci - zvýšeno na 50px
            const extraOffset = targetId === '#products' ? 50 : 0;
            
            const headerOffset = document.querySelector('.main-header')?.offsetHeight || 0;
            const elementPosition = targetElement.getBoundingClientRect().top;
            const offsetPosition = elementPosition + window.scrollY - headerOffset - 20 - extraOffset;
            
            window.scrollTo({
                top: offsetPosition,
                behavior: 'smooth'
            });
        });
    });
}

/**
 * Tlačítko "Zpět nahoru"
 */
function initBackToTop() {
    const backToTopButton = document.getElementById('back-to-top');
    
    if (!backToTopButton) return;
    
    // Zobrazení/skrytí tlačítka v závislosti na scrollování
    window.addEventListener('scroll', () => {
        if (window.scrollY > 500) {
            backToTopButton.classList.add('visible');
        } else {
            backToTopButton.classList.remove('visible');
        }
    });
    
    // Scrollování na začátek stránky po kliknutí
    backToTopButton.addEventListener('click', () => {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    });
}

/**
 * FAQ zobrazit více
 */

document.addEventListener('DOMContentLoaded', function() {
    const toggleBtn = document.getElementById('faqToggleBtn');
    const faqItems = document.querySelectorAll('.faq-item');
    let expanded = false;
    
    if (!toggleBtn) return; // Safety check
    
    // Add ripple effect on click
    toggleBtn.addEventListener('click', function(e) {
        // Remove existing ripple class
        this.classList.remove('ripple');
        
        // Force browser reflow
        void this.offsetWidth;
        
        // Add ripple class again
        this.classList.add('ripple');
        
        if (!expanded) {
            // Show all hidden FAQ items with staggered animation
            faqItems.forEach((item, index) => {
                if (index >= 4) {
                    // Set initial state
                    item.style.display = 'block';
                    item.style.opacity = '0';
                    item.style.transform = 'translateY(20px)';
                    
                    // Staggered animation
                    setTimeout(() => {
                        item.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
                        item.style.opacity = '1';
                        item.style.transform = 'translateY(0)';
                    }, (index - 4) * 100);
                }
            });
            
            // Update button text and icon directly
            toggleBtn.innerHTML = '<span>Zobrazit méně</span> <i class="fas fa-chevron-down"></i>';
            this.classList.add('showing-less');
            expanded = true;
            
            // Scroll down to show more content
            setTimeout(() => {
                // Get the last visible FAQ item
                const lastItem = faqItems[faqItems.length - 3];
                if (lastItem) {
                    lastItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }, 200);
        } else {
            // Hide FAQ items after the 4th one with staggered animation
            const itemsToHide = Array.from(faqItems).slice(4);
            
            itemsToHide.forEach((item, index) => {
                setTimeout(() => {
                    item.style.opacity = '0';
                    item.style.transform = 'translateY(20px)';
                    
                    // Hide after animation completes
                    setTimeout(() => {
                        item.style.display = 'none';
                    }, 400);
                }, (itemsToHide.length - index - 1) * 80);
            });
            
            // Update button text and icon directly
            toggleBtn.innerHTML = '<span>Zobrazit více</span> <i class="fas fa-chevron-down"></i>';
            this.classList.remove('showing-less');
            expanded = false;
            
            // Smooth scroll back to faq section
            setTimeout(() => {
                document.querySelector('.faq').scrollIntoView({ 
                    behavior: 'smooth',
                    block: 'start'
                });
            }, 300);
        }
    });
});

// Animace pro kontaktní sekci
document.addEventListener('DOMContentLoaded', function() {
    // Inicializace animací pro kontaktní sekci při scrollování
    const animateContactElements = () => {
        const elements = document.querySelectorAll('.contact [data-animate]');
        
        elements.forEach((element) => {
            const elementPosition = element.getBoundingClientRect().top;
            const windowHeight = window.innerHeight;
            
            if (elementPosition < windowHeight * 0.85) {
                element.classList.add('animated');
            }
        });
    };
    
    // První kontrola při načtení stránky
    setTimeout(animateContactElements, 300);
    
    // Kontrola při scrollování
    window.addEventListener('scroll', animateContactElements);
    
    // Inicializace 3D tilt efektu pro kontaktní karty
    if (typeof VanillaTilt !== 'undefined') {
        // Použijeme jemné nastavení pro kontaktní karty
        VanillaTilt.init(document.querySelectorAll(".contact-card[data-tilt]"), {
            max: 8,         // menší maximální náklon
            speed: 400,     // rychlost reakce
            glare: false,   // bez glare efektu
            scale: 1.03,    // jemné zvětšení při naklonění
            gyroscope: true // podpora mobilních zařízení
        });
    }
    
    // Přidáme efekt plovoucích částic v pozadí kontaktní sekce
    const contactSection = document.querySelector('.contact');
    if (contactSection) {
        // Přidáme plovoucí částice
        for (let i = 0; i < 50; i++) {
            const particle = document.createElement('div');
            particle.className = 'contact-floating-particle';
            
            // Náhodné vlastnosti pro každou částici
            const size = Math.random() * 4 + 2;
            const posX = Math.random() * 100;
            const posY = Math.random() * 100;
            const opacity = Math.random() * 0.15 + 0.05;
            const duration = Math.random() * 50 + 20;
            const delay = Math.random() * 10;
            
            // Styly částice
            particle.style.cssText = `
                position: absolute;
                width: ${size}px;
                height: ${size}px;
                left: ${posX}%;
                top: ${posY}%;
                background-color: rgba(0, 230, 118, ${opacity});
                border-radius: 50%;
                pointer-events: none;
                filter: blur(1px);
                opacity: ${opacity};
                animation: floatingParticle ${duration}s linear infinite;
                animation-delay: -${delay}s;
                z-index: -1;
            `;
            
            contactSection.appendChild(particle);
        }
        
        // Přidáme styl animace do stránky
        const style = document.createElement('style');
        style.textContent = `
            @keyframes floatingParticle {
                0% {
                    transform: translate(0, 0);
                }
                25% {
                    transform: translate(${Math.random() * 100 - 50}px, ${Math.random() * 50 - 25}px);
                }
                50% {
                    transform: translate(${Math.random() * 100 - 50}px, ${Math.random() * 50 - 25}px);
                }
                75% {
                    transform: translate(${Math.random() * 100 - 50}px, ${Math.random() * 50 - 25}px);
                }
                100% {
                    transform: translate(0, 0);
                }
            }
        `;
        document.head.appendChild(style);
    }
    
    // Vylepšení animace odesílání formuláře
    const contactForm = document.querySelector('.contact-form');
    if (contactForm) {
        contactForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const submitButton = this.querySelector('.quantum-btn');
            submitButton.classList.add('loading');
            
            // Simulace odeslání formuláře (zde by přišla AJAX komunikace se serverem)
            setTimeout(() => {
                submitButton.classList.remove('loading');
                
                // Efekt úspěšného odeslání
                submitButton.innerHTML = '<span class="btn-text">Zpráva odeslána!</span><i class="fas fa-check"></i>';
                submitButton.style.background = 'rgba(76, 175, 80, 0.2)';
                submitButton.style.borderColor = 'rgba(76, 175, 80, 0.5)';
                
                // Reset formuláře
                contactForm.reset();
                
                // Reset popisků vstupních polí
                document.querySelectorAll('.form-input').forEach(input => {
                    const label = input.nextElementSibling;
                    if (label && label.tagName === 'LABEL') {
                        label.style.top = '';
                        label.style.left = '';
                        label.style.fontSize = '';
                        label.style.color = '';
                    }
                });
                
                // Po 3 sekundách vrátíme tlačítko do původního stavu
                setTimeout(() => {
                    submitButton.innerHTML = '<span class="btn-text">Odeslat zprávu</span><div class="loading-dots"><span></span><span></span><span></span></div><i class="fas fa-paper-plane"></i><div class="btn-glow"></div><div class="btn-shine"></div>';
                    submitButton.style.background = '';
                    submitButton.style.borderColor = '';
                }, 3000);
            }, 1500);
        });
    }
    
    // Přidání interaktivních prvků pro kontaktní karty
    const contactCards = document.querySelectorAll('.contact-card');
    contactCards.forEach(card => {
        // Přidání interaktivních částic při hover
        card.addEventListener('mouseenter', function() {
            createCardParticles(this);
        });
        
        // Přidání interaktivního efektu na odkaz
        const link = card.querySelector('.contact-link');
        if (link) {
            link.addEventListener('mouseenter', function() {
                card.classList.add('link-hover');
            });
            
            link.addEventListener('mouseleave', function() {
                card.classList.remove('link-hover');
            });
        }
    });
    
    // Funkce pro vytvoření částic kolem kontaktní karty
    function createCardParticles(card) {
        // Pokud jsou již částice vytvořeny, nepokračujeme
        if (card.querySelector('.card-particle')) return;
        
        // Vytvoříme 5 částic
        for (let i = 0; i < 5; i++) {
            const particle = document.createElement('div');
            particle.className = 'card-particle';
            
            // Náhodné vlastnosti
            const size = Math.random() * 5 + 2;
            const posX = Math.random() * 100;
            const posY = Math.random() * 100;
            const duration = 0.5 + Math.random() * 1;
            const delay = Math.random() * 0.5;
            
            // Styly částice
            particle.style.cssText = `
                position: absolute;
                width: ${size}px;
                height: ${size}px;
                background-color: var(--primary);
                border-radius: 50%;
                opacity: 0;
                z-index: 10;
                top: ${posY}%;
                left: ${posX}%;
                filter: blur(1px);
                animation: cardParticle ${duration}s ease-out ${delay}s forwards;
            `;
            
            card.appendChild(particle);
            
            // Odstranění částice po dokončení animace
            setTimeout(() => {
                particle.remove();
            }, (duration + delay) * 1000);
        }
    }
    
    // Přidání stylu animace částic do stránky
    const particleStyle = document.createElement('style');
    particleStyle.textContent = `
        @keyframes cardParticle {
            0% {
                transform: translate(0, 0) scale(0);
                opacity: 0;
            }
            50% {
                opacity: 0.8;
            }
            100% {
                transform: translate(
                    ${Math.random() > 0.5 ? '-' : ''}${20 + Math.random() * 30}px, 
                    ${Math.random() > 0.5 ? '-' : ''}${20 + Math.random() * 30}px
                ) scale(1);
                opacity: 0;
            }
        }
        
        .contact-card.link-hover .contact-icon {
            transform: scale(1.15) translateY(-8px);
        }
        
        .contact-card.link-hover .icon-rays {
            opacity: 1;
            animation: pulse 1.5s infinite;
        }
    `;
    document.head.appendChild(particleStyle);
    
    // Optimalizace animací pro mobilní zařízení
    function optimizeForMobile() {
        if (window.innerWidth < 768) {
            // Snížíme počet částic a dalších náročných animací na mobilních zařízeních
            document.querySelectorAll('.contact-floating-particle').forEach((particle, index) => {
                if (index % 3 !== 0) {
                    particle.remove();
                }
            });
            
            // Zjednodušíme animace pro mobilní zařízení
            const mobileStyle = document.createElement('style');
            mobileStyle.textContent = `
                @media (max-width: 768px) {
                    .hologram-effect,
                    .icon-particles,
                    .card-corner {
                        display: none !important;
                    }
                    
                    .contact-grid-lines {
                        opacity: 0.05 !important;
                    }
                }
            `;
            document.head.appendChild(mobileStyle);
        }
    }
    
    // Optimalizace při načtení
    optimizeForMobile();
});

/**
 * Indikátor průběhu scrollování
 */
function initScrollProgress() {
    const progressBar = document.querySelector('.header-progress-bar');
    
    if (!progressBar) return;
    
    window.addEventListener('scroll', () => {
        const scrollTop = window.scrollY;
        const docHeight = document.body.scrollHeight - window.innerHeight;
        const scrollPercent = (scrollTop / docHeight) * 100;
        
        progressBar.style.width = `${scrollPercent}%`;
    });
}

/**
 * FAQ Accordion - rozbalování a zavírání otázek
 */
function initFaqAccordion() {
    const faqItems = document.querySelectorAll('.faq-item');
    
    if (faqItems.length === 0) return;
    
    faqItems.forEach(item => {
        item.addEventListener('click', function() {
            // Získáme otázku a odpověď
            const question = this.querySelector('.faq-question');
            const answer = this.querySelector('.faq-answer');
            
            // Zavřeme všechny ostatní aktivní položky
            faqItems.forEach(otherItem => {
                if (otherItem !== this && otherItem.classList.contains('active')) {
                    otherItem.classList.remove('active');
                }
            });
            
            // Přepneme stav aktuální položky
            this.classList.toggle('active');
            
            // Aplikujeme animace na ikonu
            const icon = question.querySelector('i');
            if (icon) {
                icon.style.transition = 'transform 0.4s cubic-bezier(0.68, -0.55, 0.27, 1.55)';
            }
        });
    });
}

/**
 * Interakce s kontaktním formulářem
 */
function initFormInteractions() {
    const contactForm = document.querySelector('.contact-form');
    const formInputs = document.querySelectorAll('.form-input');
    
    if (!contactForm) return;
    
    // Zpracování odeslání formuláře
    contactForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const submitButton = this.querySelector('.quantum-btn');
        submitButton.classList.add('loading');
        
        // Simulace odeslání formuláře (zde by přišla AJAX komunikace se serverem)
        setTimeout(() => {
            submitButton.classList.remove('loading');
            
            // Reset formuláře po úspěšném odeslání
            this.reset();
            
            // Reset stavu vstupních polí
            formInputs.forEach(input => {
                const label = input.nextElementSibling;
                label.style.top = null;
                label.style.fontSize = null;
                label.style.color = null;
            });
            
            // Zobrazení úspěšné zprávy (zde by přišlo např. zobrazení potvrzovacího modálního okna)
            alert('Zpráva byla úspěšně odeslána!');
        }, 1500);
    });
    
    // Interaktivní vstupní pole
    formInputs.forEach(input => {
        // Aktualizace stavu při načtení stránky
        if (input.value) {
            const label = input.nextElementSibling;
            label.classList.add('active');
        }
        
        // Eventlistenery pro focus a blur
        input.addEventListener('focus', function() {
            const label = this.nextElementSibling;
            label.classList.add('active');
        });
        
        input.addEventListener('blur', function() {
            const label = this.nextElementSibling;
            if (!this.value) {
                label.classList.remove('active');
            }
        });
    });
}

// Vylepšená inicializace produktové sekce
document.addEventListener('DOMContentLoaded', function() {
    // Inicializace animací při scrollování
    const animateProductsOnScroll = () => {
        const elements = document.querySelectorAll('[data-animate]');
        
        elements.forEach((element) => {
            const elementPosition = element.getBoundingClientRect().top;
            const windowHeight = window.innerHeight;
            
            if (elementPosition < windowHeight * 0.85) {
                element.classList.add('animated');
                
                // Animace progress barů produktů
                if (element.classList.contains('product')) {
                    element.classList.add('in-view');
                    animateProductBars(element);
                }
            }
        });
    };
    
    // První kontrola viditelných elementů při načtení stránky
    setTimeout(animateProductsOnScroll, 300);
    
    // Kontrola při scrollování
    window.addEventListener('scroll', animateProductsOnScroll);
    
    // Inicializace 3D tilt efektu (bez glare)
    if (typeof VanillaTilt !== 'undefined' && window.innerWidth > 768) {
        VanillaTilt.init(document.querySelectorAll("[data-tilt]"), {
            max: 10,
            speed: 400,
            glare: false, // Vypnuto lesk
            "max-glare": 0, // Nastaveno na 0
            scale: 1.03,
            perspective: 1000,
            transition: true
        });
    }
    
    // Funkce pro animaci jednotlivých indikátorů
    function animateProductBars(product) {
        const bars = product.querySelectorAll('.bar');
        
        bars.forEach((bar, index) => {
            setTimeout(() => {
                bar.style.width = bar.style.getPropertyValue('--width');
            }, 200 + (index * 150)); // Postupné načítání s malou prodlevou
        });
    }
    
    // Přidání interaktivních efektů tooltipů
    const indicatorBars = document.querySelectorAll('.bar');
    
    indicatorBars.forEach(bar => {
        const tooltip = bar.querySelector('.bar-tooltip');
        
        if (tooltip) {
            bar.addEventListener('mouseenter', () => {
                tooltip.style.opacity = '1';
                tooltip.style.transform = 'translateY(0)';
            });
            
            bar.addEventListener('mouseleave', () => {
                tooltip.style.opacity = '0';
                tooltip.style.transform = 'translateY(5px)';
            });
        }
    });
    
    // Přidání třesoucího efektu pro emoji ve sloganech
    const emojis = document.querySelectorAll('.tagline-emoji');
    
    emojis.forEach(emoji => {
        // Náhodný delay pro každý emoji, aby se pohybovaly nezávisle
        emoji.style.animationDelay = `${Math.random() * 2}s`;
    });
    
    // Přidání zvláštních částic kolem produktových karet
    function addParticles() {
        const productsSection = document.querySelector('.products');
        if (!productsSection) return;
        
        // Vytvoření kontejneru pro částice
        const particlesContainer = document.createElement('div');
        particlesContainer.className = 'product-particles-container';
        
        // Přidání CSS pro kontejner
        const style = document.createElement('style');
        style.textContent = `
            .product-particles-container {
                position: absolute;
                inset: 0;
                z-index: 0;
                pointer-events: none;
                overflow: hidden;
            }
            
            .product-particle {
                position: absolute;
                width: 6px;
                height: 6px;
                border-radius: 50%;
                background-color: rgba(0, 230, 118, 0.15);
                pointer-events: none;
                opacity: 0;
                animation: float-particle var(--duration, 15s) ease-in-out infinite alternate;
                filter: blur(1px);
            }
            
            @keyframes float-particle {
                0% {
                    transform: translate(0, 0) rotate(0deg);
                    opacity: 0;
                }
                10% {
                    opacity: var(--opacity, 0.3);
                }
                90% {
                    opacity: var(--opacity, 0.3);
                }
                100% {
                    transform: translate(var(--x), var(--y)) rotate(var(--rotation));
                    opacity: 0;
                }
            }
        `;
        document.head.appendChild(style);
        
        // Přidání kontejneru do sekce produktů
        productsSection.appendChild(particlesContainer);
        
        // Vytvoření částic
        for (let i = 0; i < 30; i++) {
            const particle = document.createElement('div');
            particle.className = 'product-particle';
            
            // Náhodné vlastnosti
            const size = Math.random() * 6 + 2;
            const posX = Math.random() * 100;
            const posY = Math.random() * 100;
            const opacity = Math.random() * 0.3 + 0.1;
            const duration = Math.random() * 25 + 15;
            const delay = Math.random() * 10;
            const xMovement = (Math.random() - 0.5) * 100;
            const yMovement = (Math.random() - 0.5) * 100;
            const rotation = Math.random() * 360;
            
            // Aplikace stylů
            particle.style.width = `${size}px`;
            particle.style.height = `${size}px`;
            particle.style.left = `${posX}%`;
            particle.style.top = `${posY}%`;
            particle.style.setProperty('--opacity', opacity.toString());
            particle.style.setProperty('--duration', `${duration}s`);
            particle.style.animationDelay = `${delay}s`;
            particle.style.setProperty('--x', `${xMovement}px`);
            particle.style.setProperty('--y', `${yMovement}px`);
            particle.style.setProperty('--rotation', `${rotation}deg`);
            
            // Různé barvy částic
            const hue = Math.random() * 40 + 120; // zeleno-modré odstíny
            particle.style.backgroundColor = `hsla(${hue}, 70%, 50%, ${opacity})`;
            
            particlesContainer.appendChild(particle);
        }
    }
    
    // Přidání částic do stránky
    addParticles();
    
    // Vylepšený hover efekt pro produktové karty
    const products = document.querySelectorAll('.product');
    
    products.forEach(product => {
        // Jemnější přechod všech efektů při hover
        product.addEventListener('mouseenter', () => {
            // Přidání třídy pro lepší sledování stavu hover
            product.classList.add('product-hover');
            
            // Postupné spuštění animací pro indikátory
            const indicators = product.querySelectorAll('.indicator');
            indicators.forEach((indicator, index) => {
                setTimeout(() => {
                    indicator.classList.add('indicator-active');
                }, 100 + (index * 70));
            });
        });
        
        product.addEventListener('mouseleave', () => {
            product.classList.remove('product-hover');
            
            // Odstranění aktivních tříd s minimálním zpožděním
            setTimeout(() => {
                const indicators = product.querySelectorAll('.indicator');
                indicators.forEach((indicator) => {
                    indicator.classList.remove('indicator-active');
                });
            }, 100);
        });
    });
    
    // Přidání stylu pro pohyb při hover na mobilních zařízeních
    function addMobileStyles() {
        if (window.innerWidth <= 768) {
            const style = document.createElement('style');
            style.textContent = `
                @media (max-width: 768px) {
                    .product.product-hover {
                        transform: translateY(-10px) !important;
                    }
                    
                    .product .product-shine {
                        display: none;
                    }
                }
            `;
            document.head.appendChild(style);
            
            // Přidání touch událostí
            products.forEach(product => {
                product.addEventListener('touchstart', function() {
                    this.classList.add('product-hover');
                }, {passive: true});
                
                product.addEventListener('touchend', function() {
                    setTimeout(() => {
                        this.classList.remove('product-hover');
                    }, 1000);
                }, {passive: true});
            });
        }
    }
    
    // Kontrola mobilního zařízení a přidání specifických stylů
    addMobileStyles();
});

// Funkce pro odstranění tilt efektu při problémech
function disableTiltIfNeeded() {
    const productCards = document.querySelectorAll('.product');
    
    // Pokud je problém s tilt efektem, můžeme jej vypnout
    const removeTilt = () => {
        if (typeof VanillaTilt !== 'undefined') {
            productCards.forEach(card => {
                try {
                    VanillaTilt.destroy(card);
                } catch (e) {
                    console.log('Tilt already destroyed');
                }
            });
        }
    };
    
    // Detekce zařízení a výkonu
    if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 768) {
        removeTilt();
    }
    
    // Detekce nízké plynulosti animací
    let frameCount = 0;
    let lastTime = performance.now();
    let lowFpsDetected = false;
    
    function checkFPS() {
        frameCount++;
        const currentTime = performance.now();
        const delta = currentTime - lastTime;
        
        if (delta > 1000) {
            const fps = Math.round((frameCount * 1000) / delta);
            frameCount = 0;
            lastTime = currentTime;
            
            // Pokud je FPS nízké, vypneme efekty
            if (fps < 30 && !lowFpsDetected) {
                lowFpsDetected = true;
                removeTilt();
                
                // Vypnutí dalších náročných animací
                document.querySelectorAll('.product-shine, .products-bg-particles').forEach(el => {
                    el.style.display = 'none';
                });
            }
        }
    }
    
    // Monitorovat FPS jen krátce po načtení stránky
    let fpsCheckInterval = setInterval(checkFPS, 100);
    
    // Přestat monitorovat po 5 sekundách
    setTimeout(() => {
        clearInterval(fpsCheckInterval);
    }, 5000);
}

/**
 * Animace pozadí s částicemi na canvas
 */
function initParticleCanvas() {
    const canvas = document.getElementById('particleCanvas');
    
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    // Nastavení velikosti canvasu
    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    // Vytvoření částic
    const particlesArray = [];
    const numberOfParticles = Math.min(Math.floor(window.innerWidth / 10), 100);
    
    // Definice částice
    class Particle {
        constructor() {
            this.x = Math.random() * canvas.width;
            this.y = Math.random() * canvas.height;
            this.size = Math.random() * 3 + 1;
            this.speedX = Math.random() * 0.5 - 0.25;
            this.speedY = Math.random() * 0.5 - 0.25;
            this.color = `rgba(0, ${Math.random() * 150 + 100}, ${Math.random() * 50}, ${Math.random() * 0.15 + 0.05})`;
        }
        
        update() {
            this.x += this.speedX;
            this.y += this.speedY;
            
            // Sledování hranic canvasu
            if (this.x > canvas.width || this.x < 0) {
                this.speedX = -this.speedX;
            }
            
            if (this.y > canvas.height || this.y < 0) {
                this.speedY = -this.speedY;
            }
        }
        
        draw() {
            ctx.fillStyle = this.color;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    
    // Vytvoření požadovaného počtu částic
    function init() {
        for (let i = 0; i < numberOfParticles; i++) {
            particlesArray.push(new Particle());
        }
    }
    
    // Vykreslení spojení mezi částicemi
    function connect() {
        const maxDistance = 150;
        
        for (let a = 0; a < particlesArray.length; a++) {
            for (let b = a; b < particlesArray.length; b++) {
                const dx = particlesArray[a].x - particlesArray[b].x;
                const dy = particlesArray[a].y - particlesArray[b].y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < maxDistance) {
                    const opacity = 1 - distance / maxDistance;
                    ctx.strokeStyle = `rgba(0, 230, 118, ${opacity * 0.1})`;
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.moveTo(particlesArray[a].x, particlesArray[a].y);
                    ctx.lineTo(particlesArray[b].x, particlesArray[b].y);
                    ctx.stroke();
                }
            }
        }
    }
    
    // Animační smyčka
    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        for (let i = 0; i < particlesArray.length; i++) {
            particlesArray[i].update();
            particlesArray[i].draw();
        }
        
        connect();
        requestAnimationFrame(animate);
    }
    
    init();
    animate();
}

/**
 * Animace při scrollování - postupné zobrazování prvků pomocí IntersectionObserver
 */
function initScrollAnimations() {
    // 1. Nejprve zajistíme, že prvky jsou viditelné, dokud JS nezačne pracovat
    document.documentElement.classList.add('js-preload');

    // 2. Počkáme na plné načtení stránky
    window.addEventListener('load', () => {
        // Povolíme animace
        document.documentElement.classList.remove('js-preload');
        document.documentElement.classList.add('js-loaded');

        // 3. Inicializace animací pro všechny elementy
        const animatedElements = document.querySelectorAll(
            '.feature-card, .product, .effect-card, .contact-card, .contact-form, .faq-item'
        );

        if (animatedElements.length === 0) return;

        // 4. Nastavení počátečního stavu pro animace
        animatedElements.forEach(element => {
            element.style.transition = 'opacity 0.8s ease, transform 0.8s ease';
            element.style.willChange = 'opacity, transform'; // Optimalizace prohlížeče
        });

        // 5. Vylepšený IntersectionObserver s detekcí scrollu
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        // Spustíme animaci
                        requestAnimationFrame(() => {
                            entry.target.style.opacity = '1';
                            entry.target.style.transform = 'translateY(0)';
                            
                            // Speciální logika pro produkty
                            if (entry.target.classList.contains('product')) {
                                animateProductIndicators(entry.target);
                            }
                        });
                        
                        // Přestaneme sledovat tento prvek
                        observer.unobserve(entry.target);
                    }
                });
            },
            {
                threshold: 0.1, // Nižší threshold pro lepší detekci
                rootMargin: '0px 0px -50px 0px' // Upravený rootMargin
            }
        );

        // 6. Registrace prvků s krátkým zpožděním
        setTimeout(() => {
            animatedElements.forEach(element => {
                element.style.opacity = '0';
                element.style.transform = 'translateY(30px)';
                observer.observe(element);
            });
        }, 150);

        // 7. Animace nadpisů sekcí
        const sectionTitles = document.querySelectorAll('.section-title, .section-subtitle');
        const titleObserver = new IntersectionObserver(
            (entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        requestAnimationFrame(() => {
                            entry.target.style.opacity = '1';
                            entry.target.style.transform = 'translateY(0)';
                        });
                        titleObserver.unobserve(entry.target);
                    }
                });
            },
            { threshold: 0.5 }
        );

        sectionTitles.forEach(title => {
            title.style.opacity = '0';
            title.style.transform = 'translateY(20px)';
            title.style.transition = 'opacity 0.8s ease, transform 0.8s ease';
            titleObserver.observe(title);
        });

        // 8. Manuální kontrola při prvním načtení
        checkVisibleElementsImmediately();
    });

    // Pomocná funkce pro animaci indikátorů produktů
    function animateProductIndicators(product) {
        const indicators = product.querySelectorAll('.bar');
        indicators.forEach((bar, index) => {
            setTimeout(() => {
                bar.style.width = bar.style.getPropertyValue('--width');
            }, index * 150);
        });
    }

    // Pomocná funkce pro okamžitou kontrolu viditelných prvků
    function checkVisibleElementsImmediately() {
        const elements = document.querySelectorAll(
            '.feature-card, .product, .effect-card, .contact-card, .contact-form, .faq-item, .section-title, .section-subtitle'
        );
        
        elements.forEach(el => {
            const rect = el.getBoundingClientRect();
            const isVisible = (
                rect.top <= window.innerHeight * 0.9 &&
                rect.bottom >= 0
            );
            
            if (isVisible) {
                el.style.opacity = '1';
                el.style.transform = 'translateY(0)';
            }
        });
    }
}

/**
 * 3D Tilt efekt pro karty
 */
function initTiltEffect() {
    // Kontrola, zda existuje jQuery a tilt.js knihovna
    if (typeof jQuery !== 'undefined' && typeof jQuery.fn.tilt !== 'undefined') {
        // Aplikace efektu na vybrané prvky
        jQuery('[data-tilt]').tilt({
            maxTilt: 5,
            perspective: 1000,
            speed: 400,
            glare: true,
            maxGlare: 0.2,
            scale: 1.03
        });
    }
}

/**
 * Paralax efekt pro scrollování
 */
function initParallaxEffect() {
    const parallaxElements = [
        { selector: '.hero-bg-shapes', speed: 0.2 },
        { selector: '.section-bg-particles', speed: 0.1 },
        { selector: '.products-bg-particles', speed: 0.15 },
        { selector: '.effects-bg-particles', speed: 0.1 },
        { selector: '.faq-bg-particles', speed: 0.12 }
    ];
    
    // Funkce pro aktualizaci pozic prvků
    function updateParallax() {
        const scrollY = window.scrollY;
        
        parallaxElements.forEach(item => {
            const elements = document.querySelectorAll(item.selector);
            
            elements.forEach(element => {
                const elementTop = element.getBoundingClientRect().top + scrollY;
                const distance = scrollY - elementTop;
                
                if (Math.abs(distance) < window.innerHeight) {
                    const translateY = distance * item.speed;
                    element.style.transform = `translateY(${translateY}px)`;
                }
            });
        });
    }
    
    // Optimalizovaný event listener pro scroll
    let ticking = false;
    
    window.addEventListener('scroll', () => {
        if (!ticking) {
            window.requestAnimationFrame(() => {
                updateParallax();
                ticking = false;
            });
            
            ticking = true;
        }
    });
}

/**
 * Animace padajících listů
 */
function initLeafAnimation() {
    const leavesContainer = document.querySelector('.kratom-leaves-container');
    
    if (!leavesContainer) return;
    
    // Různé typy listů pro větší variabilitu
    const leafTypes = ['🍃', '☘️', '🌿', '🍀'];
    const numberOfLeaves = Math.min(Math.floor(window.innerWidth / 20), 30);
    
    // Vytvoření listů
    for (let i = 0; i < numberOfLeaves; i++) {
        const leaf = document.createElement('div');
        leaf.classList.add('kratom-leaf');
        
        // Náhodný výběr typu listu
        leaf.textContent = leafTypes[Math.floor(Math.random() * leafTypes.length)];
        
        // Náhodné parametry animace
        const randomStart = Math.random() * 100;
        const randomDelay = Math.random() * 30;
        const randomSize = 0.8 + Math.random() * 0.8;
        const randomDuration = 15 + Math.random() * 20;
        
        leaf.style.setProperty('--start-position', `${randomStart}%`);
        leaf.style.setProperty('--end-position', `${window.innerHeight * 2}px`);
        leaf.style.setProperty('--animation-delay', `${randomDelay}s`);
        leaf.style.fontSize = `${randomSize}rem`;
        leaf.style.animationDuration = `${randomDuration}s`;
        
        leavesContainer.appendChild(leaf);
    }
    
    // Aktualizace při změně velikosti okna
    window.addEventListener('resize', () => {
        document.querySelectorAll('.kratom-leaf').forEach(leaf => {
            leaf.style.setProperty('--end-position', `${window.innerHeight * 2}px`);
        });
    });
}

/**
 * Efekt glitch pro nadpisy
 */
function initGlitchEffect() {
    const glitchHeading = document.querySelector('.glitch-heading');
    
    if (!glitchHeading) return;
    
    // Náhodné slabší glitche
    setInterval(() => {
        if (Math.random() > 0.7) {
            glitchHeading.classList.add('glitch-strong');
            
            setTimeout(() => {
                glitchHeading.classList.remove('glitch-strong');
            }, 100);
        }
    }, 2000);
}

/**
 * Animace indikátorů vlastností produktů
 */
function initProductIndicators() {
    const products = document.querySelectorAll('.product');
    
    if (products.length === 0) return;
    
    // Nastavení vizuálních efektů při najetí myší na indikátory
    products.forEach(product => {
        const indicators = product.querySelectorAll('.indicator');
        
        indicators.forEach(indicator => {
            const bar = indicator.querySelector('.bar');
            const tooltip = indicator.querySelector('.bar-tooltip');
            
            // Zobrazení tooltipu při najetí na indikátor
            indicator.addEventListener('mouseenter', () => {
                if (tooltip) {
                    tooltip.style.opacity = '1';
                    tooltip.style.transform = 'translateY(0)';
                }
            });
            
            indicator.addEventListener('mouseleave', () => {
                if (tooltip) {
                    tooltip.style.opacity = '0';
                    tooltip.style.transform = 'translateY(5px)';
                }
            });
            
            // Efekt animace při najetí na produkt
            product.addEventListener('mouseenter', () => {
                if (bar) {
                    bar.style.boxShadow = '0 0 10px currentColor';
                }
            });
            
            product.addEventListener('mouseleave', () => {
                if (bar) {
                    bar.style.boxShadow = 'none';
                }
            });
        });
    });
    
    // IntersectionObserver pro animaci indikátorů při scrollování k nim
    const productsObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('in-view');
                productsObserver.unobserve(entry.target);
            }
        });
    }, { threshold: 0.3 });
    
    products.forEach(product => {
        productsObserver.observe(product);
    });
}

/**
 * Optimalizace výkonu stránky
 */
function optimizePagePerformance() {
    // Lazy loading pro obrázky pomocí nativního loading="lazy"
    document.querySelectorAll('img').forEach(img => {
        if (!img.hasAttribute('loading')) {
            img.setAttribute('loading', 'lazy');
        }
    });
    
    // Odložené načítání těžkých skriptů
    function loadDeferredScripts() {
        const deferredScripts = document.querySelectorAll('script[data-src]');
        
        deferredScripts.forEach(script => {
            script.src = script.getAttribute('data-src');
            script.removeAttribute('data-src');
        });
    }
    
    // Načtení odložených skriptů po načtení stránky
    if (document.readyState === 'complete') {
        loadDeferredScripts();
    } else {
        window.addEventListener('load', loadDeferredScripts);
    }
    
    // Optimalizace událostí scroll a resize pro lepší výkon
    function debounce(func, wait) {
        let timeout;
        
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
    
    // Příklad použití debounce pro resize
    const handleResize = debounce(() => {
        // Aktualizace UI prvků závislých na velikosti okna
        updateResponsiveElements();
    }, 200);
    
    window.addEventListener('resize', handleResize);
}

/**
 * Aktualizace responsivních prvků
 */
function updateResponsiveElements() {
    // Přizpůsobení UI prvků aktuální velikosti okna
    const windowWidth = window.innerWidth;
    
    // Příklady responsivního nastavení
    if (windowWidth < 768) {
        // Mobilní zařízení
        document.querySelectorAll('.effect-card, .product').forEach(card => {
            if (card.hasAttribute('data-tilt')) {
                // Deaktivace tilt efektu na mobilních zařízeních
                if (typeof jQuery !== 'undefined' && typeof jQuery.fn.tilt !== 'undefined') {
                    jQuery(card).tilt('destroy');
                }
            }
        });
    } else {
        // Desktop
        // Obnovení tilt efektu při přechodu zpět na desktop
        initTiltEffect();
    }
}

/**
 * Inicializace 3D efektů pomocí Three.js
 */
function init3DEffects() {
    // Kontrola existence Three.js
    if (typeof THREE === 'undefined') return;
    
    // Zde by přišla inicializace 3D prvků pomocí Three.js
    // Například rotující 3D model kratomových listů apod.
}

/**
 * Sledování událostí pro analytiku
 */
function trackEvents() {
    // Sledování kliknutí na produkty
    document.querySelectorAll('.product-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const productName = this.closest('.product').querySelector('h3').textContent;
            
            // Zde by přišel kód pro analytiku, např. GA4 nebo jiný tracking systém
            console.log(`Product click: ${productName}`);
        });
    });
    
    // Sledování odeslání formuláře
    const contactForm = document.querySelector('.contact-form');
    if (contactForm) {
        contactForm.addEventListener('submit', function() {
            // Tracking události odeslání formuláře
            console.log('Form submitted');
        });
    }
}

// Graphics Toggle Functionality
document.addEventListener('DOMContentLoaded', function() {
    const toggle = document.getElementById('graphicsToggle');
    
    // Check for saved preference or system preference
    const savedPref = localStorage.getItem('graphicsPref');
    const systemPrefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    
    // Set initial state
    if (savedPref === 'low' || (systemPrefersReduced && savedPref !== 'high')) {
        toggle.checked = true;
        document.body.classList.add('low-graphics');
    }
    
    // Toggle event listener
    toggle.addEventListener('change', function() {
        if (this.checked) {
            document.body.classList.add('low-graphics');
            localStorage.setItem('graphicsPref', 'low');
        } else {
            document.body.classList.remove('low-graphics');
            localStorage.setItem('graphicsPref', 'high');
        }
    });
    
    // Listen for changes in system preferences
    window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', e => {
        if (e.matches && !toggle.checked) {
            toggle.checked = true;
            document.body.classList.add('low-graphics');
            localStorage.setItem('graphicsPref', 'low');
        }
    });
});

/**
 * Lokální nákupní košík - základní implementace
 */
function initShoppingCart() {
    const cartIconBadge = document.querySelector('.cart-badge');
    
    if (!cartIconBadge) return;
    
    // Načtení počtu položek z localStorage
    const cartItemCount = localStorage.getItem('cartItemCount') || 0;
    
    updateCartBadge(cartItemCount);
    
    // Přidání položek do košíku z produktových stránek
    document.querySelectorAll('.product-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            // Zabránění navigaci na detail produktu, pokud máme data-add-to-cart atribut
            if (this.hasAttribute('data-add-to-cart')) {
                e.preventDefault();
                
                // Inkrementace počítadla
                const newCount = parseInt(cartItemCount) + 1;
                localStorage.setItem('cartItemCount', newCount);
                
                // Update UI
                updateCartBadge(newCount);
                
                // Feedback uživateli (např. toast notifikace)
                showNotification('Produkt byl přidán do košíku', 'success');
            }
        });
    });
    
    // Funkce pro aktualizaci počítadla v košíku
    function updateCartBadge(count) {
        if (count > 0) {
            cartIconBadge.textContent = count;
            cartIconBadge.classList.add('active');
        } else {
            cartIconBadge.classList.remove('active');
        }
    }
    
    // Funkce pro zobrazení notifikace
    function showNotification(message, type = 'info') {
        // Vytvoření elementu notifikace
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        
        // Přidání do DOM
        document.body.appendChild(notification);
        
        // Animace zobrazení
        setTimeout(() => {
            notification.classList.add('visible');
        }, 10);
        
        // Automatické skrytí
        setTimeout(() => {
            notification.classList.remove('visible');
            
            // Odstranění z DOM po dokončení animace
            setTimeout(() => {
                notification.remove();
            }, 300);
        }, 3000);
    }
}

// Funkce pro umístění listů přesně na přechod mezi hero a about sekcí
document.addEventListener('DOMContentLoaded', function() {
    function positionLeafDivider() {
        const hero = document.getElementById('hero');
        const about = document.getElementById('about');
        const leafDivider = document.querySelector('.leaf-divider');
        
        if (hero && about && leafDivider) {
            // Zjištění absolutní pozice hero sekce
            const heroRect = hero.getBoundingClientRect();
            const heroBottom = heroRect.bottom + window.pageYOffset;
            
            // Zjištění absolutní pozice about sekce
            const aboutRect = about.getBoundingClientRect();
            const aboutTop = aboutRect.top + window.pageYOffset;
            
            // Výpočet přesné pozice přechodu
            const transitionPosition = (heroBottom + aboutTop) / 2;
            
            // Nastavení pozice listu tak, aby byl přesně na přechodu
            leafDivider.style.top = (transitionPosition - (leafDivider.offsetHeight / 2)) + 'px';
        }
    }
    
    // Spouštění funkce při načtení, scrollování a změně velikosti okna
    positionLeafDivider();
    window.addEventListener('resize', positionLeafDivider);
    window.addEventListener('scroll', positionLeafDivider);
    
    // Opakované volání pro zajištění správného umístění
    setTimeout(positionLeafDivider, 100);
    setTimeout(positionLeafDivider, 500);
    setTimeout(positionLeafDivider, 1000);
});

// Automatické spuštění optimalizace výkonu
optimizePagePerformance();

// Spuštění sledování událostí pro analytiku
trackEvents();

// Inicializace lokálního košíku
initShoppingCart();