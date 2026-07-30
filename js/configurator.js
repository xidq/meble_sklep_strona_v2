/* global BABYLON */
/** @type {import('babylonjs').Engine} */
let engine;
/** @type {import('babylonjs').Scene} */
let scene;
/** @type {import('babylonjs').ArcRotateCamera} */
let camera;
/** @type {import('babylonjs').ShadowGenerator} */
let shadowGenerator;

let loadedMeshes = [];
let selectedModelDetails = null;

// Słowniki danych z JSON-ów
let woodTexturesData = [];
let metalMaterialsData = [];
let glassMaterialsData = [];

// Przechowalnia referencji do oryginalnych materiałów z pliku GLB
let defaultMaterials = {
    Wood: null,
    Metal: null,
    Glass: null
};

let activeSelections = {
    Wood: null,
    Metal: null,
    Glass: null
};

// Klasyfikacja meshy według typu
const meshesByType = {
    Wood: [],
    Metal: [],
    Glass: []
};

// Materiały – oryginalny klon (nietknięty) i aktywny (zmieniany)
const pristineMaterials = { Wood: null, Metal: null, Glass: null };
const activeMaterials = { Wood: null, Metal: null, Glass: null };

// Cache tekstur – URL -> BABYLON.Texture
const textureCache = new Map();

/**
 * Oblicza kolor F0 (RGB) na podstawie współczynników fizycznych n oraz k dla 3 fal światła
 * Optymalizacja: Zastąpienie Math.pow(x, 2) szybszym mnożeniem (x * x)
 * @param {{r: number, g: number, b: number}} n
 * @param {{r: number, g: number, b: number}} k
 * @returns {Object}
 */
function calculateConductorF0(n, k) {
    const calcChannel = (nVal, kVal) => {
        const nMinus1 = nVal - 1;
        const nPlus1 = nVal + 1;
        const kSq = kVal * kVal;
        return ((nMinus1 * nMinus1) + kSq) / ((nPlus1 * nPlus1) + kSq);
    };

    const r = calcChannel(n.r, k.r);
    const g = calcChannel(n.g, k.g);
    const b = calcChannel(n.b, k.b);

    return new BABYLON.Color3(r, g, b);
}

document.addEventListener("DOMContentLoaded", () => {
    initBabylon();
    scene.executeWhenReady(() => {
        startConfigurator().catch(err => console.error("Configurator start error:", err));
    });
});

function initBabylon() {
    const canvas = document.getElementById("renderCanvas");
    canvas.style.filter = "blur(0.2px)";

    const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);

    const CONFIG = isMobile ? {
        shadowMapSize: 1024,
        bloomKernel: 16,
        motionBlurSamples: 8,
        fxaaEnabled: false,
        samples: 1
    } : {
        shadowMapSize: 2048,
        bloomKernel: 64,
        motionBlurSamples: 16,
        fxaaEnabled: true,
        samples: 8
    };

    engine = new BABYLON.Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true, antialias: true });
    scene = new BABYLON.Scene(engine);
    scene.clearColor = new BABYLON.Color4(0.08, 0.08, 0.08, 1.0);

    camera = new BABYLON.ArcRotateCamera("camera", Math.PI / 4, Math.PI / 3, 4, BABYLON.Vector3.Zero(), scene);
    camera.attachControl(canvas, true);

    camera.lowerRadiusLimit = 1;
    camera.upperRadiusLimit = 10;
    camera.upperBetaLimit = Math.PI / 2 - 0.05;
    camera.minZ = 0.01;
    camera.maxZ = 100.0;

    // --- OŚWIETLENIE I CIENIE ---
    const dirLight = new BABYLON.DirectionalLight("dirLight", new BABYLON.Vector3(-2, -3, -1), scene);
    dirLight.position = new BABYLON.Vector3(3, 9, 3);
    dirLight.intensity = 4.5;

    dirLight.shadowMinZ = 0.1;
    dirLight.shadowMaxZ = 20;

    shadowGenerator = new BABYLON.ShadowGenerator(CONFIG.shadowMapSize, dirLight);
    shadowGenerator.usePercentageCloserFiltering = true;
    shadowGenerator.filteringQuality = BABYLON.ShadowGenerator.QUALITY_HIGH;
    shadowGenerator.bias = 0.001;
    shadowGenerator.normalBias = 0.001;
    shadowGenerator.darkness = 0.001;
    shadowGenerator.transparencyShadow = true;

    window.addEventListener("resize", () => { engine.resize(); });

    // Environment & Post-processing
    const legacyEnv = new BABYLON.CubeTexture(
        "/data/env/a",
        scene,
        ["_px.jpg", "_py.jpg", "_pz.jpg", "_nx.jpg", "_ny.jpg", "_nz.jpg"]
    );

    if (legacyEnv.updateLightingInfo) legacyEnv.updateLightingInfo();
    scene.environmentTexture = legacyEnv;
    scene.environmentIntensity = 1.0;

    const pipeline = new BABYLON.DefaultRenderingPipeline("defaultPipeline", true, scene, [camera]);
    pipeline.imageProcessingEnabled = true;
    pipeline.imageProcessing.toneMappingEnabled = true;
    pipeline.imageProcessing.toneMappingType = 2;

    pipeline.bloomEnabled = true;
    pipeline.bloomThreshold = 0.8;
    pipeline.bloomWeight = 0.5;
    pipeline.bloomKernel = CONFIG.bloomKernel;

    pipeline.fxaaEnabled = CONFIG.fxaaEnabled;
    pipeline.samples = CONFIG.samples;

    const motionBlur = new BABYLON.MotionBlurPostProcess("mb", scene, 1.0, camera);
    motionBlur.motionStrength = 2.0;
    motionBlur.motionBlurSamples = CONFIG.motionBlurSamples;
    motionBlur.disableObjectBasedMotionBlur = true;

    engine.runRenderLoop(() => { scene.render(); });
}

// Asynchroniczne pobieranie danych i konfiguracja wejściowa
async function startConfigurator() {
    const urlParams = new URLSearchParams(window.location.search);
    const modelId = urlParams.get('id') || "komoda_1";

    try {
        const resRouter = await fetch('/data/router.json');
        const routerData = await resRouter.json();
        const activeRoute = routerData.find(item => item.id === modelId);

        if (!activeRoute) {
            document.getElementById('model-title').innerText = "Nie znaleziono modelu";
            return;
        }

        const [resProduct, resModel, resWood, resMetal, resGlass] = await Promise.all([
            fetch(activeRoute.product),
            fetch(activeRoute.model),
            fetch('/data/textures/textures.json'),
            fetch('/data/textures/metal_material.json'),
            fetch('/data/textures/glass_material.json')
        ]);

        const productData = await resProduct.json();
        let modelJson = await resModel.json();
        if (Array.isArray(modelJson)) modelJson = modelJson[0];

        const currentLang = localStorage.getItem('user-lang') || 'pl';
        document.getElementById('model-title').innerText = productData[`name_${currentLang}`] || productData.name_pl || productData.name_id;

        selectedModelDetails = {
            model: modelJson.model,
            ao: modelJson.ao,
            texture_scale: modelJson.texture_scale || 1.0,
            basePrice: parseFloat(productData.price) || 0,
            mkw: parseFloat(modelJson.wood ?? productData.wood) || 1.0,
            ilosc_metal: parseFloat(modelJson.metal ?? productData.metal) || 0.0,
            ilosc_szklo: parseFloat(modelJson.glass ?? productData.glass) || 0.0
        };

        woodTexturesData = await resWood.json();
        metalMaterialsData = (await resMetal.json()).map(item => ({...item, price: item.cena || item.price}));
        glassMaterialsData = (await resGlass.json()).map(item => ({...item, price: item.cena || item.price}));

        buildMaterialDropdowns();
        loadGlbModel(selectedModelDetails.model, selectedModelDetails);

    } catch (err) {
        console.error("Błąd krytyczny konfiguratora:", err);
        const titleEl = document.getElementById('model-title');
        if (titleEl) titleEl.innerText = "Błąd ładowania konfiguratora";
    }
}

// Ładowanie modelu i mapowanie slotów materiałowych
function loadGlbModel(glbUrl, modelDetails) {
    const lastSlash = glbUrl.lastIndexOf('/');
    const rootPath = glbUrl.substring(0, lastSlash + 1);
    const fileName = glbUrl.substring(lastSlash + 1);

    BABYLON.SceneLoader.ImportMesh("", rootPath, fileName, scene, (meshes) => {
        loadedMeshes = meshes;

        const rootMesh = meshes[0];
        const bounds = rootMesh.getHierarchyBoundingVectors(true);
        const size = bounds.max.subtract(bounds.min);
        const center = bounds.min.add(size.scale(0.5));

        camera.setTarget(center);
        const maxDimension = Math.max(size.x, size.y, size.z);
        camera.radius = maxDimension * 2.5;

        // Dynamiczne tworzenie podłogi łapiącej cień
        const groundY = bounds.min.y;
        const ground = BABYLON.MeshBuilder.CreateGround("shadowGround", {
            width: 5,
            height: 5
        }, scene);

        const groundMat = new BABYLON.PBRMaterial("groundMat", scene);
        groundMat.twoSidedLighting = true;
        groundMat.backFaceCulling = false;
        groundMat.albedoColor = new BABYLON.Color3(0.2, 0.2, 0.2);
        groundMat.roughness = 0.8;
        groundMat.metallic = 0.0;

        ground.material = groundMat;
        ground.position.y = groundY - 0.002;
        ground.receiveShadows = true;

        meshesByType.Wood = [];
        meshesByType.Metal = [];
        meshesByType.Glass = [];

        meshes.forEach(mesh => {
            if (!mesh.getTotalVertices || mesh.getTotalVertices() === 0) return;

            // Optymalizacja CPU: Zatrzymujemy odświeżanie statycznych obiektów
            mesh.freezeWorldMatrix();
            mesh.doNotSyncBoundingInfo = true;
            mesh.isPickable = false;

            shadowGenerator.addShadowCaster(mesh);
            mesh.receiveShadows = true;

            console.log('Mesh:', mesh.name, 'Material:', mesh.material?.name);

            if (mesh.material) {
                const matName = mesh.material.name ? mesh.material.name.toLowerCase() : "";
                const objName = mesh.name ? mesh.name.toLowerCase() : "";

                let typeKey = null;
                if (matName.includes("metal")) typeKey = "Metal";
                else if (matName.includes("glass") || matName.includes("szkło")) typeKey = "Glass";
                else if (matName.includes("wood") || matName.includes("drewno")) typeKey = "Wood";

                if (!typeKey) {
                    if (objName.includes("metal")) typeKey = "Metal";
                    else if (objName.includes("glass") || objName.includes("szklo")) typeKey = "Glass";
                    else if (objName.includes("wood") || objName.includes("drewno")) typeKey = "Wood";
                }

                if (typeKey) {
                    meshesByType[typeKey].push(mesh);
                    if (!defaultMaterials[typeKey]) {
                        defaultMaterials[typeKey] = mesh.material.clone(mesh.material.name + "_default");
                    }
                }

                if (modelDetails.ao && mesh.material && mesh.material instanceof BABYLON.PBRMaterial) {
                    const aoTex = new BABYLON.Texture(modelDetails.ao, scene);
                    aoTex.invertY = false;
                    mesh.material.ambientTexture = aoTex;
                }
            }
        });

        ['Wood', 'Metal', 'Glass'].forEach(type => {
            if (meshesByType[type].length === 0) return;

            const firstMat = meshesByType[type][0].material;
            if (!firstMat) return;

            pristineMaterials[type] = firstMat.clone(firstMat.name + "_pristine");
            activeMaterials[type] = firstMat.clone(firstMat.name + "_active");

            meshesByType[type].forEach(m => m.material = activeMaterials[type]);

            if (modelDetails.ao && activeMaterials[type] instanceof BABYLON.PBRMaterial) {
                const aoTex = getOrCreateTexture(modelDetails.ao);
                aoTex.invertY = false;
                activeMaterials[type].ambientTexture = aoTex;
            }
        });

        document.getElementById('loading-overlay').style.opacity = '0';
        setTimeout(() => document.getElementById('loading-overlay').style.display = 'none', 300);

        applyDefaultTextures();
    });
}

// Budowanie dynamicznych dropdownów uzależnionych od obecności w modelu
function buildMaterialDropdowns() {
    const container = document.getElementById('dynamic-slots');
    container.innerHTML = '';

    // Optymalizacja budowania widoku: Użycie DocumentFragment, by wstrzykiwać do DOM tylko 1 raz
    const fragment = document.createDocumentFragment();

    const materialSlots = [
        { id: "Wood", labelName: "Materiał Drewna", dataSource: woodTexturesData, isDds: true, available: true },
        { id: "Metal", labelName: "Elementy Metalowe", dataSource: metalMaterialsData, isDds: false, available: selectedModelDetails.ilosc_metal > 0 },
        { id: "Glass", labelName: "Elementy Szklane", dataSource: glassMaterialsData, isDds: false, available: selectedModelDetails.ilosc_szklo > 0 }
    ];

    materialSlots.forEach(slot => {
        if (!slot.available || slot.dataSource.length === 0) return;

        const groupDiv = document.createElement('div');
        groupDiv.style.marginBottom = "15px";

        const label = document.createElement('label');
        label.innerText = slot.labelName;
        label.style.display = "block";
        label.style.marginBottom = "5px";

        const select = document.createElement('select');
        select.className = 'texture-select';
        select.style.width = '100%';
        select.innerHTML = `<option value="">-- Wybierz opcję (Domyślny) --</option>`;

        if (slot.id === "Metal") {
            const noMetalOption = document.createElement('option');
            noMetalOption.value = "NO_METAL";
            noMetalOption.textContent = "Brak (W kolorze drewna)";
            select.appendChild(noMetalOption);
        }

        slot.dataSource.forEach(item => {
            const option = document.createElement('option');
            option.value = item.id || item.name;

            const priceTag = item.price ? ` (+${item.price} zł)` : "";
            option.textContent = `${item.name}${priceTag}`;
            select.appendChild(option);
        });

        select.addEventListener('change', (e) => {
            const selectedVal = e.target.value;

            if (selectedVal === "") {
                activeSelections[slot.id] = null;
                restoreDefaultMaterial(slot.id);
            } else if (selectedVal === "NO_METAL") {
                activeSelections[slot.id] = "NO_METAL";
                applyWoodTextureToMetalElements();
            } else {
                const chosenItem = slot.dataSource.find(i => (i.id === selectedVal || i.name === selectedVal));
                if (chosenItem) {
                    activeSelections[slot.id] = chosenItem;
                    if (slot.isDds) {
                        applyDdsTextureToType(slot.id, chosenItem);
                        if (activeSelections["Metal"] === "NO_METAL") {
                            applyWoodTextureToMetalElements();
                        }
                    } else {
                        applyPbrPropertiesToType(slot.id, chosenItem);
                    }
                }
            }
        });

        groupDiv.appendChild(label);
        groupDiv.appendChild(select);
        fragment.appendChild(groupDiv);

        if (slot.dataSource.length > 0) {
            if (slot.id === "Metal") {
                select.selectedIndex = 2;
                activeSelections[slot.id] = slot.dataSource[0];
            } else {
                select.selectedIndex = 1;
                activeSelections[slot.id] = slot.dataSource[0];
            }
        }
    });

    const cartBtn = document.createElement('button');
    cartBtn.id = "add-to-cart-configurator";
    cartBtn.innerText = "Dodaj konfigurację do koszyka 🛒";

    cartBtn.style.width = "100%";
    cartBtn.style.padding = "12px";
    cartBtn.style.marginTop = "20px";
    cartBtn.style.backgroundColor = "#2b6cb0";
    cartBtn.style.color = "white";
    cartBtn.style.border = "none";
    cartBtn.style.borderRadius = "6px";
    cartBtn.style.cursor = "pointer";
    cartBtn.style.fontWeight = "bold";
    cartBtn.style.fontSize = "14px";

    cartBtn.addEventListener('click', addConfiguredProductToCart);
    fragment.appendChild(cartBtn);

    container.appendChild(fragment); // Wstrzykujemy pełen układ tylko 1 raz do DOM (optymalizacja)
}

// ------------------- Cache tekstur -------------------
function getOrCreateTexture(url) {
    if (!url) return null;
    if (textureCache.has(url)) return textureCache.get(url);

    const tex = new BABYLON.Texture(url, scene, false, false, BABYLON.Texture.TRILINEAR_SAMPLINGMODE);
    tex.anisotropicFilteringLevel = 8;
    tex.uScale = 1.0;
    tex.vScale = 1.0;
    textureCache.set(url, tex);
    return tex;
}

// ------------------- Pomocnicza funkcja kopiująca podstawowe właściwości PBR (do przywracania) -------------------
function copyPBRProperties(source, target) {
    target.albedoColor = source.albedoColor.clone();
    target.metallic = source.metallic;
    target.roughness = source.roughness;
    target.indexOfRefraction = source.indexOfRefraction;
    target.alpha = source.alpha;
    target.linkRefractionWithTransparency = source.linkRefractionWithTransparency;

    target.albedoTexture = source.albedoTexture;
    target.metallicTexture = source.metallicTexture;
    target.bumpTexture = source.bumpTexture;
    target.roughnessTexture = source.roughnessTexture;
    target.ambientTexture = source.ambientTexture;
}

// ------------------- Przywracanie domyślnego materiału -------------------
function restoreDefaultMaterial(typeId) {
    if (!pristineMaterials[typeId] || !activeMaterials[typeId]) return;

    copyPBRProperties(pristineMaterials[typeId], activeMaterials[typeId]);
    calculateFinalPrice();
}

// ------------------- Nakładanie tekstur drewna na metal (NO_METAL) -------------------
function applyWoodTextureToMetalElements() {
    const currentWood = activeSelections["Wood"];
    if (!currentWood || !activeMaterials.Metal) return;

    const mat = activeMaterials.Metal;

    mat.metallic = 0;
    mat.roughness = 1;
    mat.albedoColor = new BABYLON.Color3(1, 1, 1);
    mat.metallicTexture = null;

    mat.albedoTexture = getOrCreateTexture(currentWood.diffuse);
    mat.bumpTexture = getOrCreateTexture(currentWood.normal);
    mat.roughnessTexture = getOrCreateTexture(currentWood.roughness);
    mat.useNormalMapWithAccessors = true;

    calculateFinalPrice();
}

// ------------------- Aplikacja tekstur DDS (drewno) -------------------
function applyDdsTextureToType(typeId, textureItem) {
    const mat = activeMaterials[typeId];
    if (!mat) return;

    mat.metallic = 0;
    mat.roughness = 1;
    mat.albedoColor = new BABYLON.Color3(1, 1, 1);
    mat.metallicTexture = null;

    mat.albedoTexture = getOrCreateTexture(textureItem.diffuse);
    mat.bumpTexture = getOrCreateTexture(textureItem.normal);
    mat.roughnessTexture = getOrCreateTexture(textureItem.roughness);
    mat.useNormalMapWithAccessors = true;

    if (typeId === "Wood" && activeSelections["Metal"] === "NO_METAL") {
        applyWoodTextureToMetalElements();
    }

    calculateFinalPrice();
}

// ------------------- Aplikacja właściwości PBR (metal, szkło) -------------------
function applyPbrPropertiesToType(typeId, materialItem) {
    const mat = activeMaterials[typeId];
    if (!mat) return;

    mat.albedoTexture = null;
    mat.metallicTexture = null;
    mat.bumpTexture = null;
    mat.roughnessTexture = null;

    if (typeId === "Metal") {
        mat.metallic = 1.0;
        mat.roughness = materialItem.roughness !== undefined ? parseFloat(materialItem.roughness) : 0.2;

        if (materialItem.n && materialItem.k) {
            mat.albedoColor = calculateConductorF0(materialItem.n, materialItem.k);
            mat.indexOfRefraction = materialItem.n.g;
        } else {
            mat.albedoColor = new BABYLON.Color3(0.95, 0.81, 0.45);
            mat.indexOfRefraction = 0.44;
        }

        mat.alpha = 1.0;
        mat.transparencyMode = BABYLON.PBRMaterial.PBRMATERIAL_OPAQUE;
        mat.backFaceCulling = true;
    } else if (typeId === "Glass") {
        let transVal = materialItem.transparency !== undefined ? parseFloat(materialItem.transparency) : 0.8;
        mat.alpha = 1.0 - transVal;

        mat.transparencyMode = BABYLON.PBRMaterial.PBRMATERIAL_ALPHABLEND;
        mat.useAlphaFromAlbedoTexture = false;
        mat.forceDepthWrite = true;
        mat.backFaceCulling = false;
    } else {
        mat.alpha = 1.0;
        mat.transparencyMode = BABYLON.PBRMaterial.PBRMATERIAL_OPAQUE;
        mat.backFaceCulling = true;
    }

    calculateFinalPrice();
}

// ------------------- Inicjalne tekstury -------------------
function applyDefaultTextures() {
    if (activeSelections.Wood) {
        applyDdsTextureToType("Wood", activeSelections.Wood);
    }
    if (activeSelections.Metal && activeSelections.Metal !== "NO_METAL") {
        applyPbrPropertiesToType("Metal", activeSelections.Metal);
    } else if (activeSelections.Metal === "NO_METAL") {
        applyWoodTextureToMetalElements();
    }
    if (activeSelections.Glass) {
        applyPbrPropertiesToType("Glass", activeSelections.Glass);
    }
}

// Dynamiczny kalkulator ceny
function calculateFinalPrice() {
    if (!selectedModelDetails) return;

    const basePrice = selectedModelDetails.basePrice || 0;
    let materialsPriceSum = 0;

    Object.keys(activeSelections).forEach(typeId => {
        const texture = activeSelections[typeId];

        if (texture && texture !== "NO_METAL" && texture.price) {
            if (typeId === "Wood") {
                const mkw = selectedModelDetails.mkw || 1.0;
                materialsPriceSum += (mkw * texture.price);
            } else if (typeId === "Metal") {
                const ilosc = selectedModelDetails.ilosc_metal || 0.0;
                materialsPriceSum += (ilosc * texture.price);
            } else if (typeId === "Glass") {
                const ilosc = selectedModelDetails.ilosc_szklo || 0.0;
                materialsPriceSum += (ilosc * texture.price);
            }
        }
    });

    const finalPrice = basePrice + materialsPriceSum;
    document.getElementById('price-value').innerText = finalPrice.toFixed(2);
}

// ------------------- Dodawanie skonfigurowanego mebla do koszyka -------------------
function addConfiguredProductToCart() {
    if (!selectedModelDetails) return;

    const woodId = activeSelections.Wood ? (activeSelections.Wood.id || activeSelections.Wood.name) : "default";

    let metalId = "default";
    if (selectedModelDetails.ilosc_metal <= 0) {
        metalId = "None";
    } else if (activeSelections.Metal === "NO_METAL") {
        metalId = "None";
    } else if (activeSelections.Metal) {
        metalId = activeSelections.Metal.id || activeSelections.Metal.name;
    }

    let glassId = "default";
    if (selectedModelDetails.ilosc_szklo <= 0) {
        glassId = "None";
    } else if (activeSelections.Glass) {
        glassId = activeSelections.Glass.id || activeSelections.Glass.name;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const nameId = urlParams.get('id') || "komoda_1";
    const configurationHash = `${nameId}_W:${woodId}_M:${metalId}_G:${glassId}`;
    const currentPrice = parseFloat(document.getElementById('price-value').innerText);
    const modelTitle = document.getElementById('model-title').innerText;
    let basket = JSON.parse(localStorage.getItem('cart')) || [];
    const existingItem = basket.find(item => item.id === configurationHash);

    if (existingItem) {
        existingItem.quantity += 1;
    } else {
        const cartItem = {
            id: configurationHash,
            name_id: nameId,
            quantity: 1,
            type: "configured",
            display: {
                title: modelTitle,
                price: currentPrice
            },
            configuration: {
                wood: woodId,
                metal: metalId,
                glass: glassId
            }
        };
        basket.push(cartItem);
    }

    localStorage.setItem('cart', JSON.stringify(basket));

    if (typeof updateBasketDOM === "function") {
        updateBasketDOM();
    } else {
        const badge = document.getElementById('basketCount');
        if (badge) {
            badge.textContent = basket.reduce((sum, item) => sum + item.quantity, 0);
            badge.style.display = 'block';
        }
    }

    alert("Dodano spersonalizowany mebel do koszyka! 🛒");
}