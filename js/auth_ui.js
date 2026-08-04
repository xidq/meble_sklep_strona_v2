const headerHTML = `
<header>
    <a href="/index.html" style="text-decoration: none;">
        <h1 data-i18n="welcome" style="margin: 0; font-size: 24px; color: black;">System i WebSocket</h1>
    </a>
    <div class="przyciski_podmenu_container">
        <button class="header_btn glow" onclick="window.location.href = '/strony/produkty.html'" data-i18n="nav_products"> meble </button>
        <button class="header_btn glow" onclick="window.location.href = '/strony/kontakt.html'" data-i18n="nav_contact"> meble </button>
    </div>
    <div class="nav_controls">
        <button id="basketMenu" class="glow" onclick="window.location.href = '/strony/koszyk.html'">
            <span class="basket-icon">🛒</span>
            <span id="basketCount" class="basket-badge">0</span>
        </button>
        
        <select id="language_switcher">
            <option value="pl">Polski</option>
            <option value="en">English</option>
        </select>

        <div class="dropdown" id="userDropdown">
            <button class="dropdown_btn" id="dropdownToggleBtn">👤 User Menu</button>
            <div class="dropdown-content">
                <div id="authFormSection">
                    <h3 id="authTitle" style="margin-top: 0;">Logowanie do systemu</h3>
                    <div id="loginFields">
                        <div class="header-form-group">
                            <label for="username">Nazwa użytkownika:</label>
                            <input type="text" id="username" name="username" autocomplete="username">
                        </div>
                        <div class="header-form-group">
                            <label for="password">Hasło:</label>
                            <input type="password" id="password" name="password" autocomplete="current-password">
                        </div>
                    </div>
                    
                    <div id="registerFields" style="display: none;">
                        <div class="header-form-group">
                            <label for="reg_username">Nazwa użytkownika (rejestracja):</label>
                            <input type="text" id="reg_username" name="reg_username" autocomplete="off">
                        </div>
                        <div class="header-form-group">
                            <label for="reg_password">Hasło (rejestracja):</label>
                            <input type="password" id="reg_password" name="reg_password" autocomplete="new-password">
                        </div>
                        <div class="header-form-group">
                            <label for="confirmPassword">Powtórz hasło:</label>
                            <input type="password" id="confirmPassword" name="confirmPassword" autocomplete="new-password">
                        </div>
                    </div>
                    <div class="header-form-group registration_field" style="display: none;">
                        <label for="email">Email:</label>
                        <input type="email" id="email" name="email" autocomplete="email" placeholder="email@example.com">
                    </div>
                    <div class="header-form-group registration_field" style="display: none;">
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
                    <a href="/user_page" id="userPanelLink" class="user-link-btn user-backdrop-menu-button" style="display: none;">⚙️ Panel Użytkownika</a>
                    <a href="/email" id="emailInboxLink" class="email-link-btn user-backdrop-menu-button" style="display: none;">✉️ Skrzynka E-mail</a>
                    <a href="/admin" id="adminPanelLink" class="admin-link-btn user-backdrop-menu-button" style="display: none;">⚙️ Panel Administratora</a>
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
  if (sessionStorage.getItem('cookieAccepted')) return;

  const footerHTML = `
    <div id="cookie-footer" style="
        position: fixed; bottom: 0; left: 0; right: 0;
        background: rgba(20,20,20,0.95); color: rgba(255,255,255,0.8);
        padding: 15px 20px; z-index: 99999; display: flex;
        justify-content: space-between; align-items: center; flex-wrap: wrap;
        gap: 15px; border-top: 1px solid rgba(255,255,255,0.1);
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        font-size: 14px; backdrop-filter: blur(10px);
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
            padding: 10px 30px; background: rgba(255,255,255,0.15);
            color: rgba(255,255,255,0.9); border: 1px solid rgba(255,255,255,0.2);
            border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 600;
            transition: all 0.3s ease; white-space: nowrap;
        ">
            OK, rozumiem
        </button>
    </div>`;

  document.body.insertAdjacentHTML('beforeend', footerHTML);

  const footer = document.getElementById('cookie-footer');
  const acceptBtn = document.getElementById('cookieAcceptBtn');

  acceptBtn?.addEventListener('click', () => {
    sessionStorage.setItem('cookieAccepted', 'true');
    if (footer) {
      footer.style.transition = 'opacity 0.5s ease';
      footer.style.opacity = '0';
      setTimeout(() => footer.remove(), 500);
    }
  });
}

showCookieFooter();


document.addEventListener("DOMContentLoaded", () => {
  document.body.insertAdjacentHTML('afterbegin', headerHTML);


  const el = {
    userDropdown: document.getElementById('userDropdown'),
    dropdownToggleBtn: document.getElementById('dropdownToggleBtn'),
    authFormSection: document.getElementById('authFormSection'),
    profileSection: document.getElementById('profileSection'),
    loginFields: document.getElementById('loginFields'),
    registerFields: document.getElementById('registerFields'),
    registrationFieldsAll: document.querySelectorAll('.registration_field'),
    authBtn: document.getElementById('authBtn'),
    logoutBtn: document.getElementById('logoutBtn'),
    authToggleLink: document.getElementById('authToggleLink'),
    authTitle: document.getElementById('authTitle'),
    authMessage: document.getElementById('authMessage'),
    profileUser: document.getElementById('profileUser'),
    profileRole: document.getElementById('profileRole'),
    adminPanelLink: document.getElementById('adminPanelLink'),
    userPanelLink: document.getElementById('userPanelLink'),
    emailInboxLink: document.getElementById('emailInboxLink'),
    // Pola formularzy
    usernameInput: document.getElementById('username'),
    passwordInput: document.getElementById('password'),
    regUsernameInput: document.getElementById('reg_username'),
    regPasswordInput: document.getElementById('reg_password'),
    confirmPasswordInput: document.getElementById('confirmPassword'),
    emailInput: document.getElementById('email'),
    termsCheck: document.getElementById('termsCheck'),
    // Modal regulaminu
    termsOverlay: document.getElementById('termsOverlay'),
    openTerms: document.getElementById('openTerms'),
    closeTerms: document.getElementById('closeTerms'),
    // Koszyk
    basketBadge: document.getElementById('basketCount')
  };

  let currentUser = null;
  let isLoginMode = true;
  const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;

  //  FUNKCJE POMOCNICZE UI 
  function setAuthMessage(msg, isError = false, isSuccess = false) {
    el.authMessage.textContent = msg;
    el.authMessage.style.color = isError ? "red" : (isSuccess ? "green" : "black");
  }

  function clearInputErrors() {
    el.usernameInput?.classList.remove('input-error');
    el.passwordInput?.classList.remove('input-error');
    el.regUsernameInput?.classList.remove('input-error');
    el.regPasswordInput?.classList.remove('input-error');
  }

  function updateUIPerRole(role) {
    if (el.userPanelLink) {
      el.userPanelLink.style.display = (role === "Legituser" || role === "Admin" || role === "User") ? 'block' : 'none';
    }
    if (el.emailInboxLink) {
      el.emailInboxLink.style.display = (role === "Legituser" || role === "Admin") ? 'block' : 'none';
    }
    if (el.adminPanelLink) {
      el.adminPanelLink.style.display = (role === "Admin") ? 'block' : 'none';
    }
  }

  function switchAuthMode(toLogin) {
    isLoginMode = toLogin;
    setAuthMessage("");
    clearInputErrors();

    el.loginFields.style.display = isLoginMode ? 'block' : 'none';
    el.registerFields.style.display = isLoginMode ? 'none' : 'block';
    el.registrationFieldsAll.forEach(node => node.style.display = isLoginMode ? 'none' : 'block');

    if (isLoginMode) {
      el.authTitle.textContent = "Logowanie do systemu";
      el.authBtn.textContent = "Zaloguj";
      el.authToggleLink.textContent = "Nie masz konta? Zarejestruj się";
    } else {
      el.authTitle.textContent = "Tworzenie nowego konta";
      el.authBtn.textContent = "Zarejestruj się";
      el.authToggleLink.textContent = "Masz już konto? Zaloguj się";
    }

  }

  function setProfileUI(user) {
    currentUser = user;
    if (user) {
      // ZAPISUJEMY W CACHE SESJI
      sessionStorage.setItem('cachedUser', JSON.stringify(user));

      el.authFormSection.style.display = 'none';
      el.profileSection.style.display = 'block';
      el.dropdownToggleBtn.textContent = `👤 ${user.username}`;
      el.profileUser.textContent = user.username;
      el.profileRole.textContent = user.role;
      updateUIPerRole(user.role);

      if (typeof connectWebSocket === "function") {
        connectWebSocket(user);
      }
    } else {
      // CZYSZCZEMY CACHE
      sessionStorage.removeItem('cachedUser');

      el.authFormSection.style.display = 'block';
      el.profileSection.style.display = 'none';
      el.dropdownToggleBtn.textContent = "👤 User Menu";
    }
  }
  const formInputs = [
    el.usernameInput,
    el.passwordInput,
    el.regUsernameInput,
    el.regPasswordInput,
    el.confirmPasswordInput,
    el.emailInput
  ];

  formInputs.forEach(input => {
    input?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        el.authBtn.click(); // Symuluje kliknięcie przycisku "Zaloguj" / "Zarejestruj się"
      }
    });
  });
  //  WYLOGOWANIE 
  el.logoutBtn.addEventListener('click', async () => {
    try {
      await fetch('/api/logout', { method: 'POST' });
    } catch (err) {
      console.error("Błąd podczas wylogowywania na serwerze:", err);
    }

    if (typeof disconnectWebSocket === "function") {
      disconnectWebSocket();
    }

    // Usunięcie z cache przy wylogowaniu
    sessionStorage.removeItem('cachedUser');

    setProfileUI(null);
    if (el.passwordInput) el.passwordInput.value = "";
    setAuthMessage("Wylogowano pomyślnie.", false, true);
  });

  function resetRegisterForm() {
    if (el.usernameInput) el.usernameInput.value = "";
    if (el.passwordInput) el.passwordInput.value = "";
    if (el.regUsernameInput) el.regUsernameInput.value = "";
    if (el.regPasswordInput) el.regPasswordInput.value = "";
    if (el.confirmPasswordInput) el.confirmPasswordInput.value = "";
    if (el.emailInput) el.emailInput.value = "";
    if (el.termsCheck) el.termsCheck.checked = false;
  }

  // DROPDOWN LOGIKI
  el.dropdownToggleBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    el.userDropdown.classList.toggle('open');
  });

  document.addEventListener('click', () => el.userDropdown.classList.remove('open'));
  el.userDropdown.addEventListener('click', (e) => e.stopPropagation());

  //  PRZEŁĄCZANIE FORMULARZA 
  el.authToggleLink.addEventListener('click', () => switchAuthMode(!isLoginMode));

  //  OBSŁUGA REGULAMINU (Jednorazowe podpięcie) 
  el.openTerms?.addEventListener('click', (e) => {
    e.preventDefault();
    if (el.termsOverlay) el.termsOverlay.style.display = 'flex';
  });

  el.closeTerms?.addEventListener('click', () => {
    if (el.termsOverlay) el.termsOverlay.style.display = 'none';
  });

  el.termsOverlay?.addEventListener('click', (e) => {
    if (e.target === el.termsOverlay) {
      el.termsOverlay.style.display = 'none';
    }
  });

  //  OBSŁUGA LOGOWANIA / REJESTRACJI
  el.authBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    setAuthMessage("");
    clearInputErrors();

    const username = (isLoginMode ? el.usernameInput.value : el.regUsernameInput.value).trim();
    const password = isLoginMode ? el.passwordInput.value : el.regPasswordInput.value;

    if (!isLoginMode) {
      const confirmPassword = el.confirmPasswordInput ? el.confirmPasswordInput.value : "";
      const email = el.emailInput ? el.emailInput.value.trim() : "";
      const termsChecked = el.termsCheck ? el.termsCheck.checked : false;

      if (!usernameRegex.test(username)) {
        el.regUsernameInput?.classList.add('input-error');
        setAuthMessage("Błąd: Login musi mieć 3-20 znaków (litery, cyfry, '_').", true);
        return;
      }
      if (password.length < 8 || password.length > 100) {
        el.regPasswordInput?.classList.add('input-error');
        setAuthMessage("Błąd: Hasło musi mieć od 8 do 100 znaków.", true);
        return;
      }
      if (password !== confirmPassword) {
        setAuthMessage("Błąd: Hasła nie są identyczne.", true);
        return;
      }
      if (!email.includes('@')) {
        setAuthMessage("Błąd: Podaj poprawny email.", true);
        return;
      }
      if (!termsChecked) {
        setAuthMessage("Błąd: Zaakceptuj regulamin.", true);
        return;
      }
    } else {
      if (!usernameRegex.test(username) || !password) {
        setAuthMessage("Błędny format loginu lub nie uzupełniono pól.", true);
        if (!usernameRegex.test(username)) el.usernameInput.classList.add('input-error');
        if (!password) el.passwordInput.classList.add('input-error');
        return;
      }
    }

    const payload = isLoginMode
        ? { username, password }
        : {
          username,
          password,
          confirm_password: el.confirmPasswordInput ? el.confirmPasswordInput.value : "",
          email: el.emailInput ? el.emailInput.value.trim() : "",
          name: username,
          registration_conditions: el.termsCheck ? el.termsCheck.checked : false
        };

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
        } catch {}
        throw new Error(errorMessage);
      }

      const data = await response.json();

      if (isLoginMode) {
        setProfileUI(data);
      } else {
        switchAuthMode(true);
        setAuthMessage(data.message, false, true);
        resetRegisterForm();
      }
    } catch (error) {
      setAuthMessage(error.message, true);
    }
  });

  //  WYLOGOWANIE 
  el.logoutBtn.addEventListener('click', async () => {
    try {
      await fetch('/api/logout', { method: 'POST' });
    } catch (err) {
      console.error("Błąd podczas wylogowywania na serwerze:", err);
    }

    if (typeof disconnectWebSocket === "function") {
      disconnectWebSocket();
    }

    setProfileUI(null);
    if (el.passwordInput) el.passwordInput.value = "";
    setAuthMessage("Wylogowano pomyślnie.", false, true);

    sessionStorage.removeItem('cachedUser');
    localStorage.removeItem('currentUser');

    // Odświeżenie strony, aby wymusić ponowną weryfikację uprawnień / zablokować dostęp
    window.location.reload();
  });

  //  POBIERANIE DANYCH UŻYTKOWNIKA 
  async function loadUserData() {
    // NATYCHMIASTOWE ODCZYTANIE Z CACHE (zapobiega miganiu)
    const cachedUser = sessionStorage.getItem('cachedUser');
    if (cachedUser) {
      try {
        const parsedUser = JSON.parse(cachedUser);
        setProfileUI(parsedUser);
      } catch (e) {
        sessionStorage.removeItem('cachedUser');
      }
    }

    // WERYFIKACJA W TLE Z SERWEREM (aktualizacja stanu)
    try {
      const res = await fetch('/api/me', { credentials: 'include' });
      if (res.ok) {
        const user = await res.json();
        setProfileUI(user); // Odświeża dane jeśli się zmieniły
      } else {
        // Jeśli sesja na serwerze wygasła, a w cache był użytkownik – wyloguj
        setProfileUI(null);
      }
    } catch (e) {
      console.error("Błąd ładowania danych użytkownika:", e);
      // W przypadku braku sieci zostawiamy to co było w cache lub czyścimy w zależności od wymagań
    }
  }

  // KOSZYK
  function getCart() {
    try {
      return JSON.parse(localStorage.getItem('cart')) || [];
    } catch {
      return [];
    }
  }

  function updateBasketDOM() {
    if (!el.basketBadge) return;

    const basket = getCart();
    const totalItems = basket.reduce((sum, item) => sum + (item.quantity || 0), 0);

    if (totalItems > 0) {
      el.basketBadge.textContent = totalItems;
      el.basketBadge.style.display = 'block';
    } else {
      el.basketBadge.style.display = 'none';
    }
  }

  window.addToCart = function (productId) {
    const basket = getCart();
    const existingItem = basket.find(item => item.id === productId);

    if (existingItem) {
      existingItem.quantity += 1;
    } else {
      basket.push({ id: productId, quantity: 1 });
    }

    localStorage.setItem('cart', JSON.stringify(basket));
    updateBasketDOM();
  };

  // Uruchomienie początkowe
  loadUserData().catch(err => {
    console.error('Nie udało się załadować danych użytkownika:', err);
  });

  updateBasketDOM();
});