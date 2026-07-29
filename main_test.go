package main

import (
	"bytes"
	"encoding/json"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// ============================================================
// SETUP – Przygotowanie prawdziwego środowiska i konfiguracji
// ============================================================
func setupTestEnvironment(t *testing.T) (*http.ServeMux, func()) {
	// 1. Tworzymy tymczasowy katalog roboczy
	tmpDir := t.TempDir()
	oldDir, _ := os.Getwd()
	_ = os.Chdir(tmpDir)

	// 2. Tworzymy strukturę katalogów zgodną z aktualnym serwerem
	staticDir := filepath.Join(tmpDir, "static")
	pagesDir := filepath.Join(tmpDir, "pages")
	dataDir := filepath.Join(tmpDir, "data")

	_ = os.MkdirAll(filepath.Join(staticDir, "css"), 0755)
	_ = os.MkdirAll(filepath.Join(staticDir, "js"), 0755)
	_ = os.MkdirAll(pagesDir, 0755)
	_ = os.MkdirAll(filepath.Join(dataDir, "products", "komoda_1", "img"), 0755)

	// 3. Inicjalizacja globalnej zmiennej config
	config = &Config{
		StaticDir: staticDir,
		PagesDir:  pagesDir,
		DataDir:   dataDir,
	}

	// 4. Tworzenie plików testowych w katalogu static/pages
	_ = os.WriteFile(filepath.Join(staticDir, "index.html"), []byte(`<!DOCTYPE html><html><body>Index</body></html>`), 0644)
	_ = os.WriteFile(filepath.Join(pagesDir, "index.html"), []byte(`<!DOCTYPE html><html><body>Index</body></html>`), 0644)
	_ = os.WriteFile(filepath.Join(pagesDir, "produkty.html"), []byte(`<html><body>Produkty</body></html>`), 0644)
	_ = os.WriteFile(filepath.Join(pagesDir, "kontakt.html"), []byte(`<html><body>Kontakt</body></html>`), 0644)
	_ = os.WriteFile(filepath.Join(pagesDir, "admin.html"), []byte(`<html><body>Admin Panel</body></html>`), 0644)
	_ = os.WriteFile(filepath.Join(pagesDir, "error_page.html"), []byte(`<html><body>{{code}} {{title}} {{message}}</body></html>`), 0644)

	// Pliki statyczne
	_ = os.WriteFile(filepath.Join(staticDir, "css", "style.css"), []byte(`body { background: black; }`), 0644)
	_ = os.WriteFile(filepath.Join(staticDir, "js", "app.js"), []byte(`console.log('test');`), 0644)

	// Pliki danych
	routerData := `[{"id":"komoda_1","product":"data/products/komoda_1/product.json","img":"data/products/komoda_1/img/dane.json","model":null}]`
	_ = os.WriteFile(filepath.Join(dataDir, "router.json"), []byte(routerData), 0644)

	// 5. Konfiguracja produkcyjnego MUXa serwera
	mux := http.NewServeMux()

	// Podpięcie produkcyjnych handlerów z serwera
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"status":"ok"}`))
	})

	mux.HandleFunc("/css/", func(w http.ResponseWriter, r *http.Request) {
		path := strings.TrimPrefix(r.URL.Path, "/css/")
		if path == "" || strings.HasSuffix(path, "/") {
			serveErrorPage(w, r, http.StatusForbidden, "Dostęp zabroniony", "Nie masz uprawnień.")
			return
		}
		http.StripPrefix("/css/", http.FileServer(http.Dir(filepath.Join(config.StaticDir, "css")))).ServeHTTP(w, r)
	})

	mux.HandleFunc("/js/", func(w http.ResponseWriter, r *http.Request) {
		path := strings.TrimPrefix(r.URL.Path, "/js/")
		if path == "" || strings.HasSuffix(path, "/") {
			serveErrorPage(w, r, http.StatusForbidden, "Dostęp zabroniony", "Nie masz uprawnień.")
			return
		}
		http.StripPrefix("/js/", http.FileServer(http.Dir(filepath.Join(config.StaticDir, "js")))).ServeHTTP(w, r)
	})

	mux.HandleFunc("/data/", func(w http.ResponseWriter, r *http.Request) {
		path := strings.TrimPrefix(r.URL.Path, "/data/")
		if path == "" || strings.HasSuffix(path, "/") {
			serveErrorPage(w, r, http.StatusForbidden, "Dostęp zabroniony", "Nie masz uprawnień.")
			return
		}
		fullPath := filepath.Join(config.DataDir, path)
		if stat, err := os.Stat(fullPath); err != nil || stat.IsDir() {
			serveErrorPage(w, r, http.StatusForbidden, "Dostęp zabroniony", "Katalog/Plik niedostępny.")
			return
		}
		http.ServeFile(w, r, fullPath)
	})

	// Handlery API
	mux.HandleFunc("/api/produkty/", rustFilesUploadHandler)
	mux.HandleFunc("/api/upload/json/", rustJsonUploadHandler)

	// Strony (Router domyślny)
	mux.HandleFunc("/", handlePages)

	cleanup := func() {
		_ = os.Chdir(oldDir)
	}

	return mux, cleanup
}

// ============================================================
// TEST 1 – Strona główna
// ============================================================
func TestIndex(t *testing.T) {
	mux, cleanup := setupTestEnvironment(t)
	defer cleanup()

	ts := httptest.NewServer(mux)
	defer ts.Close()

	resp, err := http.Get(ts.URL + "/")
	if err != nil {
		t.Fatalf("Cannot GET /: %v", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("Expected 200, got %d", resp.StatusCode)
	}
	body, _ := io.ReadAll(resp.Body)
	if !strings.Contains(string(body), "Index") {
		t.Errorf("Expected 'Index', got '%s'", string(body))
	}
}

// ============================================================
// TEST 2 – Routing stron
// ============================================================
func TestPageRouting(t *testing.T) {
	mux, cleanup := setupTestEnvironment(t)
	defer cleanup()

	ts := httptest.NewServer(mux)
	defer ts.Close()

	tests := []struct {
		path     string
		expected string
	}{
		{"/produkty", "Produkty"},
		{"/kontakt", "Kontakt"},
	}

	for _, tt := range tests {
		resp, err := http.Get(ts.URL + tt.path)
		if err != nil {
			t.Errorf("Cannot GET %s: %v", tt.path, err)
			continue
		}
		defer func() { _ = resp.Body.Close() }()

		if resp.StatusCode != http.StatusOK {
			t.Errorf("%s: expected 200, got %d", tt.path, resp.StatusCode)
			continue
		}
		body, _ := io.ReadAll(resp.Body)
		if !strings.Contains(string(body), tt.expected) {
			t.Errorf("%s: expected '%s', got '%s'", tt.path, tt.expected, string(body))
		}
	}
}

// ============================================================
// TEST 3 – Przekierowanie starych ścieżek /strony/*.html
// ============================================================
func TestRedirectOldPaths(t *testing.T) {
	mux, cleanup := setupTestEnvironment(t)
	defer cleanup()

	client := &http.Client{
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			return http.ErrUseLastResponse // Wstrzymujemy automatyczne podążanie za przekierowaniem
		},
	}

	ts := httptest.NewServer(mux)
	defer ts.Close()

	resp, err := client.Get(ts.URL + "/strony/produkty.html")
	if err != nil {
		t.Fatalf("Cannot GET: %v", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusFound {
		t.Errorf("Expected 302, got %d", resp.StatusCode)
	}
	if resp.Header.Get("Location") != "/produkty" {
		t.Errorf("Expected Location '/produkty', got '%s'", resp.Header.Get("Location"))
	}
}

// ============================================================
// TEST 4 – Strona 404
// ============================================================
func TestNotFound(t *testing.T) {
	mux, cleanup := setupTestEnvironment(t)
	defer cleanup()

	ts := httptest.NewServer(mux)
	defer ts.Close()

	resp, err := http.Get(ts.URL + "/nie-istnieje")
	if err != nil {
		t.Fatalf("Cannot GET: %v", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusNotFound {
		t.Errorf("Expected 404, got %d", resp.StatusCode)
	}
}

// ============================================================
// TEST 5 – Health Check
// ============================================================
func TestHealthCheck(t *testing.T) {
	mux, cleanup := setupTestEnvironment(t)
	defer cleanup()

	ts := httptest.NewServer(mux)
	defer ts.Close()

	resp, err := http.Get(ts.URL + "/health")
	if err != nil {
		t.Fatalf("Cannot GET /health: %v", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("Expected 200, got %d", resp.StatusCode)
	}
	body, _ := io.ReadAll(resp.Body)
	if string(body) != `{"status":"ok"}` {
		t.Errorf("Expected '{\"status\":\"ok\"}', got '%s'", string(body))
	}
}

// ============================================================
// TEST 6 – Serwowanie plików statycznych
// ============================================================
func TestStaticFiles(t *testing.T) {
	mux, cleanup := setupTestEnvironment(t)
	defer cleanup()

	ts := httptest.NewServer(mux)
	defer ts.Close()

	tests := []struct {
		path     string
		expected string
	}{
		{"/css/style.css", "background: black"},
		{"/js/app.js", "console.log"},
		{"/data/router.json", "komoda_1"},
	}

	for _, tt := range tests {
		resp, err := http.Get(ts.URL + tt.path)
		if err != nil {
			t.Errorf("Cannot GET %s: %v", tt.path, err)
			continue
		}
		defer func() { _ = resp.Body.Close() }()

		if resp.StatusCode != http.StatusOK {
			t.Errorf("%s: expected 200, got %d", tt.path, resp.StatusCode)
			continue
		}
		body, _ := io.ReadAll(resp.Body)
		if !strings.Contains(string(body), tt.expected) {
			t.Errorf("%s: expected '%s', got '%s'", tt.path, tt.expected, string(body))
		}
	}
}

// ============================================================
// TEST 7 – API: Upload plików (rozpoznawanie obrazów oraz modeli .glb/.gltf/.dds)
// ============================================================
func TestUploadFiles(t *testing.T) {
	mux, cleanup := setupTestEnvironment(t)
	defer cleanup()

	ts := httptest.NewServer(mux)
	defer ts.Close()

	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)

	// Tworzymy przykładowe pliki: obrazek oraz model 3D
	filePart1, _ := writer.CreateFormFile("files", "foto.jpg")
	_, _ = filePart1.Write([]byte("fake image data"))

	filePart2, _ := writer.CreateFormFile("files", "biurko.glb")
	_, _ = filePart2.Write([]byte("fake glb data"))

	_ = writer.Close()

	resp, err := http.Post(ts.URL+"/api/produkty/biurko_1", writer.FormDataContentType(), body)
	if err != nil {
		t.Fatalf("Cannot POST upload: %v", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("Expected 200, got %d", resp.StatusCode)
	}

	var result map[string]string
	_ = json.NewDecoder(resp.Body).Decode(&result)
	if result["status"] != "success" {
		t.Errorf("Expected status 'success', got '%s'", result["status"])
	}

	// Weryfikacja fizycznego zapisu na dysku
	imgFile := filepath.Join(config.DataDir, "products", "biurko_1", "img", "foto.jpg")
	if _, err := os.Stat(imgFile); os.IsNotExist(err) {
		t.Errorf("Plik obrazka nie został wygenerowany w katalogu img/: %s", imgFile)
	}

	modelFile := filepath.Join(config.DataDir, "products", "biurko_1", "model", "biurko.glb")
	if _, err := os.Stat(modelFile); os.IsNotExist(err) {
		t.Errorf("Plik modelu nie został wygenerowany w katalogu model/: %s", modelFile)
	}
}

// ============================================================
// TEST 8 – API: Upload JSON oraz scalamy model z danymi
// ============================================================
func TestUploadJSON(t *testing.T) {
	mux, cleanup := setupTestEnvironment(t)
	defer cleanup()

	ts := httptest.NewServer(mux)
	defer ts.Close()

	jsonData := map[string]interface{}{
		"var_1": map[string]string{
			"128": "test_128.avif",
		},
	}
	jsonBytes, _ := json.Marshal(jsonData)

	resp, err := http.Post(ts.URL+"/api/upload/json/images/biurko_1", "application/json", bytes.NewReader(jsonBytes))
	if err != nil {
		t.Fatalf("Cannot POST JSON: %v", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("Expected 200, got %d", resp.StatusCode)
	}

	daneJsonPath := filepath.Join(config.DataDir, "products", "biurko_1", "img", "dane.json")
	if _, err := os.Stat(daneJsonPath); os.IsNotExist(err) {
		t.Errorf("Plik JSON konfiguracyjny nie został zapisany: %s", daneJsonPath)
	}
}

// ============================================================
// TEST 9 – Blokowanie wyświetlania zawartości katalogów
// ============================================================
func TestBlockDirectoryListing(t *testing.T) {
	mux, cleanup := setupTestEnvironment(t)
	defer cleanup()

	ts := httptest.NewServer(mux)
	defer ts.Close()

	pathsToTest := []string{"/css/", "/js/", "/data/"}

	for _, p := range pathsToTest {
		resp, err := http.Get(ts.URL + p)
		if err != nil {
			t.Fatalf("Cannot GET %s: %v", p, err)
		}
		_ = resp.Body.Close()

		if resp.StatusCode != http.StatusForbidden {
			t.Errorf("Expected 403 Forbidden for path '%s', got %d", p, resp.StatusCode)
		}
	}
}
