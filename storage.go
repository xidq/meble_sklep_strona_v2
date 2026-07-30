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
type ModelPayload struct {
	NameID string  `json:"name_id"`
	Wood   float64 `json:"wood"`
	Metal  float64 `json:"metal"`
	Glass  float64 `json:"glass"`
}

// // rebuildRouterJson skanuje katalogi i tworzy centralny plik mapowania map.json / router.json
//
//	func rebuildRouterJson() {
//		dataDir := filepath.Join(config.DataDir, "products")
//		routerFilePath := filepath.Join(config.DataDir, "router.json")
//
//		// W syncProductData oraz rustFilesUploadHandler / rustJsonUploadHandler:
//
//		files, err := os.ReadDir(dataDir)
//		if err != nil {
//			log.Printf("[Router] Brak katalogu danych lub błąd odczytu: %v", err)
//			return
//		}
//
//		var routerList []RouterItem
//
//		for _, f := range files {
//			if !f.IsDir() {
//				continue
//			}
//			nameID := f.Name()
//			item := RouterItem{ID: nameID}
//
//			productPath := filepath.Join(dataDir, nameID, "product.json")
//			imgPath := filepath.Join(dataDir, nameID, "img", "dane.json")
//			modelPath := filepath.Join(dataDir, nameID, "model", "model.json")
//
//			if _, err := os.Stat(productPath); err == nil {
//				p := fmt.Sprintf("data/products/%s/product.json", nameID)
//				item.Product = &p
//			}
//			if _, err := os.Stat(imgPath); err == nil {
//				i := fmt.Sprintf("data/products/%s/img/dane.json", nameID)
//				item.Img = &i
//			}
//			if _, err := os.Stat(modelPath); err == nil {
//				m := fmt.Sprintf("data/products/%s/model/model.json", nameID)
//				item.Model = &m
//			}
//
//			routerList = append(routerList, item)
//		}
//
//		// Zapewniamy istnienie katalogu docelowego i zapisujemy plik indented JSON
//
//		if err := os.MkdirAll(filepath.Dir(routerFilePath), 0755); err != nil {
//			log.Printf("[Router] Brak katalogu danych: %v", err)
//			return
//		}
//		output, err := json.MarshalIndent(routerList, "", "  ")
//		if err != nil {
//			log.Printf("[Router] Błąd zapisu struktur JSON: %v", err)
//			return
//		}
//
//		if err := os.WriteFile(routerFilePath, output, 0644); err != nil {
//			log.Printf("[Router] Nie udało się zapisać router.json: %v", err)
//		} else {
//			log.Printf("[Router] Zaktualizowano pomyślnie plik router.json")
//		}
//	}
//
//	func syncProductData(nameID string) {
//		// Budowanie adresu URL do drugiego serv
//		rustURL := fmt.Sprintf("https://%s:%s/api/products/name_id/%s", config.RustHost, config.RustPort, nameID)
//
//		resp, err := insecureHTTPClient.Get(rustURL)
//		if err != nil {
//			log.Printf("[Sync ERROR] Brak komunikacji z Rustem dla %s: %v", nameID, err)
//			return
//		}
//		defer func(Body io.ReadCloser) {
//			err := Body.Close()
//			if err != nil {
//				log.Printf("error closing body: %v", err)
//			}
//		}(resp.Body)
//
//		if resp.StatusCode != http.StatusOK {
//			log.Printf("[Sync ERROR] Rust zwrócił status %d dla produktu %s", resp.StatusCode, nameID)
//			return
//		}
//
//		var data interface{}
//		if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
//			log.Printf("[Sync ERROR] Błąd dekodowania JSON z Rusta: %v", err)
//			return
//		}
//
//		targetDir := filepath.Join(config.DataDir, "products", nameID)
//		if err := os.MkdirAll(targetDir, 0755); err != nil {
//			log.Printf("[Sync ERROR] Nie można utworzyć struktury katalogów: %v", err)
//			return
//		}
//
//		fileData, err := json.MarshalIndent(data, "", "  ")
//		if err != nil {
//			log.Printf("[Sync ERROR] Błąd serializacji danych: %v", err)
//			return
//		}
//
//		err = os.WriteFile(filepath.Join(targetDir, "product.json"), fileData, 0644)
//		if err != nil {
//			log.Printf("[Sync ERROR] Błąd zapisu pliku product.json: %v", err)
//			return
//		}
//
//		// Po udanej synchronizacji odświeżamy mapę główną routera
//		rebuildRouterJson()
//		log.Printf("[Sync] Dane dla produktu '%s' zostały zsynchronizowane z sukcesem.", nameID)
//	}
//
// var pathRegex = regexp.MustCompile(`src/api/+/products/[^/]+/(images|models)/`)
//
// // fixPathsAndClean czyści product_id i mapuje ścieżki plików w głąb całego JSON-a
// // 2. Zmiana: Usunięcie "/" ze ścieżek podmienianych w locie (sygnatura zostaje bez zmian)
//
//	func fixPathsAndClean(data interface{}, modyfikator, typ string) interface{} {
//		switch v := data.(type) {
//		case map[string]interface{}:
//			delete(v, "product_id")
//
//			for key, val := range v {
//				switch str := val.(type) {
//				case string:
//					if pathRegex.MatchString(str) {
//						// Czyszczenie ścieżki do formatu "data/products/..."
//						v[key] = pathRegex.ReplaceAllString(str, fmt.Sprintf("data/products/%s/%s/", modyfikator, typ))
//					}
//				default:
//					v[key] = fixPathsAndClean(val, modyfikator, typ)
//				}
//			}
//			return v
//
//		case []interface{}:
//			for i, val := range v {
//				v[i] = fixPathsAndClean(val, modyfikator, typ)
//			}
//			return v
//
//		default:
//			return data
//		}
//	}
//
// // 3. Zmiana: Przejście z "." na dynamiczny config.DataDir przy zapisie obrazków
//
//	func rustFilesUploadHandler(w http.ResponseWriter, r *http.Request) {
//		log.Printf("odbieranie pliku")
//		log.Printf("[Go Server] Odbieranie żądania uploadu: %s %s", r.Method, r.URL.Path)
//		log.Printf("[Go Server] Content-Type: %s, Content-Length: %d", r.Header.Get("Content-Type"), r.ContentLength)
//		if r.Method != http.MethodPost {
//			log.Printf("err http.MethodPost")
//			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
//			return
//		}
//
//		//parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
//		//if len(parts) < 3 {
//		//
//		//	log.Printf("err http.MethodPost")
//		//	http.Error(w, "Brak parametru modyfikatora", http.StatusBadRequest)
//		//	return
//		//}
//		//modyfikator := parts[len(parts)-1]
//		modyfikator := strings.TrimPrefix(r.URL.Path, "/api/produkty/")
//		modyfikator = strings.Trim(modyfikator, "/") // usuwamy ewentualne slashe
//
//		if err := r.ParseMultipartForm(500 << 20); err != nil {
//
//			log.Printf("err r.ParseMultipartForm %v", err)
//			http.Error(w, "Błąd parsowania plików multipart", http.StatusBadRequest)
//			return
//		}
//
//		files := r.MultipartForm.File["files"]
//		if len(files) == 0 {
//			log.Printf("err len(files) == 0")
//			http.Error(w, "Brak plików w żądaniu", http.StatusBadRequest)
//			return
//		}
//
//		targetDir := filepath.Join(config.DataDir, "products", modyfikator, "img")
//		if err := os.MkdirAll(targetDir, 0755); err != nil {
//			log.Printf("err filepath.Join config.DataDir: %v", err)
//			http.Error(w, "Błąd tworzenia katalogu zapisu", http.StatusInternalServerError)
//			return
//		}
//
//		for _, fileHeader := range files {
//			file, err := fileHeader.Open()
//			if err != nil {
//				http.Error(w, err.Error(), http.StatusInternalServerError)
//				return
//			}
//			defer func(file multipart.File) {
//				err := file.Close()
//				if err != nil {
//					log.Printf("UploadHandler error %v", err)
//				}
//			}(file)
//
//			out, err := os.Create(filepath.Join(targetDir, fileHeader.Filename))
//			if err != nil {
//				http.Error(w, err.Error(), http.StatusInternalServerError)
//				return
//			}
//			defer func(out *os.File) {
//				err := out.Close()
//				if err != nil {
//					log.Printf("UploadHandler error %v", err)
//				}
//			}(out)
//
//			if _, err = io.Copy(out, file); err != nil {
//				http.Error(w, "Błąd podczas zapisu strumienia pliku", http.StatusInternalServerError)
//				return
//			}
//		}
//
//		log.Printf("[Go Server] Pomyślnie odebrano %d plików od Rusta dla produktu: %s", len(files), modyfikator)
//
//		go syncProductData(modyfikator)
//
//		w.Header().Set("Content-Type", "application/json")
//		w.WriteHeader(http.StatusOK)
//
//		if _, err := w.Write([]byte(`{"status":"success"}`)); err != nil {
//			return
//		}
//	}
//
// // 4. Zmiana: Poprawa nameID -> modyfikator, ujednolicenie nazw folderów (images -> img itd.) i config.DataDir
//
//	func rustJsonUploadHandler(w http.ResponseWriter, r *http.Request) {
//		if r.Method != http.MethodPost {
//			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
//			return
//		}
//
//		parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
//		if len(parts) < 5 {
//			http.Error(w, "Nieprawidłowe parametry ścieżki", http.StatusBadRequest)
//			return
//		}
//		typ := parts[len(parts)-2]         // images lub models
//		modyfikator := parts[len(parts)-1] // name_id produktu
//
//		// Mapowanie typów folderów z Rusta na strukturę Go
//		folderType := typ
//		switch folderType {
//		case "images", "img":
//			folderType = "img"
//		case "models", "model":
//			folderType = "model"
//		}
//
//		var rawData interface{}
//		if err := json.NewDecoder(r.Body).Decode(&rawData); err != nil {
//			http.Error(w, "Niepoprawny format danych JSON", http.StatusBadRequest)
//			return
//		}
//
//		processedData := fixPathsAndClean(rawData, modyfikator, folderType)
//
//		targetDir := filepath.Join(config.DataDir, "products", modyfikator, folderType)
//		if err := os.MkdirAll(targetDir, 0755); err != nil {
//			http.Error(w, "Nie można przygotować katalogu", http.StatusInternalServerError)
//			return
//		}
//
//		fileName := "dane.json"
//		if folderType == "model" {
//			fileName = "model.json"
//		}
//
//		fileBytes, err := json.MarshalIndent(processedData, "", "  ")
//		if err != nil {
//			http.Error(w, "Błąd kompilacji JSON", http.StatusInternalServerError)
//			return
//		}
//
//		err = os.WriteFile(filepath.Join(targetDir, fileName), fileBytes, 0644)
//		if err != nil {
//			http.Error(w, "Błąd zapisu pliku konfiguracyjnego", http.StatusInternalServerError)
//			return
//		}
//
//		log.Printf("[Go Server] Zapisano zaktualizowany konfigurator JSON (%s) dla '%s'", fileName, modyfikator)
//
//		go syncProductData(modyfikator)
//
//		w.Header().Set("Content-Type", "application/json")
//		w.WriteHeader(http.StatusOK)
//		if _, err := w.Write([]byte(`{"status":"success"}`)); err != nil {
//			log.Printf("Write error: %v", err)
//			return
//		}
//	}
//
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

	var data interface{}
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

func fixPathsAndClean(data interface{}, modyfikator, typ string) interface{} {
	switch v := data.(type) {
	case map[string]interface{}:
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

	case []interface{}:
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

	// Restrykcyjne domyślne zachowanie dla zdjęć z zachowaniem starej logiki tworzenia katalogu
	imgTargetDir := filepath.Join(config.DataDir, "products", modyfikator, "img")
	if err := os.MkdirAll(imgTargetDir, 0755); err != nil {
		log.Printf("err filepath.Join config.DataDir: %v", err)
		http.Error(w, "Błąd tworzenia katalogu zapisu", http.StatusInternalServerError)
		return
	}

	modelTargetDir := filepath.Join(config.DataDir, "products", modyfikator, "model")

	for _, fileHeader := range files {
		ext := strings.ToLower(filepath.Ext(fileHeader.Filename))
		currentTargetDir := imgTargetDir // Domyślnie zdjęcia wrzucamy sztywno tam gdzie dawniej

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
		// Zachowana rygorystyczna obsługa przez defer
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
		// Zachowana rygorystyczna obsługa przez defer
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

	// === AUTOMATYCZNE TWORZENIE model.json DLA MODELI ===
	if modelTargetDir != "" {
		var modelFileName, aoFileName string

		// Skanujemy zapisane pliki, aby odnaleźć nazwy modelu i tekstury AO (.dds)
		for _, fileHeader := range files {
			ext := strings.ToLower(filepath.Ext(fileHeader.Filename))
			switch ext {
			case ".glb", ".gltf":
				modelFileName = fileHeader.Filename
			case ".dds":
				aoFileName = fileHeader.Filename
			}
		}

		// Jeśli wykryto plik modelu, generujemy plik model.json
		if modelFileName != "" {
			modelJsonPath := filepath.Join(modelTargetDir, "model.json")

			// Tworzymy strukturę JSON ze ścieżkami względem katalogu data/products/...
			modelConfig := map[string]any{
				"model": fmt.Sprintf("data/products/%s/model/%s", modyfikator, modelFileName),
			}
			if aoFileName != "" {
				modelConfig["ao_texture"] = fmt.Sprintf("data/products/%s/model/%s", modyfikator, aoFileName)
			}

			jsonData, err := json.MarshalIndent(modelConfig, "", "  ")
			if err == nil {
				_ = os.WriteFile(modelJsonPath, jsonData, 0644)
				log.Printf("[Go Server] Automatycznie wygenerowano i zapisano: %s", modelJsonPath)
			}
		}
	}
	// ====================================================

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

	var rawData interface{}
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

	// -----------------------------------------------------------
	targetFilePath := filepath.Join(targetDir, fileName)

	// === SCALANIE DANYCH DLA MODELU ===
	// Jeśli to model, próbujemy odczytać istniejący plik (z wygenerowanymi ścieżkami)
	// i dopisać do niego odebrane dane (wood, metal, glass).
	if folderType == "model" {
		if incomingMap, ok := processedData.(map[string]interface{}); ok {
			existingData := make(map[string]interface{})

			// Odczytujemy plik wygenerowany wcześniej przez rustFilesUploadHandler
			if existingBytes, err := os.ReadFile(targetFilePath); err == nil {
				_ = json.Unmarshal(existingBytes, &existingData)
			}

			// Dopisujemy/nadpisujemy pola z odebranego JSONa do istniejących danych
			for key, val := range incomingMap {
				// Opcjonalnie: pomijamy name_id, żeby nie zaśmiecać model.json
				if key != "name_id" {
					existingData[key] = val
				}
			}

			// Podmieniamy processedData na scaloną mapę, która zaraz zostanie zapisana
			processedData = existingData
		}
	}
	// --------------------------------------------------------------------------------------

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
