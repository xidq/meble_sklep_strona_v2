// admin_panel.js
// --- KONFIGURACJA ---
// const BACKEND_URL = "127.0.0.1";
// const WS_URL = `ws://${BACKEND_URL}:8080/wss`;
// const API_URL = `http://${BACKEND_URL}:8080/api/products`;

// --- ZMIENNE GLOBALNE ---
let currentUser = null;
let allProducts = [];
let socket = null;

// --- ELEMENTY DOM ---
const saveProductBtn = document.getElementById('saveProductBtn');
const newProductModeBtn = document.getElementById('newProductModeBtn');
const productsContainer = document.getElementById('productsContainer');
const formTitle = document.getElementById('formTitle');
const adminMessage = document.getElementById('adminMessage');

// --- INICJALIZACJA ---

function deselectAll() {
    document.querySelectorAll('.product-item').forEach(el => el.classList.remove('selected'));
}
document.addEventListener('DOMContentLoaded', () => {
    // 1. Obsługa zakładek
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabSections = document.querySelectorAll('.tab-section');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetTabId = button.getAttribute('data-tab');
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabSections.forEach(section => section.classList.remove('active'));
            button.classList.add('active');
            document.getElementById(targetTabId).classList.add('active');
        });
    });

    // 2. Start systemu
    connectWebSocket();
    // fetchProducts();
    checkAuth();
});
newProductModeBtn.addEventListener('click', () => {
    // 1. Reset formularza (pola na puste lub 0)
    document.querySelectorAll('.form-panel input, .form-panel textarea').forEach(el => {
        if (el.id === 'p_id') el.value = "0";
        else el.value = "";
    });

    // 2. Odblokowanie Name_ID
    const nameIdInput = document.getElementById('p_name_id');
    nameIdInput.readOnly = false;
    nameIdInput.style.background = '#fff';

    // 3. Ukrycie sekcji wgrywania (zakładając, że owiniesz ją w HTML w div z id="p_uploadSection")
    document.getElementById('p_uploadSection').style.display = 'none';

    formTitle.textContent = "🛠️ Dodaj Nowy Produkt";
    deselectAll();
});

// --- LOGIKA WEBSOCKET ---
function connectWebSocket() {
    socket = new WebSocket("/ws");

    socket.onopen = () => {
        console.log("[WS] Połączono z serwerem!");
    };

    socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'REFRESH_PRODUCTS') {
            fetchProducts();
        }
    };

    socket.onclose = () => {
        console.log("[WS] Rozłączono. Próba połączenia za 5s...");
        setTimeout(connectWebSocket, 5000);
    };
}

// --- LOGIKA PRODUKTÓW ---
// async function checkAuth() {
//     const storedUser = localStorage.getItem('currentUser');
//     if (!storedUser) {
//         window.location.href = "../index.html";
//         return;
//     }
//     currentUser = JSON.parse(storedUser);
//     if (currentUser.role !== "Admin") {
//         window.location.href = "../index.html";
//         return;
//     }
//     document.getElementById('adminPanel').style.display = 'block';
//     fetchProducts();
// }
// async function checkAuth() {
//     try {
//         const res = await fetch('/api/me', { credentials: 'include' });
//         if (!res.ok) throw new Error('Not authenticated');
//         const data = await res.json();
//         currentUser = data;
//         window.currentUser = data; // sync with global
//         if (currentUser.role !== "Admin") {
//             window.location.href = "../index.html";
//             return;
//         }
//         document.getElementById('adminPanel').style.display = 'block';
//         fetchProducts();
//     } catch (e) {
//         window.location.href = "../index.html";
//     }
// }

function renderProductsList() {
    productsContainer.innerHTML = "";
    allProducts.forEach(prod => {
        const div = document.createElement('div');
        div.className = 'product-item';
        // Wyświetlamy ID oraz nazwę
        div.innerHTML = `
            <small>ID: ${prod.id}</small><br>
            <strong>${prod.name}</strong><br>
            <small>Cena: ${prod.price_netto} PLN</small>
        `;
        div.onclick = () => selectProductForEdit(prod);
        productsContainer.appendChild(div);
    });
}

async function fetchProducts() {
    try {
        const response = await fetch("/api/getproducts");
        if (!response.ok) throw new Error("Błąd pobierania");
        allProducts = await response.json();
        renderProductsList();
    } catch (error) {
        productsContainer.innerHTML = `<span style="color:red">${error.message}</span>`;
    }
}

function selectProductForEdit(product) {
    document.getElementById('p_id').value = product.id;
    document.getElementById('p_name_id').value = product.name_id;

    // Zakładając, że backend zwraca odpowiednie pola:
    document.getElementById('p_name_pl').value = product.name_pl || "";
    document.getElementById('p_name_en').value = product.name_en || "";
    document.getElementById('p_desc_pl').value = product.desc_pl || "";
    document.getElementById('p_desc_en').value = product.desc_en || "";
    document.getElementById('p_price').value = product.price || 0;

    // Nowe pola
    document.getElementById('p_width').value = product.width || 0;
    document.getElementById('p_height').value = product.height || 0;
    document.getElementById('p_depth').value = product.depth || 0;
    document.getElementById('p_wood_qua').value = product.wood_qua || 0;
    document.getElementById('p_metal_qua').value = product.metal_qua || 0;
    document.getElementById('p_glass_qua').value = product.glass_qua || 0;

    document.getElementById('p_name_id').readOnly = true;
    document.getElementById('p_name_id').style.background = '#eee';

    // Pokazanie sekcji wgrywania
    document.getElementById('p_uploadSection').style.display = 'block';

    formTitle.textContent = `Edycja: ${product.name_pl || product.name_id}`;

    // Zaznaczenie wizualne (musisz dodać klasę w renderProductsList przy kliknięciu)
    deselectAll();
}

// Obsługa zapisu
saveProductBtn.addEventListener('click', async () => {

    const val = (id, isFloat = false) => {
        const element = document.getElementById(id);
        const rawValue = element.value;
        if (!rawValue || rawValue.trim() === "") return isFloat ? 0.0 : "";
        return isFloat ? parseFloat(rawValue) : rawValue;
    };
    // const productPayload = {
    //     id: parseInt(document.getElementById('p_id').value),
    //     name_id: document.getElementById('p_name_id').value,
    //     name_pl: document.getElementById('p_name_pl').value,
    //     name_en: document.getElementById('p_name_en').value,
    //     description_pl: document.getElementById('p_desc_pl').value,
    //     description_en: document.getElementById('p_desc_en').value,
    //     price: parseFloat(document.getElementById('p_price').value),
    //     width: parseFloat(document.getElementById('p_width').value),
    //     height: parseFloat(document.getElementById('p_height').value),
    //     depth: parseFloat(document.getElementById('p_depth').value),
    //     wood_qua: parseFloat(document.getElementById('p_wood_qua').value),
    //     metal_qua: parseFloat(document.getElementById('p_metal_qua').value),
    //     glass_qua: parseFloat(document.getElementById('p_glass_qua').value)
    // };
    const productPayload = {
        id: parseInt(document.getElementById('p_id').value) || 0,
        name_id: val('p_name_id'),
        name_pl: val('p_name_pl'),
        name_en: val('p_name_en'),
        desc_pl: val('p_desc_pl'),
        desc_en: val('p_desc_en'),
        price: val('p_price', true),
        width: val('p_width', true),
        height: val('p_height', true),
        depth: val('p_depth', true),
        wood_qua: val('p_wood_qua', true),
        metal_qua: val('p_metal_qua', true),
        glass_qua: val('p_glass_qua', true)
    };

    console.log("Wysyłam obiekt:", productPayload);

    const method = productPayload.id === 0 ? 'POST' : 'PUT';
    const requestUrl = productPayload.id === 0 ? "/api/getproducts" : `/api/getproducts/${productPayload.id}`;

    try {
        const response = await fetch(requestUrl, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${currentUser.token}`
            },
            body: JSON.stringify(productPayload)
        });

        if (response.ok) {
            adminMessage.textContent = "Zapisano pomyślnie!";
            await fetchProducts();
        } else {
            const errData = await response.text();
            console.error("Błąd serwera:", errData);
            adminMessage.textContent = "BŁĄD ZAPISU! Sprawdź konsolę (F12).";
        }
    } catch (err) {
        console.error("Błąd sieci:", err);
        adminMessage.textContent = "Błąd połączenia z serwerem.";
    }
});
async function checkAuth() {
    try {
        const res = await fetch('/api/me', { credentials: 'include' });
        if (!res.ok) throw new Error('Not authenticated');
        const data = await res.json();
        currentUser = data;
        window.currentUser = data;

        // Jeśli backend nie zwraca tokena, pobierz go z localStorage (z poprzedniego logowania)
        if (!currentUser.token) {
            const stored = localStorage.getItem('currentUser');
            if (stored) {
                const parsed = JSON.parse(stored);
                currentUser.token = parsed.token;
            }
        }

        if (currentUser.role !== "Admin") {
            window.location.href = "../index.html";
            return;
        }
        document.getElementById('adminPanel').style.display = 'block';
        fetchProducts();
    } catch (e) {
        console.error("Błąd autoryzacji:", e);
        // Spróbuj z localStorage jako fallback
        const stored = localStorage.getItem('currentUser');
        if (stored) {
            currentUser = JSON.parse(stored);
            window.currentUser = currentUser;
            if (currentUser.role === "Admin") {
                document.getElementById('adminPanel').style.display = 'block';
                fetchProducts();
                return;
            }
        }
        // Jeśli wszystko zawiedzie – redirect na stronę główną
        window.location.href = "../index.html";
    }
}