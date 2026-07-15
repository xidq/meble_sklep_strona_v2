// =========================================================================
// GŁÓWNA LOGIKA OBSŁUGI KOSZYKA W PRZEGLĄDARCE
// =========================================================================

document.addEventListener('DOMContentLoaded', () => {

    // injectClearCartButton();
    renderCart();

    // Podpięcie przycisku finalizacji zamówienia
    const checkoutBtn = document.getElementById('checkout-submit-btn');
    if (checkoutBtn) {
        checkoutBtn.addEventListener('click', () => {
            const basket = JSON.parse(localStorage.getItem('cart')) || [];
            if (basket.length === 0) {
                alert("Koszyk jest pusty!");
                return;
            }
            // Przekierowanie na podstronę formularza zamówienia
            window.location.href = '../strony/finalizacja.html';
        });
    }
});

function injectClearCartButton() {
    const checkoutBtn = document.getElementById('checkout-submit-btn');
    if (!checkoutBtn || document.getElementById('clear-cart-btn')) return;

    const clearBtn = document.createElement('button');
    clearBtn.id = 'clear-cart-btn';
    clearBtn.innerText = 'Wyczyść koszyk 🗑️';
    clearBtn.style.width = '100%';
    clearBtn.style.padding = '10px';
    clearBtn.style.backgroundColor = '#edf2f7';
    clearBtn.style.color = '#4a5568';
    clearBtn.style.border = '1px solid #cbd5e0';
    clearBtn.style.borderRadius = '6px';
    clearBtn.style.cursor = 'pointer';
    clearBtn.style.fontWeight = 'bold';
    clearBtn.style.marginBottom = '10px';
    clearBtn.style.fontSize = '14px';

    clearBtn.addEventListener('click', clearAllCart);

    // Wstawiamy przycisk bezpośrednio przed przyciskiem płatności
    checkoutBtn.parentNode.insertBefore(clearBtn, checkoutBtn);
}

// 1. Renderowanie listy produktów i podliczenie szacowanej ceny wizualnej
function renderCart() {
    const listContainer = document.getElementById('cart-items-list');
    const totalContainer = document.getElementById('cart-total-price');
    if (!listContainer) return;

    // Pobieramy koszyk z localStorage
    const basket = JSON.parse(localStorage.getItem('cart')) || [];

    if (basket.length === 0) {
        listContainer.innerHTML = `<p class="empty-msg">Twój koszyk jest pusty. Dodaj produkty, aby zobaczyć je tutaj.</p>`;
        if (totalContainer) totalContainer.innerText = "0.00 zł";

        // Ukrywamy przycisk czyszczenia, jeśli koszyk stał się pusty
        const existingClearBtn = document.getElementById('clear-cart-btn');
        if (existingClearBtn) existingClearBtn.remove();
        return;
    }

    listContainer.innerHTML = '';
    let visualTotalSum = 0;

    basket.forEach((item) => {
        // ABSOLUTNE ZABEZPIECZENIE: Jeśli item lub item.display nie istnieje,
        // podstawiamy bezpieczne wartości domyślne, dzięki czemu pętla nigdy się nie wywali.
        const itemPrice = (item && item.display && typeof item.display.price === 'number') ? item.display.price : 0.00;
        const itemTitle = (item && item.display && item.display.title) ? item.display.title : (item.name_id || "Produkt bez nazwy");

        const itemTotalPrice = itemPrice * item.quantity;
        visualTotalSum += itemTotalPrice;

        const itemDiv = document.createElement('div');
        itemDiv.className = 'cart-item';

        // Budujemy tekst specyfikacji, jeśli produkt był konfigurowany w 3D
        let configMeta = '';
        if (item.type === 'configured' && item.configuration) {
            configMeta = `Opis: Drewno: ${item.configuration.wood}, Metal: ${item.configuration.metal}, Szkło: ${item.configuration.glass}`;
        } else {
            configMeta = `Wersja standardowa prosto z katalogu`;
        }

        itemDiv.innerHTML = `
            <div class="item-info">
                <p class="item-title">${itemTitle}</p>
                <p class="item-meta">${configMeta}</p>
                <p class="item-meta" style="font-weight: bold; margin-top: 4px;">Cena jedn.: ${itemPrice.toFixed(2)} zł</p>
            </div>
            <div class="item-controls">
                <div>
                    <button class="qty-btn" onclick="changeQuantity('${item.id}', -1)">-</button>
                    <span style="margin: 0 8px; font-weight: bold;">${item.quantity}</span>
                    <button class="qty-btn" onclick="changeQuantity('${item.id}', 1)">+</button>
                </div>
                <div style="min-width: 90px; text-align: right; font-weight: bold;">
                    ${itemTotalPrice.toFixed(2)} zł
                </div>
                <button class="remove-btn" onclick="removeItemFromBasket('${item.id}')">Usuń</button>
            </div>
        `;

        listContainer.appendChild(itemDiv);
    });

    if (totalContainer) {
        totalContainer.innerText = `${visualTotalSum.toFixed(2)} zł`;
    }
    injectClearCartButton();
}

// 2. Zmiana ilości sztuk (+1 / -1)
window.changeQuantity = function(itemId, change) {
    let basket = JSON.parse(localStorage.getItem('cart')) || [];
    const item = basket.find(i => i.id === itemId);

    if (item) {
        item.quantity += change;
        // Jeśli ilość spadnie do zera lub mniej, usuwamy pozycję całkowicie
        if (item.quantity <= 0) {
            basket = basket.filter(i => i.id !== itemId);
        }
        localStorage.setItem('cart', JSON.stringify(basket));
        renderCart();

        // Aktualizacja licznika w nagłówku, jeśli funkcja istnieje w auth_ui.js
        if (typeof window.updateBasketDOM === "function") window.updateBasketDOM();
    }
};

// 3. Całkowite usunięcie pojedynczego elementu konfiguracji mebla
window.removeItemFromBasket = function(itemId) {
    let basket = JSON.parse(localStorage.getItem('cart')) || [];
    basket = basket.filter(i => i.id !== itemId);

    localStorage.setItem('cart', JSON.stringify(basket));
    renderCart();

    if (typeof window.updateBasketDOM === "function") window.updateBasketDOM();
};
// TUTAJ BYŁ BŁĄD - Dopisałem brakującą funkcję czyszczenia przypiętą do window
window.clearAllCart = function() {
    if (confirm("Czy na pewno chcesz usunąć wszystkie produkty z koszyka?")) {
        localStorage.removeItem('cart');
        renderCart();

        // Zerowanie licznika w nagłówku strony
        const badge = document.getElementById('basketCount');
        if (badge) {
            badge.textContent = '0';
            badge.style.display = 'none';
        }
        if (typeof window.updateBasketDOM === "function") window.updateBasketDOM();
    }
};
// 4. PARSOWANIE I FILTROWANIE DANYCH WYŁĄCZNIE DLA SERWERA RUST (FINALIZACJA)
// function preparePayloadForRustBackend() {
//     const basket = JSON.parse(localStorage.getItem('cart')) || [];
//
//     if (basket.length === 0) {
//         alert("Koszyk jest pusty!");
//         return;
//     }
//
//     // MAPOWANIE: Czyścimy dane z frontowych cache'ów ( display.price, display.title itp. ).
//     // Serwer nie może ufać cenie wysłanej z przeglądarki, bo użytkownik mógłby zmodyfikować HTML/JS.
//     const rustPayload = basket.map(item => {
//         return {
//             name_id: item.name_id,
//             quantity: item.quantity,
//             // Przesyłamy surowy obiekt konfiguracji, serwer sam odpyta router/bazę o narzuty cenowe
//             configuration: item.type === 'configured' ? item.configuration : null
//         };
//     });
//
//     console.log("=========================================================");
//     console.log("🚀 PAYLOAD PRZYGOTOWANY DO WYSYŁKI DO API (SERWER RUST):");
//     console.log("=========================================================");
//     console.log(JSON.stringify(rustPayload, null, 2));
//     console.log("=========================================================");
//
//     alert("Pomyślnie zrzucono strukturę zamówienia do konsoli dev-tools! Gotowe pod integrację API.");
// }