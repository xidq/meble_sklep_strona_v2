/* global BABYLON */
/** @type {import('babylonjs').Engine} */
let engine;
/** @type {import('babylonjs').Scene} */
let scene;
/** @type {import('babylonjs').ArcRotateCamera} */
let camera;
/** @type {import('babylonjs').ShadowGenerator} */
let shadowGenerator;
// let engine, scene, camera, shadowGenerator;
let loadedMeshes = [];
let selectedModelDetails = null;

// Słowniki danych z JSON-ów
let woodTexturesData = [];
let metalMaterialsData = [];
let glassMaterialsData = [];

// Przechowalnia referencji do oryginalnych materiałów z pliku GLB (dla opcji "Wybierz opcję")
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
 * @param {{r: number, g: number, b: number}} n
 * @param {{r: number, g: number, b: number}} k
 * @returns {Object}
 */
// Oblicza kolor F0 (RGB) na podstawie współczynników fizycznych n oraz k dla 3 fal światła
function calculateConductorF0(n, k) {
    const calcChannel = (nVal, kVal) => {
        const num = Math.pow(nVal - 1, 2) + Math.pow(kVal, 2);
        const den = Math.pow(nVal + 1, 2) + Math.pow(kVal, 2);
        return num / den;
    };

    const r = calcChannel(n.r, k.r);
    const g = calcChannel(n.g, k.g);
    const b = calcChannel(n.b, k.b);

    return new BABYLON.Color3(r, g, b);
}
document.addEventListener(
    "DOMContentLoaded", () => {
        initBabylon();
        scene.executeWhenReady(
            () => {
            startConfigurator().catch(err => console.error("Configurator start error:", err));
            }
        );
    }
);


// function initBabylon() {
//
//     const canvas = document.getElementById("renderCanvas");
//     canvas.style.filter = "blur(0.2px)";
//
//     // =========================================================================
//     //  KONFIGURACJA WARIANTÓW (PC vs MOBILE)
//     // =========================================================================
//     // Proste wykrywanie smartfonów/tabletów
//     const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
//
//     const CONFIG = isMobile ? {
//         // Wariant MOBILNY (Lżejszy dla procesora i baterii)
//         shadowMapSize: 1048,       // Mniejsza mapa cieni
//         shadowBlurKernel: 32,      // Mniejsze rozmycie cieni
//         shadowBlurScale: 1,        // Mniejsza skala próbkowania cieni
//         bloomKernel: 16,           // Słabszy Bloom (bardzo oszczędza GPU)
//         motionBlurSamples: 8,       // Mało próbek rozmycia (płynniejsze działanie)
//         fxaaEnabled: false,        // Mobile: wyłączone dla oszczędności baterii
//         samples: 1                 // Brak MSAA
//     } : {
//         // Wariant PC (Maksymalna jakość)
//         shadowMapSize: 2048,       // Twoje oryginalne ustawienia cieni
//         shadowBlurKernel: 65,
//         shadowBlurScale: 2,
//         bloomKernel: 64,           // Twoje oryginalne ustawienie Blooma
//         motionBlurSamples: 16,      // Twoje oryginalne ustawienie Motion Blura
//         fxaaEnabled: true,         // PC: włączone wygładzanie postprocesu
//         samples: 8                 // PC: MSAA x4 (wygładzanie geometrii na poziomi
//     };
//     // =========================================================================
//
//
//     engine = new BABYLON.Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true, antialias: true}); // <-- DOPISZ TO KONIECZNIE });
//     scene = new BABYLON.Scene(engine);
//     scene.clearColor = new BABYLON.Color4(0.08, 0.08, 0.08, 1.0);
//
//     camera = new BABYLON.ArcRotateCamera("camera", Math.PI / 4, Math.PI / 3, 4, BABYLON.Vector3.Zero(), scene);
//     camera.attachControl(canvas, true);
//     camera.lowerRadiusLimit = 1;
//     camera.upperRadiusLimit = 10;
//     camera.upperBetaLimit = Math.PI / 2 - 0.05;
//     camera.minZ = 0.01;
//     camera.maxZ = 100.0;
//
//
//
//     // const hemiLight = new BABYLON.HemisphericLight("hemiLight", new BABYLON.Vector3(0, 1, 0), scene);
//     // hemiLight.intensity = 0.2; // Z 0.7 na 0.2 (teraz tylko rozjaśnia najgłębsze zakamarki)
//
//
//     const dirLight = new BABYLON.DirectionalLight("dirLight", new BABYLON.Vector3(-2, -3, -1), scene); // Bardziej z góry (-3 w Y)
//     dirLight.position = new BABYLON.Vector3(3, 9, 3);
//     dirLight.intensity = 5.2;
//     dirLight.shadowMinZ = 0.1;
//     dirLight.shadowMaxZ = 20;
//     shadowGenerator = new BABYLON.ShadowGenerator(CONFIG.shadowMapSize, dirLight); //2048
//     shadowGenerator.useBlurExponentialShadowMap = true;
//     shadowGenerator.blurKernel = CONFIG.shadowBlurKernel;
//     // 1. Podnieś bias, aby usunąć główną część acne (Step 4)
//     // shadowGenerator.bias = 0.003;
//     shadowGenerator.bias = 0;
//
// // 2. Dodaj normalBias, który wpycha geometrię wzdłuż wektora normalnego (Step 5)
// // To usuwa resztki acne na powierzchniach równoległych do światła, bez wywoływania Peter Panningu
// //     shadowGenerator.normalBias = 0.02;
//     shadowGenerator.blurScale = CONFIG.shadowBlurScale;
//
//     shadowGenerator.darkness = 0.1;
//     shadowGenerator.depthScale = 1.0; // WAŻNE, napsuło mi krwi!!!!!!!!!!!!!!!!!!!!11
//     shadowGenerator.frustumEdgeFalloff = 1.0;
//     // shadowGenerator.getShadowMap().refreshRate = BABYLON.RenderTargetTexture.REFRESHRATE_RENDER_ONCE;
//     dirLight.autoUpdateExtends = false;
//
//     window.addEventListener("resize", () => { engine.resize(); });
//
//     const legacyEnv = new BABYLON.CubeTexture(
//         "../data/env/a",
//         scene,
//         ["_px.jpg", "_py.jpg", "_pz.jpg", "_nx.jpg", "_ny.jpg", "_nz.jpg"]
//     );
//     legacyEnv.processLightingInfoFromCustomAsymmetry = true;
//     if (legacyEnv.updateLightingInfo) {
//         legacyEnv.updateLightingInfo();
//
//     }
//     scene.environmentTexture = legacyEnv;
//
//     scene.environmentIntensity = 1.0;
//     // =========================================================================
//     //  ZINTEGROWANY POTOK EFEKTÓW (BLOOM + MOTION BLUR + TONE MAPPING)
//     // =========================================================================
//
//     const pipeline = new BABYLON.DefaultRenderingPipeline("defaultPipeline", true, scene, [camera]);
//     // pipeline.chromaticAberrationEnabled = true; pipeline.chromaticAberration.intensity = 0; // Trik aktywujący wewnętrzny pass
//     // 1. TONE MAPPING (Przeniesiony bezpośrednio do potoku)
//     pipeline.imageProcessingEnabled = true;
//     pipeline.imageProcessing.toneMappingEnabled = true;
//     pipeline.imageProcessing.toneMappingType = 2; // Typ 2
//
//     // BLOOM
//     pipeline.bloomEnabled = true;
//     pipeline.bloomThreshold = 0.8; // Obiekty o jasności powyżej 60% zaczną generować poświatę
//     pipeline.bloomWeight = 0.5;    // Siła poświaty
//     pipeline.bloomKernel = CONFIG.bloomKernel;     // Rozmycie poświaty (wielkość blasku)
//
//
//     // =====================================================================
//
//     // ANTYALIASING (Wygładzanie ostrych krawędzi)
//     pipeline.fxaaEnabled = CONFIG.fxaaEnabled; // Wygładza krawędzie rozmyte przez Bloom/Motion Blur
//     pipeline.samples = CONFIG.samples;
//
//
//     // motion blur
//     const motionBlur = new BABYLON.MotionBlurPostProcess(
//         "mb",
//         scene,
//         1.0,
//         camera
//     );
//     motionBlur.motionStrength = 2.0;
//     motionBlur.motionBlurSamples = CONFIG.motionBlurSamples;
//     motionBlur.disableObjectBasedMotionBlur = true;
//
//     engine.runRenderLoop(() => { scene.render(); });
//
//     // scene.debugLayer.show();
// }

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

    // Dopasowanie zasięgu światła zapobiega obcinaniu cieni
    dirLight.shadowMinZ = 0.1;
    dirLight.shadowMaxZ = 20;

    // Generowanie cieni
    shadowGenerator = new BABYLON.ShadowGenerator(CONFIG.shadowMapSize, dirLight);

    // Używamy PCF – daje najlepsze rezultaty dla self-shadowingu w PBR bez wycieków cieni
    shadowGenerator.usePercentageCloserFiltering = true;
    shadowGenerator.filteringQuality = BABYLON.ShadowGenerator.QUALITY_HIGH;

    // Klucz do poprawnego Self-Shadowing:
    shadowGenerator.bias = 0.001;        // Zapobiega przesunięciu cienia (Peter-Panning)
    shadowGenerator.normalBias = 0.001;   // Wpycha geometrię wzdłuż wektorów normalnych, likwidując "shadow acne"

    shadowGenerator.darkness = 0.001;     // Głębokość cienia
    shadowGenerator.transparencyShadow = true; // Uwzględnia przezroczyste materiały (np. szkło)

    window.addEventListener("resize", () => { engine.resize(); });

    // Environment & Post-processing
    /** @type {import('babylonjs').CubeTexture} */
    const legacyEnv = new BABYLON.CubeTexture(
        "/data/env/a",
        scene,
        ["_px.jpg", "_py.jpg", "_pz.jpg", "_nx.jpg", "_ny.jpg", "_nz.jpg"]
    );
    if (legacyEnv.updateLightingInfo) legacyEnv.updateLightingInfo();
    scene.environmentTexture = legacyEnv;
    scene.environmentIntensity = 1.0;
    /** @type {import('babylonjs').DefaultRenderingPipeline} */
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

// 2. Asynchroniczne pobieranie danych i konfiguracja wejściowa (POPRAWIONA)
async function startConfigurator() {
    const urlParams = new URLSearchParams(window.location.search);
    const modelId = urlParams.get('id') || "komoda_1";

    try {
        // Krok A: Pobieramy router.json i szukamy wpisu dla danego ID
        const resRouter = await fetch('/data/router.json');
        const routerData = await resRouter.json();
        const activeRoute = routerData.find(item => item.id === modelId);

        if (!activeRoute) {
            document.getElementById('model-title').innerText = "Nie znaleziono modelu";
            return;
        }

        // Krok B: Pobieramy równolegle: dane produktu, strukturę modelu oraz bazy materiałów
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

        // Ustawiamy tytuł strony na podstawie nazwy produktu (np. z name_pl)
        const currentLang = localStorage.getItem('user-lang') || 'pl';
        document.getElementById('model-title').innerText = productData[`name_${currentLang}`] || productData.name_pl || productData.name_id;

        // Krok C: Scalamy dane z pliku produktu i modelu w jeden spójny obiekt konfiguracji,
        // mapując Twoje klucze z pliku product na zmienne używane przez kalkulator i dropdowny
        selectedModelDetails = {
            model: modelJson.model,                       // ścieżka do pliku .glb
            ao: modelJson.ao,                             // ścieżka do pliku .dds (ambient occlusion)
            texture_scale: modelJson.texture_scale || 1.0,
            basePrice: parseFloat(productData.price) || 0, // mapowanie z price
            mkw: parseFloat(modelJson.wood ?? productData.wood) || 1.0,// mapowanie z wood_quant
            ilosc_metal: parseFloat(modelJson.metal ?? productData.metal) || 0.0, // mapowanie z metal_quant
            ilosc_szklo: parseFloat(modelJson.glass ?? productData.glass) || 0.0  // mapowanie z glass_quant
        };

        // Krok D: Ładowanie słowników materiałów
        woodTexturesData = await resWood.json();
        metalMaterialsData = (await resMetal.json()).map(item => ({...item, price: item.cena || item.price}));
        glassMaterialsData = (await resGlass.json()).map(item => ({...item, price: item.cena || item.price}));

        // Krok E: Odpalamy budowanie UI i ładowanie trójwymiarowej siatki
        buildMaterialDropdowns();
        loadGlbModel(selectedModelDetails.model, selectedModelDetails);

    } catch (err) {
        console.error("Błąd krytyczny konfiguratora:", err);
        const titleEl = document.getElementById('model-title');
        if (titleEl) titleEl.innerText = "Błąd ładowania konfiguratora";
    }
}

// 3. Ładowanie modelu i mapowanie slotów materiałowych
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

        // if (rootMesh) {
        //     shadowGenerator.addShadowCaster(rootMesh, true);
        // }




        // --- NOWOŚĆ: Dynamiczne tworzenie podłogi łapiącej cień ---
        const groundY = bounds.min.y; // Najniższy punkt komody (jej spód)

        // Tworzymy podłogę dopasowaną rozmiarem do gabarytów mebla (z zapasem x5)
        const ground = BABYLON.MeshBuilder.CreateGround("shadowGround", {
            width: 5,
            height: 5
        }, scene);


        const groundMat = new BABYLON.PBRMaterial("groundMat", scene);

        // const opacityTexture = new BABYLON.ValueGradientProceduralTexture("opacityTex", 512, scene);
        // opacityTexture.color1 = new BABYLON.Color4(1, 1, 1, 1);
        // opacityTexture.color2 = new BABYLON.Color4(0, 0, 0, 1);
        // opacityTexture.gradientType = BABYLON.ValueGradientProceduralTexture.GRADIENT_TYPE_RADIAL;
        //
        // // Przypisanie do PBR
        // groundMat.opacityTexture = opacityTexture;
        groundMat.twoSidedLighting = true; // <--- DODAJ TO
        groundMat.backFaceCulling = false; // <--- DODAJ TO
        // const groundMat = new BABYLON.ShadowOnlyMaterial("groundMat", scene);
        groundMat.albedoColor = new BABYLON.Color3(0.2, 0.2, 0.2);
        groundMat.roughness = 0.8; // Maksymalna chropowatość, brak odblasków światła
        groundMat.metallic = 0.0;  // Zero metaliczności

//         const opacityTex = new BABYLON.Texture("../data/env/ground_alpha.png", scene);
//
// // Wyłączamy odwracanie osi Y, jeśli plik PNG ma standardowe koordynaty (tak jak robiłeś przy AO)
//         opacityTex.invertY = false;
//
// // Przypisujemy obiekt do materiału
//         groundMat.alphaTexture = opacityTex;
        // groundMat.opacityTexture = "../data/env/ground_alpha.png";
        // groundMat.alpha = 0.0;
        // groundMat.reflectionTexture = null;
        // groundMat.environmentIntensity = 0.0;
        ground.material = groundMat;
        ground.position.y = groundY - 0.002; // Minimalnie pod meblem, żeby uniknąć nakładania się tekstur (z-fighting)
        ground.receiveShadows = true; // Ta płaszczyzna ma przyjmować cienie
        // shadowGenerator.addShadowCaster(ground);

        meshesByType.Wood = [];
        meshesByType.Metal = [];
        meshesByType.Glass = [];

        meshes.forEach(mesh => {

            if (!mesh.getTotalVertices || mesh.getTotalVertices() === 0) return;

            shadowGenerator.addShadowCaster(mesh);
            mesh.receiveShadows = true;
            console.log('Mesh:', mesh.name, 'Material:', mesh.material?.name);
            if (mesh.material) {
                const matName = mesh.material.name ? mesh.material.name.toLowerCase() : "";
                const objName = mesh.name ? mesh.name.toLowerCase() : "";

                let typeKey = null;
                // Najpierw materiał (dokładniejsze kryterium)
                if (matName.includes("metal")) typeKey = "Metal";
                else if (matName.includes("glass") || matName.includes("szkło")) typeKey = "Glass";
                else if (matName.includes("wood") || matName.includes("drewno")) typeKey = "Wood";

                // Jeśli materiał nie wskazał typu, spróbuj nazwy obiektu
                if (!typeKey) {
                    if (objName.includes("metal")) typeKey = "Metal";
                    else if (objName.includes("glass") || objName.includes("szklo")) typeKey = "Glass";
                    else if (objName.includes("wood") || objName.includes("drewno")) typeKey = "Wood";
                }

                if (typeKey) {
                    meshesByType[typeKey].push(mesh);   // <-- WAŻNE: dodaj mesh do odpowiedniej grupy

                    // zapis oryginalnego materiału (jeśli jeszcze nie mamy)
                    if (!defaultMaterials[typeKey]) {
                        defaultMaterials[typeKey] = mesh.material.clone(mesh.material.name + "_default");
                    }
                }

                // if (modelDetails.ao && mesh.material instanceof BABYLON.PBRMaterial) {
                //     const aoTex = new BABYLON.Texture(modelDetails.ao, scene);
                //     aoTex.invertY = false;
                //     mesh.material.ambientTexture = aoTex;
                // }
                if (modelDetails.ao && mesh.material) {
                    if (mesh.material instanceof BABYLON.PBRMaterial) {
                        const aoTex = new BABYLON.Texture(modelDetails.ao, scene);
                        aoTex.invertY = false;
                        mesh.material.ambientTexture = aoTex;
                    }
                }
            }
        });
        console.log('Metal meshes count:', meshesByType.Metal.length);
        console.log('Pierwszy metal mesh:', meshesByType.Metal[0]);
        ['Wood', 'Metal', 'Glass'].forEach(type => {
            if (meshesByType[type].length === 0) return;

            const firstMat = meshesByType[type][0].material;
            if (!firstMat) return;

            pristineMaterials[type] = firstMat.clone(firstMat.name + "_pristine");
            activeMaterials[type] = firstMat.clone(firstMat.name + "_active");

            // przypisz wszystkim meshom ten sam aktywny materiał
            meshesByType[type].forEach(m => m.material = activeMaterials[type]);

            // AO – po przypisaniu materiału
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

// 4. Budowanie dynamicznych dropdownów uzależnionych od obecności w modelu
function buildMaterialDropdowns() {
    const container = document.getElementById('dynamic-slots');
    container.innerHTML = '';

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

        // Sytuacja specjalna: Dodanie opcji "Brak metalu" do listy elementów metalowych
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

            // resetIdleTimer();
            const selectedVal = e.target.value;

            if (selectedVal === "") {
                activeSelections[slot.id] = null;
                restoreDefaultMaterial(slot.id);
            } else if (selectedVal === "NO_METAL") {
                // Użytkownik rezygnuje z metalu – przypisujemy flagę tekstową i aplikujemy drewno na metalowe elementy
                activeSelections[slot.id] = "NO_METAL";
                applyWoodTextureToMetalElements();
            } else {
                const chosenItem = slot.dataSource.find(i => (i.id === selectedVal || i.name === selectedVal));
                if (chosenItem) {
                    activeSelections[slot.id] = chosenItem;
                    if (slot.isDds) {
                        applyDdsTextureToType(slot.id, chosenItem);
                        // Re-aplikacja tekstur na metal, jeśli wybrano opcję NO_METAL
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
        container.appendChild(groupDiv);

        if (slot.dataSource.length > 0) {
            if (slot.id === "Metal") {
                select.selectedIndex = 2;               // trzecia opcja (po placeholder i "NO_METAL")
                activeSelections[slot.id] = slot.dataSource[0]; // pierwszy metal z listy
            } else {
                select.selectedIndex = 1;
                activeSelections[slot.id] = slot.dataSource[0];
            }
        }
    });

    // =========================================================================
    // NOWOŚĆ: DYNAMICZNE DODANIE PRZYCISKU "DODAJ DO KOSZYKA" DO INTERFEJSU
    // =========================================================================
    const cartBtn = document.createElement('button');
    cartBtn.id = "add-to-cart-configurator";
    cartBtn.innerText = "Dodaj konfigurację do koszyka 🛒";

    // Prosty styling bezpośrednio z JS (możesz przenieść do CSS klasy)
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

    // Podpięcie zdarzenia kliknięcia pod naszą logikę
    cartBtn.addEventListener('click', addConfiguredProductToCart);

    // Wrzucamy przycisk na sam dół kontenera ze slotami w panelu bocznym
    container.appendChild(cartBtn);
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

    // Po prostu kopiujemy właściwości z pristine do active (tanio)
    copyPBRProperties(pristineMaterials[typeId], activeMaterials[typeId]);
    // Jeśli w pristine była mapa AO, ona już została skopiowana
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

    // Czyszczenie tekstur
    mat.albedoTexture = null;
    mat.metallicTexture = null;
    mat.bumpTexture = null;
    mat.roughnessTexture = null;

    if (typeId === "Metal") {
        mat.metallic = 1.0;
        mat.roughness = materialItem.roughness !== undefined ? parseFloat(materialItem.roughness) : 0.2;

        // Jeśli w JSON mamy fizyczne parametry n oraz k:
        if (materialItem.n && materialItem.k) {
            // 1. Obliczamy fizycznie poprawny kolor bazowy odbicia F0
            mat.albedoColor = calculateConductorF0(materialItem.n, materialItem.k);

            // 2. Wartość n dla średniej fali (zieleni) przypisujemy jako IOR shadera
            mat.indexOfRefraction = materialItem.n.g;
        } else {
            // Fallback, gdyby brakowało danych w JSON
            mat.albedoColor = new BABYLON.Color3(0.95, 0.81, 0.45);
            mat.indexOfRefraction = 0.44;
        }

        mat.alpha = 1.0;
        mat.transparencyMode = BABYLON.PBRMaterial.PBRMATERIAL_OPAQUE;
        mat.backFaceCulling = true;
    } else if (typeId === "Glass") {
        // Skala transparency z JSON (1.0 = w pełni przezroczyste, 0.0 = kryjące)
        let transVal = materialItem.transparency !== undefined ? parseFloat(materialItem.transparency) : 0.8;

        // Obliczamy alpha (0.0 = w pełni przezroczyste, 1.0 = kryjące)
        mat.alpha = 1.0 - transVal;

        // Kluczowe wymuszenie przezroczystości w Babylon.js PBR:
        mat.transparencyMode = BABYLON.PBRMaterial.PBRMATERIAL_ALPHABLEND;
        mat.useAlphaFromAlbedoTexture = false;
        mat.forceDepthWrite = true; // Zapewnia prawidłowe renderowanie głębi/cieni przez przezroczysty obiekt
        mat.backFaceCulling = false; // Widoczne ścianki z obu stron

    } else {
        mat.alpha = 1.0;
        mat.transparencyMode = BABYLON.PBRMaterial.PBRMATERIAL_OPAQUE;
        mat.backFaceCulling = true;
    }

    calculateFinalPrice();
}

// ------------------- Inicjalne tekstury -------------------
function applyDefaultTextures() {
    // Wood zawsze ustawiamy pierwszy z bazy (jest już w activeSelections)
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

// 9. Dynamiczny kalkulator ceny z uwzględnieniem opcji darmowej (Brak metalu)
function calculateFinalPrice() {
    if (!selectedModelDetails) return;

    const basePrice = selectedModelDetails.basePrice || 0;
    let materialsPriceSum = 0;

    Object.keys(activeSelections).forEach(typeId => {
        const texture = activeSelections[typeId];

        // Pomijamy doliczanie ceny za metal, jeśli wybrano opcję tekstową "NO_METAL"
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
// ------------------- Dodawanie skonfigurowanego mebla do koszyka -------------------
function addConfiguredProductToCart() {
    if (!selectedModelDetails) return;

    // 1. Logika przypisywania wariantów z uwzględnieniem braku elementu w modelu ("None")
    const woodId = activeSelections.Wood ? (activeSelections.Wood.id || activeSelections.Wood.name) : "default";

    let metalId = "default";
    if (selectedModelDetails.ilosc_metal <= 0) {
        metalId = "None"; // Model nie ma metalu w ogóle
    } else if (activeSelections.Metal === "NO_METAL") {
        metalId = "None"; // Użytkownik zrezygnował z metalu (wybrał w kolorze drewna)
    } else if (activeSelections.Metal) {
        metalId = activeSelections.Metal.id || activeSelections.Metal.name;
    }

    let glassId = "default";
    if (selectedModelDetails.ilosc_szklo <= 0) {
        glassId = "None"; // Model nie ma szkła w ogóle
    } else if (activeSelections.Glass) {
        glassId = activeSelections.Glass.id || activeSelections.Glass.name;
    }

    // 2. Pobieramy aktualny name_id (np. komoda_1) bezpośrednio z adresu URL
    const urlParams = new URLSearchParams(window.location.search);
    const nameId = urlParams.get('id') || "komoda_1";

    // 3. Generujemy unikalne ID dla TEJ konkretnej konfiguracji (używamy nowych, przefiltrowanych wartości)
    const configurationHash = `${nameId}_W:${woodId}_M:${metalId}_G:${glassId}`;

    // 4. Pobieramy aktualną cenę wyświetlaną na ekranie
    const currentPrice = parseFloat(document.getElementById('price-value').innerText);
    const modelTitle = document.getElementById('model-title').innerText;

    // 5. Pobieramy obecny koszyk z localStorage
    let basket = JSON.parse(localStorage.getItem('cart')) || [];

    // Sprawdzamy, czy DOKŁADNIE TAKA konfiguracja jest już w koszyku
    const existingItem = basket.find(item => item.id === configurationHash);

    if (existingItem) {
        existingItem.quantity += 1;
    } else {
        // Tworzymy lekki obiekt struktury przedmiotu z czystym "None" tam, gdzie trzeba
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

    // Zapis w przeglądarce
    localStorage.setItem('cart', JSON.stringify(basket));

    // Wywołanie aktualizacji bąbelka w menu (funkcja z auth_ui.js)
    if (typeof updateBasketDOM === "function") {
        updateBasketDOM();
    // } else {
    //     const badge = document.getElementById('basketCount');
    //     if (badge) {
    //         const totalItems = basket.reduce((sum, item) => sum + item.quantity, 0);
    //         badge.textContent = totalItems;
    //         badge.style.display = 'block';
    //     }
    // }
    } else {
        const badge = document.getElementById('basketCount');
        if (badge) {
            badge.textContent = basket.reduce((sum, item) => sum + item.quantity, 0);
            badge.style.display = 'block';
        }
    }

    alert("Dodano spersonalizowany mebel do koszyka! 🛒");
}