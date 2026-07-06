
const translations = {
    pl: {
        welcome: "logo",
        description: "To jest przykład obsługi języków w czystym JS.",
        admin_panel_title: "🛠️ Panel Administratora",
        admin_panel_item_list: "📦 Lista produktów",
        admin_panel_item_add_new: "🛠️ Dodaj Nowy Produkt",
        admin_panel_item_loading: "Ładowanie produktów...",
        admin_panel_item_name: "Nazwa produktu:",
        admin_panel_item_desc: "Opis:",
        admin_panel_item_price: "Cena netto:",
        nav_products: "Meble",
        nav_contact: "Kontakt",
    },
    en: {
        welcome: "logo",
        description: "This is an example of language handling in pure JS.",
        admin_panel_title: "🛠️ Admin Panel",
        admin_panel_item_list: "📦 Product list",
        admin_panel_item_add_new: "🛠️ Add New Produkt",
        admin_panel_item_loading: "Loading products...",
        admin_panel_item_name: "Product name:",
        admin_panel_item_desc: "Description:",
        admin_panel_item_price: "Price (raw):",
        nav_products: "Furnitures",
        nav_contact: "Contact",
    }
};

function setLanguage(lang) {
    const elements = document.querySelectorAll('[data-i18n]');
    console.log("Znaleziono elementów do tłumaczenia:", elements.length); // CZY TO SIĘ WYŚWIETLA?

    elements.forEach(el => {
        const key = el.getAttribute('data-i18n');
        console.log("Tłumaczę klucz:", key, "na:", translations[lang][key]);

        if (translations[lang] && translations[lang][key]) {
            el.innerText = translations[lang][key];
        }
    });
}

document.addEventListener("DOMContentLoaded", () => {
    // ZABEZPIECZENIE: Sprawdzamy czy element istnieje przed dodaniem eventu
    const switcher = document.getElementById('language-switcher');

    if (switcher) {
        // Obsługa zmiany w select
        switcher.addEventListener('change', (e) => {
            const lang = e.target.value;
            setLanguage(lang);
            localStorage.setItem('user-lang', lang);
        });

        // Ustawienie wartości przy ładowaniu
        const savedLang = localStorage.getItem('user-lang') || 'pl';
        switcher.value = savedLang;
        setLanguage(savedLang);
    } else {
        console.warn("Element 'language-switcher' nie został znaleziony. Skrypt działa, ale bez obsługi zmiany języka.");
    }
});