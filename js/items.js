// Funkcje pomocnicze do generowania obrazków (zostają jak były - obsługują <picture> dla 2K)
function createMainImageHTML(imgObject) {
  return `
        <picture>
            <source media="(min-width: 2048px)" srcset="${imgObject.d_2048}">
            <img src="${imgObject.d_1024}" alt="Zdjęcie produktu" />
        </picture>
    `;
}

function createThumbImageHTML(imgObject) {
  return `
        <picture>
            <source media="(min-width: 2048px)" srcset="${imgObject.d_128}">
            <img src="${imgObject.d_64}" alt="Miniaturka" style="width: 64px; height: auto;" />
        </picture>
    `;
}

// Funkcja, która buduje pojedynczą kartę produktu w DOM
function renderSingleProduct(product, index, container) {
  const card = document.createElement('div');
  card.className = 'product-card';

  // const imagesList = [product.img_dimensions_1, product.img_dimensions_2, product.img_dimensions_3];
  const imagesList = Object.keys(product)
    .filter(key => key.startsWith('img_dimensions_'))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .map(key => product[key]);

  card.innerHTML = `
        <div class="left-column">
            <div class="main-image-container" id="main-img-container-${index}">
                ${createMainImageHTML(imagesList[0])}
            </div>
            <div class="thumbnails-container" id="thumbs-container-${index}"></div>
        </div>
        <div class="right-column">
            <h2 class="product-title">${product.name}</h2>
            <p class="product-description">${product.description}</p>
            <div class="product-specs">
                <div class="spec-item"><span class="spec-label">Wysokość:</span> ${product.height} cm</div>
                <div class="spec-item"><span class="spec-label">Szerokość:</span> ${product.width} cm</div>
                <div class="spec-item"><span class="spec-label">Głębokość:</span> ${product.depth} cm</div>
            </div>
        </div>
    `;

  container.appendChild(card);

  // Obsługa galerii miniatur dla tej karty
  const mainImgContainer = document.getElementById(`main-img-container-${index}`);
  const thumbsContainer = document.getElementById(`thumbs-container-${index}`);

  imagesList.forEach((imgObj, imgIndex) => {
    const thumbWrapper = document.createElement('div');
    thumbWrapper.className = 'thumb-wrapper';
    if (imgIndex === 0) thumbWrapper.classList.add('active');

    thumbWrapper.innerHTML = createThumbImageHTML(imgObj);

    thumbWrapper.addEventListener('click', () => {
      mainImgContainer.innerHTML = createMainImageHTML(imgObj);
      const allThumbs = thumbsContainer.getElementsByClassName('thumb-wrapper');
      for (let thumb of allThumbs) {
        thumb.classList.remove('active');
      }
      thumbWrapper.classList.add('active');
    });

    thumbsContainer.appendChild(thumbWrapper);
  });
}

// GŁÓWNA LOGIKA: Pobieranie danych i sprawdzanie adresu URL
async function initGallery() {
  const container = document.getElementById('products-gallery');

  // 1. Wyciągamy parametry z adresu URL (np. z ?id=komoda_1)
  const urlParams = new URLSearchParams(window.location.search);
  const productIdParam = urlParams.get('id'); // Zwróci "komoda_1" lub null

  try {
    // 2. Ściągamy dane asynchronicznie z pliku JSON na serwerze
    const response = await fetch('../data/items.json');
    if (!response.ok) {
      throw new Error(`Błąd ładowania pliku JSON: ${response.status}`);
    }
    const productsData = await response.json();

    // 3. Sprawdzamy, czy w URL jest konkretne ID
    if (productIdParam) {
      // Szukamy produktu o pasującym ID w bazie JSON
      const targetProduct = productsData.find(p => p.id === productIdParam);

      if (targetProduct) {
        // Znaleźliśmy produkt -> renderujemy tylko ten jeden
        renderSingleProduct(targetProduct, 0, container);
      } else {
        // ID jest w URL, ale nie ma takiego produktu w bazie
        container.innerHTML = `<p class="error-msg">Przepraszamy, produkt o ID "${productIdParam}" nie istnieje.</p>`;
      }
    } else {
      // Brak ID w adresie URL -> wyświetlamy całą galerię (wszystkie produkty)
      productsData.forEach((product, index) => {
        renderSingleProduct(product, index, container);
      });
    }

  } catch (error) {
    console.error("Wystąpił błąd podczas inicjalizacji galerii:", error);
    container.innerHTML = `<p class="error-msg">Nie udało się załadować produktów. Spróbuj odświeżyć stronę.</p>`;
  }
}

// URUCHOMIENIE LOGIKI po załadowaniu drzewa DOM
document.addEventListener('DOMContentLoaded', initGallery);
