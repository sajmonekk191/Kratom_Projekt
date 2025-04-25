/**
 * Sajrajt.cz - Optimalizovaný JavaScript
 */

document.addEventListener('DOMContentLoaded', () => {
  // Klíčové funkce
  initPreloader();
  initHeaderEffects();
  initSmoothScroll();
  initBackToTop();
  initScrollProgress();
  initFaqAccordion();
  initParticleCanvas();
  initScrollAnimations();
  initGlitchEffect();
  
  // Produkty a interakce
  initProductsButtonScroll();
  enhanceProductCards();
  initProductObserver();
  initProductIndicators();
  updateCartBadge();
  initShoppingCart();
  
  // Animace a efekty
  initFormInteractions();
  initLeafAnimation();
  initContactElements();
  positionLeafDivider();
  
  // Optimalizace a nastavení
  initGraphicsToggle();
  
  // Pokročilá funkcionalita pro desktopové prohlížeče
  if (window.innerWidth > 768) {
    initParallaxEffect();
  } else {
    optimizeForMobile();
  }
});

/**
 * Preloader - zobrazí se při načítání stránky
 */
function initPreloader() {
  const preloader = document.querySelector('.preloader');
  if (!preloader) return;
  
  setTimeout(() => {
    preloader.classList.add('hidden');
    setTimeout(() => document.body.classList.add('loaded'), 500);
  }, 800);
}

/**
 * Efekty pro header - změna stylu při scrollování
 */
function initHeaderEffects() {
  const header = document.querySelector('.main-header');
  const progressBar = document.querySelector('.header-progress-bar');
  if (!header) return;
  
  let lastScrollY = 0;
  let scrollTimeout;
  
  function updateHeader() {
    const scrollY = window.scrollY;
    
    // Přidání třídy scrolled při odscrollování
    scrollY > 50 ? header.classList.add('scrolled') : header.classList.remove('scrolled');
    
    // Skrytí/zobrazení headeru při rychlém scrollování
    if (scrollY > lastScrollY + 50 && scrollY > 500) {
      header.classList.add('header-hidden');
    } else if (scrollY < lastScrollY - 10 || scrollY < 300) {
      header.classList.remove('header-hidden');
    }
    
    lastScrollY = scrollY;
    
    // Aktualizace progress baru
    if (progressBar) {
      const scrollPercent = (scrollY / (document.body.scrollHeight - window.innerHeight)) * 100;
      progressBar.style.width = `${scrollPercent}%`;
    }
  }
  
  // Optimalizovaný event listener pro scroll
  window.addEventListener('scroll', () => {
    if (!scrollTimeout) {
      scrollTimeout = setTimeout(() => {
        updateHeader();
        scrollTimeout = null;
      }, 10);
    }
  });
  
  updateHeader();
}

/**
 * Scrollování ke stránce produktů
 */
function initProductsButtonScroll() {
  const viewProductsBtn = document.getElementById('view-products-btn');
  const scrollIndicator = document.getElementById('scroll-indicator');
  
  if (viewProductsBtn) {
    viewProductsBtn.addEventListener('click', function(e) {
      e.preventDefault();
      
      const targetId = this.getAttribute('href');
      const targetElement = document.querySelector(targetId);
      if (!targetElement) return;
      
      const offset = 30;
      const targetPosition = targetElement.getBoundingClientRect().top + window.pageYOffset;
      const offsetPosition = targetPosition - offset;
      
      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
    });
  }
  
  if (scrollIndicator) {
    scrollIndicator.addEventListener('click', function() {
      const aboutSection = document.getElementById('about');
      
      if (aboutSection) {
        aboutSection.scrollIntoView({ behavior: 'smooth' });
      } else {
        window.scrollTo({
          top: window.innerHeight,
          behavior: 'smooth'
        });
      }
    });
    
    // Skrýt indikátor po scrollu dolů
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
}

/**
 * Počítadlo košíku
 */
function updateCartBadge() {
  const cartBadge = document.querySelector('.cart-badge');
  if (!cartBadge) return;
  
  const cartItems = getCartFromCookies();
  const totalItems = cartItems.reduce((total, item) => total + (parseInt(item.quantity) || 1), 0);
  
  cartBadge.textContent = totalItems;
  
  if (totalItems > 0) {
    cartBadge.classList.add('active');
  } else {
    cartBadge.classList.remove('active');
  }
}

function getCartFromCookies() {
  const allCookies = document.cookie.split(';');
  let cartCookie = null;
  
  for (let cookie of allCookies) {
    cookie = cookie.trim();
    if (cookie.startsWith('cart=')) {
      cartCookie = cookie.substring(5);
      break;
    }
  }
  
  if (cartCookie) {
    try {
      const decodedCookie = decodeURIComponent(cartCookie);
      const parsedCart = JSON.parse(decodedCookie);
      
      if (Array.isArray(parsedCart)) {
        return parsedCart;
      }
    } catch (error) {
      console.error('Chyba při parsování košíku:', error);
    }
  }
  
  return [];
}

/**
 * Vylepšení produktových karet
 */
function enhanceProductCards() {
  const products = document.querySelectorAll('.product');
  if (products.length === 0) return;
  
  products.forEach(product => {
    // Hover efekt
    product.addEventListener('mouseenter', () => {
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
      
      setTimeout(() => {
        const indicators = product.querySelectorAll('.indicator');
        indicators.forEach(indicator => {
          indicator.classList.remove('indicator-active');
        });
      }, 100);
    });
    
    // Tooltip animace
    const bars = product.querySelectorAll('.bar');
    bars.forEach(bar => {
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
  });
  
  // Připravit animace
  document.body.classList.add('product-animations-enabled');
  
  // Přidat touch podporu
  if ('ontouchstart' in window) {
    products.forEach(product => {
      product.addEventListener('touchstart', function() {
        products.forEach(p => {
          if (p !== product) p.classList.remove('product-hover');
        });
        
        this.classList.toggle('product-hover');
      }, {passive: true});
    });
  }
}

/**
 * Observer pro animaci produktových karet při scrollu
 */
function initProductObserver() {
  const productObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in-view');
        
        // Animace indikátorů
        const bars = entry.target.querySelectorAll('.bar');
        bars.forEach((bar, index) => {
          setTimeout(() => {
            bar.style.width = bar.style.getPropertyValue('--width');
          }, 200 + (index * 150));
        });
        
        productObserver.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.2,
    rootMargin: '0px 0px -50px 0px'
  });
  
  document.querySelectorAll('.product').forEach(product => {
    productObserver.observe(product);
  });
}

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
      
      // Speciální offset pro products sekci
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
  
  window.addEventListener('scroll', () => {
    if (window.scrollY > 500) {
      backToTopButton.classList.add('visible');
    } else {
      backToTopButton.classList.remove('visible');
    }
  });
  
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
function initFaqAccordion() {
  // Rozbalovací FAQ sekce
  const faqItems = document.querySelectorAll('.faq-item');
  if (faqItems.length === 0) return;
  
  faqItems.forEach(item => {
    item.addEventListener('click', function() {
      const question = this.querySelector('.faq-question');
      
      // Zavřeme všechny ostatní aktivní položky
      faqItems.forEach(otherItem => {
        if (otherItem !== this && otherItem.classList.contains('active')) {
          otherItem.classList.remove('active');
        }
      });
      
      // Přepneme stav aktuální položky
      this.classList.toggle('active');
      
      // Animace ikony
      const icon = question.querySelector('i');
      if (icon) {
        icon.style.transition = 'transform 0.4s cubic-bezier(0.68, -0.55, 0.27, 1.55)';
      }
    });
  });
  
  // Tlačítko "Zobrazit více" ve FAQ
  const toggleBtn = document.getElementById('faqToggleBtn');
  if (!toggleBtn) return;
  
  let expanded = false;
  
  toggleBtn.addEventListener('click', function() {
    // Efekt ripple
    this.classList.remove('ripple');
    void this.offsetWidth;
    this.classList.add('ripple');
    
    if (!expanded) {
      // Zobrazení všech skrytých FAQ položek
      faqItems.forEach((item, index) => {
        if (index >= 4) {
          item.style.display = 'block';
          item.style.opacity = '0';
          item.style.transform = 'translateY(20px)';
          
          setTimeout(() => {
            item.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
            item.style.opacity = '1';
            item.style.transform = 'translateY(0)';
          }, (index - 4) * 100);
        }
      });
      
      toggleBtn.innerHTML = '<span>Zobrazit méně</span> <i class="fas fa-chevron-down"></i>';
      this.classList.add('showing-less');
      expanded = true;
      
      // Scroll dolů pro zobrazení více obsahu
      setTimeout(() => {
        const lastItem = faqItems[faqItems.length - 3];
        if (lastItem) {
          lastItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 200);
    } else {
      // Skrytí FAQ položek po 4. položce
      const itemsToHide = Array.from(faqItems).slice(4);
      
      itemsToHide.forEach((item, index) => {
        setTimeout(() => {
          item.style.opacity = '0';
          item.style.transform = 'translateY(20px)';
          
          // Skrytí po dokončení animace
          setTimeout(() => {
            item.style.display = 'none';
          }, 400);
        }, (itemsToHide.length - index - 1) * 80);
      });
      
      toggleBtn.innerHTML = '<span>Zobrazit více</span> <i class="fas fa-chevron-down"></i>';
      this.classList.remove('showing-less');
      expanded = false;
      
      // Scroll zpět k FAQ sekci
      setTimeout(() => {
        document.querySelector('.faq').scrollIntoView({ 
          behavior: 'smooth',
          block: 'start'
        });
      }, 300);
    }
  });
}

/**
 * Animace pro kontaktní sekci
 */
function initContactElements() {
  // Animace kontaktních elementů při scrollování
  function animateContactElements() {
    const elements = document.querySelectorAll('.contact [data-animate]');
    
    elements.forEach(element => {
      const elementPosition = element.getBoundingClientRect().top;
      const windowHeight = window.innerHeight;
      
      if (elementPosition < windowHeight * 0.85) {
        element.classList.add('animated');
      }
    });
  }
  
  // Spustit při načtení
  setTimeout(animateContactElements, 300);
  window.addEventListener('scroll', animateContactElements);
  
  // Přidat částice do pozadí kontaktní sekce
  addContactParticles();
  
  // Interakce s kontaktními kartami
  initContactCardEffects();
  
  // Odeslání formuláře
  initContactForm();
}

/**
 * Přidání částic do pozadí kontaktní sekce
 */
function addContactParticles() {
  const contactSection = document.querySelector('.contact');
  if (!contactSection) return;
  
  // Vynechat přidávání částic při nízkých grafických nastaveních
  if (document.body.classList.contains('low-graphics')) return;
  
  // Přidání částic
  for (let i = 0; i < 50; i++) {
    const particle = document.createElement('div');
    particle.className = 'contact-floating-particle';
    
    const size = Math.random() * 4 + 2;
    const posX = Math.random() * 100;
    const posY = Math.random() * 100;
    const opacity = Math.random() * 0.15 + 0.05;
    const duration = Math.random() * 50 + 20;
    const delay = Math.random() * 10;
    
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
  
  // Přidání animace
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

/**
 * Interakce s kontaktními kartami
 */
function initContactCardEffects() {
  const contactCards = document.querySelectorAll('.contact-card');
  
  contactCards.forEach(card => {
    // Částice při hoveru
    card.addEventListener('mouseenter', function() {
      if (!document.body.classList.contains('low-graphics')) {
        createCardParticles(this);
      }
    });
    
    // Efekt na odkaz
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
  
  // Funkce pro vytvoření částic
  function createCardParticles(card) {
    if (card.querySelector('.card-particle')) return;
    
    for (let i = 0; i < 5; i++) {
      const particle = document.createElement('div');
      particle.className = 'card-particle';
      
      const size = Math.random() * 5 + 2;
      const posX = Math.random() * 100;
      const posY = Math.random() * 100;
      const duration = 0.5 + Math.random() * 1;
      const delay = Math.random() * 0.5;
      
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
      
      setTimeout(() => {
        particle.remove();
      }, (duration + delay) * 1000);
    }
  }
  
  // Styly pro animaci
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
}

/**
 * Inicializace kontaktního formuláře
 */
function initContactForm() {
  const contactForm = document.querySelector('.contact-form');
  const formInputs = document.querySelectorAll('.form-input');
  
  if (!contactForm) return;
  
  // Zpracování odeslání formuláře
  contactForm.addEventListener('submit', function(e) {
    e.preventDefault();
    
    const submitButton = this.querySelector('.quantum-btn');
    submitButton.classList.add('loading');
    
    // Simulace odeslání
    setTimeout(() => {
      submitButton.classList.remove('loading');
      
      // Efekt úspěšného odeslání
      submitButton.innerHTML = '<span class="btn-text">Zpráva odeslána!</span><i class="fas fa-check"></i>';
      submitButton.style.background = 'rgba(76, 175, 80, 0.2)';
      submitButton.style.borderColor = 'rgba(76, 175, 80, 0.5)';
      
      // Reset formuláře
      contactForm.reset();
      
      // Reset vstupních polí
      document.querySelectorAll('.form-input').forEach(input => {
        const label = input.nextElementSibling;
        if (label && label.tagName === 'LABEL') {
          label.style.top = '';
          label.style.left = '';
          label.style.fontSize = '';
          label.style.color = '';
        }
      });
      
      // Obnovení tlačítka po 3 sekundách
      setTimeout(() => {
        submitButton.innerHTML = '<span class="btn-text">Odeslat zprávu</span><div class="loading-dots"><span></span><span></span><span></span></div><i class="fas fa-paper-plane"></i><div class="btn-glow"></div><div class="btn-shine"></div>';
        submitButton.style.background = '';
        submitButton.style.borderColor = '';
      }, 3000);
    }, 1500);
  });
  
  // Interaktivní vstupní pole
  formInputs.forEach(input => {
    // Iniciální stav
    if (input.value) {
      const label = input.nextElementSibling;
      label.classList.add('active');
    }
    
    // Focus a blur události
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
 * Formulář - interakce
 */
function initFormInteractions() {
  const contactForm = document.querySelector('.contact-form');
  const formInputs = document.querySelectorAll('.form-input');
  
  if (!contactForm) return;
  
  // Interaktivní vstupní pole
  formInputs.forEach(input => {
    if (input.value) {
      const label = input.nextElementSibling;
      label.classList.add('active');
    }
    
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

/**
 * Animace canvas pozadí
 */
function initParticleCanvas() {
  const canvas = document.getElementById('particleCanvas');
  if (!canvas) return;
  
  // Přeskočení animace při nízkých grafických nastaveních
  if (document.body.classList.contains('low-graphics')) {
    canvas.style.display = 'none';
    return;
  }
  
  const ctx = canvas.getContext('2d');
  const particlesArray = [];
  
  // Nastavení velikosti canvasu
  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
  
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
      
      if (this.x > canvas.width || this.x < 0) this.speedX = -this.speedX;
      if (this.y > canvas.height || this.y < 0) this.speedY = -this.speedY;
    }
    
    draw() {
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  
  // Vytvoření částic
  function init() {
    const numberOfParticles = Math.min(Math.floor(window.innerWidth / 10), 100);
    for (let i = 0; i < numberOfParticles; i++) {
      particlesArray.push(new Particle());
    }
  }
  
  // Vykreslení spojení
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
    if (document.body.classList.contains('low-graphics')) {
      cancelAnimationFrame(animate);
      return;
    }
    
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
 * Animace při scrollování - zobrazování prvků s IntersectionObserver
 */
function initScrollAnimations() {
  // Příprava stavů pro animace
  document.documentElement.classList.add('js-preload');

  window.addEventListener('load', () => {
    document.documentElement.classList.remove('js-preload');
    document.documentElement.classList.add('js-loaded');

    // Animované elementy
    const animatedElements = document.querySelectorAll(
      '.feature-card, .product, .effect-card, .contact-card, .contact-form, .faq-item'
    );

    if (animatedElements.length === 0) return;

    // Nastavení přechodů
    animatedElements.forEach(element => {
      element.style.transition = 'opacity 0.8s ease, transform 0.8s ease';
      element.style.willChange = 'opacity, transform';
    });

    // Observer pro elementy
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            requestAnimationFrame(() => {
              entry.target.style.opacity = '1';
              entry.target.style.transform = 'translateY(0)';
              
              if (entry.target.classList.contains('product')) {
                animateProductIndicators(entry.target);
              }
            });
            
            observer.unobserve(entry.target);
          }
        });
      },
      {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
      }
    );

    // Registrace elementů s krátkým zpožděním
    setTimeout(() => {
      animatedElements.forEach(element => {
        element.style.opacity = '0';
        element.style.transform = 'translateY(30px)';
        observer.observe(element);
      });
    }, 150);

    // Nadpisy sekcí
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

    // Prvotní kontrola
    checkVisibleElementsImmediately();
  });

  // Animace indikátorů produktů
  function animateProductIndicators(product) {
    const indicators = product.querySelectorAll('.bar');
    indicators.forEach((bar, index) => {
      setTimeout(() => {
        bar.style.width = bar.style.getPropertyValue('--width');
      }, index * 150);
    });
  }

  // Kontrola viditelných prvků při načtení
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
 * Paralax efekt pro sekce při scrollování
 */
function initParallaxEffect() {
  // Přeskočit paralax při nízkých grafických nastaveních
  if (document.body.classList.contains('low-graphics')) return;
  
  const parallaxElements = [
    { selector: '.hero-bg-shapes', speed: 0.2 },
    { selector: '.section-bg-particles', speed: 0.1 },
    { selector: '.products-bg-particles', speed: 0.15 },
    { selector: '.effects-bg-particles', speed: 0.1 },
    { selector: '.faq-bg-particles', speed: 0.12 }
  ];
  
  // Optimalizovaný event listener
  let ticking = false;
  
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
  
  // Omezit počet listů při nízkých grafických nastaveních
  const isLowGraphics = document.body.classList.contains('low-graphics');
  const leafTypes = ['🍃', '☘️', '🌿', '🍀'];
  const numberOfLeaves = isLowGraphics ? 
    Math.min(Math.floor(window.innerWidth / 60), 10) : 
    Math.min(Math.floor(window.innerWidth / 20), 30);
  
  for (let i = 0; i < numberOfLeaves; i++) {
    const leaf = document.createElement('div');
    leaf.classList.add('kratom-leaf');
    
    // Náhodné parametry
    const randomStart = Math.random() * 100;
    const randomDelay = Math.random() * 30;
    const randomSize = 0.8 + Math.random() * 0.8;
    const randomDuration = isLowGraphics ? 
      25 + Math.random() * 10 : 
      15 + Math.random() * 20;
    
    leaf.textContent = leafTypes[Math.floor(Math.random() * leafTypes.length)];
    leaf.style.setProperty('--start-position', `${randomStart}%`);
    leaf.style.setProperty('--end-position', `${window.innerHeight * 2}px`);
    leaf.style.setProperty('--animation-delay', `${randomDelay}s`);
    leaf.style.fontSize = `${randomSize}rem`;
    leaf.style.animationDuration = `${randomDuration}s`;
    
    leavesContainer.appendChild(leaf);
  }
  
  // Aktualizace při resize
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
  
  // Vypnout glitch efekt při nízkých grafických nastaveních
  if (document.body.classList.contains('low-graphics')) {
    glitchHeading.classList.remove('glitch-effect');
    return;
  }
  
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
  
  // Efekty při hoveru
  products.forEach(product => {
    const indicators = product.querySelectorAll('.indicator');
    
    indicators.forEach(indicator => {
      const bar = indicator.querySelector('.bar');
      const tooltip = indicator.querySelector('.bar-tooltip');
      
      // Zobrazení tooltipu při hoveru
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
      
      // Efekt animace - pouze při normálních grafických nastaveních
      if (!document.body.classList.contains('low-graphics')) {
        product.addEventListener('mouseenter', () => {
          if (bar) bar.style.boxShadow = '0 0 10px currentColor';
        });
        
        product.addEventListener('mouseleave', () => {
          if (bar) bar.style.boxShadow = 'none';
        });
      }
    });
  });
  
  // Observer pro animaci při scrollu
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
 * Optimalizace pro mobilní zařízení
 */
function optimizeForMobile() {
  // Optimalizace částic - i při normálních grafických nastaveních
  document.querySelectorAll('.contact-floating-particle').forEach((particle, index) => {
    if (index % 3 !== 0) {
      particle.remove();
    }
  });
  
  // Zjednodušení animací
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
      
      .product.product-hover {
        transform: translateY(-10px) !important;
      }
      
      .product .product-shine {
        display: none;
      }
    }
  `;
  document.head.appendChild(mobileStyle);
  
  // Přidání touch událostí pro produkty
  const products = document.querySelectorAll('.product');
  
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

/**
 * Přepínač pro úroveň grafiky
 */
function initGraphicsToggle() {
  const toggle = document.getElementById('graphicsToggle');
  if (!toggle) return;
  
  // Kontrola uložených preferencí
  const savedPref = localStorage.getItem('graphicsPref');
  const systemPrefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  
  // Nastavení počátečního stavu
  if (savedPref === 'low' || (systemPrefersReduced && savedPref !== 'high')) {
    toggle.checked = true;
    document.body.classList.add('low-graphics');
  }
  
  // Přepínání
  toggle.addEventListener('change', function() {
    if (this.checked) {
      document.body.classList.add('low-graphics');
      localStorage.setItem('graphicsPref', 'low');
    } else {
      document.body.classList.remove('low-graphics');
      localStorage.setItem('graphicsPref', 'high');
    }
    
    // Obnovení stránky pro aplikaci změn
    location.reload();
  });
  
  // Sledování změn v systémových preferencích
  window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', e => {
    if (e.matches && !toggle.checked) {
      toggle.checked = true;
      document.body.classList.add('low-graphics');
      localStorage.setItem('graphicsPref', 'low');
      
      // Obnovení stránky pro aplikaci změn
      location.reload();
    }
  });
}

/**
 * Lokální nákupní košík
 */
function initShoppingCart() {
  const cartIconBadge = document.querySelector('.cart-badge');
  if (!cartIconBadge) return;
  
  // Přidání položek do košíku
  document.querySelectorAll('.product-btn').forEach(btn => {
    btn.addEventListener('click', function(e) {
      if (this.hasAttribute('data-add-to-cart')) {
        e.preventDefault();
        
        // Získání aktuálního počtu položek
        const cartItems = getCartFromCookies();
        const totalItems = cartItems.reduce((total, item) => total + (parseInt(item.quantity) || 1), 0);
        const newCount = totalItems + 1;
        
        // Uložení do cookies
        const newCart = [...cartItems, { id: Date.now(), quantity: 1 }];
        document.cookie = `cart=${encodeURIComponent(JSON.stringify(newCart))};path=/;max-age=86400`;
        
        // Aktualizace UI
        updateCartBadge();
        showNotification('Produkt byl přidán do košíku', 'success');
      }
    });
  });
  
  // Notifikace
  function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.classList.add('visible');
    }, 10);
    
    setTimeout(() => {
      notification.classList.remove('visible');
      
      setTimeout(() => {
        notification.remove();
      }, 300);
    }, 3000);
  }
}

/**
 * Umístění listů na přechod hero-about
 */
function positionLeafDivider() {
  const hero = document.getElementById('hero');
  const about = document.getElementById('about');
  const leafDivider = document.querySelector('.leaf-divider');
  
  if (hero && about && leafDivider) {
    const heroRect = hero.getBoundingClientRect();
    const heroBottom = heroRect.bottom + window.pageYOffset;
    
    const aboutRect = about.getBoundingClientRect();
    const aboutTop = aboutRect.top + window.pageYOffset;
    
    const transitionPosition = (heroBottom + aboutTop) / 2;
    
    leafDivider.style.top = (transitionPosition - (leafDivider.offsetHeight / 2)) + 'px';
  }
}