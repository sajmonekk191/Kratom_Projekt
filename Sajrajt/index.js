// Interakce s kurzorem
document.addEventListener('mousemove', (e) => {
    const cursorEffect = document.createElement('div');
    cursorEffect.className = 'cursor-effect';
    cursorEffect.style.left = `${e.pageX}px`;
    cursorEffect.style.top = `${e.pageY}px`;
    document.body.appendChild(cursorEffect);

    setTimeout(() => {
        cursorEffect.remove();
    }, 1000);
});

// Smooth Scroll
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        document.querySelector(this.getAttribute('href')).scrollIntoView({
            behavior: 'smooth'
        });
    });
});

// FAQ Toggle
document.querySelectorAll('.faq-item').forEach(item => {
    item.addEventListener('click', () => {
        item.classList.toggle('active');
    });
});

// Form Validation
document.getElementById('contact-form').addEventListener('submit', function (e) {
    e.preventDefault();
    alert('Děkujeme za vaši zprávu! Brzy vás budeme kontaktovat.');
});

document.querySelector('header .logo').addEventListener('click', function (e) {
    e.preventDefault(); // Zabránění výchozímu chování odkazu
    window.scrollTo({
        top: 0,
        behavior: 'smooth' // Hladký scroll
    });
});