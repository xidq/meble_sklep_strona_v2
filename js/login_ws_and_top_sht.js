
const userDropdown = document.getElementById('userDropdown');
const dropdownToggleBtn = document.getElementById('dropdownToggleBtn');
const authFormSection = document.getElementById('authFormSection');
const profileSection = document.getElementById('profileSection');

const wsSection = document.getElementById('wsSection');
const authBtn = document.getElementById('authBtn');
const logoutBtn = document.getElementById('logoutBtn');
const authToggleLink = document.getElementById('authToggleLink');
const authTitle = document.getElementById('authTitle');
const authMessage = document.getElementById('authMessage');
const userDisplay = document.getElementById('userDisplay');
const profileUser = document.getElementById('profileUser');
const profileRole = document.getElementById('profileRole');
const adminPanelLink = document.getElementById('adminPanelLink');

const statusEl = document.getElementById('status');
const sendBtn = document.getElementById('sendBtn');
const logsEl = document.getElementById('logs');

let socket = null;
let currentUser = null;
let isLoginMode = true;

// Obsługa otwierania/zamykania dropdownu
dropdownToggleBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    userDropdown.classList.toggle('open');
});
document.addEventListener('click', () => userDropdown.classList.remove('open'));
userDropdown.addEventListener('click', (e) => e.stopPropagation());

// PRZEŁĄCZANIE TRYBU LOGOWANIE / REJESTRACJA
authToggleLink.addEventListener('click', () => {
    isLoginMode = !isLoginMode;
    authMessage.textContent = "";
    document.getElementById('username').classList.remove('input-error');
    document.getElementById('password').classList.remove('input-error');

    if (isLoginMode) {
        authTitle.textContent = "Logowanie do systemu";
        authBtn.textContent = "Zaloguj";
        authToggleLink.textContent = "Nie masz konta? Zarejestruj się";
    } else {
        authTitle.textContent = "Tworzenie nowego konta";
        authBtn.textContent = "Zarejestruj się";
        authToggleLink.textContent = "Masz już konto? Zaloguj się";
    }
});

// OBSŁUGA LOGOWANIA / REJESTRACJI
authBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    authMessage.textContent = "";
    authMessage.style.color = "black";

    const uInput = document.getElementById('username');
    const pInput = document.getElementById('password');
    uInput.classList.remove('input-error');
    pInput.classList.remove('input-error');

    const username = uInput.value.trim();
    const password = pInput.value;
    const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;

    if (!isLoginMode) {
        if (!usernameRegex.test(username)) {
            uInput.classList.add('input-error');
            authMessage.style.color = "red";
            authMessage.textContent = "Błąd: Login musi mieć 3-20 znaków (litery, cyfry, '_').";
            return;
        }
        if (password.length < 8 || password.length > 100) {
            pInput.classList.add('input-error');
            authMessage.style.color = "red";
            authMessage.textContent = "Błąd: Hasło musi mieć od 8 do 100 znaków.";
            return;
        }
    } else {
        if (!usernameRegex.test(username) || !password) {
            authMessage.style.color = "red";
            authMessage.textContent = "Błędny format loginu lub nie uzupełniono pól.";
            if (!usernameRegex.test(username)) uInput.classList.add('input-error');
            if (!password) pInput.classList.add('input-error');
            return;
        }
    }

    const payload = { username, password };
    const endpoint = isLoginMode ? '/api/login' : '/api/register';

    try {
        const response = await fetch(`http://127.0.0.1:8080${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            if (response.status === 429) throw new Error("Zbyt wiele prób logowania. Spróbuj później.");
            let errorMessage = "Błąd autoryzacji serwera";
            try {
                const errorData = await response.json();
                errorMessage = errorData.error || errorMessage;
            } catch (e) {}
            throw new Error(errorMessage);
        }

        const data = await response.json();

        if (isLoginMode) {
            currentUser = data;

            // Zapis do localStorage na wypadek przejścia do panelu admina
            localStorage.setItem('currentUser', JSON.stringify(currentUser));

            // Zmiana interfejsu dropdownu
            authFormSection.style.display = 'none';
            profileSection.style.display = 'block';
            dropdownToggleBtn.textContent = `👤 ${currentUser.username}`;
            profileUser.textContent = currentUser.username;
            profileRole.textContent = currentUser.role;

            // Sekcja WebSocket główna
            wsSection.style.display = 'block';
            userDisplay.textContent = `${currentUser.username} (${currentUser.role})`;

            // Widoczność zakładki Admina
            if (currentUser.role === "Admin") {
                adminPanelLink.style.display = 'block';
            } else {
                adminPanelLink.style.display = 'none';
            }
            connectWebSocket();
        } else {
            authMessage.style.color = "green";
            authMessage.textContent = data.message;
            isLoginMode = true;
            authTitle.textContent = "Logowanie do systemu";
            authBtn.textContent = "Zaloguj";
            authToggleLink.textContent = "Nie masz konta? Zarejestruj się";
        }
    } catch (error) {
        authMessage.style.color = "red";
        authMessage.textContent = error.message;
    }
});

// WYLOGOWANIE
logoutBtn.addEventListener('click', () => {
    currentUser = null;
    localStorage.removeItem('currentUser');
    if (socket) socket.close();

    wsSection.style.display = 'none';
    profileSection.style.display = 'none';
    authFormSection.style.display = 'block';
    dropdownToggleBtn.textContent = "👤 User Menu";
    document.getElementById('password').value = "";
    authMessage.style.color = "green";
    authMessage.textContent = "Wylogowano pomyślnie.";
});

// WEBSOCKET
function connectWebSocket() {
    socket = new WebSocket('ws://127.0.0.1:8080/ws');
    socket.addEventListener('open', () => {
        statusEl.textContent = "Połączono"; statusEl.style.color = "green"; sendBtn.disabled = false;
        socket.send(JSON.stringify({ type: "auth", username: currentUser.username, role: currentUser.role }));
    });
    socket.addEventListener('message', (e) => log(`[Serwer]: ${e.data}`));
    socket.addEventListener('close', () => { statusEl.textContent = "Rozłączono"; statusEl.style.color = "red"; sendBtn.disabled = true; });
}

function log(msg) {
    const item = document.createElement('div'); item.textContent = msg; logsEl.appendChild(item);
    logsEl.scrollTop = logsEl.scrollHeight;
}
// PRZYWRACANIE SESJI PO POWROCIE NA STRONĘ
function restoreSession() {
    const storedUser = localStorage.getItem('currentUser');
    if (storedUser) {
        currentUser = JSON.parse(storedUser);

        // Zmiana interfejsu dropdownu na zalogowany
        authFormSection.style.display = 'none';
        profileSection.style.display = 'block';
        dropdownToggleBtn.textContent = `👤 ${currentUser.username}`;
        profileUser.textContent = currentUser.username;
        profileRole.textContent = currentUser.role;

        // Pokazanie sekcji WebSocket
        wsSection.style.display = 'block';
        userDisplay.textContent = `${currentUser.username} (${currentUser.role})`;

        // Widoczność zakładki Admina
        if (currentUser.role === "Admin") {
            adminPanelLink.style.display = 'block';
        } else {
            adminPanelLink.style.display = 'none';
        }

        // Automatyczne połączenie z WebSocketem
        connectWebSocket();
    }
}

// Uruchomienie sprawdzania sesji przy każdym wejściu na index.html
restoreSession();