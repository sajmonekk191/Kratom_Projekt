/**
 * Zentos.js v2 - JavaScript pro administrační systém Zentos
 * Zajišťuje kompletní funkcionalitu UI včetně správy objednávek, produktů a zákazníků
 */

document.addEventListener('DOMContentLoaded', function() {
    // ===== ZÁKLADNÍ KONFIGURACE =====
    
    // API URL - upravte podle nastavení vašeho serveru
    const API_URL = 'http://127.0.0.1:5000/api'; 
    let csrfToken = null;

    // Globální proměnné
    let currentUser = null;
    let selectedProducts = [];
    let orders = [];
    let products = [];
    let customers = [];
    let currentOrderForEdit = null; // Pro úpravu existující objednávky

    // Proměnné pro stránkování
    let currentPage = 1;
    let itemsPerPage = 12; // Počet položek na stránku
    let totalPages = 1;
    let allOrders = [];

    // ===== POMOCNÉ FUNKCE =====
    
    // Zobrazení notifikace
    function showNotification(message, type = 'success') {
        const notification = document.getElementById('notification');
        const messageEl = notification.querySelector('.toast-message');
        const icon = notification.querySelector('.toast-icon i');
        
        messageEl.textContent = message;
        notification.className = 'toast-notification';
        notification.classList.add(type);
        
        // Změna ikony podle typu notifikace
        icon.className = 'fas';
        if (type === 'success') icon.classList.add('fa-check-circle');
        else if (type === 'error') icon.classList.add('fa-times-circle');
        else if (type === 'warning') icon.classList.add('fa-exclamation-circle');
        
        notification.classList.add('show');
        
        // Přidání progress baru
        const progressBar = notification.querySelector('.toast-progress');
        if (progressBar) {
            progressBar.style.animation = 'none';
            // Trigger reflow
            void progressBar.offsetWidth;
            progressBar.style.animation = 'progress 3s linear forwards';
        }
        
        // Automatické skrytí po 3 sekundách
        setTimeout(() => {
            notification.classList.remove('show');
        }, 3000);
    }
    
    const importButton = document.getElementById('import-orders-btn');
    if (importButton) {
        importButton.addEventListener('click', function() {
          const modal = document.getElementById('import-modal');
          if (modal) {
            modal.classList.add('active');
          }
        });
    }
    
    // Zavření notifikace kliknutím na křížek
    document.querySelector('.toast-close').addEventListener('click', function() {
        document.getElementById('notification').classList.remove('show');
    });
    
    // Zobrazení/skrytí loader
    function toggleLoader(show) {
        const loader = document.querySelector('.loader-overlay');
        if (show) {
            loader.classList.add('show');
        } else {
            setTimeout(() => {
                loader.classList.remove('show');
            }, 300);
        }
    }
    
    // Formátování ceny (1250 -> 1 250 Kč)
    function formatPrice(price) {
        if (price === undefined || price === null) return '0 Kč';
        return parseFloat(price).toLocaleString('cs-CZ').replace(',', '.') + ' Kč';
    }
    
    // Formátování data (2023-04-15T14:30:00 -> 15.4.2023 14:30)
    function formatDate(dateString) {
        if (!dateString) return '';
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return dateString;
        
        return `${date.getDate()}.${date.getMonth() + 1}.${date.getFullYear()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    }
    
    // Získání HTML pro status objednávky s barevným označením
    function getStatusHTML(status) {
        const statusMap = {
            'new': { text: 'Nová', class: 'new' },
            'processing': { text: 'Zpracovává se', class: 'processing' },
            'shipped': { text: 'Odeslána', class: 'shipped' },
            'completed': { text: 'Dokončena', class: 'completed' },
            'cancelled': { text: 'Zrušena', class: 'cancelled' }
        };
        
        const statusInfo = statusMap[status] || { text: status || 'Neznámý', class: '' };
        return `<span class="status ${statusInfo.class}">${statusInfo.text}</span>`;
    }
    
    // Získání slovního popisu metody platby
    function getPaymentMethodText(method) {
        const methodMap = {
            'card': 'Online platba kartou',
            'bank': 'Bankovní převod',
            'cod': 'Dobírka'
        };
        
        return methodMap[method] || method || '';
    }
    
    // Získání slovního popisu metody dopravy
    function getShippingMethodText(method) {
        const methodMap = {
            'zasilkovna': 'Zásilkovna',
            'ppl': 'PPL',
            'express': 'Exkluzivní doručení',
            'personal': 'Osobní odběr'
        };
        
        return methodMap[method] || method || '';
    }
    
    // ===== API VOLÁNÍ =====
    
    // Obecná funkce pro API volání
    async function apiCall(endpoint, method = 'GET', data = null) {
        try {
            console.log(`Volám API: ${method} ${API_URL}${endpoint}`);
            
            const options = {
                method,
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                credentials: 'include'  // Důležité pro posílání cookies
            };
            
            // Pro POST, PUT, DELETE požadavky přidejte CSRF token, pokud existuje
            if (method !== 'GET' && csrfToken) {
                console.log("Přidávám CSRF token:", csrfToken);
                options.headers['X-CSRFToken'] = csrfToken;
            }
            
            if (data && (method === 'POST' || method === 'PUT' || method === 'DELETE')) {
                options.body = JSON.stringify(data);
            }
            
            console.log("Request options:", options);
            
            let response = await fetch(`${API_URL}${endpoint}`, options);
            
            // Pokud jde o deleteOrder nebo jiné neget požadavky a dostaneme 400 s CSRF chybou
            if ((method === 'DELETE' || method === 'PUT' || method === 'POST') && response.status === 400) {
                // Zjistíme, zda to je CSRF chyba (pokusíme se přečíst text)
                const errorText = await response.text();
                if (errorText.includes("CSRF") || errorText.includes("csrf")) {
                    console.log("CSRF chyba detekována, získávám nový token a zkouším znovu");
                    
                    // Získat nový CSRF token
                    const tokenResponse = await fetch(`${API_URL}/csrf-token`, {
                        method: 'GET',
                        headers: { 'Accept': 'application/json' },
                        credentials: 'include'
                    });
                    
                    if (tokenResponse.ok) {
                        const tokenData = await tokenResponse.json();
                        csrfToken = tokenData.csrfToken;
                        console.log("Získán nový CSRF token:", csrfToken);
                        
                        // Aktualizujeme options s novým tokenem
                        options.headers['X-CSRFToken'] = csrfToken;
                        
                        // Zkusíme požadavek znovu
                        console.log("Opakování požadavku s novým tokenem");
                        response = await fetch(`${API_URL}${endpoint}`, options);
                    }
                }
            }
            
            // Kontrola session - pokud dostaneme 401, zkusíme se znovu přihlásit
            if (response.status === 401) {
                console.log("Obdržel jsem status 401 - Unauthorized");
                
                // Zkusíme zkontrolovat session, pokud selže, přesměrujeme na přihlášení
                try {
                    const sessionCheck = await fetch(`${API_URL}/session-check`, {
                        method: 'GET',
                        headers: {
                            'Accept': 'application/json',
                            'Content-Type': 'application/json'
                        },
                        credentials: 'include'
                    });
                    
                    const sessionData = await sessionCheck.json();
                    
                    if (!sessionData.authenticated) {
                        showNotification('Vaše přihlášení vypršelo. Prosím, přihlaste se znovu.', 'error');
                        showLoginScreen();
                        return null;
                    }
                } catch (e) {
                    console.error("Chyba při kontrole session:", e);
                    showNotification('Nelze ověřit přihlášení. Prosím, přihlaste se znovu.', 'error');
                    showLoginScreen();
                    return null;
                }
            }
    
            // Kontrola, zda je odpověď ve formátu JSON
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                try {
                    // Pokud dostaneme HTML nebo text, pokusíme se to zpracovat jako JSON, případně vytvořit vlastní JSON objekt
                    const text = await response.text();
                    console.warn("Odpověď není JSON, ale:", text);
                    
                    // Pro DELETE požadavky, pokud je OK, ale není JSON, vytvořit vlastní JSON
                    if (response.ok && method === 'DELETE') {
                        console.log("Úspěšné smazání, vracím generický úspěch");
                        return {
                            status: 'success',
                            message: 'Operace byla úspěšně dokončena'
                        };
                    }
                    
                    console.error("Server nevrátil JSON odpověď:", text);
                    throw new Error(text || "Server nevrátil očekávanou JSON odpověď");
                } catch (e) {
                    throw new Error("Server nevrátil očekávanou JSON odpověď");
                }
            }
            
            const result = await response.json();
            
            if (!response.ok) {
                throw new Error(result.message || 'Chyba při komunikaci se serverem');
            }
            
            return result;
        } catch (error) {
            console.error('API Error:', error);
            if (error.message === 'Failed to fetch') {
                showNotification('Nelze se připojit k serveru. Zkontrolujte připojení.', 'error');
            } else {
                showNotification(error.message, 'error');
            }
            throw error;
        }
    }

    // Přidejte funkci pro získání CSRF tokenu
    async function getCsrfToken() {
        try {
            const response = await fetch(`${API_URL}/csrf-token`, {
                method: 'GET',
                credentials: 'include',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            csrfToken = data.csrfToken;
            console.log("CSRF token získán:", csrfToken);
            return csrfToken;
        } catch (error) {
            console.error('Nepodařilo se získat CSRF token:', error);
            throw error;
        }
    }
    
    // ===== AUTENTIZACE A SESSION =====
    
    // Přihlášení
    async function login(username, password) {
        try {
            toggleLoader(true);
            
            // Nejprve získáme CSRF token, pokud nemáme
            if (!csrfToken) {
                await getCsrfToken();
            }
            
            console.log("Přihlašuji s CSRF tokenem:", csrfToken);
            
            const result = await apiCall('/login', 'POST', { username, password });
            
            if (result && result.status === 'success') {
                currentUser = result.user;
                
                console.log("Přihlášení úspěšné, uživatel:", currentUser);
                
                // Kontrola, zda je přihlášení skutečně aktivní
                const sessionCheck = await apiCall('/session-check');
                if (!sessionCheck || !sessionCheck.authenticated) {
                    console.error("Session check selhal po přihlášení!");
                    showNotification('Problém s přihlášením. Zkuste to prosím znovu.', 'error');
                    return;
                }
                
                console.log("Session check po přihlášení OK:", sessionCheck);
                
                // Spustíme periodickou kontrolu session
                startSessionCheck();
                
                showAdminInterface();
                showNotification(result.message);
            }
        } catch (error) {
            console.error("Chyba při přihlašování:", error);
            // Error je již zpracován v apiCall
        } finally {
            toggleLoader(false);
        }
    }

    // Přidejte funkci pro periodickou kontrolu session
    let sessionCheckInterval;

    function startSessionCheck() {
        // Zrušíme existující interval, pokud existuje
        if (sessionCheckInterval) {
            clearInterval(sessionCheckInterval);
        }
        
        // Kontrolujeme session každé 2 minuty
        sessionCheckInterval = setInterval(async () => {
            try {
                const result = await apiCall('/session-check');
                if (result && !result.authenticated) {
                    // Session vypršela, přesměrujeme na login
                    clearInterval(sessionCheckInterval);
                    showNotification('Vaše přihlášení vypršelo. Prosím, přihlaste se znovu.', 'warning');
                    showLoginScreen();
                }
            } catch (error) {
                console.error('Chyba při kontrole session:', error);
            }
        }, 2 * 60 * 1000); // 2 minuty
    }
    
    // Odhlášení
    async function logout() {
        try {
            toggleLoader(true);
            
            // Zastavíme kontrolu session
            if (sessionCheckInterval) {
                clearInterval(sessionCheckInterval);
            }
            
            const result = await apiCall('/logout', 'POST');
            
            if (result.status === 'success') {
                currentUser = null;
                csrfToken = null;
                showLoginScreen();
                showNotification(result.message);
            }
        } catch (error) {
            // Error je již zpracován v apiCall
        } finally {
            toggleLoader(false);
        }
    }
    
    // Kontrola přihlášení uživatele
    async function checkSession() {
        try {
            toggleLoader(true);
            const result = await apiCall('/session-check');
            
            if (result.status === 'success' && result.authenticated) {
                currentUser = result.user;
                showAdminInterface();
            } else {
                showLoginScreen();
            }
        } catch (error) {
            showLoginScreen();
        } finally {
            toggleLoader(false);
        }
    }
    
    // ===== UI ZÁKLADNÍ FUNKCE =====
    
    // Zobrazení přihlašovací obrazovky
    function showLoginScreen() {
        document.getElementById('login-screen').classList.add('active');
        document.getElementById('admin-interface').style.display = 'none';
    }
    
    // Zobrazení administračního rozhraní
    function showAdminInterface() {
        document.getElementById('login-screen').classList.remove('active');
        document.getElementById('admin-interface').style.display = 'flex';
        
        // Načtení dat po přihlášení
        loadInitialData();
        
        // Nastavení jména přihlášeného uživatele
        if (currentUser) {
            document.querySelector('.admin-name').textContent = currentUser.name;
        }
    }
    
    // Přepínání mezi sekcemi v administraci
    function switchSection(sectionId) {
        console.log("Přepínám na sekci:", sectionId); // Pro debug
    
        // Aktualizace URL bez refreshe stránky
        history.pushState(null, null, `/admin/Zentos.html#${sectionId}`);
        
        // Skrytí všech sekcí
        document.querySelectorAll('.content-section').forEach(section => {
            section.classList.remove('active');
            section.style.display = 'none';
        });
        
        // Zobrazení vybrané sekce
        const selectedSection = document.getElementById(`${sectionId}-section`);
        if (selectedSection) {
            console.log("Našel jsem sekci:", selectedSection.id);
            selectedSection.classList.add('active');
            selectedSection.style.display = 'block';
        } else {
            console.error(`Sekce s ID '${sectionId}-section' nebyla nalezena!`);
            // Vypíšeme všechny dostupné sekce pro debug
            const availableSections = Array.from(document.querySelectorAll('.content-section')).map(s => s.id);
            console.log("Dostupné sekce:", availableSections);
        }
        
        // Aktualizace aktivního menu položky
        document.querySelectorAll('.sidebar-nav li, .sidebar-items li').forEach(item => {
            item.classList.remove('active');
        });
        
        // Zkusíme najít položku menu dvěma způsoby (podle různých možných struktur HTML)
        const menuItem = document.querySelector(`.sidebar-nav li[data-section="${sectionId}"], .sidebar-items li[data-section="${sectionId}"]`);
        if (menuItem) {
            menuItem.classList.add('active');
        } else {
            // Pokud nenajdeme podle data-section, zkusíme najít podle textu odkazu 
            // (méně spolehlivé, ale může pomoci při debugování)
            const links = document.querySelectorAll('.sidebar-nav a, .sidebar-items a');
            for (let link of links) {
                const text = link.textContent.trim().toLowerCase();
                if (text === sectionId.toLowerCase() || 
                    (sectionId === 'orders' && text.includes('objednávk')) ||
                    (sectionId === 'products' && text.includes('produkt')) ||
                    (sectionId === 'customers' && text.includes('zákazní')) ||
                    (sectionId === 'statistics' && text.includes('statist')) ||
                    (sectionId === 'settings' && text.includes('nastav'))) {
                    link.closest('li').classList.add('active');
                    break;
                }
            }
        }
        
        // Načtení dat pro danou sekci
        try {
            if (sectionId === 'orders') {
                if (typeof loadOrdersData === 'function') {
                    // Rozšířená inicializace pro sekci objednávek
                    initOrdersSection();
                }
            } else if (sectionId === 'products') {
                if (typeof loadProductsData === 'function') loadProductsData();
            } else if (sectionId === 'customers') {
                if (typeof loadCustomersData === 'function') loadCustomersData();
            } else if (sectionId === 'statistics') {
                if (typeof loadStatisticsData === 'function') loadStatisticsData();
            } else if (sectionId === 'settings') {
                if (typeof loadSettingsData === 'function') loadSettingsData();
            }
        } catch (e) {
            console.error("Chyba při načítání dat sekce:", e);
        }
        
        // Scrollování na začátek stránky
        window.scrollTo(0, 0);
    }
    
    // Načtení všech dat po přihlášení
    async function loadInitialData() {
        try {
            await Promise.all([
                fetchProducts(),
                fetchCustomers()
            ]);
            
            // Defaultní přepnutí na sekci objednávek
            switchSection('orders');
        } catch (error) {
            console.error('Error loading initial data:', error);
        }
    }
    
    // ===== MODÁLNÍ OKNA =====
    
    // Otevření modálního okna
    function openModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('active');
        } else {
            console.error(`Modální okno s ID "${modalId}" nebylo nalezeno!`);
        }
    }
    
    // Zavření modálního okna
    function closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('active');
        }
    }
    
    // Zavření všech modálních oken
    function closeAllModals() {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.classList.remove('active');
        });
    }
    
    // Nastavení event listenerů pro modální okna
    function setupModalListeners() {
        // Zavření modálního okna kliknutím na křížek nebo tlačítko zrušit
        document.querySelectorAll('.modal-close, .modal-cancel').forEach(btn => {
            btn.addEventListener('click', function() {
                const modal = this.closest('.modal');
                if (modal) {
                    modal.classList.remove('active');
                }
            });
        });
        
        // Kliknutí mimo modální okno ho zavře
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', function(e) {
                if (e.target === this) {
                    this.classList.remove('active');
                }
            });
        });
    }

    // ===== SEKCE OBJEDNÁVEK =====
    
    // Globální proměnná pro sledování stavu filtru
    let isFilterActive = false;
    let currentFilterType = 'all';
    let originalOrderCounts = null;

    // Výpočet celkové ceny objednávky
    function calculateOrderTotal() {
        if (selectedProducts.length === 0) return { subtotal: 0, total: 0 };
        
        // Výpočet mezisoučtu
        const subtotal = selectedProducts.reduce((sum, product) => sum + product.total, 0);
        
        // Získání ceny dopravy
        const shippingMethod = document.querySelector('input[name="shipping"]:checked').value;
        let shippingPrice = 0;
        
        switch (shippingMethod) {
            case 'zasilkovna':
                shippingPrice = 79;
                break;
            case 'ppl':
                shippingPrice = 89;
                break;
            case 'express':
                shippingPrice = 149;
                break;
            case 'personal':
                shippingPrice = 0;
                break;
        }
        
        // Získání ceny platby
        const paymentMethod = document.querySelector('input[name="payment"]:checked').value;
        let paymentPrice = 0;
        
        if (paymentMethod === 'cod') {
            paymentPrice = 39;
        }
        
        // Výpočet celkové ceny
        const total = subtotal + shippingPrice + paymentPrice;
        
        // Aktualizace zobrazení
        document.getElementById('products-subtotal').textContent = formatPrice(subtotal);
        document.getElementById('order-subtotal').textContent = formatPrice(subtotal);
        document.getElementById('order-shipping').textContent = formatPrice(shippingPrice);
        document.getElementById('order-payment').textContent = formatPrice(paymentPrice);
        document.getElementById('order-total').textContent = formatPrice(total);
        
        return {
            subtotal,
            shippingPrice,
            paymentPrice,
            total,
            shippingMethod,
            paymentMethod
        };
    }
    
    // Aktualizace seznamu vybraných produktů
    function updateSelectedProductsList() {
        const productsList = document.getElementById('selected-products-list');
        productsList.innerHTML = '';
        
        if (selectedProducts.length === 0) {
            productsList.innerHTML = '<tr><td colspan="6" class="empty-list">Žádné produkty nebyly vybrány</td></tr>';
            calculateOrderTotal();
            return;
        }
        
        selectedProducts.forEach((product, index) => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${product.name}</td>
                <td>${product.variant}</td>
                <td>${formatPrice(product.price)}</td>
                <td>
                    <div class="quantity-control">
                        <button type="button" class="qty-btn minus" data-index="${index}">
                            <i class="fas fa-minus"></i>
                        </button>
                        <input type="number" class="quantity" value="${product.quantity}" min="1" data-index="${index}">
                        <button type="button" class="qty-btn plus" data-index="${index}">
                            <i class="fas fa-plus"></i>
                        </button>
                    </div>
                </td>
                <td>${formatPrice(product.total)}</td>
                <td>
                    <button type="button" class="table-action-btn delete" data-index="${index}">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </td>
            `;
            
            productsList.appendChild(row);
        });
        
        // Přidání event listenerů pro tlačítka množství
        document.querySelectorAll('#selected-products-list .qty-btn.minus').forEach(btn => {
            btn.addEventListener('click', function() {
                const index = parseInt(this.getAttribute('data-index'));
                if (selectedProducts[index].quantity > 1) {
                    selectedProducts[index].quantity--;
                    selectedProducts[index].total = selectedProducts[index].price * selectedProducts[index].quantity;
                    updateSelectedProductsList();
                }
            });
        });
        
        document.querySelectorAll('#selected-products-list .qty-btn.plus').forEach(btn => {
            btn.addEventListener('click', function() {
                const index = parseInt(this.getAttribute('data-index'));
                selectedProducts[index].quantity++;
                selectedProducts[index].total = selectedProducts[index].price * selectedProducts[index].quantity;
                updateSelectedProductsList();
            });
        });
        
        document.querySelectorAll('#selected-products-list input.quantity').forEach(input => {
            input.addEventListener('change', function() {
                const index = parseInt(this.getAttribute('data-index'));
                const newQuantity = parseInt(this.value);
                
                if (newQuantity < 1) {
                    this.value = 1;
                    selectedProducts[index].quantity = 1;
                } else {
                    selectedProducts[index].quantity = newQuantity;
                }
                
                selectedProducts[index].total = selectedProducts[index].price * selectedProducts[index].quantity;
                updateSelectedProductsList();
            });
        });
        
        // Přidání event listenerů pro tlačítka smazání
        document.querySelectorAll('#selected-products-list .table-action-btn.delete').forEach(btn => {
            btn.addEventListener('click', function() {
                const index = parseInt(this.getAttribute('data-index'));
                selectedProducts.splice(index, 1);
                updateSelectedProductsList();
            });
        });
        
        // Aktualizace celkové ceny
        calculateOrderTotal();
    }
    
    // Načtení všech objednávek
    async function fetchOrders(filters = {}) {
        try {
            toggleLoader(true);
            
            // Sestavení query parametrů pro filtrování
            const queryParams = new URLSearchParams();
            
            if (filters.status && filters.status !== 'all') {
                queryParams.append('status', filters.status);
            }
            
            if (filters.sortBy) {
                queryParams.append('sort_by', filters.sortBy);
            }
            
            if (filters.dateFrom) {
                queryParams.append('date_from', filters.dateFrom);
            }
            
            if (filters.dateTo) {
                queryParams.append('date_to', filters.dateTo);
            }
            
            const endpoint = `/orders${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
            const result = await apiCall(endpoint);
            
            if (result.status === 'success') {
                orders = result.orders;
                return orders;
            }
        } catch (error) {
            // Error je již zpracován v apiCall
            return [];
        } finally {
            toggleLoader(false);
        }
    }
    
    // Vytvoření nové objednávky
    async function createOrder(orderData) {
        try {
            toggleLoader(true);
            const result = await apiCall('/orders', 'POST', orderData);
            
            if (result.status === 'success') {
                showNotification(result.message);
                closeModal('order-modal');
                
                // Aktualizace dat a počítadel po vytvoření objednávky
                await afterOrderChange();
                
                return result.order;
            }
        } catch (error) {
            // Error je již zpracován v apiCall
            return null;
        } finally {
            toggleLoader(false);
        }
    }
    
    // Aktualizace objednávky
    async function updateOrder(orderNumber, orderData) {
        try {
            toggleLoader(true);
            
            // Zajištění, že data obsahují všechny potřebné informace včetně zákazníka
            if (!orderData.customer && currentOrderForEdit) {
                // Pokud chybí data zákazníka, ale máme data z editované objednávky
                orderData.customer = {
                    name: document.getElementById('customer-name').value,
                    email: document.getElementById('customer-email').value,
                    phone: document.getElementById('customer-phone').value,
                    address: document.getElementById('customer-address').value,
                    city: document.getElementById('customer-city').value,
                    zip: document.getElementById('customer-zip').value,
                    country: document.getElementById('customer-country').value
                };
            }
            
            const result = await apiCall(`/orders/${orderNumber}`, 'PUT', orderData);
            
            if (result.status === 'success') {
                showNotification(result.message);
                await loadOrdersData(); // Obnovení tabulky objednávek
                return result.order;
            }
        } catch (error) {
            console.error('Chyba při aktualizaci objednávky:', error);
            showNotification('Nepodařilo se aktualizovat objednávku: ' + (error.message || 'Neznámá chyba'), 'error');
            return null;
        } finally {
            toggleLoader(false);
        }
    }
    
    // Načtení detailu objednávky
    async function fetchOrderDetail(orderNumber) {
        try {
            toggleLoader(true);
            const result = await apiCall(`/orders/${orderNumber}`);
            
            if (result.status === 'success') {
                return result.order;
            }
        } catch (error) {
            // Error je již zpracován v apiCall
            return null;
        } finally {
            toggleLoader(false);
        }
    }
    
    // Smazání objednávky
    async function deleteOrder(orderNumber) {
        try {
            toggleLoader(true);
            
            // Ověříme session před smazáním
            const sessionResult = await apiCall('/session-check');
            if (!sessionResult || !sessionResult.authenticated) {
                showNotification('Vaše přihlášení vypršelo. Prosím, přihlaste se znovu.', 'error');
                showLoginScreen();
                return false;
            }
            
            const result = await apiCall(`/orders/${orderNumber}`, 'DELETE');
            
            if (result.status === 'success') {
                showNotification(result.message);
                
                // Aktualizace dat a počítadel po smazání objednávky
                await afterOrderChange();
                
                return true;
            }
        } catch (error) {
            // Error je již zpracován v apiCall
            return false;
        } finally {
            toggleLoader(false);
        }
    }
    
    // Vytvoření faktury pro objednávku
    async function createInvoice(orderNumber) {
        try {
            toggleLoader(true);
            
            // Ověříme session před vytvořením faktury
            const sessionResult = await apiCall('/session-check');
            if (!sessionResult || !sessionResult.authenticated) {
                showNotification('Vaše přihlášení vypršelo. Prosím, přihlaste se znovu.', 'error');
                showLoginScreen();
                return null;
            }
            
            const result = await apiCall(`/invoices/${orderNumber}`, 'POST');
            
            if (result.status === 'success') {
                showNotification(result.message);
                return result.invoice;
            }
        } catch (error) {
            // Error je již zpracován v apiCall
            return null;
        } finally {
            toggleLoader(false);
        }
    }
    
    // Aktualizace po změně objednávek (přidání, úprava, smazání)
    async function afterOrderChange() {
        // Načtení všech objednávek pro aktualizaci počtů
        const allOrdersData = await fetchOrders();
        
        if (allOrdersData) {
            // Uložení původního filtru
            const currentFilterStatus = currentFilterType;
            
            // Dočasné vypnutí filtru pro aktualizaci počítadel
            const wasFilterActive = isFilterActive;
            isFilterActive = false;
            
            // Aktualizace všech objednávek
            allOrders = allOrdersData;
            
            // Aktualizace počtů ve filtračních tlačítkách
            calculateOrderCounts();
            
            // Obnovení stavu filtru
            isFilterActive = wasFilterActive;
            
            // Znovu aplikujeme aktuální filtr, pokud nějaký byl
            if (currentFilterStatus !== 'all') {
                await loadOrdersData({ status: currentFilterStatus });
            } else {
                // Pokud nebyl filtr, pouze překreslíme tabulku s aktuálními daty
                showOrdersPage(currentPage);
            }
        }
    }
    
    // Výpočet počtů objednávek pro filtry
    function calculateOrderCounts() {
        if (!allOrders) return;
        
        // Celkový počet všech objednávek
        const totalCount = allOrders.length;
        
        // Počty podle stavů
        const newCount = allOrders.filter(order => order.status === 'new').length;
        const processingCount = allOrders.filter(order => order.status === 'processing').length;
        const shippedCount = allOrders.filter(order => order.status === 'shipped').length;
        const completedCount = allOrders.filter(order => order.status === 'completed').length;
        const cancelledCount = allOrders.filter(order => order.status === 'cancelled').length;
        
        // Uložení hodnot do objektu
        originalOrderCounts = {
            all: totalCount,
            new: newCount,
            processing: processingCount,
            shipped: shippedCount,
            completed: completedCount,
            cancelled: cancelledCount
        };
        
        // Aktualizace zobrazení počtů ve filtračních tlačítkách
        updateStatusFilterCounts();
    }

    // Načtení dat pro sekci objednávek
    async function loadOrdersData(filters = {}) {
        try {
            const fetchedOrders = await fetchOrders(filters);
            
            if (fetchedOrders) {
                allOrders = fetchedOrders;
                
                // Při prvním načtení vypočítáme počty objednávek
                if (!originalOrderCounts && !filters.status) {
                    calculateOrderCounts();
                }
                
                // Výpočet celkového počtu stránek
                totalPages = Math.ceil(allOrders.length / itemsPerPage);
                
                // Zobrazení první stránky, nebo reset na první stránku pokud aktuální je mimo rozsah
                if (currentPage > totalPages) {
                    currentPage = 1;
                }
                
                // Zobrazení objednávek pro aktuální stránku
                showOrdersPage(currentPage);
                
                // Aktualizace počtu objednávek ve status filtrech - vždy ukazuje původní hodnoty
                updateStatusFilterCounts();
                
                // Inicializace statistik
                initOrderStats();
            }
        } catch (error) {
            console.error("Chyba při načítání objednávek:", error);
            showNotification("Nepodařilo se načíst objednávky.", "error");
        }
    }

    // Aktualizace počtů ve filtračních tlačítkách
    function updateStatusFilterCounts() {
        if (!originalOrderCounts) return;
        
        // Aktualizace počtů ve všech tlačítkách podle uložených hodnot
        const allFilter = document.querySelector('.status-filter[data-filter="all"] .filter-count');
        const newFilter = document.querySelector('.status-filter[data-filter="new"] .filter-count');
        const processingFilter = document.querySelector('.status-filter[data-filter="processing"] .filter-count');
        const shippedFilter = document.querySelector('.status-filter[data-filter="shipped"] .filter-count');
        const completedFilter = document.querySelector('.status-filter[data-filter="completed"] .filter-count');
        const cancelledFilter = document.querySelector('.status-filter[data-filter="cancelled"] .filter-count');
        
        if (allFilter) allFilter.textContent = originalOrderCounts.all;
        if (newFilter) newFilter.textContent = originalOrderCounts.new;
        if (processingFilter) processingFilter.textContent = originalOrderCounts.processing;
        if (shippedFilter) shippedFilter.textContent = originalOrderCounts.shipped;
        if (completedFilter) completedFilter.textContent = originalOrderCounts.completed;
        if (cancelledFilter) cancelledFilter.textContent = originalOrderCounts.cancelled;
    }

    // Inicializace sekce objednávek
    function initOrdersSection() {
        // Nastavení status filtrů
        setupStatusFilters();
        
        // Nastavení hromadných akcí
        setupBulkActions();
        
        // Načtení dat
        loadOrdersData();
    }

    // Funkce pro zobrazení konkrétní stránky objednávek
    function showOrdersPage(page) {
        // Validace stránky
        if (page < 1) page = 1;
        if (page > totalPages) page = totalPages;
        
        currentPage = page;
        
        // Výpočet rozsahu objednávek pro aktuální stránku
        const startIndex = (page - 1) * itemsPerPage;
        const endIndex = Math.min(startIndex + itemsPerPage, allOrders.length);
        
        // Získání objednávek pro aktuální stránku
        const ordersToShow = allOrders.slice(startIndex, endIndex);
        
        // Vykreslení objednávek pro aktuální stránku
        renderOrdersTable(ordersToShow);
        
        // Aktualizace stránkování
        updatePagination();
    }

    // Aktualizace aktivní stránky v paginaci
    function updatePagination() {
        const pagination = document.querySelector('.pagination');
        const paginationNumbers = document.querySelector('.pagination-numbers');
        
        // Skrytí stránkování, pokud je jen jedna stránka
        if (totalPages <= 1) {
            pagination.style.display = 'none';
            return;
        }
        
        // Zobrazení stránkování, pokud je více stránek
        pagination.style.display = 'flex';
        
        // Vyčištění stávajících čísel stránek
        paginationNumbers.innerHTML = '';
        
        // Určení, které stránky zobrazit
        // Zobrazíme maximálně 5 stránek kolem aktuální stránky
        const maxVisiblePages = 5;
        let startPage, endPage;
        
        if (totalPages <= maxVisiblePages) {
            // Pokud je stránek méně než maximum, zobrazíme všechny
            startPage = 1;
            endPage = totalPages;
        } else {
            // Jinak zobrazíme stránky kolem aktuální
            if (currentPage <= Math.floor(maxVisiblePages / 2) + 1) {
                startPage = 1;
                endPage = maxVisiblePages;
            } else if (currentPage >= totalPages - Math.floor(maxVisiblePages / 2)) {
                startPage = totalPages - maxVisiblePages + 1;
                endPage = totalPages;
            } else {
                startPage = currentPage - Math.floor(maxVisiblePages / 2);
                endPage = currentPage + Math.floor(maxVisiblePages / 2);
            }
        }
        
        // Vytvoření tlačítek pro jednotlivé stránky
        for (let i = startPage; i <= endPage; i++) {
            const pageButton = document.createElement('button');
            pageButton.className = 'pagination-number';
            if (i === currentPage) {
                pageButton.classList.add('active');
            }
            pageButton.textContent = i;
            pageButton.addEventListener('click', () => showOrdersPage(i));
            paginationNumbers.appendChild(pageButton);
        }
        
        // Přidání tlačítka "..." a poslední stránky, pokud je potřeba
        if (endPage < totalPages) {
            const ellipsis = document.createElement('span');
            ellipsis.className = 'pagination-ellipsis';
            ellipsis.textContent = '...';
            paginationNumbers.appendChild(ellipsis);
            
            const lastPageButton = document.createElement('button');
            lastPageButton.className = 'pagination-number';
            lastPageButton.textContent = totalPages;
            lastPageButton.addEventListener('click', () => showOrdersPage(totalPages));
            paginationNumbers.appendChild(lastPageButton);
        }
        
        // Přidání tlačítka "..." a první stránky, pokud je potřeba
        if (startPage > 1) {
            const firstPageButton = document.createElement('button');
            firstPageButton.className = 'pagination-number';
            firstPageButton.textContent = '1';
            firstPageButton.addEventListener('click', () => showOrdersPage(1));
            
            const ellipsis = document.createElement('span');
            ellipsis.className = 'pagination-ellipsis';
            ellipsis.textContent = '...';
            
            paginationNumbers.insertBefore(ellipsis, paginationNumbers.firstChild);
            paginationNumbers.insertBefore(firstPageButton, paginationNumbers.firstChild);
        }
        
        // Aktualizace tlačítek pro předchozí/další stránku
        const prevButton = document.querySelector('.pagination-btn[data-page="prev"]');
        const nextButton = document.querySelector('.pagination-btn[data-page="next"]');
        
        // Odstranění existujících event listenerů
        const newPrevButton = prevButton.cloneNode(true);
        const newNextButton = nextButton.cloneNode(true);
        prevButton.parentNode.replaceChild(newPrevButton, prevButton);
        nextButton.parentNode.replaceChild(newNextButton, nextButton);
        
        // Přidání nových event listenerů
        newPrevButton.addEventListener('click', () => {
            if (currentPage > 1) {
                showOrdersPage(currentPage - 1);
            }
        });
        
        newNextButton.addEventListener('click', () => {
            if (currentPage < totalPages) {
                showOrdersPage(currentPage + 1);
            }
        });
        
        // Aktualizace stavu tlačítek (aktivní/neaktivní)
        if (currentPage === 1) {
            newPrevButton.classList.add('disabled');
        } else {
            newPrevButton.classList.remove('disabled');
        }
        
        if (currentPage === totalPages) {
            newNextButton.classList.add('disabled');
        } else {
            newNextButton.classList.remove('disabled');
        }
    }
    
    // Vykreslení tabulky objednávek
    function renderOrdersTable(orders) {
        const tableBody = document.getElementById('orders-table-body');
        tableBody.innerHTML = '';
        
        const pagination = document.querySelector('.pagination');
        
        if (!orders || orders.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="9" class="empty-table">Nebyly nalezeny žádné objednávky</td>
                </tr>
            `;
            // Skrytí stránkování, když nejsou žádné objednávky
            pagination.style.display = 'none';
            return;
        }
        
        orders.forEach(order => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td class="checkbox-cell">
                    <input type="checkbox" class="order-checkbox" data-id="${order.id}">
                </td>
                <td>${order.order_number}</td>
                <td>${order.customer_name}</td>
                <td>${order.items ? order.items.length : 0} produktů</td>
                <td>${formatDate(order.created_at)}</td>
                <td>${formatPrice(order.total)}</td>
                <td>${getStatusHTML(order.status)}</td>
                <td>${getShippingMethodText(order.shipping_method)}</td>
                <td class="actions-cell">
                    <button class="table-action-btn view" data-order="${order.order_number}" title="Zobrazit detail">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="table-action-btn edit" data-order="${order.order_number}" title="Upravit">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="table-action-btn delete" data-order="${order.order_number}" title="Smazat">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </td>
            `;
            
            tableBody.appendChild(row);
        });
        
        // Přidání event listenerů pro akce
        addOrderActionListeners();
    }
    
    // Přidání event listenerů pro tlačítka akcí u objednávek
    function addOrderActionListeners() {
        // Tlačítko pro zobrazení detailu objednávky
        document.querySelectorAll('.table-action-btn.view').forEach(btn => {
            btn.addEventListener('click', function() {
                const orderNumber = this.getAttribute('data-order');
                showOrderDetail(orderNumber);
            });
        });
        
        // Tlačítko pro úpravu objednávky
        document.querySelectorAll('.table-action-btn.edit').forEach(btn => {
            btn.addEventListener('click', function() {
                const orderNumber = this.getAttribute('data-order');
                editOrder(orderNumber);
            });
        });
        
        // Tlačítko pro smazání objednávky
        document.querySelectorAll('.table-action-btn.delete').forEach(btn => {
            btn.addEventListener('click', function() {
                const orderNumber = this.getAttribute('data-order');
                confirmDeleteOrder(orderNumber);
            });
        });
    }

    // Přidání eventListeneru pro tlačítko Export
    document.getElementById('export-orders-btn').addEventListener('click', function() {
        // Získání všech vybraných objednávek (označených checkboxem)
        const checkboxes = document.querySelectorAll('.order-checkbox:checked');
        const selectedOrders = Array.from(checkboxes).map(checkbox => checkbox.getAttribute('data-id'));
        
        if (selectedOrders.length === 0) {
            // Pokud nejsou vybrány žádné objednávky, exportujeme všechny viditelné
            if (confirm('Nejsou vybrány žádné objednávky. Chcete exportovat všechny objednávky?')) {
                // Získáme aktuální filtry, pokud existují
                const filters = {};
                
                // Získání aktivního filtru statusu
                const activeStatusFilter = document.querySelector('.status-filter.active');
                if (activeStatusFilter) {
                    filters.status = activeStatusFilter.getAttribute('data-filter');
                }
                
                // Získání dalších filtrů, pokud jsou aktivní
                const dateFrom = document.getElementById('date-from')?.value;
                const dateTo = document.getElementById('date-to')?.value;
                
                if (dateFrom) filters.date_from = dateFrom;
                if (dateTo) filters.date_to = dateTo;
                
                exportAllOrders(filters);
            }
        } else {
            // Exportujeme jen vybrané objednávky
            exportSelectedOrders(selectedOrders);
        }
    });

    /**
    * Export vybraných objednávek
    * @param {Array} orderIds - Pole ID objednávek k exportu
    */
    function exportSelectedOrders(orderIds) {
        // Zobrazení loaderu
        toggleLoader(true);
        
        // Sestavení URL pro export s ID objednávek
        let url = `${API_URL}/export/orders?order_ids=${orderIds.join(',')}`;
        
        // Spuštění stahování
        downloadCSV(url);
    }

    /**
    * Export všech objednávek s filtry
    * @param {Object} filters - Objekt s filtry pro export
    */
    function exportAllOrders(filters = {}) {
        // Zobrazení loaderu
        toggleLoader(true);
        
        // Sestavení URL pro export s případnými filtry
        let url = `${API_URL}/export/orders`;
        
        // Přidání filtrů, pokud existují
        const params = new URLSearchParams();
        
        if (filters.status && filters.status !== 'all') {
            params.append('status', filters.status);
        }
        
        if (filters.date_from) {
            params.append('date_from', filters.date_from);
        }
        
        if (filters.date_to) {
            params.append('date_to', filters.date_to);
        }
        
        // Přidání parametrů do URL
        if (params.toString()) {
            url += '?' + params.toString();
        }
        
        // Spuštění stahování
        downloadCSV(url);
    }

    /**
    * Pomocná funkce pro stažení CSV pomocí skrytého iframe
    * @param {string} url - URL pro stažení
    */
    function downloadCSV(url) {
        // Vytvoření skrytého iframe pro stažení souboru
        const downloadFrame = document.createElement('iframe');
        downloadFrame.style.display = 'none';
        document.body.appendChild(downloadFrame);
        
        // Nastavení URL pro stažení
        downloadFrame.src = url;
        
        // Odstranění iframe po chvíli
        setTimeout(() => {
            downloadFrame.remove();
            toggleLoader(false);
            showNotification('Export byl úspěšně zahájen', 'success');
        }, 1000);
    }

    // Zobrazení detailu objednávky
    async function showOrderDetail(orderNumber) {
        const order = await fetchOrderDetail(orderNumber);
        
        if (!order) return;
        
        // Naplnění modalu daty
        document.getElementById('detail-order-id').textContent = order.order_number;
        document.getElementById('detail-created').textContent = formatDate(order.created_at);
        document.getElementById('detail-status').value = order.status;
        document.getElementById('detail-payment').textContent = getPaymentMethodText(order.payment_method);
        document.getElementById('detail-shipping').textContent = getShippingMethodText(order.shipping_method);
        
        document.getElementById('detail-customer-name').textContent = order.customer_name;
        document.getElementById('detail-customer-email').textContent = order.customer_email;
        document.getElementById('detail-customer-phone').textContent = order.customer_phone || '-';
        document.getElementById('detail-customer-address').textContent = `${order.customer_address || ''}, ${order.customer_city || ''}, ${order.customer_zip || ''}`;
        if (order.shipping_method === 'zasilkovna') {
            loadZasilkovnaBranchInfo(order.order_number, document.getElementById('detail-shipping'));
        }
        
        // Naplnění položek objednávky
        const productsList = document.getElementById('detail-products-list');
        productsList.innerHTML = '';
        
        order.items.forEach(item => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${item.name}</td>
                <td>${item.variant}</td>
                <td>${formatPrice(item.price)}</td>
                <td>${item.quantity}</td>
                <td>${formatPrice(item.total)}</td>
            `;
            productsList.appendChild(row);
        });
        
        // Naplnění souhrnných informací
        document.getElementById('detail-subtotal').textContent = formatPrice(order.subtotal);
        document.getElementById('detail-shipping-cost').textContent = formatPrice(order.shipping_price);
        document.getElementById('detail-payment-cost').textContent = formatPrice(order.payment_price);
        document.getElementById('detail-total').textContent = formatPrice(order.total);
        
        // Naplnění poznámek
        setupOrderDetailNotes(order);
        
        // Ošetření zobrazení tlačítka pro fakturu
        const generateInvoiceBtn = document.getElementById('generate-invoice');
        const viewInvoiceBtn = document.getElementById('view-invoice');
        
        if (order.invoice) {
            // Pokud objednávka už má fakturu, skryjeme tlačítko "Vytvořit fakturu" a zobrazíme "Zobrazit fakturu"
            generateInvoiceBtn.style.display = 'none';
            viewInvoiceBtn.style.display = 'inline-flex';
            viewInvoiceBtn.setAttribute('data-invoice', order.invoice.invoice_number);
        } else {
            // Pokud objednávka nemá fakturu, zobrazíme tlačítko "Vytvořit fakturu" a skryjeme "Zobrazit fakturu"
            generateInvoiceBtn.style.display = 'inline-flex';
            viewInvoiceBtn.style.display = 'none';
        }
        
        // Otevření modalu
        openModal('order-detail-modal');
        
        // Přidání event listenerů pro tlačítka v modalu
        setupOrderDetailButtons(order);
        
        // Inicializace záložek poznámek
        setupNoteTabs();
    }

    // Funkce pro načtení informací o pobočce Zásilkovny
    async function loadZasilkovnaBranchInfo(orderNumber, orderElement) {
        try {
            // Načtení informací o objednávce včetně detailů Zásilkovny
            const result = await apiCall(`/orders/${orderNumber}/shipping-details`, 'GET');
            
            if (result && result.status === 'success' && result.branch) {
                // Získání reference na element pro zobrazení informací o dopravě
                const shippingInfoElement = document.getElementById('detail-shipping');
                
                if (shippingInfoElement) {
                    // Aktualizace textu s informacemi o pobočce
                    shippingInfoElement.innerHTML = `Zásilkovna - <span class="branch-details">${result.branch.name} (ID: ${result.branch.id})</span>`;
                    
                    // Pro lepší UX můžeme přidat tooltip s plnou adresou
                    if (result.branch.address) {
                        shippingInfoElement.setAttribute('title', result.branch.address);
                        shippingInfoElement.style.cursor = 'help';
                    }
                }
            }
        } catch (error) {
            console.error("Chyba při načítání informací o pobočce Zásilkovny:", error);
        }
    }

    // Funkce pro automatickou aktualizaci statusu objednávky při změně v selectu
    function setupAutoUpdateStatus(order) {
        const statusSelect = document.getElementById('detail-status');
        if (!statusSelect) return;
        
        // Uložíme původní hodnotu
        const originalValue = statusSelect.value;
        
        // Odstraníme existující event listenery (aby se nepřidávaly duplicitně)
        const newStatusSelect = statusSelect.cloneNode(true);
        statusSelect.parentNode.replaceChild(newStatusSelect, statusSelect);
        
        // Přidáme event listener pro změnu hodnoty
        newStatusSelect.addEventListener('change', async function() {
            const orderNumber = document.getElementById('detail-order-id').textContent;
            const newStatus = this.value;
            
            // Můžeme přidat vizuální indikátor, že aktualizace probíhá
            const customSelect = this.closest('.custom-select');
            if (customSelect) {
                customSelect.classList.add('updating');
            }
            
            try {
                toggleLoader(true);
                
                // Volání API pro aktualizaci statusu
                const result = await apiCall(`/orders/${orderNumber}`, 'PUT', { status: newStatus });
                
                if (result && result.status === 'success') {
                    showNotification(`Status objednávky byl změněn na ${getStatusHTML(newStatus).replace(/<[^>]*>/g, '')}`, 'success');
                    
                    // Aktualizace dat v objednávkách (pokud jsou viditelné v tabulce)
                    await afterOrderChange();
                } else {
                    // V případě chyby vrátíme původní hodnotu
                    this.value = originalValue;
                    showNotification('Nepodařilo se změnit status objednávky', 'error');
                }
            } catch (error) {
                console.error('Chyba při aktualizaci statusu:', error);
                // V případě chyby vrátíme původní hodnotu
                this.value = originalValue;
                showNotification('Nepodařilo se změnit status objednávky', 'error');
            } finally {
                toggleLoader(false);
                // Odstranění indikátoru načítání
                if (customSelect) {
                    customSelect.classList.remove('updating');
                }
            }
        });
    }

    /**
    * Inicializace funkcionality importu objednávek
    */
    function initOrdersImport() {
        console.log('Inicializuji import objednávek...');
        
        // Přidání event listeneru pro otevření modálního okna importu
        const importButton = document.getElementById('import-orders-btn');
        if (importButton) {
            console.log('Import tlačítko nalezeno');
            
            // Odstranění všech stávajících listenerů (velmi důležité!)
            importButton.onclick = null;
            const newImportButton = importButton.cloneNode(true);
            importButton.parentNode.replaceChild(newImportButton, importButton);
            
            // Přidání nového listeneru
            newImportButton.onclick = function(e) {
                e.preventDefault();
                console.log('Kliknuto na import tlačítko');
                const modal = document.getElementById('import-modal');
                if (modal) {
                    modal.classList.add('active');
                    // Nastavit modal až když je otevřený
                    setTimeout(setupImportModal, 100);
                } else {
                    console.error('Import modal nenalezen!');
                }
            };
        } else {
            console.error('Import tlačítko nenalezeno!');
        }
        
        // Zavření modálu
        const closeButtons = document.querySelectorAll('#import-modal .modal-close, #import-modal .modal-cancel');
        closeButtons.forEach(btn => {
            btn.onclick = function() {
                const modal = document.getElementById('import-modal');
                if (modal) modal.classList.remove('active');
            };
        });
        
        // Kliknutí mimo modální okno ho zavře
        const modal = document.getElementById('import-modal');
        if (modal) {
            modal.onclick = function(e) {
                if (e.target === this) {
                    this.classList.remove('active');
                }
            };
        }
        
        console.log('Inicializace importu objednávek dokončena');
    }

    /**
    * Nastavení modálního okna pro import
    */
    function setupImportModal() {
        console.log('Nastavuji modál importu...');
        
        // Získání referencí na všechny elementy
        const modal = document.getElementById('import-modal');
        const fileInput = document.getElementById('import-file-input');
        const selectBtn = document.getElementById('select-file-btn');
        const dropArea = document.getElementById('drop-area');
        const selectedFileInfo = document.getElementById('selected-file-info');
        const selectedFileName = document.getElementById('selected-file-name');
        const importBtn = document.getElementById('start-import-btn');
        const removeBtn = document.getElementById('remove-file-btn');
        const closeBtn = modal?.querySelector('.modal-close');
        const cancelBtn = modal?.querySelector('.modal-cancel');
        
        // Kontrola, zda elementy existují
        if (!fileInput || !selectBtn || !dropArea || !importBtn) {
            console.log('Elementy pro import nenalezeny - import nebude fungovat');
            return;
        }
        
        // Reset stavu
        fileInput.value = '';
        selectedFileInfo.style.display = 'none';
        importBtn.disabled = true;
        dropArea.style.display = 'flex';
        
        // 1. Oprava tlačítka pro výběr souboru - přímý přístup
        selectBtn.onclick = function(e) {
            e.stopPropagation();
            console.log('Kliknuto na Vybrat soubor');
            fileInput.click();
        };
        
        // 2. Zpracování vybraného souboru
        fileInput.onchange = function() {
            console.log('Změna v import-file-input');
            if (this.files && this.files.length > 0) {
                selectedFileName.textContent = this.files[0].name;
                selectedFileInfo.style.display = 'flex';
                dropArea.style.display = 'none';
                importBtn.disabled = false;
                console.log('Soubor vybrán:', this.files[0].name);
            }
        };
        
        // 3. Tlačítko reset/odstranit soubor
        if (removeBtn) {
            removeBtn.onclick = function(e) {
                e.stopPropagation();
                fileInput.value = '';
                selectedFileInfo.style.display = 'none';
                dropArea.style.display = 'flex';
                importBtn.disabled = true;
            };
        }
        
        // 4. Drag and drop funkce
        // Highlight při přetáhnutí nad oblastí
        dropArea.ondragover = function(e) {
            e.preventDefault();
            e.stopPropagation();
            this.classList.add('dragover');
        };
        
        // Odstranění highlight při opuštění oblasti
        dropArea.ondragleave = function(e) {
            e.preventDefault();
            e.stopPropagation();
            this.classList.remove('dragover');
        };
        
        // Zpracování upuštěného souboru
        dropArea.ondrop = function(e) {
            e.preventDefault();
            e.stopPropagation();
            this.classList.remove('dragover');
            console.log('Soubor přetažen!');
            
            const files = e.dataTransfer.files;
            if (files && files.length > 0) {
                if (files[0].name.toLowerCase().endsWith('.csv')) {
                    // Pokus o nastavení souborů pro input
                    try {
                        // Pro moderní prohlížeče
                        const dt = new DataTransfer();
                        dt.items.add(files[0]);
                        fileInput.files = dt.files;
                        console.log('Soubor byl přidán do input elementu');
                    } catch (err) {
                        console.warn('DataTransfer API není podporováno, ale uživatel bude moct pokračovat');
                    }
                    
                    // Aktualizace UI
                    selectedFileName.textContent = files[0].name;
                    selectedFileInfo.style.display = 'flex';
                    dropArea.style.display = 'none';
                    importBtn.disabled = false;
                } else {
                    alert("Prosím vyberte soubor ve formátu CSV");
                }
            }
        };
        
        // 5. Tlačítko importu
        importBtn.onclick = function() {
            if (!fileInput.files || fileInput.files.length === 0) {
                alert("Nejprve vyberte CSV soubor");
                return;
            }
            
            // Získání nastavení importu
            const updateExisting = document.getElementById('update-existing').checked;
            const createMissing = document.getElementById('create-missing').checked;
            
            if (!updateExisting && !createMissing) {
                alert("Vyberte prosím alespoň jednu možnost importu");
                return;
            }
            
            // Formát pro odeslání
            const formData = new FormData();
            formData.append('file', fileInput.files[0]);
            formData.append('update_existing', updateExisting);
            formData.append('create_missing', createMissing);
            
            // Indikátor načítání
            const originalContent = importBtn.innerHTML;
            importBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> <span>Importuji...</span>';
            importBtn.disabled = true;
            
            // Odeslání dat na server
            fetch('http://127.0.0.1:5000/api/import/orders', {
                method: 'POST',
                body: formData,
                credentials: 'include',
                headers: csrfToken ? { 'X-CSRFToken': csrfToken } : {}
            })
            .then(response => response.json())
            .then(data => {
                if (data.status === 'success') {
                    alert(data.message || "Import byl úspěšně dokončen");
                    modal.classList.remove('active');
                    
                    // Obnovení seznamu objednávek
                    if (typeof loadOrdersData === 'function') {
                        loadOrdersData();
                    }
                } else {
                    alert(data.message || "Při importu došlo k chybě");
                }
            })
            .catch(error => {
                console.error('Chyba při importu:', error);
                alert("Během importu došlo k chybě. Zkuste to prosím znovu.");
            })
            .finally(() => {
                importBtn.innerHTML = originalContent;
                importBtn.disabled = false;
            });
        };
        
        // 6. Tlačítka pro zavření
        if (closeBtn) {
            closeBtn.onclick = function() {
                modal.classList.remove('active');
            };
        }
        
        if (cancelBtn) {
            cancelBtn.onclick = function() {
                modal.classList.remove('active');
            };
        }
        
        // 7. Kliknutí mimo modální okno ho zavře
        modal.onclick = function(e) {
            if (e.target === this) {
                this.classList.remove('active');
            }
        };
        
        console.log('Nastavení modálu importu dokončeno');
    }

    /**
    * Import objednávek z CSV souboru
    * @param {File} file - CSV soubor s objednávkami
    */

    async function importOrdersFromFile(file) {
        const startImportBtn = document.getElementById('start-import-btn');
        const updateExisting = document.getElementById('update-existing')?.checked || false;
        const createMissing = document.getElementById('create-missing')?.checked || false;
        
        // Kontrola, zda jsou vybrány alespoň nějaké možnosti
        if (!updateExisting && !createMissing) {
            showNotification('Vyberte prosím alespoň jednu možnost importu', 'warning');
            return;
        }
        
        try {
            // Změníme text tlačítka a zakážeme ho
            if (startImportBtn) {
                startImportBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> <span>Importuji...</span>';
                startImportBtn.disabled = true;
            }
            
            // Vytvoříme FormData pro odeslání souboru
            const formData = new FormData();
            formData.append('file', file);
            formData.append('update_existing', updateExisting);
            formData.append('create_missing', createMissing);
            
            // Odeslání souboru na server
            const response = await fetch(`${API_URL}/import/orders`, {
                method: 'POST',
                body: formData,
                credentials: 'include',
                headers: {
                    // Nepřidáváme Content-Type, nechť ho nastaví browser pro FormData
                    'X-CSRFToken': csrfToken
                }
            });
            
            // Zpracování odpovědi
            if (response.ok) {
                const result = await response.json();
                
                if (result.status === 'success') {
                    showNotification(result.message || 'Import byl úspěšně dokončen', 'success');
                    closeModal('import-modal');
                    
                    // Aktualizace dat v tabulce objednávek
                    await loadOrdersData();
                } else {
                    showNotification(result.message || 'Chyba při importu', 'error');
                }
            } else {
                const errorText = await response.text();
                console.error('Chyba při importu:', errorText);
                showNotification('Nepodařilo se importovat objednávky', 'error');
            }
        } catch (error) {
            console.error('Chyba při importu:', error);
            showNotification('Nepodařilo se importovat objednávky: ' + (error.message || 'Neznámá chyba'), 'error');
        } finally {
            // Vrácení tlačítka do původního stavu
            if (startImportBtn) {
                startImportBtn.innerHTML = '<i class="fas fa-upload"></i> <span>Importovat</span>';
                startImportBtn.disabled = false;
            }
        }
    }
    
    // Nastavení event listenerů pro tlačítka v detailu objednávky
    function setupOrderDetailButtons(order) {
        // Nastavení automatické aktualizace statusu
        setupAutoUpdateStatus(order);
        
        // Nastavení ostatních tlačítek
        const generateInvoiceBtn = document.getElementById('generate-invoice');
        const newGenerateInvoiceBtn = generateInvoiceBtn.cloneNode(true);
        generateInvoiceBtn.parentNode.replaceChild(newGenerateInvoiceBtn, generateInvoiceBtn);
        
        const viewInvoiceBtn = document.getElementById('view-invoice');
        const newViewInvoiceBtn = viewInvoiceBtn.cloneNode(true);
        viewInvoiceBtn.parentNode.replaceChild(newViewInvoiceBtn, viewInvoiceBtn);
        
        const editOrderBtn = document.getElementById('edit-order');
        const newEditOrderBtn = editOrderBtn.cloneNode(true);
        editOrderBtn.parentNode.replaceChild(newEditOrderBtn, editOrderBtn);
        
        const printOrderBtn = document.getElementById('print-order');
        const newPrintOrderBtn = printOrderBtn.cloneNode(true);
        printOrderBtn.parentNode.replaceChild(newPrintOrderBtn, printOrderBtn);
        
        // Event listener pro vytvoření faktury
        newGenerateInvoiceBtn.addEventListener('click', async function() {
            const invoice = await createInvoice(order.order_number);
            if (invoice) {
                closeModal('order-detail-modal');
                showInvoiceModal(invoice.invoice_number);
            }
        });
        
        // Event listener pro zobrazení faktury
        newViewInvoiceBtn.addEventListener('click', function() {
            const invoiceNumber = this.getAttribute('data-invoice');
            if (invoiceNumber) {
                closeModal('order-detail-modal');
                showInvoiceModal(invoiceNumber);
            }
        });
        
        // Event listener pro editaci objednávky
        newEditOrderBtn.addEventListener('click', function() {
            closeModal('order-detail-modal');
            editOrder(order.order_number);
        });
        
        // Event listener pro tisk objednávky
        newPrintOrderBtn.addEventListener('click', function() {
            window.open(`${API_URL}/orders/${order.order_number}/print`, '_blank');
        });
    }

    function showInvoiceModal(invoiceNumber) {
        // Nastavení nadpisu modálního okna
        document.getElementById('invoice-number').textContent = invoiceNumber;
        
        // Nastavení src atributu iframe pro zobrazení faktury
        document.getElementById('invoice-frame').src = `${API_URL}/invoices/${invoiceNumber}/view`;
        
        // Nastavení atributů pro tlačítka, aby znaly číslo faktury
        document.getElementById('download-invoice').setAttribute('data-invoice', invoiceNumber);
        document.getElementById('send-invoice-email').setAttribute('data-invoice', invoiceNumber);
        document.getElementById('print-invoice').setAttribute('data-invoice', invoiceNumber);
        
        // Odstranění existujících event listenerů, aby se nepřidávaly nové při každém otevření
        const downloadBtn = document.getElementById('download-invoice');
        const newDownloadBtn = downloadBtn.cloneNode(true);
        downloadBtn.parentNode.replaceChild(newDownloadBtn, downloadBtn);
        
        const emailBtn = document.getElementById('send-invoice-email');
        const newEmailBtn = emailBtn.cloneNode(true);
        emailBtn.parentNode.replaceChild(newEmailBtn, emailBtn);
        
        const printBtn = document.getElementById('print-invoice');
        const newPrintBtn = printBtn.cloneNode(true);
        printBtn.parentNode.replaceChild(newPrintBtn, printBtn);
        
        // Nastavení nových event listenerů
        
        // Tlačítko pro stažení faktury
        newDownloadBtn.addEventListener('click', function() {
            const invoiceNumber = this.getAttribute('data-invoice');
            if (invoiceNumber) {
                window.open(`${API_URL}/invoices/${invoiceNumber}/download`, '_blank');
            }
        });
        
        // Tlačítko pro odeslání faktury emailem
        newEmailBtn.addEventListener('click', async function() {
            const invoiceNumber = this.getAttribute('data-invoice');
            if (invoiceNumber) {
                try {
                    toggleLoader(true);
                    const result = await apiCall(`/invoices/${invoiceNumber}/send-email`, 'POST');
                    
                    if (result.status === 'success') {
                        showNotification(result.message);
                        closeModal('invoice-preview-modal');
                    }
                } catch (error) {
                    // Error je již zpracován v apiCall
                } finally {
                    toggleLoader(false);
                }
            }
        });
        
        // Tlačítko pro tisk faktury
        newPrintBtn.addEventListener('click', function() {
            const invoiceNumber = this.getAttribute('data-invoice');
            if (invoiceNumber) {
                printInvoice();
            }
        });
        
        // Otevření modálu
        openModal('invoice-preview-modal');
    }

    // Funkce pro tisk faktury
    function printInvoice() {
        const iframe = document.getElementById('invoice-frame');
        if (iframe) {
            iframe.contentWindow.focus();
            iframe.contentWindow.print();
        }
    }
    
    // Editace objednávky
    async function editOrder(orderNumber) {
        const order = await fetchOrderDetail(orderNumber);
        
        if (!order) return;
        
        // Nastavení globální proměnné pro editaci
        currentOrderForEdit = order;
        
        // Nastavení hlavičky modalu
        document.querySelector('#order-modal .modal-header h3').textContent = `Úprava objednávky #${order.order_number}`;
        
        // Naplnění formuláře daty zákazníka
        document.getElementById('customer-name').value = order.customer_name;
        document.getElementById('customer-email').value = order.customer_email;
        document.getElementById('customer-phone').value = order.customer_phone || '';
        document.getElementById('customer-address').value = order.customer_address || '';
        document.getElementById('customer-city').value = order.customer_city || '';
        document.getElementById('customer-zip').value = order.customer_zip || '';
        document.getElementById('customer-country').value = order.customer_country || 'cz';
        
        // Naplnění produktů
        selectedProducts = [];
        order.items.forEach(item => {
            const product = {
                id: item.product_id,
                name: item.name,
                type: products.find(p => p.id === item.product_id)?.type || 'unknown',
                variant: item.variant,
                price: item.price,
                quantity: item.quantity,
                total: item.total
            };
            
            selectedProducts.push(product);
        });
        
        updateSelectedProductsList();
        
        // Nastavení dopravy a platby
        const shippingRadios = document.querySelectorAll('input[name="shipping"]');
        const shippingRadio = Array.from(shippingRadios).find(radio => radio.value === order.shipping_method);
        if (shippingRadio) {
            shippingRadio.checked = true;
        }
        
        const paymentRadios = document.querySelectorAll('input[name="payment"]');
        const paymentRadio = Array.from(paymentRadios).find(radio => radio.value === order.payment_method);
        if (paymentRadio) {
            paymentRadio.checked = true;
        }
        
        document.getElementById('order-note').value = order.note || '';
        
        // Přepnutí na první tab s animací
        document.querySelectorAll('.tab-btn').forEach(tab => tab.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        
        const firstTab = document.querySelector('.tab-btn[data-tab="customer-info"]');
        firstTab.classList.add('active');
        document.getElementById('customer-info').classList.add('active');
        
        // Zvýraznění aktivního tabu
        firstTab.classList.add('tab-highlight');
        setTimeout(() => {
            firstTab.classList.remove('tab-highlight');
        }, 1000);
        
        // Změna textu tlačítka
        const saveBtn = document.getElementById('save-order');
        saveBtn.innerHTML = '<i class="fas fa-save"></i><span>Aktualizovat objednávku</span>';
        
        // Inicializace selectů pro produkty
        setupProductSelector();
        
        // Otevření modalu
        openModal('order-modal');
        
        // Přepočítání celkové ceny
        calculateOrderTotal();
    }
    
    // Potvrzení smazání objednávky
    function confirmDeleteOrder(orderNumber) {
        // Nastavení ID objednávky do potvrzovacího modalu
        document.getElementById('confirm-delete').setAttribute('data-order', orderNumber);
        
        // Změna textu
        document.querySelector('#delete-confirmation-modal .confirmation-text').textContent = 
            `Opravdu chcete smazat objednávku #${orderNumber}? Tato akce je nevratná.`;
        
        // Otevření modalu
        openModal('delete-confirmation-modal');
    }
    
    // Nastavení event listenerů pro status filtry
    function setupStatusFilters() {
        document.querySelectorAll('.status-filter').forEach(filter => {
            filter.addEventListener('click', function() {
                const status = this.getAttribute('data-filter');
                
                // Aktualizace aktivního filtru
                document.querySelectorAll('.status-filter').forEach(f => f.classList.remove('active'));
                this.classList.add('active');
                
                // Nastavení příznaků pro sledování stavu filtru
                isFilterActive = (status !== 'all');
                currentFilterType = status;
                
                // Filtrování objednávek
                if (status === 'all') {
                    loadOrdersData();
                } else {
                    loadOrdersData({ status });
                }
            });
        });
    }

    /**
    * Funkce pro inicializaci záložek poznámek v detailu objednávky
    * Přidává funkcionalitu pro přepínání mezi poznámkou zákazníka a interní poznámkou
    */
    function setupNoteTabs() {
        // Přidání event listeneru pro záložky poznámek
        document.querySelectorAll('.notes-tab').forEach(tab => {
            tab.addEventListener('click', function() {
                const tabId = this.getAttribute('data-tab');
                
                // Změna aktivní záložky
                document.querySelectorAll('.notes-tab').forEach(t => t.classList.remove('active'));
                this.classList.add('active');
                
                // Změna aktivního obsahu
                document.querySelectorAll('.notes-content').forEach(content => {
                    content.classList.remove('active');
                });
                document.getElementById(`${tabId}-content`).classList.add('active');
                
                // Pokud jde o interní poznámky, načteme je ze serveru
                if (tabId === 'admin-note') {
                    loadOrderNotes();
                }
            });
        });
    
        // Přidání event listeneru pro tlačítko přidání interní poznámky
        const addNoteBtn = document.querySelector('.add-note-btn');
        if (addNoteBtn) {
            addNoteBtn.addEventListener('click', addOrderNote);
        }
    
        // Aktualizace vizuálního stavu záložek
        updateNoteTabsStatus();
    }

    /**
    * Načtení interních poznámek objednávky ze serveru
    */
    async function loadOrderNotes() {
        const orderNumber = document.getElementById('detail-order-id').textContent;
        const notesContainer = document.getElementById('admin-notes-list');
        
        if (!notesContainer) return;
        
        try {
            toggleLoader(true);
            
            // Odeslání požadavku na server pro získání poznámek
            const result = await apiCall(`/orders/${orderNumber}/notes`, 'GET');
            
            if (result.status === 'success') {
                // Vyčistíme kontejner poznámek
                notesContainer.innerHTML = '';
                
                // Zobrazíme poznámky nebo zprávu, pokud žádné nejsou
                if (result.notes && result.notes.length > 0) {
                    result.notes.forEach(note => {
                        notesContainer.appendChild(createNoteElement(note, orderNumber));
                    });
                } else {
                    notesContainer.innerHTML = '<div class="empty-notes">Žádné interní poznámky</div>';
                }
                
                // Aktualizace vizuálního stavu záložek
                updateNoteTabsStatus(result.notes);
            }
        } catch (error) {
            console.error('Chyba při načítání poznámek:', error);
            notesContainer.innerHTML = '<div class="error-message">Nepodařilo se načíst poznámky</div>';
        } finally {
            toggleLoader(false);
        }
    }

    /**
    * Vytvoření HTML elementu pro poznámku
    * @param {Object} note - Objekt poznámky
    * @param {string} orderNumber - Číslo objednávky
    * @returns {HTMLElement} - Element poznámky
    */
    function createNoteElement(note, orderNumber) {
        const noteElement = document.createElement('div');
        noteElement.className = 'note-item';
        noteElement.dataset.id = note.id;
        
        // Formátování data a času
        const date = new Date(note.created_at.replace(' ', 'T'));
        const formattedDate = `${date.getDate()}.${date.getMonth() + 1}.${date.getFullYear()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
        
        noteElement.innerHTML = `
            <div class="note-header">
                <div class="note-author">
                    <i class="fas fa-user-circle"></i>
                    <span>${note.admin_name}</span>
                </div>
                <div class="note-date">${formattedDate}</div>
                <button class="delete-note-btn" data-id="${note.id}" data-order="${orderNumber}">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="note-text">${formatNoteText(note.note_text)}</div>
        `;
        
        // Přidání event listeneru pro smazání poznámky
        noteElement.querySelector('.delete-note-btn').addEventListener('click', function() {
            deleteOrderNote(note.id, orderNumber);
        });
        
        return noteElement;
    }

    /**
    * Formátování textu poznámky (nahrazení nových řádků, escapování HTML)
    * @param {string} text - Text poznámky
    * @returns {string} - Formátovaný text
    */
    function formatNoteText(text) {
        // Escapování HTML
        const escaped = text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
        
        // Nahrazení nových řádků
        return escaped.replace(/\n/g, '<br>');
    }

    /**
    * Přidání nové interní poznámky
    */
    async function addOrderNote() {
        const orderNumber = document.getElementById('detail-order-id').textContent;
        const noteText = document.getElementById('new-admin-note').value.trim();
        
        if (!noteText) {
            showNotification('Zadejte text poznámky', 'warning');
            return;
        }
        
        try {
            toggleLoader(true);
            
            // Odeslání požadavku na server pro přidání poznámky
            const result = await apiCall(`/orders/${orderNumber}/notes`, 'POST', {
                note_text: noteText
            });
            
            if (result.status === 'success') {
                showNotification('Poznámka byla úspěšně přidána');
                
                // Vyčistíme pole pro novou poznámku
                document.getElementById('new-admin-note').value = '';
                
                // Znovu načteme poznámky
                loadOrderNotes();
            }
        } catch (error) {
            console.error('Chyba při přidávání poznámky:', error);
            showNotification('Nepodařilo se přidat poznámku', 'error');
        } finally {
            toggleLoader(false);
        }
    }

    /**
    * Smazání interní poznámky
    * @param {number} noteId - ID poznámky
    * @param {string} orderNumber - Číslo objednávky
    */
    async function deleteOrderNote(noteId, orderNumber) {
        if (!confirm('Opravdu chcete smazat tuto poznámku?')) {
            return;
        }
        
        try {
            toggleLoader(true);
            
            // Odeslání požadavku na server pro smazání poznámky
            const result = await apiCall(`/orders/${orderNumber}/notes/${noteId}`, 'DELETE');
            
            if (result.status === 'success') {
                showNotification('Poznámka byla úspěšně smazána');
                
                // Znovu načteme poznámky
                loadOrderNotes();
            }
        } catch (error) {
            console.error('Chyba při mazání poznámky:', error);
            showNotification('Nepodařilo se smazat poznámku', 'error');
        } finally {
            toggleLoader(false);
        }
    }

    /**
    * Funkce pro aktualizaci vizuálního stavu záložek poznámek
    * Přidává indikátor, pokud existuje poznámka
    */
    function updateNoteTabsStatus(notes = null) {
        // Získání textu poznámky zákazníka
        const customerNote = document.getElementById('detail-customer-note')?.textContent || '';
        
        // Aktualizace záložky poznámky zákazníka
        const customerNoteTab = document.querySelector('.notes-tab[data-tab="customer-note"]');
        if (customerNoteTab) {
            if (customerNote && customerNote !== 'Žádná poznámka') {
                customerNoteTab.classList.add('has-note');
            } else {
                customerNoteTab.classList.remove('has-note');
            }
        }
        
        // Aktualizace záložky interních poznámek
        const adminNoteTab = document.querySelector('.notes-tab[data-tab="admin-note"]');
        if (adminNoteTab) {
            // Pokud máme poznámky z parametru, použijeme je, jinak zkontrolujeme DOM
            let hasAdminNotes = false;
            
            if (notes) {
                hasAdminNotes = notes.length > 0;
            } else {
                const notesContainer = document.getElementById('admin-notes-list');
                hasAdminNotes = notesContainer && !notesContainer.querySelector('.empty-notes');
            }
            
            if (hasAdminNotes) {
                adminNoteTab.classList.add('has-note');
            } else {
                adminNoteTab.classList.remove('has-note');
            }
        }
    }

    /**
     * Funkce pro inicializaci hodnot interní poznámky při otevření detailu objednávky
     * @param {Object} order - Objekt objednávky
     */
    function setupOrderDetailNotes(order) {
        // Nastavení poznámky zákazníka
        document.getElementById('detail-customer-note').textContent = order.note || 'Žádná poznámka';
        
        // Vyčištění kontejneru interních poznámek
        const notesContainer = document.getElementById('admin-notes-list');
        if (notesContainer) {
            notesContainer.innerHTML = '<div class="loading-notes">Načítání poznámek...</div>';
        }
        
        // Aktualizace vizuálního stavu záložek
        updateNoteTabsStatus();
    }
    
    

    // Nastavení hromadných akcí
    function setupBulkActions() {
        const selectAllCheckbox = document.getElementById('select-all');
        const bulkActionCount = document.querySelector('.bulk-action-count span');
        const bulkActionButtons = document.querySelectorAll('.bulk-action-btn');
        
        // Inicializace stavu
        let selectedOrders = [];
        
        // Event listener pro Select All checkbox
        if (selectAllCheckbox) {
            selectAllCheckbox.addEventListener('change', function() {
                const isChecked = this.checked;
                document.querySelectorAll('.order-checkbox').forEach(checkbox => {
                    checkbox.checked = isChecked;
                });
                
                // Aktualizace seznamu vybraných objednávek
                selectedOrders = isChecked ? 
                    Array.from(document.querySelectorAll('.order-checkbox')).map(cb => cb.getAttribute('data-id')) : 
                    [];
                
                // Aktualizace počtu vybraných objednávek
                if (bulkActionCount) {
                    bulkActionCount.textContent = `${selectedOrders.length} vybraných objednávek`;
                }
            });
        }
        
        // Event listener pro jednotlivé checkboxy
        document.addEventListener('change', function(e) {
            if (e.target && e.target.classList.contains('order-checkbox')) {
                const orderId = e.target.getAttribute('data-id');
                
                if (e.target.checked) {
                    if (!selectedOrders.includes(orderId)) {
                        selectedOrders.push(orderId);
                    }
                } else {
                    selectedOrders = selectedOrders.filter(id => id !== orderId);
                    
                    // Odznačit "Select All" checkbox, pokud není vybrán alespoň jeden
                    if (selectAllCheckbox) {
                        selectAllCheckbox.checked = false;
                    }
                }
                
                // Aktualizace počtu vybraných objednávek
                if (bulkActionCount) {
                    bulkActionCount.textContent = `${selectedOrders.length} vybraných objednávek`;
                }
            }
        });
        
        // Event listenery pro tlačítka hromadných akcí
        bulkActionButtons.forEach(button => {
            button.addEventListener('click', async function() {
                if (selectedOrders.length === 0) {
                    showNotification('Nejsou vybrány žádné objednávky', 'warning');
                    return;
                }
                
                if (this.classList.contains('status-change')) {
                    // Změna statusu objednávek
                    showStatusChangeModal(selectedOrders);
                } else if (this.classList.contains('generate-invoice')) {
                    // Hromadné generování faktur
                    confirmGenerateInvoices(selectedOrders);
                } else if (this.classList.contains('delete-orders')) {
                    // Hromadné mazání objednávek
                    confirmDeleteOrders(selectedOrders);
                }
            });
        });
        
        // Vytvoření modálního okna pro změnu statusu, pokud neexistuje
        createStatusChangeModal();
    }

    // Vytvoření modálního okna pro změnu statusu
    function createStatusChangeModal() {
        // Vytvoření modálního okna
        const modal = document.createElement('div');
        modal.id = 'status-change-modal';
        modal.className = 'modal';
        
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Hromadná změna statusu</h3>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-body">
                    <p class="confirmation-text">Vyberte nový status pro <span id="selected-orders-count">0</span> objednávek:</p>
                    
                    <div class="form-group">
                        <label for="bulk-status">Status:</label>
                        <select id="bulk-status" class="form-control">
                            <option value="new">Nová</option>
                            <option value="processing">Zpracovává se</option>
                            <option value="shipped">Odeslána</option>
                            <option value="completed">Dokončena</option>
                            <option value="cancelled">Zrušena</option>
                        </select>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="modal-cancel">Zrušit</button>
                    <button id="confirm-status-change" class="primary-btn">Změnit status</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Přidání event listenerů pro zavření modálu
        modal.querySelector('.modal-close').addEventListener('click', () => closeModal('status-change-modal'));
        modal.querySelector('.modal-cancel').addEventListener('click', () => closeModal('status-change-modal'));
        
        // Event listener pro kliknutí mimo modál
        modal.addEventListener('click', function(e) {
            if (e.target === this) {
                closeModal('status-change-modal');
            }
        });

    }

    // Zobrazení modálního okna pro změnu statusu
    function showStatusChangeModal(orderIds) {
        // Kontrola existence modálního okna
        if (!document.getElementById('status-change-modal')) {
            createStatusChangeModal();
        }
        
        // Aktualizace počtu vybraných objednávek
        document.getElementById('selected-orders-count').textContent = orderIds.length;
        
        // Získání tlačítka pro změnu statusu - DŮLEŽITÉ: používáme správné ID z HTML
        const confirmButton = document.getElementById('confirm-status-change');
        
        if (!confirmButton) {
            console.error("Tlačítko pro změnu statusu nenalezeno!");
            return;
        }
        
        // Uložení vybraných objednávek do datového atributu tlačítka (pro jistotu)
        confirmButton.setAttribute('data-order-ids', orderIds.join(','));
        
        // Odstranění všech existujících event listenerů
        const newButton = confirmButton.cloneNode(true);
        confirmButton.parentNode.replaceChild(newButton, confirmButton);
        
        // Přidání nového event listeneru - TOTO JE KLÍČOVÉ!
        newButton.addEventListener('click', function() {
            const newStatus = document.getElementById('bulk-status').value;
            if (!newStatus) {
                showNotification('Vyberte prosím nový status', 'warning');
                return;
            }
            
            // Získání IDs z datového atributu (pro jistotu, pokud by došlo k problému s closure)
            const selectedIds = this.getAttribute('data-order-ids').split(',');
            
            // Volání funkce pro hromadnou změnu statusu
            bulkChangeStatus(selectedIds, newStatus);
        });
        
        // Otevření modálu
        openModal('status-change-modal');
    }

    // Potvrzení hromadného generování faktur
    function confirmGenerateInvoices(orderIds) {
        // Místo alert dialogu použijeme modální okno
        document.getElementById('bulk-confirm-title').textContent = 'Vytvořit faktury';
        document.getElementById('bulk-confirm-text').textContent = 
            `Opravdu chcete vygenerovat faktury pro ${orderIds.length} vybraných objednávek?`;
        
        const confirmButton = document.getElementById('bulk-confirm-button');
        confirmButton.textContent = 'Vytvořit faktury';
        confirmButton.classList.remove('danger-btn');
        confirmButton.classList.add('primary-btn');
        
        // Nastavení callback funkce
        confirmButton.onclick = function() {
            closeModal('bulk-confirm-modal');
            bulkGenerateInvoices(orderIds);
        };
        
        openModal('bulk-confirm-modal');
    }

    // Potvrzení hromadného mazání objednávek
    function confirmDeleteOrders(orderIds) {
        // Místo alert dialogu použijeme modální okno
        document.getElementById('bulk-confirm-title').textContent = 'Smazat objednávky';
        document.getElementById('bulk-confirm-text').textContent = 
            `Opravdu chcete smazat ${orderIds.length} vybraných objednávek? Tato akce je nevratná.`;
        
        const confirmButton = document.getElementById('bulk-confirm-button');
        confirmButton.textContent = 'Smazat';
        confirmButton.classList.remove('primary-btn');
        confirmButton.classList.add('danger-btn');
        
        // Nastavení callback funkce
        confirmButton.onclick = function() {
            closeModal('bulk-confirm-modal');
            bulkDeleteOrders(orderIds);
        };
        
        openModal('bulk-confirm-modal');
    }

    // Funkce pro hromadnou změnu statusu
    async function bulkChangeStatus(orderIds, newStatus) {
        try {
            // Zobrazení loaderu
            toggleLoader(true);
            
            console.log(`Začínám hromadnou změnu statusu na "${newStatus}" pro ${orderIds.length} objednávek`);
            
            // Inicializace počítadel
            let successCount = 0;
            let errorCount = 0;
            
            // Zpracování každé objednávky zvlášť
            for (const orderId of orderIds) {
                try {
                    // Nejprve získáme číslo objednávky (order_number) podle ID
                    const orderRow = document.querySelector(`.order-checkbox[data-id="${orderId}"]`).closest('tr');
                    if (!orderRow) {
                        console.error(`Řádek pro objednávku s ID ${orderId} nebyl nalezen`);
                        errorCount++;
                        continue;
                    }
                    
                    const orderActionBtn = orderRow.querySelector('.table-action-btn');
                    const orderNumber = orderActionBtn ? orderActionBtn.getAttribute('data-order') : null;
                    
                    if (!orderNumber) {
                        console.error(`Nepodařilo se najít číslo objednávky pro ID ${orderId}`);
                        errorCount++;
                        continue;
                    }
                    
                    console.log(`Měním status objednávky ${orderNumber} na ${newStatus}`);
                    
                    // Aktualizace statusu objednávky pomocí API
                    const result = await apiCall(`/orders/${orderNumber}`, 'PUT', { status: newStatus });
                    
                    if (result && result.status === 'success') {
                        successCount++;
                        
                        // Aktualizace zobrazení statusu v tabulce
                        const statusCell = orderRow.querySelector('td:nth-child(7)');
                        if (statusCell) {
                            statusCell.innerHTML = getStatusHTML(newStatus);
                        }
                    } else {
                        console.error(`API chyba při změně statusu objednávky ${orderNumber}:`, result);
                        errorCount++;
                    }
                } catch (error) {
                    console.error(`Chyba při změně statusu objednávky ${orderId}:`, error);
                    errorCount++;
                }
            }
            
            // Zavření modálu - DŮLEŽITÉ: zavřeme modál až po dokončení všech operací
            closeModal('status-change-modal');
            
            // Zobrazení výsledku
            if (successCount > 0) {
                const message = `Status byl úspěšně změněn u ${successCount} objednávek${errorCount > 0 ? `, ${errorCount} objednávek se nepodařilo aktualizovat` : ''}.`;
                console.log(message);
                showNotification(message, 'success');
                
                // Aktualizace počtů objednávek podle statusů
                await afterOrderChange();
            } else {
                showNotification('Nepodařilo se změnit status žádné objednávky.', 'error');
            }
            
            // Odznačení všech checkboxů
            resetSelectedOrders();
            
        } catch (error) {
            console.error('Chyba při hromadné změně statusu:', error);
            showNotification('Došlo k chybě při změně statusu objednávek.', 'error');
        } finally {
            // Skrytí loaderu
            toggleLoader(false);
        }
    }
    

    // Funkce pro hromadné generování faktur
    async function bulkGenerateInvoices(orderIds) {
        try {
            toggleLoader(true);
            
            // Inicializace počítadel
            let successCount = 0;
            let errorCount = 0;
            let skippedCount = 0;
            
            // Zpracování každé objednávky zvlášť
            for (const orderId of orderIds) {
                try {
                    // Nejprve získáme číslo objednávky (order_number) podle ID
                    const orderRow = document.querySelector(`.order-checkbox[data-id="${orderId}"]`).closest('tr');
                    const orderNumber = orderRow.querySelector('.table-action-btn').getAttribute('data-order');
                    
                    // Kontrola, zda objednávka nemá již fakturu
                    const orderDetail = await apiCall(`/orders/${orderNumber}`, 'GET');
                    
                    if (orderDetail && orderDetail.order && orderDetail.order.invoice) {
                        // Objednávka již má fakturu
                        skippedCount++;
                        continue;
                    }
                    
                    // Vytvoření faktury pomocí API
                    const result = await apiCall(`/invoices/${orderNumber}`, 'POST');
                    
                    if (result && result.status === 'success') {
                        successCount++;
                    } else {
                        errorCount++;
                    }
                } catch (error) {
                    console.error(`Chyba při generování faktury pro objednávku ${orderId}:`, error);
                    errorCount++;
                }
            }
            
            // Zobrazení výsledku
            if (successCount > 0) {
                let message = `Bylo vygenerováno ${successCount} faktur`;
                if (skippedCount > 0) {
                    message += `, ${skippedCount} objednávek již mělo fakturu vytvořenou`;
                }
                if (errorCount > 0) {
                    message += `, ${errorCount} faktur se nepodařilo vytvořit`;
                }
                showNotification(message, 'success');
                
                // Aktualizace počtů objednávek podle statusů
                await afterOrderChange();
            } else if (skippedCount > 0) {
                showNotification(`Všechny vybrané objednávky (${skippedCount}) již mají faktury vytvořeny.`, 'warning');
            } else {
                showNotification('Nepodařilo se vygenerovat žádnou fakturu.', 'error');
            }
            
            // Odznačení všech checkboxů
            resetSelectedOrders();
            
        } catch (error) {
            console.error('Chyba při hromadném generování faktur:', error);
            showNotification('Došlo k chybě při generování faktur.', 'error');
        } finally {
            toggleLoader(false);
        }
    }

    // Funkce pro hromadné mazání objednávek
    async function bulkDeleteOrders(orderIds) {
        try {
            toggleLoader(true);
            
            // Inicializace počítadel
            let successCount = 0;
            let errorCount = 0;
            
            // Zpracování každé objednávky zvlášť
            for (const orderId of orderIds) {
                try {
                    // Nejprve získáme číslo objednávky (order_number) podle ID
                    const orderRow = document.querySelector(`.order-checkbox[data-id="${orderId}"]`).closest('tr');
                    if (!orderRow) continue;
                    
                    const orderNumber = orderRow.querySelector('.table-action-btn').getAttribute('data-order');
                    
                    // Smazání objednávky pomocí API
                    const result = await apiCall(`/orders/${orderNumber}`, 'DELETE');
                    
                    if (result && result.status === 'success') {
                        successCount++;
                        
                        // Odstranění řádku z tabulky
                        orderRow.remove();
                    } else {
                        errorCount++;
                    }
                } catch (error) {
                    console.error(`Chyba při mazání objednávky ${orderId}:`, error);
                    errorCount++;
                }
            }
            
            // Zobrazení výsledku
            if (successCount > 0) {
                showNotification(`Bylo smazáno ${successCount} objednávek${errorCount > 0 ? `, ${errorCount} objednávek se nepodařilo smazat` : ''}.`, 'success');
                
                // Aktualizace počtů objednávek
                await afterOrderChange();
            } else {
                showNotification('Nepodařilo se smazat žádnou objednávku.', 'error');
            }
            
            // Odznačení všech checkboxů
            resetSelectedOrders();
            
        } catch (error) {
            console.error('Chyba při hromadném mazání objednávek:', error);
            showNotification('Došlo k chybě při mazání objednávek.', 'error');
        } finally {
            toggleLoader(false);
        }
    }

    // Resetování vybraných objednávek
    function resetSelectedOrders() {
        // Odznačení všech checkboxů
        document.querySelectorAll('.order-checkbox').forEach(checkbox => {
            checkbox.checked = false;
        });
        
        // Odznačení Select All checkboxu
        const selectAllCheckbox = document.getElementById('select-all');
        if (selectAllCheckbox) {
            selectAllCheckbox.checked = false;
        }
        
        // Reset počítadla
        const bulkActionCount = document.querySelector('.bulk-action-count span');
        if (bulkActionCount) {
            bulkActionCount.textContent = '0 vybraných objednávek';
        }
    }

    // Funkce pro inicializaci statistik objednávek
    async function initOrderStats() {
        try {
            const response = await apiCall('/statistics', 'GET');
            
            if (response && response.status === 'success' && response.stats) {
                // Aktualizace statistických karet
                const statCards = document.querySelectorAll('.order-stat-card');
                
                if (statCards.length >= 4) {
                    // Celkový počet objednávek
                    updateStatCard(statCards[0], response.stats.current.total_orders, response.stats.changes.orders_change);
                    
                    // Zpracovávané objednávky
                    const processingOrders = allOrders.filter(order => order.status === 'processing').length;
                    updateStatCard(statCards[1], processingOrders, 0);
                    
                    // K odeslání (objednávky se statusem shipped)
                    const shippedOrders = allOrders.filter(order => order.status === 'shipped').length;
                    updateStatCard(statCards[2], shippedOrders, 0);
                    
                    // Tržby
                    updateStatCard(statCards[3], formatPrice(response.stats.current.total_revenue).replace(' Kč', ''), response.stats.changes.revenue_change);
                }
            }
        } catch (error) {
            console.error('Chyba při načítání statistik objednávek:', error);
        }
    }

    // Pomocná funkce pro aktualizaci statistické karty
    function updateStatCard(card, value, change) {
        const valueEl = card.querySelector('.stat-info h3');
        const trendEl = card.querySelector('.stat-trend');
        
        if (valueEl) {
            // Zkontrolujeme, zda jde o kartu s tržbami (má třídu revenue nebo obsahuje ikonu fa-coins)
            const isRevenueCard = card.querySelector('.stat-icon.revenue') || 
                                  card.querySelector('.stat-icon .fa-coins');
            
            // Přidáme "Kč" jen pokud jde o kartu s tržbami
            if (isRevenueCard) {
                // Pokud hodnota už obsahuje "Kč", nepřidáváme znovu
                if (!value.toString().includes('Kč')) {
                    valueEl.textContent = value + ' Kč';
                } else {
                    valueEl.textContent = value;
                }
            } else {
                // Pro ostatní karty nastavíme jen hodnotu bez jednotky
                valueEl.textContent = value;
            }
        }
        
        if (trendEl) {
            const trendValueEl = trendEl.querySelector('span');
            if (trendValueEl) trendValueEl.textContent = `${Math.abs(change)}%`;
            
            if (change > 0) {
                trendEl.classList.remove('down');
                trendEl.classList.add('up');
                trendEl.querySelector('i').className = 'fas fa-arrow-up';
            } else if (change < 0) {
                trendEl.classList.remove('up');
                trendEl.classList.add('down');
                trendEl.querySelector('i').className = 'fas fa-arrow-down';
            }
        }
    }
    
    // ===== SEKCE PRODUKTŮ =====
    
    // Načtení všech produktů
    async function fetchProducts() {
        try {
            toggleLoader(true);
            const result = await apiCall('/products');
            
            if (result.status === 'success') {
                products = result.products;
                console.log("Načteno produktů:", products.length);
                return products;
            }
        } catch (error) {
            console.error("Chyba při načítání produktů:", error);
            showNotification('Nepodařilo se načíst produkty. Zkuste to prosím znovu.', 'error');
            return [];
        } finally {
            toggleLoader(false);
        }
    }
    
    // Vytvoření nového produktu
    async function createProduct(productData) {
        try {
            toggleLoader(true);
            const result = await apiCall('/products', 'POST', productData);
            
            if (result.status === 'success') {
                showNotification(result.message);
                await loadProductsData();
                return result.product;
            }
        } catch (error) {
            // Error je již zpracován v apiCall
            return null;
        } finally {
            toggleLoader(false);
        }
    }
    
    // Aktualizace produktu
    async function updateProduct(productId, productData) {
        try {
            toggleLoader(true);
            const result = await apiCall(`/products/${productId}`, 'PUT', productData);
            
            if (result.status === 'success') {
                showNotification(result.message);
                await loadProductsData();
                return result.product;
            }
        } catch (error) {
            // Error je již zpracován v apiCall
            return null;
        } finally {
            toggleLoader(false);
        }
    }
    
    // Smazání produktu
    async function deleteProduct(productId) {
        try {
            toggleLoader(true);
            const result = await apiCall(`/products/${productId}`, 'DELETE');
            
            if (result.status === 'success') {
                showNotification(result.message);
                await loadProductsData();
                return true;
            }
        } catch (error) {
            // Error je již zpracován v apiCall
            return false;
        } finally {
            toggleLoader(false);
        }
    }
    
    // Načtení dat pro sekci produktů
    async function loadProductsData() {
        const products = await fetchProducts();
        renderProductsGrid(products);
    }
    
    // Vykreslení mřížky produktů
    function renderProductsGrid(products) {
        const productsGrid = document.getElementById('products-grid');
        productsGrid.innerHTML = '';
        
        if (!products || products.length === 0) {
            productsGrid.innerHTML = '<div class="empty-grid">Nebyly nalezeny žádné produkty</div>';
            return;
        }
        
        products.forEach(product => {
            const productCard = document.createElement('div');
            productCard.className = 'product-card';
            
            let badgeHtml = '';
            if (product.featured) {
                badgeHtml = '<div class="product-badge featured">Doporučeno</div>';
            } else if (product.stock <= 0) {
                badgeHtml = '<div class="product-badge out-of-stock">Vyprodáno</div>';
            }
            
            productCard.innerHTML = `
                <div class="product-image">
                    <img src="/api/placeholder/400/320" alt="${product.name}">
                    ${badgeHtml}
                </div>
                <div class="product-info">
                    <h3 class="product-name">${product.name} - ${product.variant}</h3>
                    <div class="product-categories">
                        <span class="product-category">${product.type}</span>
                        <span class="product-category">${product.variant}</span>
                    </div>
                    <div class="product-price">${formatPrice(product.price)}</div>
                    <div class="product-stock">Skladem: ${product.stock} ks</div>
                    <div class="product-actions">
                        <button class="product-btn edit" data-id="${product.id}">
                            <i class="fas fa-edit"></i>
                            <span>Upravit</span>
                        </button>
                        <button class="product-btn delete" data-id="${product.id}">
                            <i class="fas fa-trash-alt"></i>
                            <span>Smazat</span>
                        </button>
                    </div>
                </div>
            `;
            
            productsGrid.appendChild(productCard);
        });
        
        // Přidání event listenerů pro akce
        addProductActionListeners();
    }
    
    // Přidání event listenerů pro tlačítka akcí u produktů
    function addProductActionListeners() {
        // Tlačítko pro úpravu produktu
        document.querySelectorAll('.product-btn.edit').forEach(btn => {
            btn.addEventListener('click', function() {
                const productId = parseInt(this.getAttribute('data-id'));
                editProduct(productId);
            });
        });
        
        // Tlačítko pro smazání produktu
        document.querySelectorAll('.product-btn.delete').forEach(btn => {
            btn.addEventListener('click', function() {
                const productId = parseInt(this.getAttribute('data-id'));
                confirmDeleteProduct(productId);
            });
        });
    }
    
    // Nastavení dynamického výběru produktů
    function setupProductSelector() {
        const productTypeSelect = document.getElementById('product-type');
        
        // Nejprve zkontrolujeme, zda je select box k dispozici
        if (!productTypeSelect) {
            console.error("Element 'product-type' nebyl nalezen");
            return;
        }
        
        // Vyčistíme stávající možnosti
        productTypeSelect.innerHTML = '<option value="">-- Vyberte produkt --</option>';
        
        // Kontrola, zda máme načtené produkty
        if (!products || products.length === 0) {
            console.log("Načítám produkty...");
            fetchProducts().then(() => {
                populateProductOptions(productTypeSelect);
            });
        } else {
            populateProductOptions(productTypeSelect);
        }
    }

    // Pomocná funkce pro naplnění produktových možností
    function populateProductOptions(productTypeSelect) {
        // Získání unikátních typů produktů
        const productTypes = [...new Set(products.map(p => p.type))];
        
        console.log("Dostupné typy produktů:", productTypes);
        
        // Přidání možností pro každý typ produktu
        productTypes.forEach(type => {
            // Najdeme první produkt tohoto typu, abychom mohli zobrazit jeho název
            const productWithThisType = products.find(p => p.type === type);
            if (productWithThisType) {
                const option = document.createElement('option');
                option.value = type;
                option.textContent = productWithThisType.name;
                productTypeSelect.appendChild(option);
            }
        });
        
        // Přidáme event listener pro změnu typu
        productTypeSelect.addEventListener('change', updateVariantOptions);
        
        // Inicializujeme varianty, pokud je vybrán typ
        if (productTypeSelect.value) {
            updateVariantOptions();
        }
    }

    // Aktualizace variant podle vybraného typu
    function updateVariantOptions() {
        const productTypeSelect = document.getElementById('product-type');
        const productVariantSelect = document.getElementById('product-variant');
        
        if (!productVariantSelect) {
            console.error("Element 'product-variant' nebyl nalezen");
            return;
        }
        
        const selectedType = productTypeSelect.value;
        
        // Reset výběru varianty
        productVariantSelect.innerHTML = '<option value="">-- Vyberte variantu --</option>';
        
        if (!selectedType) return;
        
        // Filtrace produktů podle vybraného typu
        const variantsForType = products
            .filter(p => p.type === selectedType)
            .map(p => p.variant);
        
        console.log(`Varianty pro typ ${selectedType}:`, variantsForType);
        
        // Přidání variant do select boxu
        variantsForType.forEach(variant => {
            const option = document.createElement('option');
            option.value = variant;
            option.textContent = variant;
            productVariantSelect.appendChild(option);
        });
    }
    
    // ===== SEKCE ZÁKAZNÍKŮ =====
    
    // Načtení všech zákazníků
    async function fetchCustomers() {
        try {
            toggleLoader(true);
            const result = await apiCall('/customers');
            
            if (result.status === 'success') {
                customers = result.customers;
                return customers;
            }
        } catch (error) {
            // Error je již zpracován v apiCall
            return [];
        } finally {
            toggleLoader(false);
        }
    }
    
    // Vytvoření nového zákazníka
    async function createCustomer(customerData) {
        try {
            toggleLoader(true);
            const result = await apiCall('/customers', 'POST', customerData);
            
            if (result.status === 'success') {
                showNotification(result.message);
                await loadCustomersData();
                return result.customer;
            }
        } catch (error) {
            // Error je již zpracován v apiCall
            return null;
        } finally {
            toggleLoader(false);
        }
    }
    
    // Aktualizace zákazníka
    async function updateCustomer(customerId, customerData) {
        try {
            toggleLoader(true);
            const result = await apiCall(`/customers/${customerId}`, 'PUT', customerData);
            
            if (result.status === 'success') {
                showNotification(result.message);
                await loadCustomersData();
                return result.customer;
            }
        } catch (error) {
            // Error je již zpracován v apiCall
            return null;
        } finally {
            toggleLoader(false);
        }
    }
    
    // Smazání zákazníka
    async function deleteCustomer(customerId) {
        try {
            toggleLoader(true);
            const result = await apiCall(`/customers/${customerId}`, 'DELETE');
            
            if (result.status === 'success') {
                showNotification(result.message);
                await loadCustomersData();
                return true;
            }
        } catch (error) {
            // Error je již zpracován v apiCall
            return false;
        } finally {
            toggleLoader(false);
        }
    }
    
    // Načtení dat pro sekci zákazníků
    async function loadCustomersData() {
        const customers = await fetchCustomers();
        renderCustomersTable(customers);
    }
    
    // Vykreslení tabulky zákazníků
    function renderCustomersTable(customers) {
        const tableBody = document.getElementById('customers-table-body');
        tableBody.innerHTML = '';
        
        if (!customers || customers.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="9" class="empty-table">Nebyly nalezeni žádní zákazníci</td>
                </tr>
            `;
            return;
        }
        
        customers.forEach(customer => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td class="checkbox-cell">
                    <input type="checkbox" class="customer-checkbox" data-id="${customer.id}">
                </td>
                <td>${customer.id}</td>
                <td>${customer.name}</td>
                <td>${customer.email}</td>
                <td>${customer.phone || '-'}</td>
                <td>${customer.address ? `${customer.address}, ${customer.city}, ${customer.zip}` : '-'}</td>
                <td>${customer.orders_count}</td>
                <td>${formatPrice(customer.total_spent)}</td>
                <td class="actions-cell">
                    <button class="table-action-btn view" data-id="${customer.id}" title="Zobrazit detail">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="table-action-btn edit" data-id="${customer.id}" title="Upravit">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="table-action-btn delete" data-id="${customer.id}" title="Smazat">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </td>
            `;
            
            tableBody.appendChild(row);
        });
        
        // Přidání event listenerů pro akce
        addCustomerActionListeners();
    }
    
    // Přidání event listenerů pro tlačítka akcí u zákazníků
    function addCustomerActionListeners() {
        // Tlačítko pro zobrazení detailu zákazníka
        document.querySelectorAll('#customers-table-body .table-action-btn.view').forEach(btn => {
            btn.addEventListener('click', function() {
                const customerId = parseInt(this.getAttribute('data-id'));
                showCustomerDetail(customerId);
            });
        });
        
        // Tlačítko pro úpravu zákazníka
        document.querySelectorAll('#customers-table-body .table-action-btn.edit').forEach(btn => {
            btn.addEventListener('click', function() {
                const customerId = parseInt(this.getAttribute('data-id'));
                editCustomer(customerId);
            });
        });
        
        // Tlačítko pro smazání zákazníka
        document.querySelectorAll('#customers-table-body .table-action-btn.delete').forEach(btn => {
            btn.addEventListener('click', function() {
                const customerId = parseInt(this.getAttribute('data-id'));
                confirmDeleteCustomer(customerId);
            });
        });
    }
    
    // ===== SEKCE STATISTIKY =====
    
    // Načtení dat pro sekci statistik
    async function loadStatisticsData() {
        // Pro demo účely pouze logujeme
        console.log('Načítání statistik...');
    }
    
    // ===== SEKCE NASTAVENÍ =====
    
    // Načtení dat pro sekci nastavení
    function loadSettingsData() {
        // Pro demo účely pouze logujeme
        console.log('Načítání nastavení...');
    }
    
    // Nastavení event listenerů pro nastavení
    function setupSettingsListeners() {
        // Přepínání panelů v nastavení
        document.querySelectorAll('.settings-menu li').forEach(item => {
            item.addEventListener('click', function() {
                const settingsId = this.getAttribute('data-settings');
                
                // Změna aktivní položky menu
                document.querySelectorAll('.settings-menu li').forEach(li => li.classList.remove('active'));
                this.classList.add('active');
                
                // Změna aktivního panelu
                document.querySelectorAll('.settings-panel').forEach(panel => panel.classList.remove('active'));
                document.getElementById(`${settingsId}-settings`).classList.add('active');
            });
        });
        
        // Uložení obecného nastavení
        document.getElementById('save-general-settings').addEventListener('click', function() {
            // Implementace bude později
            showNotification('Nastavení bylo úspěšně uloženo');
        });
        
        // Uložení nastavení obchodu
        document.getElementById('save-shop-settings').addEventListener('click', function() {
            // Implementace bude později
            showNotification('Nastavení obchodu bylo úspěšně uloženo');
        });
    }
    
    // ===== NASTAVENÍ FORMULÁŘE OBJEDNÁVKY =====
    
    // Nastavení event listenerů pro formulář objednávky
    function setupOrderFormListeners() {
        // Přepínání tabů v modalu objednávky
        document.querySelectorAll('.tab-btn').forEach(tab => {
            tab.addEventListener('click', function() {
                const tabId = this.getAttribute('data-tab');
                
                // Změna aktivního tabu
                document.querySelectorAll('.tab-btn').forEach(t => t.classList.remove('active'));
                this.classList.add('active');
                
                // Změna obsahu
                document.querySelectorAll('.tab-content').forEach(content => {
                    content.classList.remove('active');
                });
                document.getElementById(tabId).classList.add('active');
            });
        });
        
        // Přidání produktu do objednávky
        document.getElementById('add-product-btn').addEventListener('click', function() {
            const type = document.getElementById('product-type').value;
            const variant = document.getElementById('product-variant').value;
            const quantity = parseInt(document.getElementById('product-quantity').value);
            
            if (!type || !variant || isNaN(quantity) || quantity <= 0) {
                showNotification('Vyplňte prosím všechna pole produktu', 'error');
                return;
            }
            
            // Najít produkt v načtených produktech
            const productInfo = products.find(p => p.type === type && p.variant === variant);
            
            if (!productInfo) {
                showNotification('Vybraný produkt nebyl nalezen', 'error');
                return;
            }
            
            // Kontrola, zda již není produkt přidán
            const existingIndex = selectedProducts.findIndex(p => p.type === type && p.variant === variant);
            
            if (existingIndex !== -1) {
                // Aktualizace množství existujícího produktu
                selectedProducts[existingIndex].quantity += quantity;
                selectedProducts[existingIndex].total = selectedProducts[existingIndex].price * selectedProducts[existingIndex].quantity;
            } else {
                // Přidání nového produktu
                selectedProducts.push({
                    id: productInfo.id,
                    name: productInfo.name,
                    type: productInfo.type,
                    variant: productInfo.variant,
                    price: productInfo.price,
                    quantity: quantity,
                    total: productInfo.price * quantity
                });
            }
            
            // Aktualizace seznamu produktů
            updateSelectedProductsList();
            
            // Přidání animace tlačítka
            const addBtn = document.getElementById('add-product-btn');
            addBtn.classList.add('success-animation');
            setTimeout(() => {
                addBtn.classList.remove('success-animation');
            }, 700);
            
            // Reset výběru
            document.getElementById('product-quantity').value = 1;
            
            showNotification('Produkt byl přidán do objednávky', 'success'); 
        });

        // Změna dopravy nebo platby aktualizuje celkovou cenu
        document.querySelectorAll('input[name="shipping"], input[name="payment"]').forEach(input => {
            input.addEventListener('change', calculateOrderTotal);
        });
        
        // Tlačítka pro změnu množství produktu
        document.querySelector('.quantity-control .minus').addEventListener('click', function() {
            const input = document.getElementById('product-quantity');
            const value = parseInt(input.value);
            if (value > 1) {
                input.value = value - 1;
            }
        });
        
        document.querySelector('.quantity-control .plus').addEventListener('click', function() {
            const input = document.getElementById('product-quantity');
            input.value = parseInt(input.value) + 1;
        });
        
        // Vylepšení pro přepínání mezi taby pomocí tlačítek Další/Zpět
        document.querySelectorAll('.next-tab-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const currentTab = document.querySelector('.tab-btn.active');
                const nextTabBtn = currentTab.nextElementSibling;
                if (nextTabBtn) {
                    nextTabBtn.click();
                }
            });
        });
        
        document.querySelectorAll('.prev-tab-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const currentTab = document.querySelector('.tab-btn.active');
                const prevTabBtn = currentTab.previousElementSibling;
                if (prevTabBtn) {
                    prevTabBtn.click();
                }
            });
        });
        
        // Uložení objednávky
        document.getElementById('save-order').addEventListener('click', async function() {
            try {
                // Přidáme animaci načítání na tlačítko
                const saveBtn = document.getElementById('save-order');
                const originalText = saveBtn.innerHTML;
                saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Ukládám...';
                saveBtn.disabled = true;
                
                // Zjištění aktivní záložky
                const activeTab = document.querySelector('.tab-btn.active').getAttribute('data-tab');
                
                // Vytvoření kompletního objektu s daty
                let orderData = {};
                
                // Vždy přidáme poznámku, pokud existuje
                const noteElement = document.getElementById('order-note');
                if (noteElement) {
                    orderData.note = noteElement.value;
                }
                
                // Údaje o zákazníkovi
                orderData.customer = {
                    name: document.getElementById('customer-name')?.value || '',
                    email: document.getElementById('customer-email')?.value || '',
                    phone: document.getElementById('customer-phone')?.value || '',
                    address: document.getElementById('customer-address')?.value || '',
                    city: document.getElementById('customer-city')?.value || '',
                    zip: document.getElementById('customer-zip')?.value || '',
                    country: document.getElementById('customer-country')?.value || ''
                };
                
                // Údaje o produktech
                orderData.products = selectedProducts;
                    
                // Údaje o dopravě a platbě
                const totals = calculateOrderTotal();
                orderData.shipping = {
                    method: totals.shippingMethod,
                    price: totals.shippingPrice
                };
                orderData.payment = {
                    method: totals.paymentMethod,
                    price: totals.paymentPrice
                };
                orderData.subtotal = totals.subtotal;
                orderData.total = totals.total;
                
                // Zachováme původní status objednávky
                if (currentOrderForEdit && currentOrderForEdit.status) {
                    orderData.status = currentOrderForEdit.status;
                }
                
                console.log('Odesílám data objednávky:', orderData);
                
                // Aktualizace nebo vytvoření objednávky
                if (currentOrderForEdit) {
                    // Aktualizace existující objednávky
                    const result = await updateOrder(currentOrderForEdit.order_number, orderData);
                    if (result) {
                        showNotification('Objednávka byla úspěšně aktualizována');
                        // Reset formuláře a zavření modalu
                        closeModal('order-modal');
                        await loadOrdersData();
                        currentOrderForEdit = null;
                    }
                } else {
                    // Vytvoření nové objednávky
                    await createOrder(orderData);
                    // Reset formuláře a zavření modalu
                    closeModal('order-modal');
                    await loadOrdersData();
                }
            } catch (error) {
                console.error('Chyba při ukládání objednávky:', error);
                showNotification('Nepodařilo se uložit objednávku: ' + (error.message || 'Neznámá chyba'), 'error');
            } finally {
                // Obnova tlačítka
                const saveBtn = document.getElementById('save-order');
                if (saveBtn) {
                    saveBtn.innerHTML = currentOrderForEdit ? 
                        '<i class="fas fa-save"></i><span>Aktualizovat objednávku</span>' : 
                        '<i class="fas fa-save"></i><span>Vytvořit objednávku</span>';
                    saveBtn.disabled = false;
                }
                
                // Reset formuláře pouze při vytvoření nové objednávky
                if (!currentOrderForEdit) {
                    document.querySelector('#order-modal form')?.reset();
                    selectedProducts = [];
                    updateSelectedProductsList();
                }
            }
        });
    }
    
    // Nastavení event listenerů pro potvrzovací modály
    function setupConfirmationListeners() {
        // Potvrzení smazání
        document.getElementById('confirm-delete').addEventListener('click', async function() {
            const orderNumber = this.getAttribute('data-order');
            if (orderNumber) {
                await deleteOrder(orderNumber);
                closeModal('delete-confirmation-modal');
            }
            
            const productId = this.getAttribute('data-product');
            if (productId) {
                await deleteProduct(parseInt(productId));
                closeModal('delete-confirmation-modal');
            }
            
            const customerId = this.getAttribute('data-customer');
            if (customerId) {
                await deleteCustomer(parseInt(customerId));
                closeModal('delete-confirmation-modal');
            }
        });
    }

    // ===== INICIALIZACE APLIKACE =====
    
    // Inicializace aplikace
    async function initApp() {
        // Kontrola hesla ve formuláři (zobrazení/skrytí)
        document.querySelector('.password-toggle')?.addEventListener('click', function() {
            const passwordInput = document.getElementById('admin-password');
            const icon = this.querySelector('i');
            
            if (passwordInput.type === 'password') {
                passwordInput.type = 'text';
                icon.classList.remove('fa-eye');
                icon.classList.add('fa-eye-slash');
            } else {
                passwordInput.type = 'password';
                icon.classList.remove('fa-eye-slash');
                icon.classList.add('fa-eye');
            }
        });
        
        // Přihlášení po stisku klávesy Enter
        document.getElementById('admin-password')?.addEventListener('keyup', function(event) {
            if (event.key === 'Enter') {
                document.getElementById('login-button').click();
            }
        });
        
        // Přihlašovací tlačítko
        document.getElementById('login-button')?.addEventListener('click', async function() {
            const username = document.getElementById('admin-id').value;
            const password = document.getElementById('admin-password').value;
            
            if (!username || !password) {
                showNotification('Vyplňte prosím všechna pole', 'error');
                return;
            }
            
            // Nejprve získáme CSRF token
            try {
                await getCsrfToken();
                await login(username, password);
            } catch (error) {
                console.error('Chyba při přihlašování:', error);
                showNotification('Nepodařilo se připojit k serveru. Zkontrolujte připojení.', 'error');
            }
        });
        
        // Odhlašovací tlačítko
        document.getElementById('logout-button')?.addEventListener('click', function() {
            logout();
        });
        
        // Oprava importu - bude provedena ihned
        fixImportFunctionality();
        
        // Oprava importu - také po načtení DOM (pro případ, že elementy ještě nejsou k dispozici)
        document.addEventListener('DOMContentLoaded', function() {
            // Vypisuje základní debug informace
            console.log("DOM načten, inicializuji přepínání sekcí");
            
            // Oprava importu
            fixImportFunctionality();
            
            // Najdeme všechny menu položky, které by mohly existovat v různých HTML strukturách
            const menuLinks = document.querySelectorAll('.sidebar-nav a, .sidebar-items a, nav a[href^="#"]');
            console.log("Nalezeno menu položek:", menuLinks.length);
            
            menuLinks.forEach(link => {
                // Odebrat existující listenery (pokud existují)
                const newLink = link.cloneNode(true);
                link.parentNode.replaceChild(newLink, link);
                
                newLink.addEventListener('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    let sectionId;
                    
                    // Zjistíme ID sekce několika způsoby
                    const parentLi = this.closest('li');
                    if (parentLi && parentLi.getAttribute('data-section')) {
                        sectionId = parentLi.getAttribute('data-section');
                    } else if (this.getAttribute('href') && this.getAttribute('href').startsWith('#')) {
                        sectionId = this.getAttribute('href').substring(1);
                    } else {
                        // Odvození ze textu odkazu
                        const text = this.textContent.trim().toLowerCase();
                        if (text.includes('objednávk')) sectionId = 'orders';
                        else if (text.includes('produkt')) sectionId = 'products';
                        else if (text.includes('zákazní')) sectionId = 'customers';
                        else if (text.includes('statist')) sectionId = 'statistics';
                        else if (text.includes('nastav')) sectionId = 'settings';
                    }
                    
                    console.log("Kliknuto na menu položku:", this.textContent, "-> sekce:", sectionId);
                    
                    if (sectionId) {
                        switchSection(sectionId);
                    }
                });
            });
    
            // Další opravy importu
            setTimeout(function() {
                console.log("Odložená inicializace importu po načtení stránky");
                fixImportFunctionality();
            }, 1000);
            
            // Také přidáme event listener na logo a název, aby přepínali na výchozí sekci
            document.querySelectorAll('.logo-container, .logo-icon, .sidebar-header h1').forEach(el => {
                el.addEventListener('click', function() {
                    switchSection('orders'); // Výchozí sekce
                });
            });
            
            // Inicializace výchozí sekce podle URL hash nebo fallback na orders
            setTimeout(() => {
                let initialSection = 'orders'; // Výchozí sekce
                
                // Kontrola, zda je v URL hash
                const hash = window.location.hash;
                if (hash && hash.length > 1) {
                    const hashSection = hash.substring(1);
                    const validSections = ['orders', 'products', 'customers', 'statistics', 'settings'];
                    if (validSections.includes(hashSection)) {
                        initialSection = hashSection;
                    }
                }
                
                console.log("Inicializuji výchozí sekci:", initialSection);
                switchSection(initialSection);
            }, 200);
        });
        
        window.addEventListener('hashchange', function() {
            const hash = window.location.hash;
            if (hash && hash.length > 1) {
                const section = hash.substring(1);
                const validSections = ['orders', 'products', 'customers', 'statistics', 'settings'];
                if (validSections.includes(section)) {
                    switchSection(section);
                }
            }
        });
    
        // Toggle sidebar
        document.querySelector('.toggle-sidebar')?.addEventListener('click', function() {
            document.querySelector('.sidebar').classList.toggle('collapsed');
        });
        
        // Zobrazení filtrovacího panelu
        document.getElementById('filter-orders-btn')?.addEventListener('click', function() {
            const filtersPanel = document.querySelector('.filters-panel');
            filtersPanel.style.display = filtersPanel.style.display === 'flex' ? 'none' : 'flex';
        });
        
        // Přepínání filtru statusu
        document.querySelectorAll('.filter-option').forEach(option => {
            option.addEventListener('click', function() {
                document.querySelectorAll('.filter-option').forEach(opt => {
                    opt.classList.remove('active');
                });
                this.classList.add('active');
            });
        });
        
        // Aplikace filtrů
        document.querySelector('.apply-filters')?.addEventListener('click', function() {
            const status = document.querySelector('.filter-option.active').getAttribute('data-filter');
            const sortBy = document.getElementById('order-sort').value;
            const dateFrom = document.getElementById('date-from').value;
            const dateTo = document.getElementById('date-to').value;
            
            loadOrdersData({ status, sortBy, dateFrom, dateTo });
            
            // Skrytí filtrovacího panelu
            document.querySelector('.filters-panel').style.display = 'none';
        });
        
        // Zobrazení modalu pro novou objednávku
        document.getElementById('create-order-btn')?.addEventListener('click', function() {
            // Reset formuláře
            document.querySelector('#order-modal .modal-header h3').textContent = 'Nová objednávka';
            document.querySelector('#order-modal form')?.reset();
            document.getElementById('save-order').textContent = 'Vytvořit objednávku';
            
            currentOrderForEdit = null;
            selectedProducts = [];
            updateSelectedProductsList();
            
            // Resetování tabů
            document.querySelectorAll('.tab-btn').forEach(tab => tab.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
            document.querySelector('.tab-btn[data-tab="customer-info"]')?.classList.add('active');
            document.getElementById('customer-info')?.classList.add('active');
            
            // Zde inicializujeme selector produktů
            setupProductSelector();
            
            // Otevření modalu
            openModal('order-modal');
        });
        
        // Nastavení event listenerů pro modály a formuláře
        setupModalListeners();
        setupOrderFormListeners();
        setupConfirmationListeners();
        setupSettingsListeners();
        
        // Dynamický výběr produktů
        setupProductSelector();
        
        // Získání CSRF tokenu a poté kontrola přihlášení při načtení stránky
        try {
            await getCsrfToken();
            await checkSession();
        } catch (error) {
            console.error('Chyba při inicializaci:', error);
            showLoginScreen();
        }
    }
    
    // Funkce pro opravu funkcionality importu CSV
    function fixImportFunctionality() {
        console.log('Spouštím opravu importu...');
        
        // 1. Vylepšit tlačítko pro otevření modálu importu
        const importButton = document.getElementById('import-orders-btn');
        if (importButton) {
            importButton.onclick = function() {
                const modal = document.getElementById('import-modal');
                if (modal) {
                    modal.classList.add('active');
                    // Nastavit modal ihned po otevření
                    setupImportModal();
                }
            };
            console.log('Import tlačítko opraveno');
        }
        
        // 2. Okamžitá oprava modálu, pokud už je otevřený
        const openModal = document.getElementById('import-modal');
        if (openModal && openModal.classList.contains('active')) {
            setupImportModal();
        }
    }
    
    // Spuštění inicializace
    initApp();
});