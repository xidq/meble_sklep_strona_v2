document.addEventListener('DOMContentLoaded', () => {
    renderTabs();
    loadDashboard();
});

function renderTabs() {
    const container = document.createElement('div');
    container.className = 'user-container';
    container.innerHTML = `
        <nav class="sidebar">
            <button onclick="loadDashboard()">Dashboard</button>
            <button onclick="loadOrders()">Zamówienia</button>
            <button onclick="loadSettings()">Ustawienia</button>
        </nav>
        <main id="content">Ładowanie...</main>
    `;
    document.body.appendChild(container);
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

// NAPRAWIONE: Dashboard teraz wyświetla 'name' zgodnie ze strukturą w Ruście
async function loadDashboard() {
    try {
        const user = await fetchAndParse('/api/usr/self/data');
        document.getElementById('content').innerHTML = `
            <h1>Witaj, ${user.username || 'Użytkowniku'}</h1>
            <p>Email: ${user.email || 'Nie podano'}</p>
            <p>Imię i Nazwisko: ${user.name || '---'}</p> 
            <p>Status konta: ${user.valid ? 'Zweryfikowane' : 'Oczekuje'}</p>
        `;
    } catch (err) {
        document.getElementById('content').innerHTML = `<p style="color:red;">${err.message}</p>`;
    }
}

async function loadOrders() {
    try {
        const orders = await fetchAndParse('/api/usr/self/orders');
        if (orders.length === 0) {
            document.getElementById('content').innerHTML = `<h1>Twoje zamówienia</h1><p>Brak zamówień.</p>`;
            return;
        }
        document.getElementById('content').innerHTML = `
            <h1>Twoje zamówienia</h1>
            ${orders.map(o => `
                <div style="border:1px solid #ccc; margin:10px; padding:10px;">
                    <p><strong>FV:</strong> ${o.numer_fv} | <strong>Data:</strong> ${o.date}</p>
                    <p><strong>Status:</strong> ${o.oplacone ? 'Opłacone' : 'Czeka na płatność'}</p>
                    <p><strong>Kwota:</strong> ${o.cena.toFixed(2)} PLN</p>
                </div>
            `).join('')}
        `;
    } catch (err) {
        document.getElementById('content').innerHTML = `<p style="color:red;">${err.message}</p>`;
    }
}

// NAPRAWIONE: Formularz ustawień w całości tutaj
async function loadSettings() {
    try {
        const user = await fetchAndParse('/api/usr/self/data');

        document.getElementById('content').innerHTML = `
            <h1>Ustawienia konta</h1>
            <div id="settings-form" style="max-width: 400px; display: flex; flex-direction: column; gap: 10px;">
                <label>Imię i Nazwisko:</label>
                <input type="text" id="in_name" value="${user.name || ''}" style="padding: 5px;">
                
                <label>Email (zablokowany):</label>
                <input type="email" id="in_email" value="${user.email || ''}" readonly style="background:#edf2f7; border: 1px solid #cbd5e0; padding: 5px;">
                
                <label>Nowe hasło:</label>
                <input type="password" id="in_pass" placeholder="Wpisz, jeśli chcesz zmienić">
                
                <button id="btnSave" style="margin-top:10px; cursor:pointer;">Zapisz zmiany</button>
                
                <hr style="width:100%; margin: 20px 0;">
                
                <button id="btnDownload" style="background:#4a5568; color:white; cursor:pointer;">Pobierz moje dane (TXT)</button>
            </div>
        `;

        // Podpięcie zdarzeń do nowych przycisków
        document.getElementById('btnSave').addEventListener('click', saveSettings);
        document.getElementById('btnDownload').addEventListener('click', downloadUserData);

    } catch (err) {
        document.getElementById('content').innerHTML = `<p style="color:red;">Błąd ładowania: ${err.message}</p>`;
    }
}

async function saveSettings() {
    const name = document.getElementById('in_name').value;
    const newPass = document.getElementById('in_pass').value;

    const payload = {
        name: name,
        new_password: (newPass && newPass.trim() !== "") ? newPass : null
    };

    try {
        const currentUser = JSON.parse(localStorage.getItem('currentUser'));
        const response = await fetch('/api/usr/account', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${currentUser ? currentUser.token : ''}`
            },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            alert("Dane zaktualizowane!");
            loadSettings();
        } else {
            alert("Błąd aktualizacji danych.");
        }
    } catch (err) {
        alert("Błąd połączenia z serwerem.");
    }
}

async function downloadUserData() {
    try {
        const user = await fetchAndParse('/api/usr/data');

        const safeData = { ...user };
        delete safeData.id;
        delete safeData.password_hash;

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