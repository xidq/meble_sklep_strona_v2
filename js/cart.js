// =========================================================================
// GŁÓWNA LOGIKA OBSŁUGI KOSZYKA W PRZEGLĄDARCE
// =========================================================================

document.addEventListener('DOMContentLoaded', () => {
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
            window.location.href = '/strony/finalizacja.html';
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

    checkoutBtn.parentNode.insertBefore(clearBtn, checkoutBtn);
}

function renderCart() {
    const listContainer = document.getElementById('cart-items-list');
    const totalContainer = document.getElementById('cart-total-price');
    if (!listContainer) return;

    const currentLang = localStorage.getItem('user-lang') || 'pl';
    const dict = (typeof translations !== 'undefined' && translations[currentLang]) ? translations[currentLang] : {};
    const basket = JSON.parse(localStorage.getItem('cart')) || [];

    if (basket.length === 0) {
        const emptyMsg = dict.cart_empty || "Twój koszyk jest pusty. Dodaj produkty, aby zobaczyć je tutaj.";
        listContainer.innerHTML = `<p class="empty-msg" data-i18n="cart_empty">${emptyMsg}</p>`;
        if (totalContainer) totalContainer.innerText = "0.00 zł";

        const existingClearBtn = document.getElementById('clear-cart-btn');
        if (existingClearBtn) existingClearBtn.remove();
        return;
    }

    listContainer.innerHTML = '';
    let visualTotalSum = 0;

    basket.forEach((item) => {
        const itemPrice = (item && item.display && typeof item.display.price === 'number') ? item.display.price : 0.00;
        const itemTitle = (item && item.display && item.display.title) ? item.display.title : (item.name_id || "Produkt bez nazwy");

        const itemTotalPrice = itemPrice * item.quantity;
        visualTotalSum += itemTotalPrice;

        const itemDiv = document.createElement('div');
        itemDiv.className = 'cart-item';

        let configMeta;
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

window.changeQuantity = function(itemId, change) {
    let basket = JSON.parse(localStorage.getItem('cart')) || [];
    const item = basket.find(i => i.id === itemId);

    if (item) {
        item.quantity += change;
        if (item.quantity <= 0) {
            basket = basket.filter(i => i.id !== itemId);
        }
        localStorage.setItem('cart', JSON.stringify(basket));
        renderCart();

        if (typeof window.updateBasketDOM === "function") window.updateBasketDOM();
    }
};

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
