/* global BABYLON, updateBasketDOM */

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
// let defaultMaterials = {
//     Wood: null,
//     Metal: null,
//     Glass: null
// };
let activeWoodTextureResolution = "4k";

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


function ensureProgressBar() {
    const overlay = document.getElementById('loading-overlay');
    if (!overlay || document.getElementById('loading-progress-text')) return;


    overlay.style.display = 'flex';
    overlay.style.flexDirection = 'column';
    overlay.style.justifyContent = 'center';
    overlay.style.alignItems = 'center';
    overlay.style.gap = '16px';


    const textDiv = document.createElement('div');
    textDiv.id = 'loading-progress-text';
    Object.assign(textDiv.style, {
        fontFamily: 'monospace',
        fontSize: '1.4rem',
        color: '#333',
        textAlign: 'center',
        letterSpacing: '2px',
        backgroundColor: 'rgba(255,255,255,0.4)',
        padding: '6px 18px',
        borderRadius: '8px',
        display: 'inline-block'
    });
    textDiv.textContent = '[░░░░░░░░░░░░░░░░░░░░] 0%';

    overlay.appendChild(textDiv);
}

function updateLoadingProgress(percent) {
    ensureProgressBar();
    const textDiv = document.getElementById('loading-progress-text');
    if (!textDiv) return;

    const totalBlocks = 20;
    const filled = Math.round((percent / 100) * totalBlocks);
    const empty = totalBlocks - filled;
    const bar = '█'.repeat(filled) + '░'.repeat(empty);
    textDiv.textContent = `[${bar}] ${Math.round(percent)}%`;
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
        samples: 1,
        tekstury: "2k",
    } : {
        shadowMapSize: 2048,
        bloomKernel: 64,
        motionBlurSamples: 16,
        fxaaEnabled: true,
        samples: 8,
        tekstury: "2k",
    };

    activeWoodTextureResolution = CONFIG.tekstury;

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
    // const dirLight = new BABYLON.PointLight("dirLight", new BABYLON.Vector3(-2, -3, -1), scene);
    const dirLight = new BABYLON.DirectionalLight("dirLight", new BABYLON.Vector3(-5, -9, -5), scene);

    // dirLight.position = new BABYLON.Vector3(3, 9, 3);
    dirLight.intensity = 3;

    dirLight.shadowMinZ = 0.1;
    dirLight.shadowMaxZ = 20;
    // dirLight.autoCalcShadowZBounds = true;

    shadowGenerator = new BABYLON.ShadowGenerator(CONFIG.shadowMapSize, dirLight, true);
    shadowGenerator.useContactHardeningShadow = true;
    // shadowGenerator.contactHardeningLightSizeUVRatio = 0.012;    // shadowGenerator.usePercentageCloserFiltering = true;

    shadowGenerator.filteringQuality = BABYLON.ShadowGenerator.QUALITY_HIGH;
    shadowGenerator.bias = 0.001;
    shadowGenerator.normalBias = 0.01;
    shadowGenerator.darkness = 0.001;
    shadowGenerator.transparencyShadow = true;

    window.addEventListener("resize", () => { engine.resize(); });

    // Environment & Post-processing
    // const legacyEnv = new BABYLON.CubeTexture(
    //     "/data/env/a",
    //     scene,
    //     ["_px.jpg", "_py.jpg", "_pz.jpg", "_nx.jpg", "_ny.jpg", "_nz.jpg"]
    // );
    //
    // if (legacyEnv.updateLightingInfo) legacyEnv.updateLightingInfo();
    // scene.environmentTexture = legacyEnv;
    // scene.environmentIntensity = 1.0;
    scene.environmentTexture = new BABYLON.CubeTexture(
        "/data/env/a",
        scene,
        ["_px.jpg", "_py.jpg", "_pz.jpg", "_nx.jpg", "_ny.jpg", "_nz.jpg"]
    );
    /** @type {import('babylonjs').DefaultRenderingPipeline & { imageProcessing: BABYLON.ImageProcessingConfiguration }} */
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

    // Pokaż overlay i zainicjuj pasek
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
        overlay.style.display = 'flex';   // lub 'block' – jak w Twoim CSS
        overlay.style.opacity = '1';
    }
    updateLoadingProgress(0);

    try {
        const resRouter = await fetch('/data/router.json');
        updateLoadingProgress(10);

        const routerData = await resRouter.json();
        const activeRoute = routerData.find(item => item.id === modelId);
        if (!activeRoute) {
            document.getElementById('model-title').innerText = "Nie znaleziono modelu";
            if (overlay) overlay.style.display = 'none';
            return;
        }

        // Równoległe pobieranie 5 plików
        let completed = 0;
        const totalRequests = 5;
        function onRequestComplete() {
            completed++;
            const progress = 10 + (completed / totalRequests) * 30; // 10–40%
            updateLoadingProgress(progress);
        }

        const [productData, modelJsonRaw, woodTextures, metalRaw, glassRaw] = await Promise.all([
            fetch(activeRoute.product).then(r => { onRequestComplete(); return r.json(); }),
            fetch(activeRoute.model).then(r => { onRequestComplete(); return r.json(); }),
            fetch('/data/textures/textures.json').then(r => { onRequestComplete(); return r.json(); }),
            fetch('/data/textures/metal_material.json').then(r => { onRequestComplete(); return r.json(); }),
            fetch('/data/textures/glass_material.json').then(r => { onRequestComplete(); return r.json(); })
        ]);

        updateLoadingProgress(40); // dane gotowe

        let modelJson = Array.isArray(modelJsonRaw) ? modelJsonRaw[0] : modelJsonRaw;
        const currentLang = localStorage.getItem('user-lang') || 'pl';
        document.getElementById('model-title').innerText = productData[`name_${currentLang}`] || productData.name_pl || productData.name_id;

        selectedModelDetails = {
            model: modelJson.model,
            ao: modelJson.ao,
            texture_scale: modelJson.wood || 1.0,
            basePrice: parseFloat(productData.price) || 0,
            mkw: parseFloat(modelJson.wood ?? productData.wood) || 1.0,
            ilosc_metal: parseFloat(modelJson.metal ?? productData.metal) || 0.0,
            ilosc_szklo: parseFloat(modelJson.glass ?? productData.glass) || 0.0
        };

        woodTexturesData = woodTextures;
        metalMaterialsData = metalRaw.map(item => ({...item, price: item.cena || item.price}));
        glassMaterialsData = glassRaw.map(item => ({...item, price: item.cena || item.price}));

        buildMaterialDropdowns();
        loadGlbModel(selectedModelDetails.model, selectedModelDetails);

    } catch (err) {
        console.error("Błąd krytyczny konfiguratora:", err);
        const titleEl = document.getElementById('model-title');
        if (titleEl) titleEl.innerText = "Błąd ładowania konfiguratora";
        if (overlay) {
            overlay.style.opacity = '0';
            setTimeout(() => overlay.style.display = 'none', 300);
        }
    }
}

// Ładowanie modelu i mapowanie slotów materiałowych (Zoptymalizowane pod kątem braku zwiechy)
function loadGlbModel(glbUrl, modelDetails) {
    const lastSlash = glbUrl.lastIndexOf('/');
    const rootPath = glbUrl.substring(0, lastSlash + 1);
    const fileName = glbUrl.substring(lastSlash + 1);

    // Progres modelu (40% → 100%)
    function modelProgress(loaded, total) {
        if (total > 0) {
            const fraction = loaded / total;
            const overall = 40 + fraction * 60;
            updateLoadingProgress(overall);
        }
    }

    BABYLON.SceneLoader.ImportMesh("", rootPath, fileName, scene,
        // --- onSuccess (bez zmian, tylko drobna modyfikacja na końcu) ---
        (meshes) => {
            loadedMeshes = meshes;
            const rootMesh = meshes[0];
            const bounds = rootMesh.getHierarchyBoundingVectors(true);
            const size = bounds.max.subtract(bounds.min);
            const center = bounds.min.add(size.scale(0.5));

            camera.setTarget(center);
            const maxDimension = Math.max(size.x, size.y, size.z);
            camera.radius = maxDimension * 2.5;

            const groundY = bounds.min.y;
            const ground = BABYLON.MeshBuilder.CreateGround("shadowGround", { width: 5, height: 5 }, scene);
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

            meshes.forEach((meshOrig => {
                /** @type {import('babylonjs').AbstractMesh} */
                const mesh = meshOrig;

                if (!mesh.getTotalVertices || mesh.getTotalVertices() === 0) return;

                mesh.freezeWorldMatrix();
                mesh.doNotSyncBoundingInfo = true;
                mesh.isPickable = false;
                shadowGenerator.addShadowCaster(mesh);
                mesh.receiveShadows = true;

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
                    if (typeKey) meshesByType[typeKey].push(mesh);
                }
            }));

            ['Wood', 'Metal', 'Glass'].forEach(type => {
                if (meshesByType[type].length === 0) return;
                const firstMat = meshesByType[type][0].material;
                if (!firstMat) return;
                activeMaterials[type] = firstMat;

                if (modelDetails.ao && activeMaterials[type] instanceof BABYLON.PBRMaterial) {
                    const aoTex = getOrCreateTexture(modelDetails.ao);
                    aoTex.invertY = false;
                    activeMaterials[type].ambientTexture = aoTex;
                }
                setTimeout(() => {
                    if (firstMat && !pristineMaterials[type]) {
                        pristineMaterials[type] = firstMat.clone(firstMat.name + "_pristine");
                    }
                }, 2000);
            });

            // MODEL GOTOWY – ustawiamy 100% i chowamy overlay
            updateLoadingProgress(100);

            const overlay = document.getElementById('loading-overlay');
            if (overlay) {
                overlay.style.opacity = '0';
                setTimeout(() => overlay.style.display = 'none', 300);
            }

            applyDefaultTextures();
            requestAnimationFrame(() => {
                setTimeout(() => {
                    preloadAllTexturesInTheBackground();
                }, 500);
            });
        },

        // --- onProgress (NOWOŚĆ) ---
        (evt) => {
            if (evt.lengthComputable) {
                modelProgress(evt.loaded, evt.total);
            }
        },

        // --- onError ---
        (scene, message, exception) => {
            console.error("Błąd ładowania modelu:", message, exception);
            const overlay = document.getElementById('loading-overlay');
            if (overlay) {
                overlay.style.opacity = '0';
                setTimeout(() => overlay.style.display = 'none', 300);
            }
        }
    );
}

// Budowanie dynamicznych dropdownów uzależnionych od obecności w modelu
function buildMaterialDropdowns() {
    const container = document.getElementById('dynamic-slots');
    container.innerHTML = '';

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
        // select.innerHTML = `<option value="">-- Wybierz opcję (Domyślny) --</option>`;

        if (slot.id === "Metal") {
            const noMetalOption = document.createElement('option');
            noMetalOption.value = "NO_METAL";
            noMetalOption.textContent = "Brak (W kolorze drewna)";
            select.appendChild(noMetalOption);
        }

        slot.dataSource.forEach(item => {
            const option = document.createElement('option');
            option.value = item.id || item.name;

            let quantity = 0;
            if (slot.id === "Wood") {
                quantity = selectedModelDetails.mkw || 1.0;
            } else if (slot.id === "Metal") {
                quantity = selectedModelDetails.ilosc_metal || 0.0;
            } else if (slot.id === "Glass") {
                quantity = selectedModelDetails.ilosc_szklo || 0.0;
            }
            const unitPrice = item.price || 0;
            const calculatedPrice = (quantity * unitPrice) * 1.3;

            const priceTag = calculatedPrice ? ` (+${calculatedPrice.toFixed(2)} zł)` : "";
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
                        applyMockupTextureOnly(slot.id, chosenItem);
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
                select.selectedIndex = 1;
                activeSelections[slot.id] = slot.dataSource[0];
            } else {
                select.selectedIndex = 0;
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

    container.appendChild(fragment);
}

function applyMockupTextureOnly(typeId, textureItem) {
    const mat = activeMaterials[typeId];
    if (!mat) return;

    mat.metallic = 0;
    mat.roughness = 1;
    mat.albedoColor = new BABYLON.Color3(1, 1, 1);
    mat.metallicTexture = null;

    if (textureItem.diffuse_mockup) {
        mat.albedoTexture = getOrCreateTexture(textureItem.diffuse_mockup);
    } else {
        const is2k = (activeWoodTextureResolution === "2k");
        mat.albedoTexture = getOrCreateTexture(is2k ? (textureItem.diffuse_2k || textureItem.diffuse) : textureItem.diffuse);
    }

    mat.bumpTexture = null;
    mat.roughnessTexture = null;
    mat.useNormalMapWithAccessors = false;

    if (typeId === "Wood" && activeSelections["Metal"] === "NO_METAL") {
        applyWoodTextureToMetalElements();
    }

    calculateFinalPrice();
}

function preloadAllTexturesInTheBackground() {
    const urlsToLoad = new Set();

    [woodTexturesData, metalMaterialsData, glassMaterialsData].forEach(dataSource => {
        if (!Array.isArray(dataSource)) return;
        dataSource.forEach(item => {
            if (item.diffuse) urlsToLoad.add(item.diffuse);
            if (item.normal) urlsToLoad.add(item.normal);
            if (item.roughness) urlsToLoad.add(item.roughness);
            if (item.ambient) urlsToLoad.add(item.ambient);
        });
    });

    if (selectedModelDetails && selectedModelDetails.ao) {
        urlsToLoad.add(selectedModelDetails.ao);
    }

    urlsToLoad.forEach(url => {
        if (!textureCache.has(url)) {
            window.setTimeout(() => {
                getOrCreateTexture(url);
            }, 100);
        }
    });
}

//  Cache tekstur 
function getOrCreateTexture(url) {
    if (!url || typeof url !== 'string') return null;
    const is2k = (activeWoodTextureResolution === "2k");
    let targetUrl = url;

    for (const item of woodTexturesData) {
        if (item.diffuse === url || item.diffuse_2k === url) {
            targetUrl = is2k ? (item.diffuse_2k || item.diffuse) : item.diffuse;
            break;
        }
        if (item.normal === url || item.normal_2k === url) {
            targetUrl = is2k ? (item.normal_2k || item.normal) : item.normal;
            break;
        }
        if (item.roughness === url || item.roughness_2k === url) {
            targetUrl = is2k ? (item.roughness_2k || item.roughness) : item.roughness;
            break;
        }
        if (item.diffuse_mockup === url) {
            targetUrl = item.diffuse_mockup;
            break;
        }
    }

    if (textureCache.has(url)) return textureCache.get(url);

    const tex = new BABYLON.Texture(targetUrl, scene, false, false, BABYLON.Texture.TRILINEAR_SAMPLINGMODE);
    tex.anisotropicFilteringLevel = 8;
    const textureScale = (selectedModelDetails && selectedModelDetails.texture_scale) ? selectedModelDetails.texture_scale : 1.0;
    tex.uScale = textureScale;
    tex.vScale = textureScale;
    textureCache.set(url, tex);
    return tex;
}

// Pomocnicza funkcja kopiująca podstawowe właściwości PBR (do przywracania)
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

// Przywracanie domyślnego materiału
function restoreDefaultMaterial(typeId) {
    if (!pristineMaterials[typeId] || !activeMaterials[typeId]) return;

    copyPBRProperties(pristineMaterials[typeId], activeMaterials[typeId]);
    calculateFinalPrice();
}

// Nakładanie tekstur drewna na metal (NO_METAL)
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

// Aplikacja właściwości PBR (metal, szkło)
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
        let transVal = materialItem.transparency !== undefined ? parseFloat(materialItem.transparency) : 0.75;

        mat.metallic = 0.0;
        const isFrosted = materialItem.nam_en === "frosted_glass";
        mat.roughness = isFrosted ? 0.6 : (materialItem.roughness !== undefined ? parseFloat(materialItem.roughness) : 0.05);

        if (materialItem.color) {
            mat.albedoColor = BABYLON.Color3.FromHexString(materialItem.color);
        } else {
            mat.albedoColor = new BABYLON.Color3(1, 1, 1);
        }

        if (materialItem.ior !== undefined) {
            mat.indexOfRefraction = parseFloat(materialItem.ior);
        }
        if (isFrosted) {
            mat.subSurface.isTranslucencyEnabled = true;
            mat.subSurface.translucencyIntensity = 0.85;
            mat.subSurface.minimumThickness = 0.01;
            mat.subSurface.maximumThickness = 0.5;
        } else {
            mat.subSurface.isTranslucencyEnabled = false;
            mat.subSurface.minimumThickness = 0.01;
            mat.subSurface.maximumThickness = 0.5;
        }

        mat.subSurface.isRefractionEnabled = true;
        mat.subSurface.indexOfRefraction = mat.indexOfRefraction;
        mat.subSurface.tintColor = isFrosted ? mat.albedoColor.clone() : mat.albedoColor.clone(); //.scale(2.0)
        mat.alpha = isFrosted ? 0.8 : (1.0 - transVal);
        mat.transparencyMode = BABYLON.PBRMaterial.PBRMATERIAL_ALPHABLEND;
        mat.useAlphaFromAlbedoTexture = false;

        mat.backFaceCulling = false;

        mat.needDepthPrePass = true;
        mat.forceDepthWrite = false;

        if (scene.environmentTexture) {
            mat.reflectionTexture = scene.environmentTexture;
        }
    } else {
        mat.alpha = 1.0;
        mat.transparencyMode = BABYLON.PBRMaterial.PBRMATERIAL_OPAQUE;
        mat.backFaceCulling = true;
    }

    calculateFinalPrice();
}

//  Inicjalne tekstury 
function applyDefaultTextures() {
    if (activeSelections.Wood) {
        applyMockupTextureOnly("Wood", activeSelections.Wood);
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

// Dodawanie skonfigurowanego mebla do koszyka
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
            badge.textContent = basket.reduce((sum , item) => sum + item.quantity, 0).toString();
            badge.style.display = 'block';
        }
    }

    alert("Dodano spersonalizowany mebel do koszyka! 🛒");
}