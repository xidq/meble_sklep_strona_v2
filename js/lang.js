
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
        hero_title: "Żyj wygodniej",
        hero_desc: "Odkryj naszą kolekcję nowoczesnych mebli, które łączą w sobie unikalny design, najwyższą jakość wykonania oraz niezrównany komfort użytkowania na co dzień. Stwórz wnętrze swoich marzeń.",
        cart_title: "Twój koszyk:",
        cart_summary: "Podsumowanie",
        cart_sum: "Suma (szacowana):",
        cart_checkout: "Przejdź do płatności",
        cart_empty: "Twój koszyk jest pusty. Dodaj produkty, aby zobaczyć je tutaj.",
        cart_standard_version: "Wersja standardowa prosto z katalogu",
        cart_unit_price: "Cena jedn.:",
        cart_remove: "Usuń",
        cart_clear: "Wyczyść koszyk 🗑️",
        cart_clear_confirm: "Czy na pewno chcesz usunąć wszystkie produkty z koszyka?"
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
        hero_title: "Live comfortable",
        hero_desc: "Discover our collection of modern furniture that combines unique design, the highest quality craftsmanship, and unparalleled comfort for everyday use. Create the interior of your dreams.",
        cart_title: "Your cart:",
        cart_summary: "Summary",
        cart_sum: "Sum (approx):",
        cart_checkout: "Forward with transaction",
        cart_empty: "Your cart is empty. Add products to see them here",
        cart_standard_version: "Standard version straight from the catalog",
        cart_unit_price: "Unit price:",
        cart_remove: "Remove",
        cart_clear: "Clear cart 🗑️",
        cart_clear_confirm: "Are you sure you want to remove all products from the cart?"
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

    const productTitles = document.querySelectorAll('.product-title');
    productTitles.forEach(t => {
        const namePL = t.getAttribute('data-name-pl');
        const nameEN = t.getAttribute('data-name-en');
        t.innerText = (lang === 'en' && nameEN) ? nameEN : (namePL || 'Brak nazwy');
    });

    const productDescriptions = document.querySelectorAll('.product-description');
    productDescriptions.forEach(p => {
        const textPL = p.getAttribute('data-desc-pl');
        const textEN = p.getAttribute('data-desc-en');
        p.innerText = (lang === 'en' && textEN) ? textEN : (textPL || 'Brak opisu.');
    });
}

document.addEventListener("DOMContentLoaded", () => {
    const switcher = document.getElementById('language_switcher');

    if (switcher) {
        switcher.addEventListener('change', (e) => {
            const lang = e.target.value;
            setLanguage(lang);
            localStorage.setItem('user-lang', lang);
        });

        const savedLang = localStorage.getItem('user-lang') || 'pl';
        switcher.value = savedLang;
        setLanguage(savedLang);
    } else {
        console.warn("Element 'language_switcher' nie został znaleziony. Skrypt działa, ale bez obsługi zmiany języka.");
    }
});