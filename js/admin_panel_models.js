// admin_panel_models.js

document.addEventListener('DOMContentLoaded', () => {
    // Rejestracja obsługi przełączania zakładek – pobierz produkty przy wejściu w zakładkę modeli
    const tabButtons = document.querySelectorAll('.tab-btn');
    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            if (btn.getAttribute('data-tab') === 'tab-models') {
                initModelsTab();
            }
        });
    });

    // Inicjalizacja domyślna, jeśli zakładka jest aktywna na starcie
    const modelsTab = document.getElementById('tab-models');
    if (modelsTab && modelsTab.classList.contains('active')) {
        initModelsTab();
    }
});

/**
 * Główna funkcja inicjalizująca interfejs zakładki modeli 3D
 */
async function initModelsTab() {
    renderModelsUI();
    await populateProductsDropdown();
    attachModelFormEvents();
    attachRefreshButtonEvent();
}
function attachRefreshButtonEvent() {
    const refreshBtn = document.getElementById('REFRESH_ALL_MODELS_DATA');
    if (!refreshBtn) return;

    refreshBtn.addEventListener('click', async () => {
        // Opcjonalnie: zabezpieczenie przed wielokrotnym kliknięciem
        refreshBtn.disabled = true;
        originalText = refreshBtn.textContent;
        refreshBtn.textContent = '⏳ Odświeżanie...';

        try {
            const response = await fetch('/api/model_ops/refresh', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    // 'Authorization': `Bearer ${currentUser.token}` // odkomentuj, jeśli wymagane
                },
                body: JSON.stringify({}), // Przesyłamy pusty obiekt JSON, co wymusi nagłówek
                credentials: 'include'
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(errText || `Błąd serwera (Status: ${response.status})`);
            }

            const data = await response.json().catch(() => ({}));
            console.log("Dane modeli zostały pomyślnie odświeżone przez proxy:", data);
            alert('✅ Dane modeli zostały pomyślnie odświeżone!');

        } catch (error) {
            console.error("[Models Tab] Błąd podczas odświeżania modeli:", error);
            alert(`❌ Nie udało się odświeżyć modeli: ${error.message}`);
        } finally {
            refreshBtn.disabled = false;
            refreshBtn.textContent = 'Aktualizuj dane modeli';
        }
    });
}

/**
 * Buduje dynamiczny interfejs użytkownika wewnątrz sekcji #tab-models
 */
function renderModelsUI() {
    const tabModels = document.getElementById('tab-models');
    if (!tabModels) return;

    tabModels.innerHTML = `
        <div class="admin-container">
            <div class="products-list-panel">
                <div>
                    <h3>🧊 Wybierz Produkt dla Modeli 3D</h3>
                    <button id="REFRESH_ALL_MODELS_DATA">Aktualizuj dane modeli</button>
                </div>
                <div class="form-group" style="margin-bottom: 20px;">
                    <label for="m_product_select"><b>Produkt docelowy:</b></label>
                    <select id="m_product_select" style="width: 100%; padding: 8px; font-size: 14px; margin-top: 5px;">
                        <option value="">-- Ładowanie produktów... --</option>
                    </select>
                </div>
                
                <div id="m_product_info" style="padding: 10px; background: #f8f9fa; border: 1px solid #ddd; border-radius: 4px; display: none;">
                    <p style="margin: 0;"><b>Wybrany ID:</b> <span id="m_info_id">-</span></p>
                    <p style="margin: 5px 0 0 0;"><b>Name_ID:</b> <span id="m_info_name_id">-</span></p>
                </div>
            </div>

            <div class="form-panel" style="border-top: 2px solid #28a745;">
                <h2>📦 Wgrywanie Modeli 3D i Tekstur DDS</h2>
                
                <form id="uploadModelForm">
                    <div class="form-group">
                        <label for="m_files">Pliki Modelu (.glb, .gltf) oraz Tekstury (.dds, .png, .jpg):</label>
                        <input type="file" id="m_files" name="files" multiple accept=".glb,.gltf,.dds,.png,.jpg,.jpeg,.json" style="margin-top: 5px;" required>
                        <small style="display: block; color: #666; margin-top: 4px;">
                            Możesz zaznaczyć jednocześnie plik <b>.glb</b>/<b>.gltf</b> oraz dedykowane pliki tekstur <b>.dds</b>.
                        </small>
                    </div>

                    <button type="submit" id="uploadModelBtn" style="background: #28a745; color: white; width: 100%; padding: 10px; font-size: 16px; border: none; border-radius: 4px; cursor: pointer;">
                        🚀 Wyślij Model i Tekstury na Serwer
                    </button>
                </form>

                <div id="m_uploadStatus" style="margin-top: 15px; font-weight: bold; white-space: pre-wrap;"></div>
            </div>
        </div>
    `;
}

/**
 * Ściąga listę produktów z backendu i uzupełnia pole wyboru <select>
 */
async function populateProductsDropdown() {
    const selectEl = document.getElementById('m_product_select');
    if (!selectEl) return;

    try {
        const response = await fetch("/api/getproducts", { credentials: 'include' });
        if (!response.ok) throw new Error(`Błąd pobierania produktów (Status: ${response.status})`);

        const products = await response.json();

        selectEl.innerHTML = '<option value="">-- Wybierz produkt z listy --</option>';

        products.forEach(product => {
            const opt = document.createElement('option');
            opt.value = product.name_id; // Używamy name_id jako klucza ścieżki
            opt.dataset.id = product.id;
            opt.dataset.nameId = product.name_id;
            opt.textContent = `[ID: ${product.id}] ${product.name_pl || product.name_id} (${product.name_id})`;
            selectEl.appendChild(opt);
        });

        // Reakcja na zmianę wybranego produktu
        selectEl.addEventListener('change', (e) => {
            const selectedOpt = e.target.options[e.target.selectedIndex];
            const infoBox = document.getElementById('m_product_info');

            if (e.target.value) {
                document.getElementById('m_info_id').textContent = selectedOpt.dataset.id;
                document.getElementById('m_info_name_id').textContent = selectedOpt.dataset.nameId;
                infoBox.style.display = 'block';
            } else {
                infoBox.style.display = 'none';
            }
        });

    } catch (error) {
        console.error("[Models Tab] Błąd:", error);
        selectEl.innerHTML = '<option value="">Błąd podczas ładowania produktów!</option>';
    }
}

// /**
//  * Pоdłączenie zdarzeń dla formularza uploadu plików 3D
//  */
// function attachModelFormEvents() {
//     const form = document.getElementById('uploadModelForm');
//     const statusDiv = document.getElementById('m_uploadStatus');
//
//     if (!form) return;
//
//     form.addEventListener('submit', async (e) => {
//         e.preventDefault();
//
//         const productSelect = document.getElementById('m_product_select');
//         const fileInput = document.getElementById('m_files');
//         const selectedNameId = productSelect.value;
//
//         if (!selectedNameId) {
//             statusDiv.style.color = '#dc3545';
//             statusDiv.textContent = '⚠️ Wybierz produkt, do którego ma zostać przypisany model!';
//             return;
//         }
//
//         if (!fileInput.files || fileInput.files.length === 0) {
//             statusDiv.style.color = '#dc3545';
//             statusDiv.textContent = '⚠️ Wybierz przynajmniej jeden plik do wysłania!';
//             return;
//         }
//
//         // Przygotowanie paczki FormData (multipart/form-data)
//         const formData = new FormData();
//         const productId = productSelect.options[productSelect.selectedIndex].dataset.id;
//
//         // Dodatkowe metadane w form-data (id oraz name_id)
//         // formData.append('product_id', productId);
//         // formData.append('name_id', selectedNameId);
//
//         // Dołączenie wszystkich zaznaczonych plików (zarówno .glb, jak i .dds)
//         for (let i = 0; i < fileInput.files.length; i++) {
//             formData.append('files', fileInput.files[i]);
//         }
//
//         statusDiv.style.color = '#007bff';
//         statusDiv.textContent = '⏳ Wysyłanie plików na serwer... Proszę czekać.';
//
//         try {
//             // Strzał do endpointu multipart dedykowanego produktowi po name_id
//             const uploadUrl = `/api/admin/models/${productId}`;
//
//             const response = await fetch(uploadUrl, {
//                 method: 'POST',
//                 headers: {
//                     // UWAGA: Podczas wysyłania FormData NIE ustawiamy nagłówka Content-Type ręcznie!
//                     // Przeglądarka sama wstawi 'multipart/form-data' z odpowiednim 'boundary'.
//                     'Authorization': `Bearer ${currentUser.token}`
//                 },
//                 body: formData,
//                 // credentials: 'include'
//             });
//
//             if (response.ok) {
//                 const resData = await response.json().catch(() => ({ status: 'success' }));
//                 statusDiv.style.color = '#28a745';
//                 statusDiv.textContent = `✅ Pliki dla produktu "${selectedNameId}" zostały pomyślnie wgrane!`;
//                 form.reset();
//             } else {
//                 const errText = await response.text();
//                 statusDiv.style.color = '#dc3545';
//                 statusDiv.textContent = `❌ Błąd wgrywania (${response.status}): ${errText}`;
//             }
//         } catch (err) {
//             console.error('[Models Tab] Błąd połączenia:', err);
//             statusDiv.style.color = '#dc3545';
//             statusDiv.textContent = '❌ Błąd sieci/połączenia z serwerem.';
//         }
//     });
// }

/**
 * Podłączenie zdarzeń dla formularza uploadu plików 3D
 */
// Poprawiona funkcja attachModelFormEvents w admin_panel_models.js
function attachModelFormEvents() {
    const form = document.getElementById('uploadModelForm');
    const statusDiv = document.getElementById('m_uploadStatus');

    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const productSelect = document.getElementById('m_product_select');
        const fileInput = document.getElementById('m_files');
        const selectedNameId = productSelect.value;

        if (!selectedNameId) {
            statusDiv.style.color = '#dc3545';
            statusDiv.textContent = '⚠️ Wybierz produkt, do którego ma zostać przypisany model!';
            return;
        }

        if (!fileInput.files || fileInput.files.length === 0) {
            statusDiv.style.color = '#dc3545';
            statusDiv.textContent = '⚠️ Wybierz przynajmniej jeden plik do wysłania!';
            return;
        }

        const selectedOption = productSelect.options[productSelect.selectedIndex];
        const productId = selectedOption.dataset.id;

        if (!productId) {
            statusDiv.style.color = '#dc3545';
            statusDiv.textContent = '⚠️ Nie znaleziono ID dla wybranego produktu!';
            return;
        }

        const formData = new FormData();
        for (const file of fileInput.files) {
            formData.append("file", file); // Zmienione z "files" na "file", dokładnie tak jak przy zdjęciach!
        }

        statusDiv.style.color = '#007bff';
        statusDiv.textContent = '⏳ Wysyłanie plików na serwer... Proszę czekać.';

        try {
            const uploadUrl = `/api/admin/models/${productId}`; // Zachowane ID w ścieżce

            const response = await fetch(uploadUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${currentUser.token}`
                },
                body: formData
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(errorText || `Status serwera: ${response.status}`);
            }

            const data = await response.json().catch(() => ({}));
            console.log("Serwer przyjął pliki modeli:", data);

            statusDiv.style.color = '#28a745';
            statusDiv.textContent = `✅ Pliki modeli dla produktu zostały pomyślnie przesłane na serwer!`;
            form.reset();

        } catch (error) {
            console.error("[Models Tab] Błąd przesyłania:", error);
            statusDiv.style.color = '#dc3545';
            statusDiv.textContent = `❌ Wystąpił błąd podczas przesyłania: ${error.message}`;
        }
    });
}