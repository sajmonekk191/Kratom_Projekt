document.addEventListener('DOMContentLoaded', function() {
    // Initialize components
    initHeader();
    initSmothScroll();
    initFaqToggle();
    initBackToTop();
    initFormInteractions();
    initLeafAnimation();
    initProductBars();
    initParallaxEffects();
    initGlitchEffect();
    initCanvasBackground();
    
    // Trigger animations when elements come into view
    initScrollAnimations();
});

// Header behavior
function initHeader() {
    const header = document.querySelector('header');
    const heroSection = document.getElementById('hero');
    
    if (!header || !heroSection) return;
    
    // Change header style on scroll
    const heroHeight = heroSection.offsetHeight;
    
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            header.classList.add('header-fixed');
        } else {
            header.classList.remove('header-fixed');
        }
    });
}

// Smooth scrolling for anchor links
function initSmothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            
            const targetId = this.getAttribute('href');
            if (targetId === '#') return;
            
            const targetElement = document.querySelector(targetId);
            if (!targetElement) return;
            
            const headerOffset = 80;
            const elementPosition = targetElement.getBoundingClientRect().top;
            const offsetPosition = elementPosition + window.scrollY - headerOffset;
            
            window.scrollTo({
                top: offsetPosition,
                behavior: 'smooth'
            });
        });
    });
}

// FAQ accordion functionality
function initFaqToggle() {
    const faqItems = document.querySelectorAll('.faq-item');
    
    faqItems.forEach(item => {
        item.addEventListener('click', function() {
            // Close other items
            faqItems.forEach(otherItem => {
                if (otherItem !== this) {
                    otherItem.classList.remove('active');
                }
            });
            
            // Toggle current item
            this.classList.toggle('active');
        });
    });
}

// Back to top button
function initBackToTop() {
    const backToTopButton = document.getElementById('back-to-top');
    
    if (!backToTopButton) return;
    
    // Show/hide button based on scroll position
    window.addEventListener('scroll', () => {
        if (window.scrollY > 500) {
            backToTopButton.classList.add('visible');
        } else {
            backToTopButton.classList.remove('visible');
        }
    });
    
    // Scroll to top when button is clicked
    backToTopButton.addEventListener('click', () => {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    });
}

// Form interactions
function initFormInteractions() {
    // Handle form submission
    const contactForm = document.querySelector('.contact-form');
    
    if (contactForm) {
        contactForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const submitButton = this.querySelector('.quantum-btn');
            submitButton.classList.add('loading');
            
            // Simulate form submission (replace with actual form handling)
            setTimeout(() => {
                submitButton.classList.remove('loading');
                
                // Reset form (in a real application, you'd display success message)
                this.reset();
                
                // Reset input states
                this.querySelectorAll('.form-input').forEach(input => {
                    input.parentElement.classList.remove('active');
                });
                
                alert('Zpráva byla úspěšně odeslána!');
            }, 2000);
        });
    }
    
    // Enhance form inputs
    document.querySelectorAll('.form-input').forEach(input => {
        // Add active class when input has value
        if (input.value) {
            input.parentElement.classList.add('active');
        }
        
        // Handle focus events
        input.addEventListener('focus', function() {
            this.parentElement.classList.add('active');
        });
        
        input.addEventListener('blur', function() {
            if (!this.value) {
                this.parentElement.classList.remove('active');
            }
        });
    });
}

// Animated falling leaves
function initLeafAnimation() {
    const leavesContainer = document.querySelector('.kratom-leaves-container');
    
    if (!leavesContainer) return;
    
    // Create leaves
    const leafEmojis = ['🍃', '☘️', '🌿'];
    const numberOfLeaves = 20;
    
    for (let i = 0; i < numberOfLeaves; i++) {
        const leaf = document.createElement('div');
        leaf.classList.add('kratom-leaf');
        
        // Randomly select leaf emoji
        const randomIndex = Math.floor(Math.random() * leafEmojis.length);
        leaf.textContent = leafEmojis[randomIndex];
        
        // Set random properties
        const randomStart = Math.random() * 100;
        const randomDelay = Math.random() * 5;
        const randomDuration = 12 + Math.random() * 8;
        
        leaf.style.setProperty('--start-position', `${randomStart}%`);
        leaf.style.setProperty('--end-position', `${window.innerHeight * 2}px`);
        leaf.style.setProperty('--animation-delay', `${randomDelay}s`);
        leaf.style.animationDuration = `${randomDuration}s`;
        
        leavesContainer.appendChild(leaf);
    }
    
    // Update leaf positions on window resize
    window.addEventListener('resize', () => {
        document.querySelectorAll('.kratom-leaf').forEach(leaf => {
            leaf.style.setProperty('--end-position', `${window.innerHeight * 2}px`);
        });
    });
}

// Animate product effect bars when they come into view
function initProductBars() {
    const productCards = document.querySelectorAll('.product');
    
    // Add 'in-view' class to products when they come into view
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('in-view');
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.2 });
    
    productCards.forEach(card => {
        observer.observe(card);
    });
}

// Scroll animation and parallax effects
function initParallaxEffects() {
    // Elements that should have parallax effect
    const parallaxElements = [
        { selector: '.feature-card', speed: 0.05 },
        { selector: '.product', speed: 0.03 },
        { selector: '.effect-card', speed: 0.04 }
    ];
    
    window.addEventListener('scroll', () => {
        const scrollY = window.scrollY;
        
        parallaxElements.forEach(item => {
            const elements = document.querySelectorAll(item.selector);
            
            elements.forEach(element => {
                const elementTop = element.getBoundingClientRect().top + scrollY;
                const elementOffset = (scrollY - elementTop) * item.speed;
                
                // Only apply parallax if element is in viewport area
                if (Math.abs(window.innerHeight - elementTop + scrollY) < window.innerHeight * 1.5) {
                    element.style.transform = `translateY(${elementOffset}px)`;
                }
            });
        });
    });
}

// Enhanced glitch effect for hero title
function initGlitchEffect() {
    const glitchText = document.querySelector('.glitch-text');
    
    if (!glitchText) return;
    
    // Create random glitch intervals
    setInterval(() => {
        // Add strong glitch class temporarily
        glitchText.classList.add('glitch-strong');
        
        // Remove after short duration
        setTimeout(() => {
            glitchText.classList.remove('glitch-strong');
        }, 200);
    }, 3000);
}

// Canvas background effect
function initCanvasBackground() {
    const canvas = document.getElementById('bg-canvas');
    
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    // Set canvas dimensions
    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    // Particle settings
    const particleCount = 50;
    const particles = [];
    
    // Create particles
    for (let i = 0; i < particleCount; i++) {
        particles.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            size: Math.random() * 2 + 1,
            speed: Math.random() * 0.5 + 0.1,
            color: `rgba(0, ${Math.floor(Math.random() * 150 + 100)}, ${Math.floor(Math.random() * 100)}, ${Math.random() * 0.2 + 0.1})`,
            direction: Math.random() * Math.PI * 2
        });
    }
    
    // Animation loop
    function animate() {
        // Clear canvas with slight fade effect
        ctx.fillStyle = 'rgba(18, 18, 18, 0.05)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Update and draw particles
        particles.forEach(particle => {
            // Move particle
            particle.x += Math.cos(particle.direction) * particle.speed;
            particle.y += Math.sin(particle.direction) * particle.speed;
            
            // Wrap around edges
            if (particle.x < 0) particle.x = canvas.width;
            if (particle.x > canvas.width) particle.x = 0;
            if (particle.y < 0) particle.y = canvas.height;
            if (particle.y > canvas.height) particle.y = 0;
            
            // Draw particle
            ctx.beginPath();
            ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
            ctx.fillStyle = particle.color;
            ctx.fill();
        });
        
        // Random connection lines between close particles
        if (Math.random() > 0.95) {
            drawRandomConnections();
        }
        
        requestAnimationFrame(animate);
    }
    
    // Draw connection lines between random particles
    function drawRandomConnections() {
        for (let i = 0; i < 3; i++) {
            const p1 = particles[Math.floor(Math.random() * particles.length)];
            const p2 = particles[Math.floor(Math.random() * particles.length)];
            
            // Calculate distance
            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            // Only connect if they're relatively close
            if (distance < 150) {
                ctx.beginPath();
                ctx.moveTo(p1.x, p1.y);
                ctx.lineTo(p2.x, p2.y);
                ctx.strokeStyle = `rgba(0, 230, 118, ${0.1 - distance / 1500})`;
                ctx.lineWidth = 1;
                ctx.stroke();
            }
        }
    }
    
    // Start animation
    animate();
}

// Init scroll animations - using Intersection Observer API
function initScrollAnimations() {
    const animatedElements = document.querySelectorAll('.feature-card, .product, .effect-card, .faq-item, .contact-card, .contact-form');
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                // Add animation classes based on element type
                const element = entry.target;
                
                if (element.classList.contains('feature-card')) {
                    element.style.animation = 'fadeInUp 0.8s forwards';
                    element.style.animationDelay = '0.2s';
                } else if (element.classList.contains('product')) {
                    element.style.animation = 'fadeInUp 0.8s forwards';
                    element.style.animationDelay = '0.3s';
                } else if (element.classList.contains('effect-card')) {
                    element.style.animation = 'fadeInUp 0.8s forwards';
                    element.style.animationDelay = '0.4s';
                } else if (element.classList.contains('faq-item')) {
                    element.style.animation = 'fadeInUp 0.6s forwards';
                    element.style.animationDelay = '0.2s';
                } else if (element.classList.contains('contact-card') || element.classList.contains('contact-form')) {
                    element.style.animation = 'fadeInUp 0.8s forwards';
                    element.style.animationDelay = '0.3s';
                }
                
                observer.unobserve(element);
            }
        });
    }, { threshold: 0.15 });
    
    animatedElements.forEach(element => {
        // Set initial state
        element.style.opacity = '0';
        element.style.transform = 'translateY(30px)';
        
        // Begin observing
        observer.observe(element);
    });
    
    // Define animations in CSS
    const style = document.createElement('style');
    style.textContent = `
        @keyframes fadeInUp {
            from {
                opacity: 0;
                transform: translateY(30px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
        
        @keyframes glitchEffect {
            0% { transform: none; filter: none; }
            20% { transform: skewX(4deg); filter: hue-rotate(90deg); }
            21% { transform: none; filter: none; }
            35% { transform: skewX(-2deg) skewY(1deg); filter: invert(50%); }
            36% { transform: none; filter: none; }
            100% { transform: none; filter: none; }
        }
        
        .glitch-strong {
            animation: glitchEffect 0.5s linear;
        }
    `;
    
    document.head.appendChild(style);
}