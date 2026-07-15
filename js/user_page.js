document.addEventListener('DOMContentLoaded', () => {
    renderTabs();
    loadDashboard(); // Domyślny widok przy starcie
});

function renderTabs() {
    // Dodajemy kontener bez niszczenia body/headera
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
    // Pobierz token z localStorage (upewnij się, że klucz jest właściwy)
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    const token = currentUser ? currentUser.token : ""; // Zakładam, że tam trzymasz token

    const res = await fetch(url, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}` // <--- KLUCZOWE
        }
    });

    if (res.status === 401) {
        throw new Error("Brak autoryzacji. Zaloguj się ponownie.");
    }

    const text = await res.text();
    try {
        return JSON.parse(text);
    } catch (e) {
        throw new Error("Serwer zwrócił błąd: " + text);
    }
}

async function loadDashboard() {
    try {
        const user = await fetchAndParse('http://127.0.0.1:8080/usr/usr');
        document.getElementById('content').innerHTML = `
            <h1>Witaj, ${user.username}</h1>
            <p>Email: ${user.email}</p>
            <p>Status konta: ${user.valid ? 'Zweryfikowane' : 'Oczekuje'}</p>
        `;
    } catch (err) {
        document.getElementById('content').innerHTML = `<p style="color:red;">${err.message}</p>`;
    }
}

async function loadOrders() {
    try {
        const orders = await fetchAndParse('http://127.0.0.1:8080/api/user/orders');
        if (orders.length === 0) {
            document.getElementById('content').innerHTML = `<h1>Twoje zamówienia</h1><p>Brak zamówień.</p>`;
            return;
        }
        document.getElementById('content').innerHTML = `
            <h1>Twoje zamówienia</h1>
            ${orders.map(o => `
                <div class="order-card" style="border:1px solid #ccc; margin:10px; padding:10px;">
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

function loadSettings() {
    document.getElementById('content').innerHTML = `
        <h1>Ustawienia</h1>
        <p>Tu będzie formularz zmiany hasła.</p>
    `;
}