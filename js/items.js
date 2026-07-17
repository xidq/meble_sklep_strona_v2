
// ==========================================
// 1. FUNKCJE POMOCNICZE (FORMAT OBRAZKÓW)
// ==========================================
// Wyciągają ścieżki bezpośrednio z obiektu wariantu (np. var_1) znajdującego się w dane.json
function createMainImageHTML(imgObject) {
  if (!imgObject) return '';
  return `
        <picture>
            <source media="(min-width: 2048px)" srcset="${imgObject["2048"] || ''}">
            <source media="(min-width: 1024px)" srcset="${imgObject["1024"] || ''}">
            <source media="(min-width: 512px)" srcset="${imgObject["512"] || ''}">
            <img src="${imgObject["512"] || imgObject["1024"] || ''}" alt="Zdjęcie produktu" />
        </picture>
    `;
}

// Miniaturka: również korzysta z picture, dopasowując mniejsze pliki do ekranu
function createThumbImageHTML(imgObject) {
  if (!imgObject) return '';
  return `
        <picture>
            <source media="(min-width: 128px)" srcset="${imgObject["128"] || ''}">
            <source media="(min-width: 64px)" srcset="${imgObject["64"] || ''}">
            <img src="${imgObject["32"] || imgObject["64"] || ''}" alt="Miniaturka" style="width: 64px; height: auto;" />
        </picture>
    `;
}

// ==========================================
// 2. RENDEROWANIE POJEDYNCZEJ KARTY DOM
// ==========================================
// ==========================================
// 2. RENDEROWANIE POJEDYNCZEJ KARTY DOM (ZINTEGROWANA Z LANG)
// ==========================================
function renderSingleProduct(fullData, index, container) {
  // Dane produktu leżą bezpośrednio w obiekcie po scaleniu
  const product = fullData.product || fullData;
  const card = document.createElement('div');
  card.className = 'product-card';

  const currentLang = localStorage.getItem('user-lang') || 'pl';

  // Ustalamy początkowy język dla nazwy i opisu
  const productName = product[`name_${currentLang}`] || product.name_pl || product.name_id;
  const description = product[`description_${currentLang}`] || product.description_pl || 'Brak opisu.';
  const productId = product.name_id;

  // Wyciągamy warianty zdjęć (var_1, var_2...)
  const imagesList = Object.keys(fullData)
      .filter(key => key.startsWith('var_'))
      .sort((a, b) => a.localeCompare(b, undefined, {numeric: true}))
      .map(key => fullData[key]);


  console.log('🔍 imagesList length:', imagesList.length); // DODAJ
  console.log('🔍 imagesList content:', imagesList);      // DODAJ
  console.log('🔍 fullData keys:', Object.keys(fullData)); // DODAJ


  // Wstrzykujemy strukturę HTML
  // UWAGA: Dodane atrybuty data-i18n, aby funkcja setLanguage mogła przetłumaczyć etykiety!
  card.innerHTML = `
        <div class="left-column">
            <div class="main-image-container" id="main-img-container-${index}">
                ${imagesList.length > 0 ? createMainImageHTML(imagesList[0]) : ''}
            </div>
            <div class="thumbnails-container" id="thumbs-container-${index}"></div>
        </div>
        <div class="right-column">
            <h2 class="product-title" 
                data-name-pl="${product.name_pl || product.name_id}" 
                data-name-en="${product.name_en || product.name_pl || product.name_id}">
                ${productName}
            </h2>
            <p class="product-description" 
               data-desc-pl="${product.description_pl || ''}" 
               data-desc-en="${product.description_en || ''}">
               ${description}
            </p>
            <div class="product-specs">
                <div class="spec-item"><span data-i18n="spec_height" class="spec-label"></span> ${product.height || 0} cm</div>
                <div class="spec-item"><span data-i18n="spec_width" class="spec-label"></span> ${product.width || 0} cm</div>
                <div class="spec-item"><span data-i18n="spec_depth" class="spec-label"></span> ${product.depth || 0} cm</div>
                <div class="spec-item"><span data-i18n="spec_price" class="spec-label"></span> ${product.price || 0} zł</div>
            </div>
            
            <div class="product-actions" style="margin-top: 20px; display: flex; gap: 10px; flex-wrap: wrap;">
                <button class="add-to-cart-btn" data-product-id="${productId}" style="padding: 10px 20px; background-color: #2e7d32; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">
                    Dodaj do koszyka 🛒
                </button>
                <a href="strony/model.html?id=${productId}" class="configure-btn" style="padding: 10px 20px; background-color: #2b6cb0; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; text-decoration: none; display: inline-flex; align-items: center;">
                    Konfigurator 3D 🛠️
                </a>
            </div>
        </div>
    `;

  container.appendChild(card);

  // DODAJ RENDEROWANIE MINIATUREK
  const thumbsContainer = document.getElementById(`thumbs-container-${index}`);
  if (thumbsContainer && imagesList.length > 0) {
    console.log('RENDERUJĘ MINIATURKI, ilość:', imagesList.length); // DODAJ
    imagesList.forEach((imgObj, idx) => {
      const thumbWrapper = document.createElement('div');
      thumbWrapper.className = 'thumb-wrapper';
      if (idx === 0) thumbWrapper.classList.add('active');

      // Wstaw miniaturkę
      thumbWrapper.innerHTML = createThumbImageHTML(imgObj);

      // Kliknięcie – zmień główne zdjęcie
      thumbWrapper.addEventListener('click', () => {
        // Usuń 'active' z wszystkich miniaturek
        const allThumbs = thumbsContainer.querySelectorAll('.thumb-wrapper');
        allThumbs.forEach(t => t.classList.remove('active'));
        thumbWrapper.classList.add('active');

        // Zmień główne zdjęcie
        const mainContainer = document.getElementById(`main-img-container-${index}`);
        if (mainContainer) {
          mainContainer.innerHTML = createMainImageHTML(imgObj);
        }
      });

      thumbsContainer.appendChild(thumbWrapper);
    });
  } else {    console.log('NIE RENDERUJĘ MINIATUREK – thumbsContainer lub imagesList puste!');}

  // Koszyk działający w oparciu o aktualny język (dla nazwy wyświetlanej)
  const cartBtn = card.querySelector('.add-to-cart-btn');
  if (cartBtn) {
    cartBtn.addEventListener('click', () => {
      let basket = JSON.parse(localStorage.getItem('cart')) || [];
      const currentLangNow = localStorage.getItem('user-lang') || 'pl';
      const dynamicName = product[`name_${currentLangNow}`] || product.name_pl || product.name_id;

      const existingItem = basket.find(item => item.id === productId);

      if (existingItem) {
        existingItem.quantity += 1;
      } else {
        const cartItem = {
          id: productId,
          name_id: productId,
          quantity: 1,
          type: "standard",
          display: {
            title: dynamicName,
            price: parseFloat(product.price) || 0.0
          },
          configuration: "None"
        };
        basket.push(cartItem);
      }

      localStorage.setItem('cart', JSON.stringify(basket));

      const badge = document.getElementById('basketCount');
      if (badge) {
        const totalItems = basket.reduce((sum, item) => sum + item.quantity, 0);
        badge.textContent = totalItems;
        badge.style.display = 'block';
      }

      alert(currentLangNow === 'en' ? `Added ${dynamicName} to cart! 🛒` : `Dodano produkt ${dynamicName} do koszyka! 🛒`);
    });
  }
}

// ==========================================
// 3. GŁÓWNA INICJALIZACJA GALERII (POPRAWIONA)
// ==========================================
async function initGallery() {
  console.log('🚀 initGallery START'); // <-- DODAJ
  const container = document.getElementById('products-gallery');
  console.log('🚀 container:', container); // <-- DODAJ
  if (!container) return;

  const urlParams = new URLSearchParams(window.location.search);
  const productIdParam = urlParams.get('id'); // np. ?id=biurko_1

  try {
    // Krok A: Pobieramy główny router.json
    const responseRouter = await fetch('data/router.json');
    console.log('🚀 router.json status:', responseRouter.status); // <-- DODAJ
    if (!responseRouter.ok) {
      throw new Error(`Nie udało się załadować router.json: ${responseRouter.status}`);
    }
    const routerData = await responseRouter.json();
    console.log('🚀 router.json status:', responseRouter.status); // <-- DODAJ

    // Funkcja pomocnicza, która pobiera plik produktu i obrazków dla jednego elementu z routera
    async function fetchAndCombineProduct(item) {
      console.log('🚀 fetchAndCombineProduct for:', item.id); // <-- DODAJ
      const [resProduct, resImg] = await Promise.all([
        fetch(item.product),
        fetch(item.img)
      ]);

      if (!resProduct.ok || !resImg.ok) {
        throw new Error(`Błąd pobierania składowych dla ${item.id}`);
      }

      const productJson = await resProduct.json();
      const imgJson = await resImg.json();

      // Łączymy je w jeden obiekt tak, aby renderSingleProduct widział strukturę:
      // { product: { ...dane z product... }, var_1: { ... }, var_2: { ... } }
      return {
        product: productJson,
        ...imgJson
      };
    }

    // Krok B: Jeśli w URL przekazano konkretne ID mebla (?id=biurko_1)
    if (productIdParam) {
      const targetItem = routerData.find(item => item.id === productIdParam);

      if (targetItem) {
        console.log('🚀 targetItem found:', targetItem); // <-- DODAJ
        try {
          const combinedData = await fetchAndCombineProduct(targetItem);
          console.log('🚀 combinedData:', combinedData); // <-- DODAJ
          renderSingleProduct(combinedData, 0, container);
          console.log('🚀 renderSingleProduct DONE'); // <-- DODAJ

          if (typeof setLanguage === 'function') {
            setLanguage(localStorage.getItem('user-lang') || 'pl');
          }
        } catch (err) {
          console.log('🚀 renderSingleProduct DONE'); // <-- DODAJ
          container.innerHTML = `<p class="error-msg">Błąd odczytu plików produktu: ${productIdParam}</p>`;
        }
      } else {
        container.innerHTML = `<p class="error-msg">Przepraszamy, produkt o ID "${productIdParam}" nie istnieje.</p>`;
      }
    } else {
      // Krok C: Brak ID w URL -> Pobieramy wszystkie produkty z routera równolegle
      const fetchPromises = routerData.map(item =>
          fetchAndCombineProduct(item).catch(err => {
            console.error(`Pominięto ${item.id} z powodu błędu:`, err);
            return null; // Zwracamy null dla zepsutych, żeby Promise.all szedł dalej
          })
      );

      const combinedResults = await Promise.all(fetchPromises);

      let renderedCount = 0;
      combinedResults.forEach((combinedData) => {
        if (combinedData !== null) {
          renderSingleProduct(combinedData, renderedCount, container);
          renderedCount++;
        }
      });

      if (renderedCount > 0 && typeof setLanguage === 'function') {
        setLanguage(localStorage.getItem('user-lang') || 'pl');
      }

      if (renderedCount === 0) {
        container.innerHTML = `<p class="error-msg">Brak dostępnych produktów do wyświetlenia.</p>`;
      }
    }

  } catch (error) {
    console.error("Wystąpił błąd podczas inicjalizacji galerii:", error);
    container.innerHTML = `<p class="error-msg">Nie udało się załadować produktów. Spróbuj odświeżyć stronę.</p>`;
  }
}

// ==========================================
// 4. START PO ZAŁADOWANIU STRONY
// ==========================================
document.addEventListener('DOMContentLoaded', initGallery);