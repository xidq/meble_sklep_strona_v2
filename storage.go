package main

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strings"
)

type RouterItem struct {
	ID      string  `json:"id"`
	Product *string `json:"product"`
	Img     *string `json:"img"`
	Model   *string `json:"model"`
}

// rebuildRouterJson skanuje katalogi i tworzy centralny plik mapowania map.json / router.json
func rebuildRouterJson() {
	dataDir := filepath.Join(config.DataDir, "products")
	routerFilePath := filepath.Join(config.DataDir, "router.json")

	files, err := os.ReadDir(dataDir)
	if err != nil {
		log.Printf("[Router] Brak katalogu danych lub błąd odczytu: %v", err)
		return
	}

	var routerList []RouterItem

	for _, f := range files {
		if !f.IsDir() {
			continue
		}
		nameID := f.Name()
		item := RouterItem{ID: nameID}

		productPath := filepath.Join(dataDir, nameID, "product.json")
		imgPath := filepath.Join(dataDir, nameID, "img", "dane.json")
		modelPath := filepath.Join(dataDir, nameID, "model", "model.json")

		if _, err := os.Stat(productPath); err == nil {
			p := fmt.Sprintf("data/products/%s/product.json", nameID)
			item.Product = &p
		}
		if _, err := os.Stat(imgPath); err == nil {
			i := fmt.Sprintf("data/products/%s/img/dane.json", nameID)
			item.Img = &i
		}
		if _, err := os.Stat(modelPath); err == nil {
			m := fmt.Sprintf("data/products/%s/model/model.json", nameID)
			item.Model = &m
		}

		routerList = append(routerList, item)
	}

	if err := os.MkdirAll(filepath.Dir(routerFilePath), 0755); err != nil {
		log.Printf("[Router] Brak katalogu danych: %v", err)
		return
	}
	output, err := json.MarshalIndent(routerList, "", "  ")
	if err != nil {
		log.Printf("[Router] Błąd zapisu struktur JSON: %v", err)
		return
	}

	if err := os.WriteFile(routerFilePath, output, 0644); err != nil {
		log.Printf("[Router] Nie udało się zapisać router.json: %v", err)
	} else {
		log.Printf("[Router] Zaktualizowano pomyślnie plik router.json")
	}
}

func syncProductData(nameID string) {
	rustURL := fmt.Sprintf("https://%s:%s/api/products/name_id/%s", config.RustHost, config.RustPort, nameID)

	resp, err := insecureHTTPClient.Get(rustURL)
	if err != nil {
		log.Printf("[Sync ERROR] Brak komunikacji z Rustem dla %s: %v", nameID, err)
		return
	}
	defer func(Body io.ReadCloser) {
		err := Body.Close()
		if err != nil {
			log.Printf("error closing body: %v", err)
		}
	}(resp.Body)

	if resp.StatusCode != http.StatusOK {
		log.Printf("[Sync ERROR] Rust zwrócił status %d dla produktu %s", resp.StatusCode, nameID)
		return
	}

	var data any
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		log.Printf("[Sync ERROR] Błąd dekodowania JSON z Rusta: %v", err)
		return
	}

	targetDir := filepath.Join(config.DataDir, "products", nameID)
	if err := os.MkdirAll(targetDir, 0755); err != nil {
		log.Printf("[Sync ERROR] Nie można utworzyć struktury katalogów: %v", err)
		return
	}

	fileData, err := json.MarshalIndent(data, "", "  ")
	if err != nil {
		log.Printf("[Sync ERROR] Błąd serializacji danych: %v", err)
		return
	}

	err = os.WriteFile(filepath.Join(targetDir, "product.json"), fileData, 0644)
	if err != nil {
		log.Printf("[Sync ERROR] Błąd zapisu pliku product.json: %v", err)
		return
	}

	rebuildRouterJson()
	log.Printf("[Sync] Dane dla produktu '%s' zostały zsynchronizowane z sukcesem.", nameID)
}

var pathRegex = regexp.MustCompile(`src/api/+/products/[^/]+/(images|models)/`)

func fixPathsAndClean(data any, modyfikator, typ string) any {
	switch v := data.(type) {
	case map[string]any:
		delete(v, "product_id")

		for key, val := range v {
			switch str := val.(type) {
			case string:
				if pathRegex.MatchString(str) {
					v[key] = pathRegex.ReplaceAllString(str, fmt.Sprintf("data/products/%s/%s/", modyfikator, typ))
				}
			default:
				v[key] = fixPathsAndClean(val, modyfikator, typ)
			}
		}
		return v

	case []any:
		for i, val := range v {
			v[i] = fixPathsAndClean(val, modyfikator, typ)
		}
		return v

	default:
		return data
	}
}

func rustFilesUploadHandler(w http.ResponseWriter, r *http.Request) {
	log.Printf("odbieranie pliku")
	log.Printf("[Go Server] Odbieranie żądania uploadu: %s %s", r.Method, r.URL.Path)
	log.Printf("[Go Server] Content-Type: %s, Content-Length: %d", r.Header.Get("Content-Type"), r.ContentLength)
	if r.Method != http.MethodPost {
		log.Printf("err http.MethodPost")
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	modyfikator := strings.TrimPrefix(r.URL.Path, "/api/produkty/")
	modyfikator = strings.Trim(modyfikator, "/") // usuwamy ewentualne slashe

	if err := r.ParseMultipartForm(500 << 20); err != nil {
		log.Printf("err r.ParseMultipartForm %v", err)
		http.Error(w, "Błąd parsowania plików multipart", http.StatusBadRequest)
		return
	}

	files := r.MultipartForm.File["files"]
	if len(files) == 0 {
		log.Printf("err len(files) == 0")
		http.Error(w, "Brak plików w żądaniu", http.StatusBadRequest)
		return
	}

	// Restrykcyjne domyślne zachowanie dla zdjęć z zachowaniem logiki tworzenia katalogu
	imgTargetDir := filepath.Join(config.DataDir, "products", modyfikator, "img")
	if err := os.MkdirAll(imgTargetDir, 0755); err != nil {
		log.Printf("err filepath.Join config.DataDir: %v", err)
		http.Error(w, "Błąd tworzenia katalogu zapisu", http.StatusInternalServerError)
		return
	}

	modelTargetDir := filepath.Join(config.DataDir, "products", modyfikator, "model")

	for _, fileHeader := range files {
		ext := strings.ToLower(filepath.Ext(fileHeader.Filename))
		currentTargetDir := imgTargetDir

		// Nadpisanie folderu docelowego, jeśli to jednoznacznie plik modelu lub tekstura
		if ext == ".gltf" || ext == ".glb" || ext == ".dds" || ext == ".bin" {
			currentTargetDir = modelTargetDir
			if err := os.MkdirAll(currentTargetDir, 0755); err != nil {
				log.Printf("err tworzenia katalogu dla modelu: %v", err)
				http.Error(w, "Błąd tworzenia katalogu zapisu dla modelu", http.StatusInternalServerError)
				return
			}
		}

		file, err := fileHeader.Open()
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		defer func(file multipart.File) {
			err := file.Close()
			if err != nil {
				log.Printf("UploadHandler error %v", err)
			}
		}(file)

		out, err := os.Create(filepath.Join(currentTargetDir, fileHeader.Filename))
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		defer func(out *os.File) {
			err := out.Close()
			if err != nil {
				log.Printf("UploadHandler error %v", err)
			}
		}(out)

		if _, err = io.Copy(out, file); err != nil {
			http.Error(w, "Błąd podczas zapisu strumienia pliku", http.StatusInternalServerError)
			return
		}
	}

	log.Printf("[Go Server] Pomyślnie odebrano %d plików od Rusta dla produktu: %s", len(files), modyfikator)

	if modelTargetDir != "" {
		hasModelFiles := false

		// Sprawdzamy, czy wgrano jakiekolwiek pliki modelu lub tekstury
		for _, fileHeader := range files {
			ext := strings.ToLower(filepath.Ext(fileHeader.Filename))
			if ext == ".glb" || ext == ".gltf" || ext == ".dds" {
				hasModelFiles = true
				break
			}
		}

		// Jeśli wgrano pliki modelu, przebudowywany JSON z uwzględnieniem LOD
		if hasModelFiles {
			modelJsonPath := filepath.Join(modelTargetDir, "model.json")

			// Odczytywanie istniejących parametrów z model.json (np. wood, metal, scale), żeby ich nie stracić
			existingParams := make(map[string]any)
			if existingBytes, err := os.ReadFile(modelJsonPath); err == nil {
				_ = json.Unmarshal(existingBytes, &existingParams)
			}

			// Usuwanie starych kluczy ścieżek, żeby funkcja mogła zbudować je na nowo z nullami i poprawnymi plikami
			delete(existingParams, "model")
			delete(existingParams, "ao_texture")
			for i := 0; i <= 3; i++ {
				delete(existingParams, fmt.Sprintf("LOD%d", i))
			}

			// fn do wygenerowania mapy LOD-ów i scalenia z parametrami
			modelConfig := mergeModelFilesAndData(modyfikator, modelTargetDir, existingParams)

			jsonData, err := json.MarshalIndent(modelConfig, "", "  ")
			if err == nil {
				_ = os.WriteFile(modelJsonPath, jsonData, 0644)
				log.Printf("[Go Server] Automatycznie wygenerowano i zapisano strukturę LOD: %s", modelJsonPath)
			}
		}
	}

	go syncProductData(modyfikator)

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)

	if _, err := w.Write([]byte(`{"status":"success"}`)); err != nil {
		return
	}
}

func rustJsonUploadHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	if len(parts) < 5 {
		http.Error(w, "Nieprawidłowe parametry ścieżki", http.StatusBadRequest)
		return
	}
	typ := parts[len(parts)-2]         // images lub models
	modyfikator := parts[len(parts)-1] // name_id produktu

	folderType := typ
	switch folderType {
	case "images", "img":
		folderType = "img"
	case "models", "model":
		folderType = "model"
	}

	var rawData any
	if err := json.NewDecoder(r.Body).Decode(&rawData); err != nil {
		http.Error(w, "Niepoprawny format danych JSON", http.StatusBadRequest)
		return
	}

	processedData := fixPathsAndClean(rawData, modyfikator, folderType)

	targetDir := filepath.Join(config.DataDir, "products", modyfikator, folderType)
	if err := os.MkdirAll(targetDir, 0755); err != nil {
		http.Error(w, "Nie można przygotować katalogu", http.StatusInternalServerError)
		return
	}

	fileName := "dane.json"
	if folderType == "model" {
		fileName = "model.json"
	}

	targetFilePath := filepath.Join(targetDir, fileName)

	// SCALANIE DANYCH DLA MODELU
	// Jeśli to model, próba odczytania istniejącego pliku (z wygenerowanymi ścieżkami)
	// dopisanie odebranych danych (wood, metal, glass).
	if folderType == "model" {
		if incomingMap, ok := processedData.(map[string]any); ok {
			existingData := make(map[string]any)

			// Odczytuje plik wygenerowany wcześniej przez rustFilesUploadHandler
			if existingBytes, err := os.ReadFile(targetFilePath); err == nil {
				_ = json.Unmarshal(existingBytes, &existingData)
			}

			// Dopisuje/nadpisuje pola z odebranego JSONa do istniejących danych
			for key, val := range incomingMap {
				// Opcjonalnie: pomijamy name_id, żeby nie zaśmiecać model.json
				if key != "name_id" {
					existingData[key] = val
				}
			}

			// Podmienia processedData na scaloną mapę
			processedData = existingData
		}
	}

	fileBytes, err := json.MarshalIndent(processedData, "", "  ")
	if err != nil {
		http.Error(w, "Błąd kompilacji JSON", http.StatusInternalServerError)
		return
	}

	err = os.WriteFile(filepath.Join(targetDir, fileName), fileBytes, 0644)
	if err != nil {
		http.Error(w, "Błąd zapisu pliku konfiguracyjnego", http.StatusInternalServerError)
		return
	}

	log.Printf("[Go Server] Zapisano zaktualizowany konfigurator JSON (%s) dla '%s'", fileName, modyfikator)

	go syncProductData(modyfikator)

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	if _, err := w.Write([]byte(`{"status":"success"}`)); err != nil {
		log.Printf("Write error: %v", err)
		return
	}
}
func syncAllDataHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet && r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Wyciągamy kategorię z URL, np. /api/sync/all/models -> "models"
	parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	if len(parts) < 4 {
		http.Error(w, "Nieprawidłowa ścieżka", http.StatusBadRequest)
		return
	}
	category := parts[3]

	// Budujemy adres backendu
	rustURL := fmt.Sprintf("https://%s:%s/api/admin/sync/%s", config.RustHost, config.RustPort, category)

	req, err := http.NewRequest(http.MethodGet, rustURL, nil)
	if err != nil {
		http.Error(w, "Błąd budowania zapytania", http.StatusInternalServerError)
		return
	}

	// kopiowany token z ciasteczek/nagłówków Go, w celach autoryzacji
	token := extractAuthToken(r)
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}

	// Pobiera Vec<Data> z backendu (listę wszystkich jsonów)
	resp, err := insecureHTTPClient.Do(req)
	if err != nil {
		log.Printf("[Sync All] Błąd komunikacji z Rustem dla %s: %v", category, err)
		http.Error(w, "Błąd komunikacji z backendem", http.StatusBadGateway)
		return
	}
	defer func(Body io.ReadCloser) {
		err := Body.Close()
		if err != nil {
			log.Printf("[Storage] Error closing body: %v", err)
		}
	}(resp.Body)

	if resp.StatusCode != http.StatusOK {
		log.Printf("[Sync All] Rust zwrócił błąd %d dla kategorii %s", resp.StatusCode, category)
		http.Error(w, "Błąd pobierania danych", http.StatusBadGateway)
		return
	}

	// Dekoduje spłaszczoną tablicę [{...}, {...}]
	var dataList []map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&dataList); err != nil {
		log.Printf("[Sync All] Błąd dekodowania JSON: %v", err)
		http.Error(w, "Nieprawidłowy format JSON", http.StatusInternalServerError)
		return
	}

	//Uniwersalne mapowanie folderów i nazw plików
	folderType := category
	switch folderType {
	case "images", "img":
		folderType = "img"
	case "models", "model":
		folderType = "model"
	}

	fileName := "dane.json"
	if folderType == "model" {
		fileName = "model.json"
	}

	// Przetwarzanie i zapisywanie każdego rekordu
	for _, item := range dataList {
		nameID, ok := item["name_id"].(string)
		if !ok || nameID == "" {
			continue
		}

		processedData := fixPathsAndClean(item, nameID, folderType)

		targetDir := filepath.Join(config.DataDir, "products", nameID, folderType)
		if err := os.MkdirAll(targetDir, 0755); err != nil {
			log.Printf("[Sync All] Błąd tworzenia katalogu dla %s: %v", nameID, err)
			continue
		}

		if folderType == "model" {
			if incomingMap, ok := processedData.(map[string]any); ok {
				// Automatycznie skanuje katalog, buduje ścieżki LOD z nullami i dodaje dane (wood, metal...)
				processedData = mergeModelFilesAndData(nameID, targetDir, incomingMap)
			}
		}

		fileBytes, err := json.MarshalIndent(processedData, "", "  ")
		if err != nil {
			log.Printf("[Sync All] Błąd serializacji JSON dla %s: %v", nameID, err)
			continue
		}

		if err := os.WriteFile(filepath.Join(targetDir, fileName), fileBytes, 0644); err != nil {
			log.Printf("[Sync All] Błąd zapisu pliku %s dla %s: %v", fileName, nameID, err)
		}
	}

	rebuildRouterJson()

	log.Printf("[Sync All] Zakończono synchronizację dla kategorii: %s (zaktualizowano %d elementów)", category, len(dataList))

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	if _, err := w.Write([]byte(fmt.Sprintf(`{"status":"success", "message":"Zsynchronizowano kategorię %s"}`, category))); err != nil {
		return
	}
}

// mergeModelFilesAndData skanuje katalog modelu, wykrywa pliki LOD/AO,
// wstawia null dla brakujących LOD-ów i scala to z danymi z backendu
func mergeModelFilesAndData(nameID, targetDir string, incomingMap map[string]any) map[string]any {
	// Domyślne klucze - jeśli plik nie zostanie znaleziony, w JSON pojawi się null
	result := map[string]any{
		"LOD0":       nil,
		"LOD1":       nil,
		"LOD2":       nil,
		"LOD3":       nil,
		"ao_texture": nil,
	}

	// Odczytuje pliki z fizycznego katalogu
	entries, err := os.ReadDir(targetDir)
	if err == nil {
		for _, entry := range entries {
			if entry.IsDir() {
				continue
			}

			fileName := entry.Name()
			ext := strings.ToLower(filepath.Ext(fileName))
			baseName := strings.TrimSuffix(fileName, filepath.Ext(fileName))
			upperBase := strings.ToUpper(baseName)

			relPath := fmt.Sprintf("data/products/%s/model/%s", nameID, fileName)

			// Wykrywa modele 3D i poziomów LOD
			if ext == ".glb" || ext == ".gltf" {
				for i := 0; i <= 3; i++ {
					lodKey := fmt.Sprintf("LOD%d", i)
					if strings.HasSuffix(upperBase, lodKey) {
						result[lodKey] = relPath
						break
					}
				}
			} else if ext == ".dds" || strings.Contains(strings.ToLower(baseName), "ao") {
				// Wykrywa tekstury ao
				result["ao_texture"] = relPath
			}
		}
	}

	// Scala wartości z backendu (wood, metal, glass itp.), pomijając name_id
	for key, val := range incomingMap {
		if key != "name_id" {
			result[key] = val
		}
	}

	return result
}
