// --- ZMIENNE GLOBALNE I ELEMENTY DOM ---
let allOrders = [];
let originalOrderData = {};
let currentOrderItems = []; // Przechowuje pozycje produktów zamawianych

const ordersContainer = document.getElementById('ordersContainer');
const saveOrderBtn = document.getElementById('saveOrderBtn');

// Wspinanie się/automatyczne pobieranie zamówień przy przełączaniu zakładek
document.addEventListener('DOMContentLoaded', () => {
    const ordersTabBtn = document.querySelector('[data-tab="tab-orders"]');
    if (ordersTabBtn) {
        ordersTabBtn.addEventListener('click', () => {
            fetchOrders();
        });
    }

    // Dodanie kontenera na listę produktów jeśli nie istnieje dynamicznie
    const formPanel = document.querySelector('#tab-orders .form-panel');
    if (formPanel && !document.getElementById('o_items_container')) {
        const itemsDiv = document.createElement('div');
        itemsDiv.id = 'o_items_container';
        itemsDiv.className = 'form-group';
        itemsDiv.innerHTML = '<label>Zamówione produkty:</label><div id="o_items_list" style="background:#f8f9fa; padding:10px; border-radius:4px; font-size:0.9em; font-family:monospace;">---</div>';
        formPanel.insertBefore(itemsDiv, saveOrderBtn);
    }

    // Obsługa śledzenia zmian (kropki)
    const orderInputs = document.querySelectorAll('#tab-orders .form-panel input, #tab-orders .form-panel textarea, #tab-orders .form-panel select');
    orderInputs.forEach(input => {
        const handler = () => {
            const origVal = originalOrderData[input.id];
            const isModified = String(input.value || '').trim() !== String(origVal || '').trim();
            updateOrderFieldModifiedStatus(input.id, isModified);
        };
        input.addEventListener('input', handler);
        input.addEventListener('change', handler);
    });

    // REJESTRACJA NASŁUCHIWANIA FILTRÓW (dopisane filter_status i filter_oplacone)
    const filterInputs = [
        'filter_fv',
        'filter_user_id',
        'filter_status',
        'filter_oplacone',
        'filter_date_from',
        'filter_date_to',
        'sort_orders'
    ];

    filterInputs.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', renderOrdersList);
            el.addEventListener('change', renderOrdersList);
        }
    });

    const clearBtn = document.getElementById('clear_order_filters');
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            filterInputs.forEach(id => {
                const el = document.getElementById(id);
                if (el) {
                    if (el.tagName === 'SELECT') el.selectedIndex = 0;
                    else el.value = '';
                }
            });
            renderOrdersList();
        });
    }
});

// --- POBIERANIE LISTY ZAMÓWIEŃ ---
async function fetchOrders() {
    try {
        const response = await fetch("/api/admin/orders", {
            headers: {
                'Authorization': `Bearer ${currentUser?.token || ''}`
            }
        });
        if (!response.ok) throw new Error("Błąd pobierania listy zamówień");

        allOrders = await response.json();
        renderOrdersList();
    } catch (error) {
        if (ordersContainer) {
            ordersContainer.innerHTML = `<span style="color:red">${error.message}</span>`;
        }
    }
}

// --- RENDEROWANIE I FILTROWANIE LISTY ZAMÓWIEŃ ---
function renderOrdersList() {
    if (!ordersContainer) return;
    ordersContainer.innerHTML = "";

    if (!Array.isArray(allOrders) || allOrders.length === 0) {
        ordersContainer.innerHTML = "<div>Brak zamówień w bazie.</div>";
        return;
    }

    // Pobranie wartości filtrów
    const filterFv = getVal('filter_fv').toLowerCase().trim();
    const filterUserId = getVal('filter_user_id').trim();
    const filterStatus = getVal('filter_status');
    const filterOplacone = getVal('filter_oplacone');
    const filterDateFrom = getVal('filter_date_from');
    const filterDateTo = getVal('filter_date_to');
    const sortVal = getVal('sort_orders');

    // 1. FILTROWANIE
    let filtered = allOrders.filter(order => {
        if (filterFv) {
            const fvMatch = (order.numer_fv || '').toLowerCase().includes(filterFv);
            const idMatch = String(order.id).includes(filterFv);
            if (!fvMatch && !idMatch) return false;
        }

        if (filterUserId && String(order.user_id) !== filterUserId) {
            return false;
        }

        // Filtrowanie po statusie przesyłki
        if (filterStatus && order.status !== filterStatus) {
            return false;
        }

        // Filtrowanie po statusie płatności
        if (filterOplacone && order.oplacone !== filterOplacone) {
            return false;
        }

        if (order.date) {
            const orderDateStr = order.date.split(' ')[0].split('|')[0].trim();
            if (filterDateFrom && orderDateStr < filterDateFrom) return false;
            if (filterDateTo && orderDateStr > filterDateTo) return false;
        }

        return true;
    });

    // 2. SORTOWANIE
    filtered.sort((a, b) => {
        const parseDate = (dStr) => {
            if (!dStr) return 0;
            return new Date(dStr.replace(' | ', 'T')).getTime() || 0;
        };

        if (sortVal === 'date_desc') return parseDate(b.date) - parseDate(a.date);
        if (sortVal === 'date_asc') return parseDate(a.date) - parseDate(b.date);
        if (sortVal === 'price_desc') return (b.cena || 0) - (a.cena || 0);
        if (sortVal === 'price_asc') return (a.cena || 0) - (b.cena || 0);
        return 0;
    });

    if (filtered.length === 0) {
        ordersContainer.innerHTML = "<div style='color:#777; padding: 10px;'>Brak wyników spełniających kryteria.</div>";
        return;
    }

    // 3. RENDEROWANIE Z DODANYMI STATUSAMI
    filtered.forEach(order => {
        const div = document.createElement('div');
        div.className = 'product-item order-item';

        // Stylizacja statusów na liście dla lepszej czytelności
        const isPaid = order.oplacone === 'Oplacone';
        const paidBadgeColor = isPaid ? '#28a745' : (order.oplacone === 'Nieoplacone' ? '#dc3545' : '#ffc107');

        div.innerHTML = `
            <strong>FV: ${order.numer_fv || 'Brak FV'}</strong><br>
            <small>ID: ${order.id} | User ID: ${order.user_id || '-'}</small><br>
            <small>Data: ${order.date || '-'}</small><br>
            <small>Kwota: <b>${order.cena} zł</b></small><br>
            <div style="margin-top: 4px; font-size: 0.8em; display: flex; gap: 5px; flex-wrap: wrap;">
                <span style="background: #e9ecef; padding: 2px 6px; border-radius: 4px;">🚚 ${order.status || 'Brak'}</span>
                <span style="background: ${paidBadgeColor}; color: white; padding: 2px 6px; border-radius: 4px;">💳 ${order.oplacone || 'Brak'}</span>
            </div>
        `;

        div.onclick = async () => {
            deselectAll();
            div.classList.add('selected');
            await selectOrderForEdit(order.id);
        };
        ordersContainer.appendChild(div);
    });
}

// --- POBIERANIE I WYŚWIETLANIE SZCZEGÓŁÓW ZAMÓWIENIA ---
async function selectOrderForEdit(orderId) {
    clearOrderModifiedDots();
    try {
        const response = await fetch(`/api/admin/orders/${orderId}`, {
            headers: {
                'Authorization': `Bearer ${currentUser?.token || ''}`
            }
        });

        if (!response.ok) throw new Error(`Błąd HTTP: ${response.status}`);

        const data = await response.json();
        const d = data.dane || data;
        currentOrderItems = data.przedmioty || [];

        // Podstawowe dane
        setVal('o_id', d.id ?? 0);
        setVal('o_numer_fv', d.numer_fv ?? '');
        setVal('o_date', d.date ?? '');
        setVal('o_user_id', d.user_id ?? 0);
        setVal('o_imie', d.imie ?? '');
        setVal('o_nazwisko', d.nazwisko ?? '');
        setVal('o_email', d.email ?? '');
        setVal('o_tel', d.tel ?? '');

        // Statusy i cena
        setVal('o_status', d.status ?? 'ZamowieniePrzyjete');
        setVal('o_oplacone', d.oplacone ?? 'Nieoplacone');
        setVal('o_cena', d.cena ?? 0);
        setVal('o_vat', d.vat ?? 0);

        // Lokacja dostawy
        const lok = d.lokacja || {};
        setVal('o_ulica', lok.ulica ?? d.ulica ?? '');
        setVal('o_kodpocztowy', lok.kod_pocztowy ?? d.kod_pocztowy ?? '');
        setVal('o_miasto', lok.miasto ?? d.miasto ?? '');

        // Faktura dane
        const fv = d.faktura_dane || {};
        setVal('o_fv_nazwa_firmy', fv.nazwa_firmy ?? '');
        setVal('o_fv_nip', fv.nip ?? '');
        setVal('o_fv_ulica', fv.ulica ?? '');
        setVal('o_fv_kodpocztowy', fv.kod_pocztowy ?? '');
        setVal('o_fv_miasto', fv.miasto ?? '');

        // Transport
        const tr = d.transport || {};
        setVal('o_tr_odleglosc', tr.odleglosc_km ?? '');
        setVal('o_tr_cena', tr.cena_netto ?? '');
        setVal('o_tr_vat', tr.stawka_vat ?? '');

        // Zapis stanu początkowego
        originalOrderData = {
            'o_id': String(d.id ?? 0),
            'o_numer_fv': String(d.numer_fv ?? ''),
            'o_date': String(d.date ?? ''),
            'o_user_id': String(d.user_id ?? 0),
            'o_imie': String(d.imie ?? ''),
            'o_nazwisko': String(d.nazwisko ?? ''),
            'o_email': String(d.email ?? ''),
            'o_tel': String(d.tel ?? ''),
            'o_status': String(d.status ?? ''),
            'o_oplacone': String(d.oplacone ?? ''),
            'o_cena': String(d.cena ?? 0),
            'o_vat': String(d.vat ?? 0),
            'o_ulica': String(lok.ulica ?? d.ulica ?? ''),
            'o_kodpocztowy': String(lok.kod_pocztowy ?? d.kod_pocztowy ?? ''),
            'o_miasto': String(lok.miasto ?? d.miasto ?? ''),
            'o_fv_nazwa_firmy': String(fv.nazwa_firmy ?? ''),
            'o_fv_nip': String(fv.nip ?? ''),
            'o_fv_ulica': String(fv.ulica ?? ''),
            'o_fv_kodpocztowy': String(fv.kod_pocztowy ?? ''),
            'o_fv_miasto': String(fv.miasto ?? ''),
            'o_tr_odleglosc': String(tr.odleglosc_km ?? ''),
            'o_tr_cena': String(tr.cena_netto ?? ''),
            'o_tr_vat': String(tr.stawka_vat ?? '')
        };

        // Renderowanie zakupionych przedmiotów
        const itemsListEl = document.getElementById('o_items_list');
        if (itemsListEl) {
            if (currentOrderItems.length === 0) {
                itemsListEl.innerHTML = '<em>Brak pozycji w tym zamówieniu</em>';
            } else {
                itemsListEl.innerHTML = currentOrderItems.map(p => `
                    <div style="border-bottom: 1px dotted #ccc; padding: 4px 0;">
                        <b>Produkt ID:</b> ${p.product_id} | 
                        <b>Ilość:</b> ${p.ilosc} szt. | 
                        <b>Cena:</b> ${p.cena} zł | 
                        <b>VAT:</b> ${p.vat}%
                    </div>
                `).join('');
            }
        }

    } catch (error) {
        console.error("Błąd pobierania szczegółów zamówienia:", error);
        alert("Nie udało się pobrać szczegółów zamówienia.");
    }
}

// --- ZAPIS ZMIAN ZAMÓWIENIA (PUT) ZGODNIE Z KODEM RUST (`CaloscioweZamowienie`) ---
if (saveOrderBtn) {
    saveOrderBtn.addEventListener('click', async () => {
        const orderId = getVal('o_id');
        if (!orderId || orderId === '0') {
            alert("Nie wybrano zamówienia do edycji!");
            return;
        }

        // Przygotowanie danych faktury (null jeśli brak NIPu lub nazwy firmy)
        const fvNip = getVal('o_fv_nip').trim();
        const fvNazwa = getVal('o_fv_nazwa_firmy').trim();
        let fakturaDane = null;
        if (fvNip || fvNazwa) {
            fakturaDane = {
                nip: fvNip,
                nazwa_firmy: fvNazwa,
                ulica: getVal('o_fv_ulica').trim() || null,
                kod_pocztowy: getVal('o_fv_kodpocztowy').trim() || null,
                miasto: getVal('o_fv_miasto').trim() || null
            };
        }

        // Przygotowanie danych transportu (null jeśli brak odległości/ceny)
        const trOdleglosc = parseFloat(getVal('o_tr_odleglosc'));
        let transportDane = null;
        if (!isNaN(trOdleglosc)) {
            transportDane = {
                odleglosc_km: trOdleglosc,
                cena_netto: parseFloat(getVal('o_tr_cena')) || 0.0,
                stawka_vat: parseFloat(getVal('o_tr_vat')) || 0.23
            };
        }

        // Struktura odpowiadająca Rust: `CaloscioweZamowienie<f64>`
        const payload = {
            dane: {
                id: parseInt(orderId),
                date: getVal('o_date'),
                email: getVal('o_email') || null,
                tel: getVal('o_tel') || null,
                imie: getVal('o_imie'),
                nazwisko: getVal('o_nazwisko'),
                user_id: parseInt(getVal('o_user_id')) || null,
                numer_fv: getVal('o_numer_fv'),
                oplacone: getVal('o_oplacone'),
                status: getVal('o_status'),
                cena: parseFloat(getVal('o_cena')) || 0.0,
                vat: parseFloat(getVal('o_vat')) || 0.0,
                ulica: getVal('o_ulica'),
                miasto: getVal('o_miasto'),
                kod_pocztowy: getVal('o_kodpocztowy'),
                faktura_dane: fakturaDane,
                transport: transportDane
            },
            przedmioty: currentOrderItems
        };

        try {
            const response = await fetch(`/api/admin/orders/${orderId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${currentUser?.token || ''}`
                },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                alert("Zaktualizowano zamówienie w bazie!");
                await fetchOrders();
            } else {
                const errData = await response.text();
                alert(`Błąd zapisu zamówienia: ${errData}`);
            }
        } catch (err) {
            console.error("Błąd sieci:", err);
            alert("Błąd połączenia z serwerem.");
        }
    });
}

// --- POMOCNICZE FUNKCJE ---
function getVal(id) {
    const el = document.getElementById(id);
    return el ? el.value : '';
}

function setVal(id, val) {
    const el = document.getElementById(id);
    if (el) el.value = val;
}

function updateOrderFieldModifiedStatus(fieldId, isModified) {
    const el = document.getElementById(fieldId);
    if (!el) return;
    const group = el.closest('.form-group');
    if (!group) return;

    let dot = group.querySelector('.modified-dot');
    if (isModified) {
        if (!dot) {
            dot = document.createElement('span');
            dot.className = 'modified-dot';
            dot.title = 'Pole zostało zmodyfikowane';
            const label = group.querySelector('label');
            if (label) label.appendChild(dot);
        }
    } else {
        if (dot) dot.remove();
    }
}

function clearOrderModifiedDots() {
    document.querySelectorAll('#tab-orders .modified-dot').forEach(dot => dot.remove());
}