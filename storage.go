package main

import (
	"encoding/json"
	"log"
	"net/http"
	"os"
	"path/filepath"
)

// ============================================================
// SYNC PRODUCT DATA (fetch z Rusta)
// ============================================================
func syncProductData(nameID string) error {
	// 1. Zapytaj Rusta
	resp, err := http.Get("http://127.0.0.1:8080/api/products/name_id/" + nameID)
	if err != nil {
		log.Printf("⚠️ Cannot reach Rust: %v", err)
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		log.Printf("⚠️ Rust returned: %d", resp.StatusCode)
		return nil // nie przerywamy, ale logujemy
	}

	// 2. Odczytaj JSON
	var data map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		log.Printf("⚠️ Cannot decode JSON: %v", err)
		return err
	}

	// 3. Zapisz do data/products/{nameId}/product.json
	targetDir := filepath.Join(".", "data", "products", nameID)
	if err := os.MkdirAll(targetDir, 0755); err != nil {
		log.Printf("⚠️ Cannot create dir: %v", err)
		return err
	}

	filePath := filepath.Join(targetDir, "product.json")
	jsonData, err := json.MarshalIndent(data, "", "  ")
	if err != nil {
		log.Printf("⚠️ Cannot marshal: %v", err)
		return err
	}
	if err := os.WriteFile(filePath, jsonData, 0644); err != nil {
		log.Printf("⚠️ Cannot write file: %v", err)
		return err
	}

	log.Printf("✅ Synced product data for %s", nameID)

	// 4. Odśwież router.json
	return rebuildRouterJson()
}

// ============================================================
// REBUILD ROUTER.JSON
// ============================================================
func rebuildRouterJson() error {
	dataDir := filepath.Join(".", "data", "products")
	routerPath := filepath.Join(".", "data", "router.json")
	log.Printf("📍 Router path: %s", routerPath) // DODAJ LOG

	// Sprawdź, czy katalog istnieje
	if _, err := os.Stat(dataDir); os.IsNotExist(err) {
		log.Printf("⚠️ Data dir does not exist: %s", dataDir)
		return nil
	}

	entries, err := os.ReadDir(dataDir)
	if err != nil {
		log.Printf("⚠️ Cannot read dir: %v", err)
		return err
	}

	var routerItems []map[string]interface{}

	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}
		nameID := entry.Name()
		productPath := filepath.Join(dataDir, nameID)

		item := map[string]interface{}{
			"id":      nameID,
			"product": nil,
			"img":     nil,
			"model":   nil,
		}

		// Sprawdź product.json
		jsonProduct := filepath.Join(productPath, "product.json")
		if _, err := os.Stat(jsonProduct); err == nil {
			item["product"] = "../data/products/" + nameID + "/product.json"
		}

		// Sprawdź img/dane.json
		jsonImg := filepath.Join(productPath, "img", "dane.json")
		if _, err := os.Stat(jsonImg); err == nil {
			item["img"] = "../data/products/" + nameID + "/img/dane.json"
		}

		// Sprawdź model/model.json
		jsonModel := filepath.Join(productPath, "model", "model.json")
		if _, err := os.Stat(jsonModel); err == nil {
			item["model"] = "../data/products/" + nameID + "/model/model.json"
		}

		routerItems = append(routerItems, item)
	}

	// Zapisz router.json
	data, err := json.MarshalIndent(routerItems, "", "  ")
	if err != nil {
		log.Printf("⚠️ Cannot marshal router: %v", err)
		return err
	}
	if err := os.WriteFile(routerPath, data, 0644); err != nil {
		log.Printf("⚠️ Cannot write router: %v", err)
		return err
	}

	log.Printf("✅ Router rebuilt: %d items", len(routerItems))
	return nil
}