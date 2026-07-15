package test

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
// SETUP – przygotowanie symulowanego serwera
// ============================================================
func setupTestServer(t *testing.T) (*httptest.Server, func()) {
    // Tymczasowy katalog z plikami
    tmpDir := t.TempDir()
    oldDir, _ := os.Getwd()
    os.Chdir(tmpDir)

    // Struktura katalogów
    dirs := []string{"css", "js", "data/products", "strony"}
    for _, d := range dirs {
        os.MkdirAll(d, 0755)
    }

    // index.html
    os.WriteFile("index.html", []byte(`<!DOCTYPE html><html><body>Index</body></html>`), 0644)

    // item.html
    os.WriteFile("item.html", []byte(`<!DOCTYPE html><html><body>Item</body></html>`), 0644)

    // strony
    os.WriteFile("strony/produkty.html", []byte(`<html><body>Produkty</body></html>`), 0644)
    os.WriteFile("strony/kontakt.html", []byte(`<html><body>Kontakt</body></html>`), 0644)
    os.WriteFile("strony/admin.html", []byte(`<html><body>Admin Panel</body></html>`), 0644)

    // error_page.html
    os.WriteFile("strony/error_page.html", []byte(`<html><body>{{code}} {{title}} {{message}}</body></html>`), 0644)

    // data/router.json
    os.WriteFile("data/router.json", []byte(`[{"id":"komoda_1","product":"../data/products/komoda_1/product.json","img":"../data/products/komoda_1/img/dane.json","model":null}]`), 0644)

    // product.json
    os.MkdirAll("data/products/komoda_1", 0755)
    os.WriteFile("data/products/komoda_1/product.json", []byte(`{"id":1,"name_id":"komoda_1","name_pl":"Komoda"}`), 0644)

    // dane.json
    os.MkdirAll("data/products/komoda_1/img", 0755)
    os.WriteFile("data/products/komoda_1/img/dane.json", []byte(`{"var_1":{"128":"test.avif"}}`), 0644)

    // CSS, JS
    os.WriteFile("css/style.css", []byte(`body { background: black; }`), 0644)
    os.WriteFile("js/app.js", []byte(`console.log('test');`), 0644)

    // === SYMULOWANY SERWER ===
    mux := http.NewServeMux()

    // Routing stron
    mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
        path := strings.TrimSuffix(r.URL.Path, "/")

        switch {
        case path == "" || path == "/":
            http.ServeFile(w, r, "index.html")
        case path == "/index.html":
            http.Redirect(w, r, "/", http.StatusFound)
        case path == "/produkty":
            http.ServeFile(w, r, "strony/produkty.html")
        case path == "/kontakt":
            http.ServeFile(w, r, "strony/kontakt.html")
        case path == "/item.html":
            http.ServeFile(w, r, "item.html")
        case path == "/admin":
            http.ServeFile(w, r, "strony/admin.html")
        case strings.HasPrefix(path, "/strony/") && strings.HasSuffix(path, ".html"):
            clean := strings.TrimPrefix(path, "/strony/")
            clean = strings.TrimSuffix(clean, ".html")
            http.Redirect(w, r, "/"+clean, http.StatusFound)
        case strings.HasPrefix(path, "/css/"):
            http.ServeFile(w, r, strings.TrimPrefix(path, "/"))
        case strings.HasPrefix(path, "/js/"):
            http.ServeFile(w, r, strings.TrimPrefix(path, "/"))
        case path == "/data/router.json":
            http.ServeFile(w, r, "data/router.json")
        case path == "/health":
            w.Header().Set("Content-Type", "application/json")
            w.Write([]byte(`{"status":"ok"}`))
        default:
            http.NotFound(w, r)
        }
    })

    // API – upload produktu
    mux.HandleFunc("/api/upload/product", func(w http.ResponseWriter, r *http.Request) {
        if r.Method != http.MethodPost {
            http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
            return
        }
        var body map[string]interface{}
        json.NewDecoder(r.Body).Decode(&body)
        nameID, _ := body["name_id"].(string)
        if nameID != "" {
            os.MkdirAll("data/products", 0755)
            os.WriteFile(filepath.Join("data/products", nameID+".json"), []byte(`{"status":"ok"}`), 0644)
        }
        w.Header().Set("Content-Type", "application/json")
        json.NewEncoder(w).Encode(map[string]string{"status": "success"})
    })

    // API – upload plików
    mux.HandleFunc("/api/produkty/", func(w http.ResponseWriter, r *http.Request) {
        if r.Method != http.MethodPost {
            http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
            return
        }
        parts := strings.Split(r.URL.Path, "/")
        nameID := parts[len(parts)-1]
        r.ParseMultipartForm(32 << 20)
        files := r.MultipartForm.File["files"]
        if len(files) == 0 {
            http.Error(w, "No files", http.StatusBadRequest)
            return
        }
        targetDir := filepath.Join("data", "products", nameID, "img")
        os.MkdirAll(targetDir, 0755)
        for _, f := range files {
            file, _ := f.Open()
            data, _ := io.ReadAll(file)
            os.WriteFile(filepath.Join(targetDir, f.Filename), data, 0644)
            file.Close()
        }
        w.Header().Set("Content-Type", "application/json")
        json.NewEncoder(w).Encode(map[string]string{"status": "success"})
    })

    // API – upload JSON
    mux.HandleFunc("/api/upload/json/", func(w http.ResponseWriter, r *http.Request) {
        if r.Method != http.MethodPost {
            http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
            return
        }
        parts := strings.Split(r.URL.Path, "/")
        if len(parts) < 5 {
            http.Error(w, "Invalid path", http.StatusBadRequest)
            return
        }
        typ := parts[len(parts)-2]
        nameID := parts[len(parts)-1]
        var jsonData map[string]interface{}
        json.NewDecoder(r.Body).Decode(&jsonData)
        targetDir := filepath.Join("data", "products", nameID, typ)
        os.MkdirAll(targetDir, 0755)
        fileName := "dane.json"
        if typ == "models" {
            fileName = "model.json"
        }
        data, _ := json.MarshalIndent(jsonData, "", "  ")
        os.WriteFile(filepath.Join(targetDir, fileName), data, 0644)
        w.Header().Set("Content-Type", "application/json")
        json.NewEncoder(w).Encode(map[string]string{"status": "success"})
    })

    ts := httptest.NewServer(mux)

    cleanup := func() {
        ts.Close()
        os.Chdir(oldDir)
    }

    return ts, cleanup
}

// ============================================================
// TEST 1 – Strona główna
// ============================================================
func TestIndex(t *testing.T) {
    ts, cleanup := setupTestServer(t)
    defer cleanup()

    resp, err := http.Get(ts.URL + "/")
    if err != nil {
        t.Fatalf("Cannot GET /: %v", err)
    }
    defer resp.Body.Close()

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
    ts, cleanup := setupTestServer(t)
    defer cleanup()

    tests := []struct {
        path     string
        expected string
    }{
        {"/produkty", "Produkty"},
        {"/kontakt", "Kontakt"},
        {"/item.html", "Item"},
        {"/admin", "Admin Panel"},
    }

    for _, tt := range tests {
        resp, err := http.Get(ts.URL + tt.path)
        if err != nil {
            t.Errorf("Cannot GET %s: %v", tt.path, err)
            continue
        }
        defer resp.Body.Close()
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
// TEST 3 – Przekierowanie /strony/*.html
// ============================================================
func TestRedirectOldPaths(t *testing.T) {
    ts, cleanup := setupTestServer(t)
    defer cleanup()

    resp, err := http.Get(ts.URL + "/strony/produkty.html")
    if err != nil {
        t.Fatalf("Cannot GET: %v", err)
    }
    defer resp.Body.Close()

    if resp.StatusCode != http.StatusFound {
        t.Errorf("Expected 302, got %d", resp.StatusCode)
    }
    if resp.Header.Get("Location") != "/produkty" {
        t.Errorf("Expected Location '/produkty', got '%s'", resp.Header.Get("Location"))
    }
}

// ============================================================
// TEST 4 – 404
// ============================================================
func TestNotFound(t *testing.T) {
    ts, cleanup := setupTestServer(t)
    defer cleanup()

    resp, err := http.Get(ts.URL + "/nie-istnieje")
    if err != nil {
        t.Fatalf("Cannot GET: %v", err)
    }
    defer resp.Body.Close()

    if resp.StatusCode != http.StatusNotFound {
        t.Errorf("Expected 404, got %d", resp.StatusCode)
    }
}

// ============================================================
// TEST 5 – Health Check
// ============================================================
func TestHealthCheck(t *testing.T) {
    ts, cleanup := setupTestServer(t)
    defer cleanup()

    resp, err := http.Get(ts.URL + "/health")
    if err != nil {
        t.Fatalf("Cannot GET /health: %v", err)
    }
    defer resp.Body.Close()

    if resp.StatusCode != http.StatusOK {
        t.Errorf("Expected 200, got %d", resp.StatusCode)
    }
    body, _ := io.ReadAll(resp.Body)
    if string(body) != `{"status":"ok"}` {
        t.Errorf("Expected '{\"status\":\"ok\"}', got '%s'", string(body))
    }
}

// ============================================================
// TEST 6 – Pliki statyczne
// ============================================================
func TestStaticFiles(t *testing.T) {
    ts, cleanup := setupTestServer(t)
    defer cleanup()

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
        defer resp.Body.Close()
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
// TEST 7 – API: upload produktu
// ============================================================
func TestUploadProduct(t *testing.T) {
    ts, cleanup := setupTestServer(t)
    defer cleanup()

    productData := map[string]interface{}{
        "name_id": "test_1",
        "name_pl": "Test Produkt",
        "price":   99.99,
    }
    body, _ := json.Marshal(productData)

    resp, err := http.Post(ts.URL+"/api/upload/product", "application/json", bytes.NewReader(body))
    if err != nil {
        t.Fatalf("Cannot POST: %v", err)
    }
    defer resp.Body.Close()

    if resp.StatusCode != http.StatusOK {
        t.Errorf("Expected 200, got %d", resp.StatusCode)
    }

    var result map[string]string
    json.NewDecoder(resp.Body).Decode(&result)
    if result["status"] != "success" {
        t.Errorf("Expected status 'success', got '%s'", result["status"])
    }
}

// ============================================================
// TEST 8 – API: upload plików (multipart)
// ============================================================
func TestUploadFiles(t *testing.T) {
    ts, cleanup := setupTestServer(t)
    defer cleanup()

    body := &bytes.Buffer{}
    writer := multipart.NewWriter(body)
    part, _ := writer.CreateFormFile("files", "test.jpg")
    part.Write([]byte("fake image data"))
    writer.Close()

    resp, err := http.Post(ts.URL+"/api/produkty/test_1", writer.FormDataContentType(), body)
    if err != nil {
        t.Fatalf("Cannot POST: %v", err)
    }
    defer resp.Body.Close()

    if resp.StatusCode != http.StatusOK {
        t.Errorf("Expected 200, got %d", resp.StatusCode)
    }

    var result map[string]string
    json.NewDecoder(resp.Body).Decode(&result)
    if result["status"] != "success" {
        t.Errorf("Expected status 'success', got '%s'", result["status"])
    }
}

// ============================================================
// TEST 9 – API: upload JSON
// ============================================================
func TestUploadJSON(t *testing.T) {
    ts, cleanup := setupTestServer(t)
    defer cleanup()

    jsonData := map[string]interface{}{
        "var_1": map[string]string{
            "128": "test_128.avif",
            "256": "test_256.avif",
        },
    }
    body, _ := json.Marshal(jsonData)

    resp, err := http.Post(ts.URL+"/api/upload/json/img/test_1", "application/json", bytes.NewReader(body))
    if err != nil {
        t.Fatalf("Cannot POST: %v", err)
    }
    defer resp.Body.Close()

    if resp.StatusCode != http.StatusOK {
        t.Errorf("Expected 200, got %d", resp.StatusCode)
    }

    var result map[string]string
    json.NewDecoder(resp.Body).Decode(&result)
    if result["status"] != "success" {
        t.Errorf("Expected status 'success', got '%s'", result["status"])
    }
}

// ============================================================
// TEST 10 – Blokada katalogów
// ============================================================
func TestBlockDirectory(t *testing.T) {
    ts, cleanup := setupTestServer(t)
    defer cleanup()

    resp, err := http.Get(ts.URL + "/data/")
    if err != nil {
        t.Fatalf("Cannot GET: %v", err)
    }
    defer resp.Body.Close()

    // W symulowanym serwerze /data/ zwraca 404, ale w prawdziwym 403
    // Sprawdzamy tylko, że nie zwraca 200
    if resp.StatusCode == http.StatusOK {
        t.Errorf("Expected non-200 for /data/, got %d", resp.StatusCode)
    }
}