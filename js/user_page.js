const ORDER_STATUS_MAP = {
    'ZamowieniePrzyjete': { label: 'Zamówienie przyjęte', color: '#6c757d', bg: '#e9ecef' },
    'Wprzygotowaniu': { label: 'W realizacji', color: '#0056b3', bg: '#cce5ff' },
    'OczekujeNaWysylke': { label: 'Oczekuje na wysyłkę', color: '#004085', bg: '#b8daff' },
    'Wpodrozy': { label: 'W podróży', color: '#155724', bg: '#d4edda' },
    'Dostarczone': { label: 'Dostarczone', color: '#721c24', bg: '#f8d7da' }
};
const PAYMENT_STATUS_MAP = {
    'Nieoplacone': { label: 'Oczekuje na płatność', color: '#856404', bg: '#fff3cd' },
    'Oplacone': { label: 'Opłacone', color: '#155724', bg: '#d4edda' },
    'Zwrocone': { label: 'Zwrócono środki', color: '#383d41', bg: '#e2e3e5' },
    'Czesciowo': { label: 'Opłacone częściowo', color: '#721c24', bg: '#f8d7da' }
};

const specialCharsRegex = /[<>{}[\\]\\\/@#$%^&*()_+=~`|]/;
// const nameRegex = /^[a-zA-ZąćęłńóśźżĄĆĘŁŃÓŚŹŻ\s\-]{2,50}$/;

let originalUserData = {};
const API_CACHE = {};
const CACHE_DURATION_MS = 10 * 60 * 1000; // 10 minut w milisekundach

document.addEventListener('DOMContentLoaded', () => {
    renderTabs();
    // loadDashboard().catch(console.error);
    const firstTab = document.querySelector('.userpage-button');
    loadDashboard(firstTab);
});

function renderTabs() {
    const container = document.createElement('div');
    container.className = 'user-container';
    container.innerHTML = `
        <nav class="sidebar">
            <button class="glow userpage-button active" onclick="loadDashboard(this)">Dashboard</button>
            <button class="glow userpage-button" onclick="loadOrders(this)">Zamówienia</button>
            <button class="glow userpage-button" onclick="loadSettings(this)">Ustawienia</button>
        </nav>
        <main id="content">Ładowanie...</main>
    `;
    document.body.appendChild(container);
}
async function fetchWithCache(url, forceRefresh = false) {
    const now = Date.now();

    // Sprawdzamy, czy dane są w cache, czy nie wymuszono odświeżenia i czy nie minęło 10 minut
    if (!forceRefresh && API_CACHE[url] && (now - API_CACHE[url].timestamp < CACHE_DURATION_MS)) {
        console.log(`[CACHE] Pobrano dane dla: ${url}`);
        return API_CACHE[url].data;
    }

    // Jeśli nie ma w cache, pobieramy standardowo z serwera
    console.log(`[API] Pobieram świeże dane dla: ${url}`);
    const data = await fetchAndParse(url);

    // Zapisujemy wynik do cache
    API_CACHE[url] = {
        data: data,
        timestamp: now
    };

    return data;
}
function clearApiCache(url = null) {
    if (url) {
        delete API_CACHE[url];
    } else {
        for (let key in API_CACHE) delete API_CACHE[key];
    }
}

async function fetchAndParse(url) {
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    const token = currentUser ? currentUser.token : "";

    const res = await fetch(url, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        }
    });

    if (res.status === 401) {
        throw new Error("Brak autoryzacji.");
    }

    const text = await res.text();
    try {
        return JSON.parse(text);
    } catch (e) {
        throw new Error("Błąd serwera: " + text);
    }
}

async function loadDashboard(btn) {
    setActiveTab(btn);
    try {
        // const user = await fetchAndParse('/api/usr/self/data');
        const user = await fetchWithCache('/api/usr/self/data');
        document.getElementById('content').innerHTML = `
            <h1>Witaj, ${user.username || 'Użytkowniku'}</h1>
            <p>Email: ${user.email || 'Nie podano'}</p>
            <p>Imię i Nazwisko: ${user.name + " " + user.surname || '---'}</p> 
            <p>Status konta: ${user.valid ? 'Zweryfikowane' : 'Oczekuje'}</p>
        `;
    } catch (err) {
        document.getElementById('content').innerHTML = `<p style="color:red;">${err.message}</p>`;
    }
}

async function loadOrders(btn) {
    setActiveTab(btn);
    try {
        // const orders = await fetchAndParse('/api/usr/self/orders');
        const orders = await fetchWithCache('/api/usr/self/orders');
        if (orders.length === 0) {
            document.getElementById('content').innerHTML = `<h1>Twoje zamówienia</h1><p>Brak zamówień.</p>`;
            return;
        }
        document.getElementById('content').innerHTML = `
            <h1>Twoje zamówienia</h1>
            ${orders.map(o => `
                <div style="border:1px solid #ccc; margin:10px; padding:10px;">
                    <p><strong>FV:</strong> ${o.numer_fv} | <strong>Data:</strong> ${o.date}</p>
                    <p><strong>Status płatności:</strong> ${PAYMENT_STATUS_MAP[o.oplacone]?.label || o.oplacone}</p>
                    <p><strong>Status dostawy:</strong> ${ORDER_STATUS_MAP[o.status]?.label || o.status}</p>
                    <p><strong>Kwota:</strong> ${o.cena.toFixed(2)} PLN</p>
                </div>
            `).join('')}
        `;
    } catch (err) {
        document.getElementById('content').innerHTML = `<p style="color:red;">${err.message}</p>`;
    }
}
function setActiveTab(buttonElement) {
    document.querySelectorAll('.userpage-button').forEach(btn => {
        btn.classList.remove('active');
    });
    if (buttonElement) {
        buttonElement.classList.add('active');
    }
}
async function loadSettings(btn) {
    // setActiveTab(btn);
    if(btn) setActiveTab(btn);
    try {
        // const user = await fetchAndParse('/api/usr/self/data');
        const user = await fetchWithCache('/api/usr/self/data');

        originalUserData = {
            name: user.name || '',
            surname: user.surname || '',
            email: user.email || ''
        };

        document.getElementById('content').innerHTML = `
            <h1>Ustawienia konta</h1>
            <div id="settings-form">
                <div class="form-group">
                    <label for="in_name">Imię: <span class="modified-dot" id="dot_name"></span></label>
                    <input type="text" id="in_name" name="given-name" autocomplete="given-name" value="${user.name || ''}" style="padding: 5px;">
                </div>
                <div class="form-group">
                    <label for="in_surname">Nazwisko: <span class="modified-dot" id="dot_surname"></span></label>
                    <input type="text" id="in_surname" name="family-name" autocomplete="family-name" value="${user.surname || ''}" style="padding: 5px;">
                </div>
                <!-- <div class="form-group">
                    <label>Email (zablokowany):</label>
                    <input type="email" id="in_email" value="${user.email || ''}" readonly style="background:#edf2f7; border: 1px solid #cbd5e0; padding: 5px;">
                </div> -->
                
                <p id="settingsMessage" style="font-weight: bold; font-size: 12px; margin: 5px 0;"></p>
                <button class="submit-btn" id="btnSave" disabled>Zapisz zmiany</button>
                <hr style="width:100%; margin: 20px 0;">

                <div class="form-group">
                    <label for="in_old_pass">Stare hasło:</label>
                    <input type="password" id="in_old_pass" name="current-password" autocomplete="current-password" placeholder="Wpisz, jeśli chcesz zmienić">
                </div>
                <div class="form-group">
                    <label for="in_pass">Nowe hasło:</label>
                    <input type="password" id="in_pass" name="new-password" autocomplete="off" placeholder="Wpisz, jeśli chcesz zmienić">
                </div>
                <div class="form-group">
                    <label for="in_pass_retry">Powtórz nowe hasło:</label>
                    <input type="password" id="in_pass_retry" name="confirm-password" autocomplete="off" placeholder="Wpisz, jeśli chcesz zmienić">
                </div>
                
                <p id="passwordMessage" style="font-weight: bold; font-size: 12px; margin: 5px 0;"></p>
                <button class="submit-btn" id="btnChangePassword" disabled>Zapisz zmiany</button>
                
                <hr style="width:100%; margin: 20px 0;">
                <div class="form-group">
                    <label for="in_del_pass">Aktualne hasło:</label>
                    <input type="password" id="in_del_pass" name="current-password" autocomplete="current-password" placeholder="Wpisz aktualne hasło">
                </div>
                <div class="form-group">
                    <label for="in_del_retry_pass">Powtórz aktualne hasło:</label>
                    <input type="password" id="in_del_retry_pass" name="current-password" autocomplete="current-password" placeholder="Wpisz aktualne hasło">
                </div>
                <button class="submit-btn danger-btn" id="btnDeleteAcc" disabled>Usuń konto!</button>
                <hr style="width:100%; margin: 20px 0;">

                
                <button id="btnDownload" style="background:#4a5568; color:white; cursor:pointer;">Pobierz moje dane (TXT)</button>
            </div>
        `;


        document.getElementById('btnSave').addEventListener('click', saveSettings);
        document.getElementById('btnChangePassword').addEventListener('click', changePassword);
        document.getElementById('btnDownload').addEventListener('click', downloadUserData);

        document.getElementById('btnDeleteAcc').addEventListener('click', deleteUserAcc);

        document.getElementById('in_name').addEventListener('input', (e) => checkModification('name', e.target.value));
        document.getElementById('in_surname').addEventListener('input', (e) => checkModification('surname', e.target.value));

        document.getElementById('in_old_pass').addEventListener('input', checkPasswordInputs);
        document.getElementById('in_pass').addEventListener('input', checkPasswordInputs);
        document.getElementById('in_pass_retry').addEventListener('input', checkPasswordInputs);

        document.getElementById('in_del_pass').addEventListener('input', checkDelPasswordInputs);
        document.getElementById('in_del_retry_pass').addEventListener('input', checkDelPasswordInputs);
    } catch (err) {
        document.getElementById('content').innerHTML = `<p style="color:red;">Błąd ładowania: ${err.message}</p>`;
    }
}

// function checkModification(field, currentValue) {
//     const dot = document.getElementById(`dot_${field}`);
//     if (currentValue.trim() !== originalUserData[field]) {
//         dot.classList.add('active');
//     } else {
//         dot.classList.remove('active');
//     }
// }
function checkModification(field, currentValue) {
    const dot = document.getElementById(`dot_${field}`);
    if (currentValue !== originalUserData[field]) {
        dot.classList.add('active');
    } else {
        dot.classList.remove('active');
    }

    const currentName = document.getElementById('in_name')?.value || '';
    const currentSurname = document.getElementById('in_surname')?.value || '';

    const isChanged = (currentName !== originalUserData.name) || (currentSurname !== originalUserData.surname);

    const btnSave = document.getElementById('btnSave');
    if (btnSave) {
        btnSave.disabled = !isChanged;
    }
}
function checkPasswordInputs() {
    const oldPass = document.getElementById('in_old_pass')?.value || '';
    const newPass = document.getElementById('in_pass')?.value || '';
    const newPassRetry = document.getElementById('in_pass_retry')?.value || '';

    const btnChangePassword = document.getElementById('btnChangePassword');
    if (btnChangePassword) {
        const isValid = oldPass.length > 0 && newPass.length > 0 && newPassRetry.length > 0 && newPass === newPassRetry && newPass !== oldPass;
        btnChangePassword.disabled = !isValid;
    }
}
function checkDelPasswordInputs() {
    const Pass = document.getElementById('in_del_pass')?.value || '';
    const retryPass = document.getElementById('in_del_retry_pass')?.value || '';
    const btnDeleteAcc = document.getElementById('btnDeleteAcc');

    if (btnDeleteAcc) {
        const isValid = Pass.length > 0 && retryPass.length > 0 && Pass === retryPass;
        btnDeleteAcc.disabled = !isValid;
    }
}

async function deleteUserAcc() {
    const pass = document.getElementById('in_del_pass')?.value;
    const retryPass = document.getElementById('in_del_retry_pass')?.value;

    if (!pass || pass !== retryPass) {
        showMessage('passwordMessage', 'Hasła potwierdzające muszą być identyczne.', true);
        return;
    }

    const confirmed = window.confirm("Czy na pewno chcesz usunąć konto?\n\nPamiętaj: ta operacja jest NIEODWRACALNA!");
    if (!confirmed) {
        return; // Użytkownik anulował operację
    }

    try {
        const currentUser = JSON.parse(localStorage.getItem('currentUser'));
        const response = await fetch('/api/usr/account/usr/self/data', {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${currentUser ? currentUser.token : ''}`
            },
            body: JSON.stringify({ password: pass })
        });

        if (response.ok) {
            try {
                await fetch('/api/logout', { method: 'POST' });
            } catch (err) {
                console.error("Błąd podczas wylogowywania na serwerze:", err);
            }
            if (typeof disconnectWebSocket === "function") {
                disconnectWebSocket();
            }
            sessionStorage.removeItem('cachedUser');
            localStorage.removeItem('currentUser');
            clearApiCache();

            alert("Twoje konto zostało pomyślnie usunięte.");
            window.location.reload();
        } else {
            const errData = await response.json().catch(() => ({}));
            alert(errData.error || 'Nie udało się usunąć konta. Sprawdź poprawność hasła.');
        }
    } catch (err) {
        alert('Błąd połączenia z serwerem: ' + err.message);
    }
}

async function saveSettings() {
    clearValidationStyles(['in_name', 'in_surname']);
    showMessage('settingsMessage', '');

    const name = document.getElementById('in_name').value.trim();
    const surname = document.getElementById('in_surname').value.trim();

    // Walidacja imienia i nazwiska
    if (name !== "" && specialCharsRegex.test(name)) {
        document.getElementById('in_name').classList.add('input-error');
        showMessage('settingsMessage', 'Imię zawiera niedozwolone znaki specjalne.', true);
        return;
    }
    if (surname !== "" && specialCharsRegex.test(surname)) {
        document.getElementById('in_surname').classList.add('input-error');
        showMessage('settingsMessage', 'Nazwisko zawiera niedozwolone znaki specjalne.', true);
        return;
    }

    const payload = {
        username: "huehue",
        name: (name !== "") ? name : null,
        surname: (surname !== "") ? surname : null,
        email: null,
        // Email jest zablokowany, więc go nie wysyłamy do zmiany
    };

    try {
        const currentUser = JSON.parse(localStorage.getItem('currentUser'));
        const response = await fetch('/api/usr/account/usr/self/data', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${currentUser ? currentUser.token : ''}`
            },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            showMessage('settingsMessage', 'Dane zaktualizowane pomyślnie!');
            // Odświeżenie interfejsu (kropki znikną)
            clearApiCache('/api/usr/self/data');
            setTimeout(() => loadSettings(), 1000);
        } else {
            showMessage('settingsMessage', 'Błąd aktualizacji danych na serwerze.', true);
        }
    } catch (err) {
        showMessage('settingsMessage', 'Błąd połączenia z serwerem.', true);
    }
}

async function changePassword() {
    clearValidationStyles(['in_old_pass', 'in_pass', 'in_pass_retry']);
    showMessage('passwordMessage', '');

    const oldPass = document.getElementById('in_old_pass').value;
    const newPass = document.getElementById('in_pass').value;
    const newSecondPass = document.getElementById('in_pass_retry').value;

    if (!oldPass || !newPass || !newSecondPass) {
        showMessage('passwordMessage', 'Wypełnij wszystkie pola haseł.', true);
        return;
    }

    if (newPass.length < 8 || newPass.length > 100) {
        document.getElementById('in_pass').classList.add('input-error');
        showMessage('passwordMessage', 'Nowe hasło musi mieć od 8 do 100 znaków.', true);
        return;
    }

    if (newPass !== newSecondPass) {
        document.getElementById('in_pass').classList.add('input-error');
        document.getElementById('in_pass_retry').classList.add('input-error');
        showMessage('passwordMessage', 'Nowe hasła nie są identyczne.', true);
        return;
    }

    if (oldPass === newPass) {
        document.getElementById('in_pass').classList.add('input-error');
        showMessage('passwordMessage', 'Nowe hasło musi być inne niż stare.', true);
        return;
    }

    const payload = {
        old_password: oldPass,
        new_password: newPass
    };

    try {
        const currentUser = JSON.parse(localStorage.getItem('currentUser'));
        const response = await fetch('/api/usr/account/usr/self/password/', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${currentUser ? currentUser.token : ''}`
            },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            showMessage('passwordMessage', 'Hasło zostało pomyślnie zmienione!');
            document.getElementById('in_old_pass').value = '';
            document.getElementById('in_pass').value = '';
            document.getElementById('in_pass_retry').value = '';
        } else {
            const errData = await response.json().catch(() => ({}));
            showMessage('passwordMessage', errData.error || 'Stare hasło jest niepoprawne lub wystąpił błąd.', true);
        }
    } catch (err) {
        showMessage('passwordMessage', 'Błąd połączenia z serwerem.', true);
    }
}

function showMessage(elementId, msg, isError = false) {
    const el = document.getElementById(elementId);
    el.textContent = msg;
    el.style.color = isError ? "red" : "green";
}

function clearValidationStyles(ids) {
    ids.forEach(id => document.getElementById(id).classList.remove('input-error'));
}

async function downloadUserData() {
    try {
        const user = await fetchAndParse('/api/usr/data');

        const safeData = { ...user };
        delete safeData.id;
        delete safeData['password_hash'];

        const textContent = JSON.stringify(safeData, null, 2);
        const blob = new Blob([textContent], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `moje_dane.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch (err) {
        alert("Błąd pobierania danych: " + err.message);
    }
}