// auth_ui.js
const API_BASE = `https://${window.location.hostname}:8444`;
const headerHTML = `
<header>
    <a href="../index.html" style="text-decoration: none;">
        <h1 data-i18n="welcome" style="margin: 0; font-size: 24px; color: black;">System i WebSocket</h1>
    </a>

    <div>
        <button class="header_btn glow" onclick="window.location.href = '/strony/produkty.html'" data-i18n="nav_products"> meble </button>
        <button class="header_btn glow" onclick="window.location.href = '/strony/kontakt.html'" data-i18n="nav_contact"> meble </button>
    </div>

    <div class="nav-controls">
        <button id="basketMenu" class="glow" onclick="window.location.href = '/strony/koszyk.html'">
            <span class="basket-icon">🛒</span>
            <!-- Licznik przedmiotów -->
            <span id="basketCount" class="basket-badge">0</span>
        </button>
        
        <select id="language-switcher" style="padding: 5px;">
            <option value="pl">Polski</option>
            <option value="en">English</option>
        </select>

        <div class="dropdown" id="userDropdown">
            <button class="dropdown-btn" id="dropdownToggleBtn">👤 User Menu</button>
            <div class="dropdown-content">
    
                <div id="authFormSection">
                    <h3 id="authTitle" style="margin-top: 0;">Logowanie do systemu</h3>
                    <div id="loginFields">
                        <div class="form-group">
                            <label>Nazwa użytkownika:</label>
                            <input type="text" id="username" autocomplete="username">
                        </div>
                        <div class="form-group">
                            <label>Hasło:</label>
                            <input type="password" id="password" autocomplete="current-password">
                        </div>
                    </div>
                    
                    <div id="registerFields" style="display: none;">
                        <div class="form-group">
                            <label>Nazwa użytkownika (rejestracja):</label>
                            <input type="text" id="reg_username" autocomplete="off">
                        </div>
                        <div class="form-group">
                            <label>Hasło (rejestracja):</label>
                            <input type="password" id="reg_password" autocomplete="new-password">
                        </div>
                        <div class="form-group">
                            <label>Powtórz hasło:</label>
                            <input type="password" id="confirmPassword" autocomplete="new-password">
                        </div>
                        <!-- ... email i checkbox ... -->
                    </div>
                    <div class="form-group registration-field" style="display: none;">
                        <label>Email:</label>
                        <input type="email" id="email" placeholder="email@example.com">
                    </div>
                    <div class="form-group registration-field" style="display: none;">
                        <label style="font-size: 11px;">
                            <input type="checkbox" id="termsCheck"> Akceptuję <a href="#" id="openTerms" style="color: blue; text-decoration: underline;">regulamin</a>
                        </label>
                    </div>
                    <button id="authBtn" style="width: 100%;">Zaloguj</button>
                    <span id="authToggleLink" class="toggle-auth">Nie masz konta? Zarejestruj się</span>
                    <p id="authMessage" style="font-weight: bold; margin-top: 10px; font-size: 12px;"></p>
                </div>
    
                <div id="profileSection" style="display: none;">
                    <h3 style="margin-top: 0;">Mój Profil</h3>
                    <p>Użytkownik: <span id="profileUser" style="font-weight: bold;">-</span></p>
                    <p>Rola: <span id="profileRole" style="font-weight: bold;">-</span></p>
                    <a href="/user_page" id="userPanelLink" class="user-link-btn" style="display: none;">⚙️ Panel Użytkownika</a>
                    <a href="/email" id="emailInboxLink" class="email-link-btn" style="display: none;">✉️ Skrzynka E-mail</a>
                    <a href="/admin" id="adminPanelLink" class="admin-link-btn" style="display: none;">⚙️ Panel Administratora</a>
                    <button id="logoutBtn" style="background: #dc3545; width: 100%; margin-top: 15px;">Wyloguj się 🚪</button>
                </div>
    
            </div>
        </div>
    </div>
    <div id="termsOverlay" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 9999; align-items: center; justify-content: center;">
        <div style="background: white; padding: 20px; width: 80%; max-width: 500px; max-height: 80vh; overflow-y: auto; border-radius: 8px; color: black;">
            <h3>Regulamin</h3>
            <div id="termsContent">Tutaj wczytamy treść regulaminu...</div>
            <button id="closeTerms" style="margin-top: 15px; width: 100%;">Zamknij</button>
        </div>
    </div>
</header>
`;
function showCookieFooter() {
  // Sprawdź, czy użytkownik już zaakceptował w tej sesji
  if (sessionStorage.getItem('cookieAccepted')) {
    return;
  }

  const footerHTML = `
        <div id="cookie-footer" style="
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            background: rgba(20,20,20,0.95);
            color: rgba(255,255,255,0.8);
            padding: 15px 20px;
            z-index: 99999;
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 15px;
            border-top: 1px solid rgba(255,255,255,0.1);
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            font-size: 14px;
            backdrop-filter: blur(10px);
        ">
            <div style="flex: 1; min-width: 200px;">
                <strong style="color: rgba(255,255,255,0.9);">🍪 Informacja o ciasteczkach</strong>
                <p style="margin: 5px 0 0 0; font-size: 13px; color: rgba(255,255,255,0.6);">
                    Ta strona używa niezbędnych plików cookies do autoryzacji użytkownika 
                    (sesyjne ciasteczko JWT). Są one wymagane do logowania i korzystania z panelu.
                    <br>
                    <span style="font-size: 12px; color: rgba(255,255,255,0.4);">
                        Dane są przechowywane tylko podczas sesji i nie są wykorzystywane do śledzenia.
                    </span>
                </p>
            </div>
            <button id="cookieAcceptBtn" style="
                padding: 10px 30px;
                background: rgba(255,255,255,0.15);
                color: rgba(255,255,255,0.9);
                border: 1px solid rgba(255,255,255,0.2);
                border-radius: 6px;
                cursor: pointer;
                font-size: 14px;
                font-weight: 600;
                transition: all 0.3s ease;
                white-space: nowrap;
            ">
                OK, rozumiem
            </button>
        </div>
    `;

  document.body.insertAdjacentHTML('beforeend', footerHTML);

  const footer = document.getElementById('cookie-footer');
  const acceptBtn = document.getElementById('cookieAcceptBtn');

  if (acceptBtn) {
    acceptBtn.addEventListener('click', () => {
      sessionStorage.setItem('cookieAccepted', 'true');
      if (footer) {
        footer.style.transition = 'opacity 0.5s ease';
        footer.style.opacity = '0';
        setTimeout(() => {
          footer.remove();
        }, 500);
      }
    });
  }
}
showCookieFooter();
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
  const userPanelLink = document.getElementById('userPanelLink');
  const emailInboxLink = document.getElementById('emailInboxLink');

  let currentUser = null;
  let isLoginMode = true;

  function updateUIPerRole(role) {
    // Panel użytkownika dla każdego zalogowanego
    if (userPanelLink) userPanelLink.style.display = (role === "Legituser" || role === "Admin" || role === "User") ? 'block' : 'none';

    if (emailInboxLink) emailInboxLink.style.display = (role === "Legituser" || role === "Admin") ? 'block' : 'none';
    // Panel administratora tylko dla admina
    if (adminPanelLink) {
      adminPanelLink.style.display = (role === "Admin") ? 'block' : 'none';
    }
  }

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
    document.getElementById('loginFields').style.display = isLoginMode ? 'block' : 'none';
    document.getElementById('registerFields').style.display = isLoginMode ? 'none' : 'block';

    if (isLoginMode) {
      authTitle.textContent = "Logowanie do systemu";
      authBtn.textContent = "Zaloguj";
      authToggleLink.textContent = "Nie masz konta? Zarejestruj się";
    } else {
      authTitle.textContent = "Tworzenie nowego konta";
      authBtn.textContent = "Zarejestruj się";
      authToggleLink.textContent = "Masz już konto? Zaloguj się";
    }
    const regFields = document.querySelectorAll('.registration-field');
    regFields.forEach(el => el.style.display = isLoginMode ? 'none' : 'block');

    // Obsługa regulaminu
    const termsOverlay = document.getElementById('termsOverlay');
    const openTerms = document.getElementById('openTerms');
    const closeTerms = document.getElementById('closeTerms');

    if (openTerms) {
      openTerms.addEventListener('click', (e) => {
        e.preventDefault(); // Zapobiega odświeżeniu strony
        termsOverlay.style.display = 'flex'; // Pokazuje nakładkę
      });
    }

    if (closeTerms) {
      closeTerms.addEventListener('click', () => {
        termsOverlay.style.display = 'none'; // Chowa nakładkę
      });
    }

    // Zamknięcie po kliknięciu w tło
    termsOverlay.addEventListener('click', (e) => {
      if (e.target === termsOverlay) {
        termsOverlay.style.display = 'none';
      }
    });
  });

  // OBSŁUGA LOGOWANIA / REJESTRACJI
  authBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    authMessage.textContent = "";
    authMessage.style.color = "black";

    const uInput = document.getElementById('username');
    const pInput = document.getElementById('password');
    const cpInput = document.getElementById('confirmPassword'); // nowe
    const eInput = document.getElementById('email');           // nowe
    const tCheck = document.getElementById('termsCheck');     // nowe
    uInput.classList.remove('input-error');
    pInput.classList.remove('input-error');

    const username = isLoginMode
        ? document.getElementById('username').value.trim()
        : document.getElementById('reg_username').value.trim();

    const password = isLoginMode
        ? document.getElementById('password').value
        : document.getElementById('reg_password').value;

    const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
    const confirmPassword = cpInput ? cpInput.value : "";
    const email = eInput ? eInput.value.trim() : "";
    const termsChecked = tCheck ? tCheck.checked : false;

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
      if (password !== confirmPassword) {
        authMessage.style.color = "red";
        authMessage.textContent = "Błąd: Hasła nie są identyczne.";
        return;
      }
      if (!email.includes('@')) {
        authMessage.style.color = "red";
        authMessage.textContent = "Błąd: Podaj poprawny email.";
        return;
      }
      if (!termsChecked) {
        authMessage.style.color = "red";
        authMessage.textContent = "Błąd: Zaakceptuj regulamin.";
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

    const payload = isLoginMode
        ? { username, password }
        : { username, password, confirm_password: confirmPassword, email, name: username, registration_conditions: termsChecked};
    const endpoint = isLoginMode ? '/api/login' : '/api/register';

    try {
      const response = await fetch(endpoint, {
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
        // localStorage.setItem('currentUser', JSON.stringify(currentUser));
        // localStorage.setItem('currentUser', JSON.stringify(currentUser));
        // USTAW CIASTECZKO Z TOKENEM DLA GO
        // if (data.token) {
        //   document.cookie = `token=${data.token}; path=/; Secure; SameSite=Strict; max-age=86400`;
        // }

        // Zmiana interfejsu dropdownu
        authFormSection.style.display = 'none';
        profileSection.style.display = 'block';
        dropdownToggleBtn.textContent = `👤 ${currentUser.username}`;
        profileUser.textContent = currentUser.username;
        profileRole.textContent = currentUser.role;


        updateUIPerRole(currentUser.role);
        // if (currentUser.role === "Admin" || currentUser.role === "User") {
        //   // Tutaj możesz np. pokazać panel użytkownika, który jest wspólny
        //   if (userPanelLink) userPanelLink.style.display = 'block';
        // }
        //
        // // Widoczność zakładki Admina (Bezpieczne wywołanie dla innych podstron)
        // if (currentUser.role === "Admin") {
        //   if (adminPanelLink) adminPanelLink.style.display = 'block';
        // } else {
        //   if (adminPanelLink) adminPanelLink.style.display = 'none';
        // }

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

        // 2. Ukrycie pól rejestracyjnych
        const regFields = document.querySelectorAll('.registration-field');
        regFields.forEach(el => el.style.display = 'none');

        // 3. Wyczyść pola (opcjonalnie, ale bardzo zalecane dla porządku)
        document.getElementById('username').value = "";
        document.getElementById('password').value = "";
        document.getElementById('confirmPassword').value = "";
        document.getElementById('email').value = "";
        document.getElementById('termsCheck').checked = false;
      }
    } catch (error) {
      authMessage.style.color = "red";
      authMessage.textContent = error.message;
    }
  });

  // WYLOGOWANIE
  logoutBtn.addEventListener('click', async() => {
    currentUser = null;
    // localStorage.removeItem('currentUser');
    // localStorage.removeItem('userToken');

    // USUŃ CIASTECZKO TOKEN
    // document.cookie = 'token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC; Secure; SameSite=Strict';
    // document.cookie = 'token=; path=/; max-age=0; Secure; SameSite=Strict';

    try {
      await fetch('/api/logout', { method: 'POST' });
    } catch (err) {
      console.error("Błąd podczas wylogowywania na serwerze:", err);
    }

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
  // function restoreSession() {
  //   const storedUser = localStorage.getItem('currentUser');
  //   if (storedUser) {
  //     currentUser = JSON.parse(storedUser);
  //
  //     const storedToken = localStorage.getItem('userToken');
  //     if (storedToken) {
  //       document.cookie = `token=${storedToken}; path=/; Secure; SameSite=Strict; max-age=86400`;
  //     }
  //
  //     // Zmiana interfejsu dropdownu
  //     authFormSection.style.display = 'none';
  //     profileSection.style.display = 'block';
  //     dropdownToggleBtn.textContent = `👤 ${currentUser.username}`;
  //     profileUser.textContent = currentUser.username;
  //     profileRole.textContent = currentUser.role;
  //
  //     // Widoczność zakładki Admina
  //     if (currentUser.role === "Admin") {
  //       if (adminPanelLink) adminPanelLink.style.display = 'block';
  //     } else {
  //       if (adminPanelLink) adminPanelLink.style.display = 'none';
  //     }
  //     updateUIPerRole(currentUser.role);
  //
  //     // Automatyczne połączenie z WebSocketem
  //     if (typeof connectWebSocket === "function") {
  //       connectWebSocket(currentUser);
  //     }
  //   }
  // }

  // async function loadUserData() {
  //   try {
  //     const res = await fetch('/api/me');
  //     if (res.ok) {
  //       const data = await res.json();
  //       // Ustaw UI (pokaż profil, przyciski)
  //       currentUser = data;
  //       // ... aktualizacja interfejsu
  //     } else {
  //       // Użytkownik niezalogowany – pokaż formularz logowania
  //     }
  //   } catch(e) {
  //     // obsługa błędu
  //   }
  // }
  async function loadUserData() {
    try {
      const res = await fetch('/api/me', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        currentUser = data;

        // UI – pokaż profil, schowaj logowanie
        authFormSection.style.display = 'none';
        profileSection.style.display = 'block';
        dropdownToggleBtn.textContent = `👤 ${currentUser.username}`;
        profileUser.textContent = currentUser.username;
        profileRole.textContent = currentUser.role;
        updateUIPerRole(currentUser.role);

        // Połącz WebSocket (przez serwer Go, nie bezpośrednio do Rusta)
        if (typeof connectWebSocket === "function") {
          connectWebSocket(currentUser); // przekazujemy dane użytkownika
        }
      } else {
        // Użytkownik niezalogowany – pokaż formularz
        authFormSection.style.display = 'block';
        profileSection.style.display = 'none';
        dropdownToggleBtn.textContent = "👤 User Menu";
      }
    } catch(e) {
      console.error("Błąd ładowania danych użytkownika:", e);
      // W razie błędu pokaż formularz
      authFormSection.style.display = 'block';
      profileSection.style.display = 'none';
    }
  }

  // ==========================================
  // OBSŁUGA KOSZYKA (DODANE ELEMENTY)
  // ==========================================

  function updateBasketDOM() {
    const badge = document.getElementById('basketCount');
    if (!badge) return; // Zabezpieczenie na wypadek, gdyby elementu nie było w DOM

    const basket = JSON.parse(localStorage.getItem('cart')) || [];
    const totalItems = basket.reduce((sum, item) => sum + item.quantity, 0);

    if (totalItems > 0) {
      badge.textContent = totalItems;
      badge.style.display = 'block';
    } else {
      badge.style.display = 'none';
    }
  }

  // Funkcja globalna, żebyś mógł jej użyć w pliku produkty.js przy kliknięciu "dodaj"
  window.addToCart = function(productId) {
    let basket = JSON.parse(localStorage.getItem('cart')) || [];
    const existingItem = basket.find(item => item.id === productId);

    if (existingItem) {
      existingItem.quantity += 1;
    } else {
      basket.push({ id: productId, quantity: 1 });
    }

    localStorage.setItem('cart', JSON.stringify(basket));
    updateBasketDOM();
  };
  // document.addEventListener('DOMContentLoaded', showCookieFooter);
  // restoreSession();
  loadUserData().catch(err => {
    console.error('Nie udało się załadować danych użytkownika:', err);
  });
  // if (typeof connectWebSocket === "function") {
  //   connectWebSocket(); // bez currentUser
  // }
  updateBasketDOM(); // Wywołanie odświeżenia licznika po wstrzyknięciu HTML
});

