document.addEventListener('DOMContentLoaded', () => {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabSections = document.querySelectorAll('.tab-section');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetTabId = button.getAttribute('data-tab');

            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabSections.forEach(section => section.classList.remove('active'));
            button.classList.add('active');
            document.getElementById(targetTabId).classList.add('active');

        });
    });
});
    let currentUser = null;
    let allProducts = [];

    const saveProductBtn = document.getElementById('saveProductBtn');
    const newProductModeBtn = document.getElementById('newProductModeBtn');
    const productsContainer = document.getElementById('productsContainer');
    const formTitle = document.getElementById('formTitle');
    const adminMessage = document.getElementById('adminMessage');

    // Strażnik Autoryzacji (Zabezpieczenie przed nieautoryzowanym dostępem)
    function checkAuth() {
    const storedUser = localStorage.getItem('currentUser');
    if (!storedUser) {
        alert("Brak dostępu! Zaloguj się najpierw.");
        window.location.href = "../index.html";
        return;
    }
    currentUser = JSON.parse(storedUser);
    if (currentUser.role !== "Admin") {
        alert("Brak uprawnień administratora!");
        window.location.href = "../index.html";
        return;
    }
    // Jeśli autoryzacja przebiegła pomyślnie - ładuj produkty
    document.getElementById('adminPanel').style.display = 'block';
    fetchProducts();
}

    async function fetchProducts() {
    try {
    const response = await fetch('http://127.0.0.1:8080/api/products');
    if (!response.ok) throw new Error("Nie udało się pobrać listy produktów");
    allProducts = await response.json();
    renderProductsList();
} catch (error) {
    productsContainer.innerHTML = `<span style="color:red">${error.message}</span>`;
}
}

    function renderProductsList() {
    productsContainer.innerHTML = "";
    if (allProducts.length === 0) {
    productsContainer.innerHTML = "Brak produktów w bazie.";
    return;
}
    allProducts.forEach(prod => {
    const div = document.createElement('div');
    div.className = 'product-item';
    div.id = `prod-item-${prod.id}`;
    div.innerHTML = `<strong>${prod.name}</strong><br><small>Cena netto: ${prod.price_netto} PLN (ID: ${prod.id})</small>`;
    div.addEventListener('click', () => selectProductForEdit(prod));
    productsContainer.appendChild(div);
});
}

    function selectProductForEdit(product) {
    document.querySelectorAll('.product-item').forEach(el => el.classList.remove('selected'));
    const item = document.getElementById(`prod-item-${product.id}`);
    if(item) item.classList.add('selected');

    formTitle.textContent = `📝 Edytujesz: ${product.name} (ID: ${product.id})`;
    document.getElementById('p_id').value = product.id;
    document.getElementById('p_name').value = product.name;
    document.getElementById('p_desc').value = product.description;
    document.getElementById('p_price').value = product.price_netto;
    document.getElementById('p_vat').value = product.vat;
    document.getElementById('p_url').value = product.model_url;
    document.getElementById('p_width').value = product.width_cm;
    document.getElementById('p_height').value = product.height_cm;
    document.getElementById('p_depth').value = product.depth_cm;
    document.getElementById('p_scale').value = product.suggested_render_scale;

    saveProductBtn.style.background = "#ffc107";
    saveProductBtn.textContent = "Zaktualizuj dane produktu";
    adminMessage.textContent = "";
}

    newProductModeBtn.addEventListener('click', () => {
    document.querySelectorAll('.product-item').forEach(el => el.classList.remove('selected'));
    formTitle.textContent = "🛠️ Dodaj Nowy Produkt";
    document.getElementById('p_id').value = "0";
    document.getElementById('p_name').value = "";
    document.getElementById('p_desc').value = "";
    document.getElementById('p_price').value = "0.00";
    document.getElementById('p_vat').value = "23.00";
    document.getElementById('p_url').value = "/assets/models/";
    document.getElementById('p_width').value = "0";
    document.getElementById('p_height').value = "0";
    document.getElementById('p_depth').value = "0";
    document.getElementById('p_scale').value = "1.0";

    saveProductBtn.style.background = "#007bff";
    saveProductBtn.textContent = "Zapisz nowy produkt";
    adminMessage.textContent = "";
});

    saveProductBtn.addEventListener('click', async () => {
    adminMessage.style.color = "black";
    adminMessage.textContent = "Wysyłanie...";
    const currentId = parseInt(document.getElementById('p_id').value);

    const productPayload = {
    id: currentId,
    name: document.getElementById('p_name').value,
    description: document.getElementById('p_desc').value,
    price_netto: parseFloat(document.getElementById('p_price').value),
    vat: parseFloat(document.getElementById('p_vat').value),
    model_url: document.getElementById('p_url').value,
    width_cm: parseFloat(document.getElementById('p_width').value),
    height_cm: parseFloat(document.getElementById('p_height').value),
    depth_cm: parseFloat(document.getElementById('p_depth').value),
    suggested_render_scale: parseFloat(document.getElementById('p_scale').value)
};

    try {
    const response = await fetch('http://127.0.0.1:8080/api/products', {
    method: 'POST',
    headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${currentUser.token}`
},
    body: JSON.stringify(productPayload)
});

    if (response.ok) {
    adminMessage.style.color = "green";
    adminMessage.textContent = currentId === 0 ? "Dodano nowy produkt!" : "Zaktualizowano produkt!";
    fetchProducts();
} else {
    const errText = await response.text();
    throw new Error(errText);
}
} catch (error) {
    adminMessage.style.color = "red";
    adminMessage.textContent = "Błąd: " + error.message;
}
});

    // Uruchomienie sprawdzania uprawnień przy starcie panelu
    checkAuth();
    document.getElementById('language-switcher').addEventListener('change', () => {
    setTimeout(() => {
        if (allProducts.length > 0) {
            renderProductsList();
        }
    }, 50)});
