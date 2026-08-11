// FUNKCJE POMOCNICZE (FORMAT OBRAZKÓW)
function createMainImageHTML(imgObject) {
  if (!imgObject || typeof imgObject !== 'object') return '';

  // Dynamiczne pobranie wszystkich kluczy-rozdzielczości z obiektu JSON i posortowanie ich numerycznie malejąco
  const resolutions = Object.keys(imgObject)
      .filter(key => !isNaN(key))
      .sort((a, b) => Number(b) - Number(a));

  if (resolutions.length === 0) return '';

  let sourcesHTML = '';
  // resolutions.forEach(res => {
  //   const url = imgObject[res];
  //   if (url && typeof url === 'string' && url.length > 5) {
  //     sourcesHTML += `<source media="(min-width: ${res}px)" srcset="${encodeURI(url)}">\n`;
  //   }
  // });
  const portraitTargetKey = resolutions.find(res => Number(res) >= 1024) || resolutions[0];
  const portraitTargetUrl = imgObject[portraitTargetKey];

  if (portraitTargetUrl && typeof portraitTargetUrl === 'string' && portraitTargetUrl.length > 5) {
    sourcesHTML += `<source media="(orientation: portrait) and (min-width: 700px)" srcset="${encodeURI(portraitTargetUrl)}">\n`;
  }

  resolutions.forEach(res => {
    const url = imgObject[res];
    if (url && typeof url === 'string' && url.length > 5) {
      sourcesHTML += `<source media="(min-width: ${res}px)" srcset="${encodeURI(url)}">\n`;
    }
  });

  const fallbackKey = resolutions.includes("512") ? "512" : resolutions[resolutions.length - 1];
  const fallbackUrl = encodeURI(imgObject[fallbackKey] || '');

  return `
        <picture class="main_image">
            ${sourcesHTML}
            <img src="${fallbackUrl}" alt="Zdjęcie produktu" loading="lazy" />
        </picture>
    `;
}

function createThumbImageHTML(imgObject) {
  if (!imgObject || typeof imgObject !== 'object') return '';

  const resolutions = Object.keys(imgObject)
      .filter(key => !isNaN(key))
      .sort((a, b) => Number(b) - Number(a));

  if (resolutions.length === 0) return '';

  let sourcesHTML = '';
  resolutions.forEach(res => {
    const url = imgObject[res];
    if (url && typeof url === 'string' && url.length > 5) {
      sourcesHTML += `<source media="(min-width: ${res}px)" srcset="${encodeURI(url)}">\n`;
    }
  });

  const fallbackKey = resolutions.includes("64") ? "64" : resolutions[resolutions.length - 1];
  const fallbackUrl = encodeURI(imgObject[fallbackKey] || '');

  return `
        <picture>
            ${sourcesHTML}
            <img src="${fallbackUrl}" alt="Miniaturka" style="width: 64px; height: auto;" loading="lazy" />
        </picture>
    `;
}

// RENDEROWANIE POJEDYNCZEJ KARTY DOM
function renderSingleProduct(fullData, index, container) {
  const product = fullData.product || fullData;
  const card = document.createElement('div');
  card.className = 'product-card';
  console.log(product);
  const currentLang = localStorage.getItem('user-lang') || 'pl';
  const productName = product[`name_${currentLang}`] || product.name_pl || product.name_id;
  const description = product[`desc_${currentLang}`] || product.desc_pl || 'Brak opisu.';
  const productId = product.name_id;

  const hasModel = fullData.model !== null && fullData.model !== undefined && fullData.model !== '';
  const configuratorBtnHTML = hasModel ? `
      <a href="model.html?id=${productId}" class="configure-btn" style="padding: 10px 20px; background-color: #2b6cb0; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; text-decoration: none; display: inline-flex; align-items: center;">
          Konfigurator 3D 🛠️
      </a>
  ` : '';

  const imagesList = Object.keys(fullData)
      .filter(key => key.startsWith('var_'))
      .sort((a, b) => a.localeCompare(b, undefined, {numeric: true}))
      .map(key => fullData[key]);

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
               data-desc-pl="${product.desc_pl || ''}" 
               data-desc-en="${product.desc_en || ''}">
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
                ${configuratorBtnHTML}
            </div>
        </div>
    `;

  // Optymalizacja: Fragment dokumentu dla miniaturek (brak obciążania DOM w pętli)
  const thumbsContainer = card.querySelector('.thumbnails-container');
  if (thumbsContainer && imagesList.length > 0) {
    const fragment = document.createDocumentFragment();

    imagesList.forEach((imgObj, idx) => {
      const thumbWrapper = document.createElement('div');
      thumbWrapper.className = 'thumb-wrapper';
      if (idx === 0) thumbWrapper.classList.add('active');

      thumbWrapper.innerHTML = createThumbImageHTML(imgObj);

      // Optymalizacja: Izolacja w obrębie kontenera
      thumbWrapper.addEventListener('click', () => {
        const allThumbs = thumbsContainer.querySelectorAll('.thumb-wrapper');
        allThumbs.forEach(t => t.classList.remove('active'));
        thumbWrapper.classList.add('active');

        const mainContainer = card.querySelector('.main-image-container');
        if (mainContainer) {
          mainContainer.innerHTML = createMainImageHTML(imgObj);
        }
      });

      fragment.appendChild(thumbWrapper);
    });

    thumbsContainer.appendChild(fragment);
  }

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
        badge.textContent = basket.reduce((sum, item) => sum + item.quantity, 0).toString();
        badge.style.display = 'block';
      }

      alert(currentLangNow === 'en' ? `Added ${dynamicName} to cart! 🛒` : `Dodano produkt ${dynamicName} do koszyka! 🛒`);
    });
  }

  // Wpinamy do głównego widoku dopiero gdy cała karta jest gotowa
  container.appendChild(card);
}

// GŁÓWNA INICJALIZACJA GALERII
async function initGallery() {
  const container = document.getElementById('products-gallery');
  if (!container) return;

  const urlParams = new URLSearchParams(window.location.search);
  const productIdParam = urlParams.get('id');

  try {
    const responseRouter = await fetch('data/router.json');
    if (!responseRouter.ok) {
      container.innerHTML = `<p class="error-msg">Nie udało się załadować router.json</p>`;
      return;
    }
    const routerData = await responseRouter.json();

    async function fetchAndCombineProduct(item) {
      const [resProduct, resImg] = await Promise.all([
        fetch(`/api/products/by-name/${item.id}`),
        fetch(item.img)
      ]);

      if (!resProduct.ok || !resImg.ok) throw new Error(`Błąd składowych: ${item.id}`);

      return {
        product: await resProduct.json(),
        model: item.model,
        ...(await resImg.json())
      };
    }

    if (productIdParam) {
      const targetItem = routerData.find(item => item.id === productIdParam);
      if (targetItem) {
        try {
          const combinedData = await fetchAndCombineProduct(targetItem);
          renderSingleProduct(combinedData, 0, container);
          if (typeof setLanguage === 'function') setLanguage(localStorage.getItem('user-lang') || 'pl');
        } catch (err) {
          container.innerHTML = `<p class="error-msg">Błąd odczytu: ${productIdParam}</p>`;
        }
      } else {
        container.innerHTML = `<p class="error-msg">Brak produktu o ID "${productIdParam}".</p>`;
      }
    } else {
      const fetchPromises = routerData.map(item => fetchAndCombineProduct(item).catch(() => null));
      const combinedResults = await Promise.all(fetchPromises);

      // Optymalizacja: Renderowanie wsadowe przy użyciu fragmentu, gdy wczytujemy listę
      const listFragment = document.createDocumentFragment();
      let renderedCount = 0;

      combinedResults.forEach((combinedData) => {
        if (combinedData !== null) {
          renderSingleProduct(combinedData, renderedCount, listFragment);
          renderedCount++;
        }
      });

      container.appendChild(listFragment);

      if (renderedCount > 0 && typeof setLanguage === 'function') {
        setLanguage(localStorage.getItem('user-lang') || 'pl');
      }

      if (renderedCount === 0) {
        container.innerHTML = `<p class="error-msg">Brak dostępnych produktów.</p>`;
      }
    }

  } catch (error) {
    container.innerHTML = `<p class="error-msg">Wystąpił błąd ładowania produktów.</p>`;
  }
}

document.addEventListener('DOMContentLoaded', initGallery);