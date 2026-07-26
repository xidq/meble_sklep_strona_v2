// admin_panel.js
// --- KONFIGURACJA ---
// const BACKEND_URL = "127.0.0.1";
// const WS_URL = `ws://${BACKEND_URL}:8080/wss`;
// const API_URL = `http://${BACKEND_URL}:8080/api/products`;

// --- ZMIENNE GLOBALNE ---
let currentUser = null;
let allProducts = [];
let socket = null;
let allUsers = [];
let isEditingUser = false; // Flaga określająca tryb POST/PUT
let originalUserData = {};

// --- ELEMENTY DOM ---
const saveProductBtn = document.getElementById('saveProductBtn');
const saveUserBtn = document.getElementById('saveUserBtn');
const newProductModeBtn = document.getElementById('newProductModeBtn');
const newUserModeBtn = document.getElementById('newUserModeBtn');
const productsContainer = document.getElementById('productsContainer');
const usersContainer = document.getElementById('usersContainer');
const formTitle = document.getElementById('formTitle');
const formUserTitle = document.getElementById('formUserTitle');
const adminMessage = document.getElementById('adminMessage');
const deleteUserBtn = document.getElementById('deleteUserBtn');

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

            // Pobieranie danych po wejściu w zakładkę
            if (targetTabId === 'tab-users') fetchUsers();
            if (targetTabId === 'tab-products') fetchProducts();
        });
    });

    // 2. Start systemu (Usunięto WS)
    checkAuth();
});
newProductModeBtn.addEventListener('click', () => {
    document.querySelectorAll('#tab-products .form-panel input, #tab-products .form-panel textarea').forEach(el => {
        if (el.id === 'p_id') el.value = "0";
        else el.value = "";
    });

    const nameIdInput = document.getElementById('p_name_id');
    nameIdInput.readOnly = false;
    nameIdInput.style.background = '#fff';
    document.getElementById('p_uploadSection').style.display = 'none';

    formTitle.textContent = "🛠️ Dodaj Nowy Produkt";
    deselectAll('.product-item');
});
async function fetchProducts() {
    try {
        const response = await fetch("/api/getproducts"); // Powinno lecieć z cache z serwera Go
        if (!response.ok) throw new Error("Błąd pobierania");
        allProducts = await response.json();
        renderProductsList();
    } catch (error) {
        productsContainer.innerHTML = `<span style="color:red">${error.message}</span>`;
    }
}

// --- LOGIKA WEBSOCKET ---
// function connectWebSocket() {
//     socket = new WebSocket("/wss");
//
//     socket.onopen = () => {
//         console.log("[WS] Połączono z serwerem!");
//     };
//
//     socket.onmessage = (event) => {
//         const data = JSON.parse(event.data);
//         if (data.type === 'REFRESH_PRODUCTS') {
//             fetchProducts();
//         }
//     };
//
//     socket.onclose = () => {
//         console.log("[WS] Rozłączono. Próba połączenia za 5s...");
//         setTimeout(connectWebSocket, 5000);
//     };
// }

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
        div.innerHTML = `<small>ID: ${prod.id}</small><br><strong>${prod.name_pl || prod.name_id}</strong>`;
        div.onclick = () => {
            deselectAll('.product-item');
            div.classList.add('selected');
            selectProductForEdit(prod);
        };
        productsContainer.appendChild(div);
    });
}

async function fetchProducts() {
    try {
        const response = await fetch("/api/getproducts"); // Powinno lecieć z cache z serwera Go
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

newUserModeBtn.addEventListener('click', () => {
    isEditingUser = false;
    originalUserData = {};
    clearAllModifiedDots();

    document.querySelectorAll('#tab-users .form-panel input').forEach(el => el.value = "");

    const usernameInput = document.getElementById('u_username');
    if (usernameInput) {
        usernameInput.readOnly = false;
        usernameInput.style.background = '#fff';
    }

    const validCheckbox = document.getElementById('u_valid');
    if (validCheckbox) validCheckbox.checked = false; // Domyślnie odznaczony dla nowego

    const roleSelect = document.getElementById('u_permission');
    if (roleSelect) roleSelect.value = "User";

    if (formUserTitle) formUserTitle.textContent = "🛠️ Dodaj Nowego Użytkownika";
    if (deleteUserBtn) deleteUserBtn.style.display = 'none';
    deselectAll();
});

async function fetchUsers() {
    try {
        const response = await fetch("/api/admin/usr", {
            headers: { 'Authorization': `Bearer ${currentUser.token}` }
        });
        if (!response.ok) throw new Error("Błąd pobierania użytkowników");
        allUsers = await response.json();

        console.log("%c--- 1. DANE Z LISTY (/api/admin/usr) ---", "color: #00ff00; font-weight: bold;");
        console.log(allUsers);

        renderUsersList();
    } catch (error) {
        usersContainer.innerHTML = `<span style="color:red">${error.message}</span>`;
    }
}

function renderUsersList() {
    usersContainer.innerHTML = "";
    allUsers.forEach(user => {
        const div = document.createElement('div');
        div.className = 'product-item user-item';
        div.innerHTML = `
            <strong>${user.username}</strong><br>
            <small>Id:${user.id}</small>
        `;
        div.onclick = async () => {
            deselectAll('.user-item');
            div.classList.add('selected');
            // await selectUserForEdit(user.username);
            await selectUserForEdit(user);
        };
        usersContainer.appendChild(div);
    });
}

async function selectUserForEdit(userObj) {
    isEditingUser = true;
    clearAllModifiedDots();
    const name_id = typeof userObj === 'object' ? userObj.username : userObj;
    const listId = typeof userObj === 'object' ? userObj.id : null;

    // Zapamiętujemy uprawnienie, które PRZYSZŁO Z LISTY
    const fallbackPermission = (typeof userObj === 'object' && userObj.permission) ? userObj.permission : "User";
    try {
        const response = await fetch(`/api/admin/usr/${name_id}`, {
            headers: { 'Authorization': `Bearer ${currentUser.token}` }
        });

        if (!response.ok) throw new Error(`Błąd HTTP: ${response.status}`);

        let data = await response.json();
        console.log("Szczegóły użytkownika z backendu:", data);

        const u = data.user || data.data || data;

        // Wyciąganie wartości z backendu
        const id = u.id ?? u.ID ?? u.user_id ?? listId ?? "";
        const username = u.username || u.Username || name_id || "";
        const email = u.email || u.Email || "";
        const name = u.name || u.Name || u.imie || u.Imie || "";
        const surname = u.surname || u.Surname || u.nazwisko || u.Nazwisko || "";

        // 2. Poprawione dopasowanie Roli dla u_permission
        const rawRole = String(u.permission || u.Permission || u.role || u.Role || fallbackPermission).trim();        // let rawRole = u.permission || u.Permission || u.role || u.Role || "User";
        // Normalizacja pierwszej litery na dużą (np. admin -> Admin, user -> User)
        const roleSelect = document.getElementById('u_permission');
        if (roleSelect) {
            // Szukamy opcji w select, porównując wartości bez względu na wielkość liter
            const matchedOption = Array.from(roleSelect.options).find(
                option => option.value.toLowerCase() === rawRole.toLowerCase()
            );

            if (matchedOption) {
                roleSelect.value = matchedOption.value; // Ustawiamy właściwą wartość z opcji
            } else {
                roleSelect.value = "User"; // Domyślna wartość w przypadku braku dopasowania
            }
        }

        // 1. Poprawiony Checkbox valid (sprawdzamy czy jawnie zwrócono true)
        const isValid = (u.valid !== undefined) ? u.valid :
            (u.Valid !== undefined) ? u.Valid :
                (u.registration_conditions !== undefined) ? u.registration_conditions : false;

        // Ustawianie wartości w formularzu
        document.getElementById('u_id').value = id;
        document.getElementById('u_username').value = username;
        document.getElementById('u_email').value = email;
        document.getElementById('u_name').value = name;
        document.getElementById('u_surname').value = surname;

        // const roleSelect = document.getElementById('u_permission');
        // if (roleSelect) {
        //     roleSelect.value = rawRole;
        // }

        const validCb = document.getElementById('u_valid');
        if (validCb) {
            validCb.checked = Boolean(isValid);
        }

        // Zapis stanu początkowego do porównywania zmian (punkt 3)
        originalUserData = {
            'u_id': String(id),
            'u_username': String(username),
            'u_email': String(email),
            'u_name': String(name),
            'u_surname': String(surname),
            'u_permission': String(rawRole),
            'u_valid': Boolean(isValid)
        };

        // Blokada pola username w trybie edycji
        const usernameInput = document.getElementById('u_username');
        if (usernameInput) {
            usernameInput.readOnly = true;
            usernameInput.style.background = '#eee';
        }

        if (formUserTitle) formUserTitle.textContent = `Edycja: ${username}`;

    } catch (error) {
        console.error("Błąd podczas pobierania szczegółów użytkownika:", error);
        alert("Nie udało się załadować szczegółowych danych użytkownika.");
    }
    if (deleteUserBtn) deleteUserBtn.style.display = 'block';
}

saveUserBtn.addEventListener('click', async () => {
    const usernameElem = document.getElementById('u_username');
    const username = usernameElem ? usernameElem.value : "";
    if (!username) { alert("Podaj username!"); return; }
    const getVal = (id) => {
        const el = document.getElementById(id);
        return el ? el.value : "";
    };

    let payload = {};
    let method = isEditingUser ? 'PUT' : 'POST';

    if (isEditingUser) {
        // Payload dla PUT (bez haseł)
        payload = {
            username: username,
            email: getVal('u_email'),
            name: getVal('u_name'),
            surname: getVal('u_surname'),
            registration_conditions: true
        };
    } else {
        // Payload dla POST (sztywne hasło 123456)
        const validElem = document.getElementById('u_valid');
        payload = {
            username: username,
            password: "12345678",
            confirm_password: "12345678",
            email: getVal('u_email'),
            name: getVal('u_name'),
            surname: getVal('u_surname'),
            registration_conditions: true
        };
    }

    try {
        const response = await fetch('/api/admin/usr', {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${currentUser.token}`
            },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            alert(isEditingUser ? "Zaktualizowano użytkownika!" : "Dodano użytkownika!");
            await fetchUsers();
        } else {
            const errData = await response.text();
            alert(`Błąd zapisu: ${errData}`);
        }
    } catch (err) {
        console.error("Błąd sieci:", err);
        alert("Błąd połączenia z serwerem.");
    }
});

// --- LOGIKA TESTERA ENDPOINTÓW ---
document.addEventListener('DOMContentLoaded', () => {
    const chkMethod = document.getElementById('chk_method');
    const chkEndpoint = document.getElementById('chk_endpoint');
    const chkBody = document.getElementById('chk_body');
    const chkBodyContainer = document.getElementById('chk_body_container');
    const chkSendBtn = document.getElementById('chk_sendBtn');
    const chkStatus = document.getElementById('chk_status');
    const chkResponseOutput = document.getElementById('chk_responseOutput');

    if (!chkSendBtn) return;

    // Pokazywanie pola Body tylko dla metod POST i PUT
    chkMethod.addEventListener('change', () => {
        if (chkMethod.value === 'POST' || chkMethod.value === 'PUT') {
            chkBodyContainer.style.display = 'block';
        } else {
            chkBodyContainer.style.display = 'none';
        }
    });

    chkSendBtn.addEventListener('click', async () => {
        // Usuwamy ewentualny początkowy slash, aby ścieżka się nie duplikowała
        let path = chkEndpoint.value.trim();
        if (path.startsWith('/')) {
            path = path.substring(1);
        }

        const targetUrl = `/api/admin/check_response/${path}`;
        const method = chkMethod.value;

        chkStatus.textContent = "Wysyłanie...";
        chkStatus.style.color = "#e6a23c";
        chkResponseOutput.textContent = "Ładowanie danych...";

        const options = {
            method: method,
            headers: {
                'Authorization': `Bearer ${currentUser?.token || ''}`
            }
        };

        if ((method === 'POST' || method === 'PUT') && chkBody.value.trim() !== "") {
            options.headers['Content-Type'] = 'application/json';
            options.body = chkBody.value;
        }

        try {
            const response = await fetch(targetUrl, options);

            chkStatus.textContent = `Status: ${response.status} ${response.statusText}`;
            chkStatus.style.color = response.ok ? "#28a745" : "#dc3545";

            const rawText = await response.text();

            // Spróbujmy sparsować odpowiedź jako JSON do ładnego formatowania
            try {
                const jsonObj = JSON.parse(rawText);
                chkResponseOutput.textContent = JSON.stringify(jsonObj, null, 2);
            } catch (e) {
                // Jeśli to nie JSON, wyświetl czysty tekst/HTML
                chkResponseOutput.textContent = rawText;
            }
        } catch (err) {
            console.error("Błąd zapytania testera:", err);
            chkStatus.textContent = "Błąd połączenia z serwerem";
            chkStatus.style.color = "#dc3545";
            chkResponseOutput.textContent = err.toString();
        }
    });
});

// Helper do pokazywania/ukrywania zielonej kropeczki przy etykiecie
function updateFieldModifiedStatus(fieldId, isModified) {
    const el = document.getElementById(fieldId);
    if (!el) return;
    const group = el.closest('.form-group');
    if (!group) return;

    let dot = group.querySelector('.modified-dot');
    if (isModified) {
        if (!dot) {
            dot = document.createElement('span');
            dot.className = 'modified-dot';
            dot.title = 'Pole zostało zmodyfikowane';
            const label = group.querySelector('label');
            if (label) label.appendChild(dot);
        }
    } else {
        if (dot) dot.remove();
    }
}

// Czyszczenie wszystkich kropek modyfikacji
function clearAllModifiedDots() {
    document.querySelectorAll('#tab-users .modified-dot').forEach(dot => dot.remove());
}

// Nasłuchiwanie zmian na formularzu użytkownika
document.addEventListener('DOMContentLoaded', () => {
    const userFormInputs = document.querySelectorAll('#tab-users .form-panel input, #tab-users .form-panel select');
    userFormInputs.forEach(input => {
        const handler = () => {
            if (!isEditingUser) {
                clearAllModifiedDots();
                return;
            }

            let isModified = false;
            let origVal = originalUserData[input.id];

            if (input.type === 'checkbox') {
                isModified = input.checked !== Boolean(origVal);
            } else {
                isModified = String(input.value || '').trim() !== String(origVal || '').trim();
            }

            updateFieldModifiedStatus(input.id, isModified);
        };

        input.addEventListener('input', handler);
        input.addEventListener('change', handler);
    });
});

deleteUserBtn.addEventListener('click', async () => {
    // 1. Wyciągamy ID użytkownika z pola formularza
    const userIdInput = document.getElementById('u_id');
    const userId = userIdInput ? parseInt(userIdInput.value) : 0;
    const usernameInput = document.getElementById('u_username');
    const username = usernameInput ? usernameInput.value : "";

    if (!userId) {
        alert("Brak wybranego użytkownika do usunięcia!");
        return;
    }

    // 2. Komunikat potwierdzający
    const confirmed = confirm(`Czy na pewno chcesz usunąć użytkownika: "${username}" (ID: ${userId})?`);
    if (!confirmed) return;

    try {
        // 3. Wysyłanie zapytania DELETE pod adres edycji z tagiem "delete" i ID w ciele zapytania
        const response = await fetch(`/api/admin/usr/${userId}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${currentUser.token}`
            },
            body: JSON.stringify({
                tag: "delete",
                id: userId
            })
        });

        if (response.ok) {
            alert("Użytkownik został pomyślnie usunięty!");

            // Czyszczenie formularza i ukrycie przycisku
            if (newUserModeBtn) newUserModeBtn.click();

            // Odświeżenie listy użytkowników
            await fetchUsers();
        } else {
            const errData = await response.text();
            alert(`Błąd usuwania użytkownika: ${errData}`);
        }
    } catch (err) {
        console.error("Błąd sieci podczas usuwania:", err);
        alert("Błąd połączenia z serwerem.");
    }
});