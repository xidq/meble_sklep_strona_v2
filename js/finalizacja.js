// =========================================================================
// finalizacja.js - OBSŁUGA FORMULARZA I WYSYŁKA ZAMÓWIENIA DO RUST API
// =========================================================================

document.addEventListener('DOMContentLoaded', () => {
    renderCartSummary();
    setupInvoiceToggle();
    checkUserAuthStatus();
    setupLiveValidation(); // Uruchomienie nasłuchiwania na opuszczanie pól
    setupInputRestrictions(); // <-- DODAJ TO TUTAJ

    // Główny przycisk "Przejdź do płatności" na stronie finalizacji
    const checkoutBtn = document.getElementById('checkout-submit-btn');
    if (checkoutBtn) {
        checkoutBtn.addEventListener('click', handleOrderSubmission);
    }
});

// 1. Sprawdzanie czy użytkownik jest zalogowany (wstrzykiwanie danych do formularza)
function checkUserAuthStatus() {
    // Zakładam, że Twoje auth_ui.js zapisuje dane o zalogowanym użytkowniku w localStorage lub sesji
    const currentUser = JSON.parse(localStorage.getItem('user')) || null;

    const emailInput = document.getElementById('customer-email');
    const nameInput = document.getElementById('customer-name');
    const surnameInput = document.getElementById('customer-surname');

    if (currentUser) {
        // Jeśli jest zalogowany, blokujemy pola lub uzupełniamy automatycznie
        if (emailInput && currentUser.email) {
            emailInput.value = currentUser.email;
            emailInput.disabled = true; // Zalogowany nie musi (i nie powinien) zmieniać maila zamówienia
        }
        if (nameInput && currentUser.firstName) nameInput.value = currentUser.firstName;
        if (surnameInput && currentUser.lastName) surnameInput.value = currentUser.lastName;

        // Zapisujemy ID użytkownika w ukrytym polu, aby łatwo go wyciągnąć
        document.getElementById('checkout-form').setAttribute('data-user-id', currentUser.id || '');
    }
}

/// 2. Obsługa pokazywania/ukrywania pól faktury przez Checkbox
function setupInvoiceToggle() {
    const invoiceCheckbox = document.getElementById('wants-invoice');
    const invoiceSection = document.getElementById('invoice-fields-section');

    if (invoiceCheckbox && invoiceSection) {
        invoiceCheckbox.addEventListener('change', (e) => {
            if (e.target.checked) {
                invoiceSection.style.display = 'block';
            } else {
                invoiceSection.style.display = 'none';
                // Czyści błędy pól faktury, jeśli użytkownik ją odznaczy
                const invoiceInputs = invoiceSection.querySelectorAll('input');
                invoiceInputs.forEach(input => clearFieldError(input.id));
            }
        });
    }
}

// 3. Renderowanie uproszczonego podsumowania koszyka na stronie finalizacji
function renderCartSummary() {
    const summaryContainer = document.getElementById('cart-summary-list');
    const totalContainer = document.getElementById('cart-summary-total');
    if (!summaryContainer) return;

    const basket = JSON.parse(localStorage.getItem('cart')) || [];
    if (basket.length === 0) {
        summaryContainer.innerHTML = `<p>Twój koszyk jest pusty. <a href="/">Wróć do sklepu</a></p>`;
        return;
    }

    summaryContainer.innerHTML = '';
    let total = 0;

    basket.forEach(item => {
        const itemPrice = (item.display && item.display.price) ? item.display.price : 0;
        total += itemPrice * item.quantity;

        const li = document.createElement('div');
        li.style.display = 'flex';
        li.style.justifyContent = 'space-between';
        li.style.marginBottom = '8px';
        li.innerHTML = `
            <span>${item.display?.title || item.name_id} x${item.quantity}</span>
            <span>${(itemPrice * item.quantity).toFixed(2)} zł</span>
        `;
        summaryContainer.appendChild(li);
    });

    if (totalContainer) totalContainer.innerText = `${total.toFixed(2)} zł`;
}

// --- FUNKCJE SILNIKA WALIDACJI (ZASADA: BŁĄD BEZPOŚREDNIO POD INPUTEM) ---

// Słownik reguł walidacyjnych dla konkretnych ID
const validationRules = {
    'customer-email': (val) => /^[^@]+@[^@]+\.[^@]+$/.test(val) ? '' : 'Wprowadź poprawny email (musi zawierać @ oraz kropkę).',
    // 'customer-phone': (val) => /^(\+|00)[0-9]{9,13}$/.test(val) ? '' : 'Wymagany kierunkowy (+ lub 00) oraz od 9 do 13 cyfr bez spacji.',
    'customer-phone': (val) => {
        // Usuwamy spacje i plus do samej walidacji długości cyfr
        const cleanDigits = val.replace(/[^0-9]/g, '');
        const hasPlus = val.startsWith('+');

        if (hasPlus) {
            // Numer zagraniczny/międzynarodowy (np. +48 666 666 666 ma 11 cyfr)
            // Globalnie numery z kierunkowym mają od 8 do 15 cyfr
            return (cleanDigits.length >= 8 && cleanDigits.length <= 15) ? '' : 'Poprawny numer międzynarodowy musi mieć od 8 do 15 cyfr.';
        } else {
            // Polski numer lokalny (komórka lub stacjonarny) podany bez prefiksu
            return cleanDigits.length === 9 ? '' : 'Polski numer telefonu musi składać się dokładnie z 9 cyfr.';
        }
    },
    'customer-name': (val) => val.length >= 2 ? '' : 'Imię musi mieć minimum 2 znaki.',
    'customer-surname': (val) => val.length >= 2 ? '' : 'Nazwisko musi mieć minimum 2 znaki.',
    'address-street': (val) => val.length >= 4 ? '' : 'Podaj poprawny adres (minimum 4 znaki).',
    'address-city': (val) => val.length >= 2 ? '' : 'Nazwa miasta musi mieć minimum 2 znaki.',
    'address-zip': (val) => /^[0-9]{2}-[0-9]{3}$/.test(val) ? '' : 'Wpisz kod w formacie 00-000.',
    // Reguły dla faktury (będą sprawdzane warunkowo)
    'invoice-company-name': (val) => val.length >= 3 ? '' : 'Nazwa firmy musi mieć minimum 3 znaki.',
    'invoice-nip': (val) => /^[0-9]{10}$/.test(val.replace(/[- ]/g, '')) ? '' : 'NIP musi składać się dokładnie z 10 cyfr.',
    'invoice-street': (val) => val.length >= 4 ? '' : 'Podaj poprawny adres firmy (minimum 4 znaki).',
    'invoice-city': (val) => val.length >= 2 ? '' : 'Nazwa miasta firmy musi mieć minimum 2 znaki.',
    'invoice-zip': (val) => /^[0-9]{2}-[0-9]{3}$/.test(val) ? '' : 'Wpisz kod firmy w formacie 00-000.'
};
// Funkcja sprawdzająca pojedyncze pole i wstrzykująca błąd pod niego
function validateField(inputId) {
    const input = document.getElementById(inputId);
    if (!input) return true;

    // Jeśli pole jest ukryte (np. faktura wyłączona), nie walidujemy go
    if (input.closest('#invoice-fields-section') && !document.getElementById('wants-invoice')?.checked) {
        clearFieldError(inputId);
        return true;
    }

    const value = input.value.trim();
    const rule = validationRules[inputId];

    if (rule) {
        const errorMessage = rule(value);
        if (errorMessage) {
            showFieldError(inputId, errorMessage);
            return false;
        } else {
            clearFieldError(inputId);
            return true;
        }
    }
    return true;
}

function showFieldError(inputId, message) {
    const input = document.getElementById(inputId);
    if (!input) return;

    input.classList.add('input-error');

    // Nadajemy rodzicowi pozycję relatywną, aby błąd pozycjonował się względem niego
    if (input.parentNode) {
        input.parentNode.style.position = 'relative';
    }

    // Szukamy diva z błędem
    let errorDiv = input.nextElementSibling;
    if (!errorDiv || !errorDiv.classList.contains('field-error-message')) {
        errorDiv = document.createElement('div');
        errorDiv.className = 'field-error-message';

        // STYLOWANIE ABSOLUTNE - zapobiega kurczeniu się inputów
        errorDiv.style.position = 'absolute';
        errorDiv.style.left = '0';
        errorDiv.style.bottom = '-18px'; // Wypycha błąd dokładnie pod dolną krawędź inputa
        errorDiv.style.color = '#dc3545';
        errorDiv.style.fontSize = '11px';
        errorDiv.style.whiteSpace = 'nowrap'; // Zapobiega łamaniu tekstu w ciasnych miejscach
        errorDiv.style.zIndex = '10';

        input.parentNode.insertBefore(errorDiv, input.nextSibling);
    }

    errorDiv.innerText = message;
    errorDiv.style.display = 'block';

    // Opcjonalnie: dodaj margines do całego kontenera (form-group),
    // aby błędy nie najeżdżały na pola poniżej
    const formGroup = input.closest('.form-group');
    if (formGroup) {
        formGroup.style.marginBottom = '25px';
    }
}

function clearFieldError(inputId) {
    const input = document.getElementById(inputId);
    if (!input) return;

    input.classList.remove('input-error');
    const errorDiv = input.nextElementSibling;
    if (errorDiv && errorDiv.classList.contains('field-error-message')) {
        errorDiv.style.display = 'none';
    }

    // Przywracamy standardowy odstęp, gdy błąd znika
    const formGroup = input.closest('.form-group');
    if (formGroup) {
        formGroup.style.marginBottom = ''; // lub pierwotna wartość np. '15px'
    }
}

// Podpięcie zdarzenia 'blur' pod wszystkie zdefiniowane pola
function setupLiveValidation() {
    Object.keys(validationRules).forEach(inputId => {
        const input = document.getElementById(inputId);
        if (input) {
            input.addEventListener('blur', () => {
                validateField(inputId);
            });
        }
    });
}
// 4. WALIDACJA FORMULARZA I WYSYŁKA DO RUST API
async function handleOrderSubmission(e) {
    e.preventDefault();

    const basket = JSON.parse(localStorage.getItem('cart')) || [];
    if (basket.length === 0) {
        alert("Twój koszyk jest pusty!");
        return;
    }

    // Walidujemy wszystkie pola po kolei przy próbie wysłania formularza
    let isFormValid = true;
    Object.keys(validationRules).forEach(inputId => {
        const isValid = validateField(inputId);
        if (!isValid) {
            isFormValid = false;
        }
    });

    // Jeśli formularz ma błędy, znajdź pierwszy i przewiń do niego ekran
    if (!isFormValid) {
        const firstErrorInput = document.querySelector('.input-error');
        if (firstErrorInput) {
            firstErrorInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
            firstErrorInput.focus();
        }
        return;
    }

    // Pobieranie sprawdzonych wartości
    const userId = document.getElementById('checkout-form').getAttribute('data-user-id') || null;
    const email = document.getElementById('customer-email').value.trim();
    const name = document.getElementById('customer-name').value.trim();
    const surname = document.getElementById('customer-surname').value.trim();
    const phone = document.getElementById('customer-phone').value.trim();
    const street = document.getElementById('address-street').value.trim();
    const city = document.getElementById('address-city').value.trim();
    const zipCode = document.getElementById('address-zip').value.trim();

    const wantsInvoice = document.getElementById('wants-invoice')?.checked || false;
    let invoiceData = null;

    if (wantsInvoice) {
        const companyName = document.getElementById('invoice-company-name').value.trim();
        const nip = document.getElementById('invoice-nip').value.trim().replace(/[- ]/g, '');
        const invStreet = document.getElementById('invoice-street').value.trim();
        const invCity = document.getElementById('invoice-city').value.trim();
        const invZip = document.getElementById('invoice-zip').value.trim();

        invoiceData = { company_name: companyName, nip, street: invStreet, city: invCity, zip_code: invZip };
    }
    const enrichedItems = await Promise.all(basket.map(async (item) => {
        try {
            // Wywołujemy Twój endpoint: /api/products/name_id/{id}
            const response = await fetch(`http://localhost:8080/api/products/name_id/${item.name_id}`);
            if (!response.ok) throw new Error("Nie znaleziono produktu");

            const productData = await response.json();

            return {
                zamowienie_id: 0,
                product_id: productData.id, // TO JEST TO PRAWDZIWE ID, KTÓREGO BRAKUJE
                ilosc: item.quantity,
                cena: item.display?.price || 0,
                konfiguracja: item.type === 'configured' ? item.configuration : null
            };
        } catch (err) {
            console.error("Błąd podczas pobierania danych produktu:", item.name_id, err);
            return null; // Lub obsłuż błąd inaczej
        }
    }));

    // Sprawdź czy wszystko się pobrało
    if (enrichedItems.includes(null)) {
        alert("Wystąpił błąd podczas weryfikacji produktów w koszyku.");
        return;
    }

    // MAPOWANIE KOSZYKA
    const cleanItems = basket.map(item => ({
        zamowienie_id: 0, // Ignorowane przez serwer (wypełniane w SQL)
        product_id: item.product_id, // Upewnij się, że masz tu ID produktu
        ilosc: item.quantity,
        cena: item.display?.price || 0, // Cena jednostkowa (ważne dla bazy)
        konfiguracja: item.type === 'configured' ? item.configuration : null
    }));

    // BUDOWANIE PAYLOADU ZGODNEGO Z CaloscioweZamowienie
    const finalPayload = {
        dane: {
            id: 0, // Inicjalizowane na serwerze
            user_id: userId ? parseInt(userId) : null,
            date: "", // Generowane na serwerze
            email: email,
            tel: phone,
            ulica: street,
            miasto: city,
            kod_pocztowy: zipCode,
            faktura_dane: invoiceData ? {
                ulica: invoiceData.street,
                miasto: invoiceData.city,
                kod_pocztowy: invoiceData.zip_code,
                nip: invoiceData.nip,
                nazwa_firmy: invoiceData.company_name
            } : null,
            cena: basket.reduce((sum, item) => sum + (item.display?.price * item.quantity), 0),
            numer_fv: "", // Generowane na serwerze
            oplacone: false
        },
        przedmioty: enrichedItems
    };

    console.log("🚀 WYSYŁANIE DO RUST API:", JSON.stringify(finalPayload, null, 2));
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    const token = currentUser ? currentUser.token : null;
    try {
        const response = await fetch('http://localhost:8080/api/order', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': token ? `Bearer ${token}` : '' // DODAJ TO!
            },
            body: JSON.stringify(finalPayload)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || "Błąd serwera podczas przetwarzania zamówienia.");
        }

        const result = await response.json();

        if (result.payment_url) {
            localStorage.removeItem('cart');
            window.location.href = result.payment_url;
        } else {
            alert("Serwer nie zwrócił linku do płatności.");
        }

    } catch (err) {
        console.error("Błąd krytyczny finalizacji:", err);
        alert(`Nie udało się złożyć zamówienia: ${err.message}`);
    }
}
function setupInputRestrictions() {
    const phoneInput = document.getElementById('customer-phone');
    const nameInput = document.getElementById('customer-name');
    const surnameInput = document.getElementById('customer-surname');
    const nipInput = document.getElementById('invoice-nip');
    const zipInput = document.getElementById('address-zip');
    const invZipInput = document.getElementById('invoice-zip');

    // 1. RESTRYKCJA DLA TELEFONU: Pozwala na '+' tylko na samym początku i same cyfry
// 1. RESTRYKCJA I AUTOMATYCZNE GRUPOWANIE DLA TELEFONU (Komórkowe, Stacjonarne, Krajowe i Zagraniczne)
    if (phoneInput) {
        phoneInput.addEventListener('input', (e) => {
            let value = e.target.value;
            const cursorPosition = e.target.selectionStart;
            const originalLength = value.length;

            // 1. Standaryzacja: jeśli wpisze 00 na starcie, zamień na +
            if (value.startsWith('00')) {
                value = '+' + value.slice(2);
            }

            // 2. Wyciągamy informację o kierunkowym
            let hasPlus = value.startsWith('+');

            // Czyścimy wszystko oprócz cyfr
            let allDigits = value.replace(/[^0-9]/g, '');

            let prefix = '';
            let mainNumber = '';

            if (hasPlus) {
                // Dla numerów z plusem (np. +48... lub +1... lub +44...)
                // Standardowe kody krajów mają od 1 do 3 cyfr.
                // Najczęstszy scenariusz w PL to +48 (2 cyfry). Sprawdźmy dynamicznie:
                if (allDigits.startsWith('48') || allDigits.length > 9) {
                    // Jeśli zaczyna się od 48 lub numer jest podejrzanie długi, odcinamy pierwsze 2 cyfry jako kierunkowy
                    // (Możesz to rozbudować, ale podział na 2 cyfry prefiksu dla Europy/PL działa najlepiej)
                    let prefixLength = allDigits.startsWith('48') ? 2 : (allDigits.length > 11 ? 3 : 2);
                    if (allDigits.length < prefixLength) prefixLength = allDigits.length;

                    prefix = '+' + allDigits.slice(0, prefixLength);
                    mainNumber = allDigits.slice(prefixLength);
                } else {
                    // Jeśli wpisuje dopiero początek kierunkowego
                    prefix = '+' + allDigits;
                    mainNumber = '';
                }
            } else {
                // Brak plusa -> traktujemy jako numer polski (9 cyfr)
                prefix = '';
                mainNumber = allDigits;
            }

            // 3. Ograniczenie maksymalnej długości właściwego numeru (standard E.164: max 15 cyfr globalnie)
            // Jeśli numer jest polski (brak prefiksu), ograniczamy go do standardowych 9 cyfr
            const maxMainDigits = prefix ? 15 : 9;
            mainNumber = mainNumber.slice(0, maxMainDigits);

            // 4. Grupowanie właściwego numeru co 3 cyfry
            let formattedMain = '';
            for (let i = 0; i < mainNumber.length; i++) {
                if (i > 0 && i % 3 === 0) {
                    formattedMain += ' ';
                }
                formattedMain += mainNumber[i];
            }

            // 5. Składanie finalnego ciągu
            let newValue = '';
            if (prefix) {
                newValue = prefix + (formattedMain ? ' ' : '') + formattedMain;
            } else {
                newValue = formattedMain;
            }

            // 6. Przypisanie i inteligentna korekta pozycji kursora, żeby nie skakał na koniec linii
            if (e.target.value !== newValue) {
                e.target.value = newValue;

                // Obliczamy przesunięcie kursora na podstawie zmiany długości ciągu
                const lengthDiff = newValue.length - originalLength;
                let newCursorPos = cursorPosition + lengthDiff;

                // Zabezpieczenie przed ujemnym indeksem
                newCursorPos = Math.max(0, Math.min(newCursorPos, newValue.length));
                e.target.setSelectionRange(newCursorPos, newCursorPos);
            }
        });
    }

    // 2. RESTRYKCJA DLA NIP: Tylko cyfry
    if (nipInput) {
        nipInput.addEventListener('input', (e) => {
            let cursorPosition = e.target.selectionStart;
            let newValue = e.target.value.replace(/[^0-9]/g, '');
            if (e.target.value !== newValue) {
                e.target.value = newValue;
                e.target.setSelectionRange(cursorPosition - 1, cursorPosition - 1);
            }
        });
    }

    // 3. RESTRYKCJA DLA IMION I NAZWISK: Blokada wpisywania cyfr i znaków specjalnych
    [nameInput, surnameInput].forEach(input => {
        if (input) {
            input.addEventListener('input', (e) => {
                let cursorPosition = e.target.selectionStart;
                let newValue = e.target.value.replace(/[0-9!@#$%^&*()_+=\[\]{};':"\\|,.<>\/?]/g, '');
                if (e.target.value !== newValue) {
                    e.target.value = newValue;
                    e.target.setSelectionRange(cursorPosition - 1, cursorPosition - 1);
                }
            });
        }
    });

    // 4. RESTRYKCJA DLA KODÓW POCZTOWYCH: Ogarnia ręczny myślnik i automatyczne wstawianie
    [zipInput, invZipInput].forEach(input => {
        if (input) {
            input.addEventListener('input', (e) => {
                let value = e.target.value;

                // Wyciągamy same cyfry, żeby sprawdzić realną długość danych
                let digits = value.replace(/[^0-9]/g, '');

                // Maksymalnie 5 cyfr dla polskiego kodu pocztowego
                digits = digits.slice(0, 5);

                let newValue = '';
                if (digits.length > 2) {
                    newValue = digits.slice(0, 2) + '-' + digits.slice(2);
                } else {
                    newValue = digits;
                }

                // Przypisujemy nową wartość tylko wtedy, gdy faktycznie się zmieniła
                if (value !== newValue) {
                    let cursorPosition = e.target.selectionStart;

                    // Mały trik: jeśli użytkownik właśnie sam wpisał myślnik na 3. pozycji,
                    // lub skrypt go dodał, kursor przesunąłby się błędnie. Kontrolujemy to:
                    e.target.value = newValue;

                    if (cursorPosition === 3 && value.endsWith('-')) {
                        e.target.setSelectionRange(3, 3);
                    } else {
                        e.target.setSelectionRange(cursorPosition, cursorPosition);
                    }
                }
            });
        }
    });
}