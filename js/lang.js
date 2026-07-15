
const translations = {
    pl: {
        welcome: "logo",
        description: "To jest przykład obsługi języków w czystym JS.",
        admin_panel_title: "🛠️ Panel Administratora",
        admin_panel_item_list: "📦 Lista produktów",
        admin_panel_item_add_new: "🛠️ Dodaj Nowy Produkt",
        admin_panel_item_loading: "Ładowanie produktów...",
        admin_panel_item_name: "Nazwa produktu:",
        admin_panel_item_name_pl: "Nazwa produktu(pl):",
        admin_panel_item_name_en: "Nazwa produktu(en):",
        admin_panel_item_desc: "Opis:",
        admin_panel_item_desc_pl: "Opis PL:",
        admin_panel_item_desc_en: "Opis EN:",
        admin_panel_item_price: "Cena netto:",
        nav_products: "Meble",
        nav_contact: "Kontakt",
        spec_height: "Wysokość:",
        spec_width: "Szerokość:",
        spec_depth: "Głębokość:",
        spec_price: "Cena:",
        // spec_name: "Nazwa:",
    },
    en: {
        welcome: "logo",
        description: "This is an example of language handling in pure JS.",
        admin_panel_title: "🛠️ Admin Panel",
        admin_panel_item_list: "📦 Product list",
        admin_panel_item_add_new: "🛠️ Add New Produkt",
        admin_panel_item_loading: "Loading products...",
        admin_panel_item_name: "Product name:",
        admin_panel_item_name_pl: "Product name(pl):",
        admin_panel_item_name_en: "Product name(en):",
        admin_panel_item_desc: "Description:",
        admin_panel_item_desc_pl: "Description PL:",
        admin_panel_item_desc_en: "Description EN:",
        admin_panel_item_price: "Price (raw):",
        nav_products: "Furnitures",
        nav_contact: "Contact",
        spec_height: "Height:",
        spec_width: "Width:",
        spec_depth: "Depth:",
        spec_price: "Price:",
        // spec_name: "Name:",
    }
};

function setLanguage(lang) {
    const elements = document.querySelectorAll('[data-i18n]');

    elements.forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (translations[lang] && translations[lang][key]) {
            el.innerText = translations[lang][key];
        }
    });

    // NOWOŚĆ: Dynamiczne tłumaczenie tytułów produktów w galerii
    const productTitles = document.querySelectorAll('.product-title');
    productTitles.forEach(t => {
        const namePL = t.getAttribute('data-name-pl');
        const nameEN = t.getAttribute('data-name-en');
        t.innerText = (lang === 'en' && nameEN) ? nameEN : (namePL || 'Brak nazwy');
    });

    // Istniejące już u Ciebie tłumaczenie opisów
    const productDescriptions = document.querySelectorAll('.product-description');
    productDescriptions.forEach(p => {
        const textPL = p.getAttribute('data-desc-pl');
        const textEN = p.getAttribute('data-desc-en');
        p.innerText = (lang === 'en' && textEN) ? textEN : (textPL || 'Brak opisu.');
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