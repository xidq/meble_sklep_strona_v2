// auth_ui.js

const headerHTML = `
<header>
    <a href="../index.html" style="text-decoration: none;">
        <h1 data-i18n="welcome" style="margin: 0; font-size: 24px; color: black;">System i WebSocket</h1>
    </a>

    <div>
        <button class="header_btn" onclick="window.location.href = '../strony/produkty.html'" data-i18n="nav_products"> meble </button>
        <button class="header_btn" onclick="window.location.href = '../strony/kontakt.html'" data-i18n="nav_contact"> meble </button>
    </div>

    <div class="nav-controls">
        <select id="language-switcher" style="padding: 5px;">
            <option value="pl">Polski</option>
            <option value="en">English</option>
        </select>

    <div class="dropdown" id="userDropdown">
        <button class="dropdown-btn" id="dropdownToggleBtn">👤 User Menu</button>
        <div class="dropdown-content">

            <div id="authFormSection">
                <h3 id="authTitle" style="margin-top: 0;">Logowanie do systemu</h3>
                <div class="form-group">
                    <label>Nazwa użytkownika:</label>
                    <input type="text" id="username" value="admin_jan">
                </div>
                <div class="form-group">
                    <label>Hasło:</label>
                    <input type="password" id="password" value="tajne_haslo_123">
                </div>
                <button id="authBtn" style="width: 100%;">Zaloguj</button>
                <span id="authToggleLink" class="toggle-auth">Nie masz konta? Zarejestruj się</span>
                <p id="authMessage" style="font-weight: bold; margin-top: 10px; font-size: 12px;"></p>
            </div>

            <div id="profileSection" style="display: none;">
                <h3 style="margin-top: 0;">Mój Profil</h3>
                <p>Użytkownik: <span id="profileUser" style="font-weight: bold;">-</span></p>
                <p>Rola: <span id="profileRole" style="font-weight: bold;">-</span></p>
                <a href="../strony/admin.html" id="adminPanelLink" class="admin-link-btn" style="display: none;">⚙️ Panel Administratora</a>
                <button id="logoutBtn" style="background: #dc3545; width: 100%; margin-top: 15px;">Wyloguj się 🚪</button>
            </div>

        </div>
    </div>
  </div>
</header>
`;

document.addEventListener("DOMContentLoaded", () => {
  // 1. Wstrzykiwanie HTML
  document.body.insertAdjacentHTML('afterbegin', headerHTML);

  // 2. Pobieranie elementów DOM
  const userDropdown = document.getElementById('userDropdown');
  const dropdownToggleBtn = document.getElementById('dropdownToggleBtn');
  const authFormSection = document.getElementById('authFormSection');
  const profileSection = document.getElementById('profileSection');
  const authBtn = document.getElementById('authBtn');
  const logoutBtn = document.getElementById('logoutBtn');
  const authToggleLink = document.getElementById('authToggleLink');
  const authTitle = document.getElementById('authTitle');
  const authMessage = document.getElementById('authMessage');
  const profileUser = document.getElementById('profileUser');
  const profileRole = document.getElementById('profileRole');
  const adminPanelLink = document.getElementById('adminPanelLink');

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
        localStorage.setItem('currentUser', JSON.stringify(currentUser));

        // Zmiana interfejsu dropdownu
        authFormSection.style.display = 'none';
        profileSection.style.display = 'block';
        dropdownToggleBtn.textContent = `👤 ${currentUser.username}`;
        profileUser.textContent = currentUser.username;
        profileRole.textContent = currentUser.role;

        // Widoczność zakładki Admina (Bezpieczne wywołanie dla innych podstron)
        if (currentUser.role === "Admin") {
          if (adminPanelLink) adminPanelLink.style.display = 'block';
        } else {
          if (adminPanelLink) adminPanelLink.style.display = 'none';
        }

        // Odpalenie zewnętrznej funkcji z websocket.js
        if (typeof connectWebSocket === "function") {
          connectWebSocket(currentUser);
        }
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

    // Odpalenie zewnętrznej funkcji z websocket.js
    if (typeof disconnectWebSocket === "function") {
      disconnectWebSocket();
    }

    profileSection.style.display = 'none';
    authFormSection.style.display = 'block';
    dropdownToggleBtn.textContent = "👤 User Menu";
    document.getElementById('password').value = "";
    authMessage.style.color = "green";
    authMessage.textContent = "Wylogowano pomyślnie.";
  });

  // PRZYWRACANIE SESJI PO POWROCIE NA STRONĘ
  function restoreSession() {
    const storedUser = localStorage.getItem('currentUser');
    if (storedUser) {
      currentUser = JSON.parse(storedUser);

      // Zmiana interfejsu dropdownu
      authFormSection.style.display = 'none';
      profileSection.style.display = 'block';
      dropdownToggleBtn.textContent = `👤 ${currentUser.username}`;
      profileUser.textContent = currentUser.username;
      profileRole.textContent = currentUser.role;

      // Widoczność zakładki Admina
      if (currentUser.role === "Admin") {
        if (adminPanelLink) adminPanelLink.style.display = 'block';
      } else {
        if (adminPanelLink) adminPanelLink.style.display = 'none';
      }

      // Automatyczne połączenie z WebSocketem
      if (typeof connectWebSocket === "function") {
        connectWebSocket(currentUser);
      }
    }
  }

  restoreSession();
});
