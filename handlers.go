package main

import (
	"encoding/json"
	"io"
	"log"
	"net/http"
	"os"
    "fmt"
//     "net/url"
	"path/filepath"
	"strings"
	"encoding/base64"
	"time"
)

// ============================================================
// 1. UPLOAD PRODUCT (JSON)
// ============================================================
func uploadProductHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var body map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	nameID, ok := body["name_id"].(string)
	if !ok || nameID == "" {
		http.Error(w, "Missing name_id", http.StatusBadRequest)
		return
	}

	// Zapis do data/products/{name_id}.json
	productDir := filepath.Join(".", "data", "products")
	if err := os.MkdirAll(productDir, 0755); err != nil {
		http.Error(w, "Cannot create directory", http.StatusInternalServerError)
		return
	}

	filePath := filepath.Join(productDir, nameID+".json")
	data, err := json.MarshalIndent(body, "", "  ")
	if err != nil {
		http.Error(w, "Cannot marshal JSON", http.StatusInternalServerError)
		return
	}
	if err := os.WriteFile(filePath, data, 0644); err != nil {
		http.Error(w, "Cannot write file", http.StatusInternalServerError)
		return
	}

	// Odśwież router.json
	if err := rebuildRouterJson(); err != nil {
		log.Printf("⚠️ Rebuild router error: %v", err)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "success"})
}

// ============================================================
// 2. UPLOAD FILES (Multipart) - /api/produkty/{nameId}
// ============================================================
func uploadFilesHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Wyciągnij nameId z URL: /api/produkty/komoda_1
	pathParts := strings.Split(r.URL.Path, "/")
	if len(pathParts) < 3 {
		http.Error(w, "Missing nameId", http.StatusBadRequest)
		return
	}
	nameID := pathParts[len(pathParts)-1]

	// Parsuj multipart (max 32MB)
	if err := r.ParseMultipartForm(32 << 20); err != nil {
		http.Error(w, "Cannot parse form", http.StatusBadRequest)
		return
	}

	files := r.MultipartForm.File["files"]
	if len(files) == 0 {
		http.Error(w, "No files", http.StatusBadRequest)
		return
	}

	// Zapisz do data/products/{nameId}/img/
	targetDir := filepath.Join(".", "data", "products", nameID, "img")
	if err := os.MkdirAll(targetDir, 0755); err != nil {
		http.Error(w, "Cannot create directory", http.StatusInternalServerError)
		return
	}

	for _, fileHeader := range files {
		file, err := fileHeader.Open()
		if err != nil {
			log.Printf("⚠️ Cannot open file: %v", err)
			continue
		}
		defer file.Close()

		filePath := filepath.Join(targetDir, fileHeader.Filename)
		out, err := os.Create(filePath)
		if err != nil {
			log.Printf("⚠️ Cannot create file: %v", err)
			continue
		}
		defer out.Close()

		if _, err := io.Copy(out, file); err != nil {
			log.Printf("⚠️ Cannot copy file: %v", err)
			continue
		}
	}

	log.Printf("📁 Saved files to %s", targetDir)

	// Synchronizuj z Rustem
	if err := syncProductData(nameID); err != nil {
		log.Printf("⚠️ Sync error: %v", err)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "success"})
}

// ============================================================
// 3. UPLOAD JSON - /api/upload/json/{typ}/{nameId}
// ============================================================
func uploadJSONHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Wyciągnij parametry: /api/upload/json/img/komoda_1
	pathParts := strings.Split(r.URL.Path, "/")
	if len(pathParts) < 5 {
		http.Error(w, "Invalid path", http.StatusBadRequest)
		return
	}
	typ := pathParts[len(pathParts)-2]   // "img" lub "models"
	nameID := pathParts[len(pathParts)-1] // "komoda_1"

	var jsonData map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&jsonData); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	// 1. Usuń product_id
	delete(jsonData, "product_id")

	// 2. Popraw ścieżki (rekurencyjnie)
	fixPaths(jsonData, nameID, typ)

	// 3. Zapis
	targetDir := filepath.Join(".", "data", "products", nameID, typ)
	if err := os.MkdirAll(targetDir, 0755); err != nil {
		http.Error(w, "Cannot create directory", http.StatusInternalServerError)
		return
	}

	fileName := "dane.json"
	if typ == "models" {
		fileName = "model.json"
	}
	filePath := filepath.Join(targetDir, fileName)

	data, err := json.MarshalIndent(jsonData, "", "  ")
	if err != nil {
		http.Error(w, "Cannot marshal JSON", http.StatusInternalServerError)
		return
	}
	if err := os.WriteFile(filePath, data, 0644); err != nil {
		http.Error(w, "Cannot write file", http.StatusInternalServerError)
		return
	}

	// Synchronizuj
	if err := syncProductData(nameID); err != nil {
		log.Printf("⚠️ Sync error: %v", err)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "success"})
}

// ============================================================
// 4. ROUTING STRON
// ============================================================
func handlePages(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
	w.Header().Set("Pragma", "no-cache")
	w.Header().Set("Expires", "0")

	path := strings.TrimSuffix(r.URL.Path, "/")
	query := r.URL.RawQuery
	log.Printf("📥 Request: %s (query: %s)", path, query)

    // ============================================
    // 🔐 AUTORYZACJA DLA CHRONIONYCH ŚCIEŻEK
    // ============================================
    protectedPaths := map[string][]string{
        "/admin":      {"Admin"},
        "/admin/":     {"Admin"},
        "/user_page":  {"Admin", "User", "Legituser"},
        "/user_page/": {"Admin", "User", "Legituser"},
        "/email":      {"Admin", "Legituser"},
        "/email/":     {"Admin", "Legituser"},
        "/dashboard":  {"Admin", "User", "Legituser"},
        "/dashboard/": {"Admin", "User", "Legituser"},
        "/strony/admin":      {"Admin"},
        "/strony/admin/":     {"Admin"},
        "/strony/user_page":  {"Admin", "User", "Legituser"},
        "/strony/user_page/": {"Admin", "User", "Legituser"},
        "/strony/email":      {"Admin", "Legituser"},
        "/strony/email/":     {"Admin", "Legituser"},
        "/strony/dashboard":  {"Admin", "User", "Legituser"},
        "/strony/dashboard/": {"Admin", "User", "Legituser"},
        // dodaj inne chronione ścieżki
    }

    for protectedPath, allowedRoles := range protectedPaths {
        if strings.HasPrefix(path, protectedPath) {
            log.Printf("🔐 Path '%s' matched protected: %s", path, protectedPath)
            if !checkUserRole(r, allowedRoles...) {
                log.Printf("🚫 Access denied for %s", path)
                serveErrorPage(w, r, http.StatusForbidden, "Brak uprawnień", "Nie masz wystarczających uprawnień do tej strony.")
                return
            }
            log.Printf("✅ Access granted for %s", path)
            break
        }
    }

	// Stare ścieżki /strony/*.html → przekierowanie
	if strings.HasPrefix(path, "/strony/") && strings.HasSuffix(path, ".html") {
    log.Printf("🔄 Redirecting old path: %s", path) // <-- BEZ cleanPath
        cleanPath := strings.TrimPrefix(path, "/strony/")
		cleanPath = strings.TrimSuffix(cleanPath, ".html")
		newURL := "/" + cleanPath
		if query != "" {
			newURL += "?" + query
		}
		http.Redirect(w, r, newURL, http.StatusFound)
		return
	}

	// Index
	if path == "" || path == "/" {
		http.ServeFile(w, r, "./index.html")
		return
	}
	if path == "/index.html" {
		http.Redirect(w, r, "/", http.StatusFound)
		return
	}

	// Jeśli .html – serwuj z głównego lub z ./strony/
	if strings.HasSuffix(path, ".html") {
		// Sprawdź w głównym katalogu
		filePath := "." + path
		    log.Printf("📄 Checking file: %s", filePath) // DODAJ
		if _, err := os.Stat(filePath); err == nil {
		        log.Printf("✅ Serving file: %s", filePath)
			http.ServeFile(w, r, filePath)
			return
		}
		// Sprawdź w ./strony/
		filePath = filepath.Join(".", "strony", strings.TrimPrefix(path, "/"))
		    log.Printf("📄 Checking file: %s", filePath) // DODAJ
		if _, err := os.Stat(filePath); err == nil {
		        log.Printf("✅ Serving file: %s", filePath)
			http.ServeFile(w, r, filePath)
			return
		}
        log.Printf("❌ File not found: %s", filePath)
        // Plik .html nie istnieje → 404
        serveErrorPage(w, r, http.StatusNotFound, "Nie znaleziono strony", "Plik '" + path + "' nie istnieje.")
        return
	}

	// Dynamiczne mapowanie: /produkty → ./strony/produkty.html
	htmlPath := filepath.Join(".", "strony", path+".html")
	if _, err := os.Stat(htmlPath); err == nil {
		http.ServeFile(w, r, htmlPath)
		return
	}

    // Plik z rozszerzeniem → 404
    if strings.Contains(path, ".") {
        serveErrorPage(w, r, http.StatusNotFound, "Nie znaleziono pliku", "Plik '" + path + "' nie istnieje.")
        return
    }

	// SPA fallback
    // 	http.ServeFile(w, r, "./index.html")
    // Wszystko inne → 404
    serveErrorPage(w, r, http.StatusNotFound, "Nie znaleziono strony", "Strona '" + path + "' nie istnieje.")
}

// ============================================================
// 5. WEBSOCKET
// ============================================================
func handleWebSocket(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Print("Upgrade error:", err)
		return
	}
	defer conn.Close()

	for {
		msgType, msg, err := conn.ReadMessage()
		if err != nil {
			break
		}
		log.Printf("Received: %s", msg)
		if err := conn.WriteMessage(msgType, msg); err != nil {
			break
		}
	}
}

// ============================================================
// 6. Pomocnicze - fixPaths
// ============================================================
func fixPaths(obj map[string]interface{}, nameID, typ string) {
	for key, val := range obj {
		switch v := val.(type) {
		case string:
			if strings.Contains(v, "src/api/products/") {
				// Zamiana: src/api/products/{nameId}/(images|models)/ → ../data/products/{nameId}/{typ}/
				obj[key] = strings.Replace(v, "src/api/products/", "../data/products/", 1)
				// Dodatkowo poprawiamy podfoldery
				obj[key] = strings.Replace(obj[key].(string), "/images/", "/"+typ+"/", 1)
				obj[key] = strings.Replace(obj[key].(string), "/models/", "/"+typ+"/", 1)
			}
		case map[string]interface{}:
			fixPaths(v, nameID, typ)
		case []interface{}:
			for _, item := range v {
				if m, ok := item.(map[string]interface{}); ok {
					fixPaths(m, nameID, typ)
				}
			}
		}
	}
}

// ============================================================
// 7. JWT AUTORYZACJA
// ============================================================

// Struktura JWT (dopasuj do swojego Rusta)
type JWTClaims struct {
    Sub  int64 `json:"sub"`
    Role string `json:"role"`
    Exp  int64  `json:"exp"`
}

// Weryfikacja JWT (BEZ sprawdzania podpisu – zakładam, że robi to Rust)
func verifyJWT(tokenString string) (*JWTClaims, error) {
    log.Printf("🔐 Verifying JWT token (length: %d)", len(tokenString))

    parts := strings.Split(tokenString, ".")
    if len(parts) != 3 {
        log.Printf("❌ Invalid token format: expected 3 parts, got %d", len(parts))
        return nil, fmt.Errorf("invalid token format")
    }

    payload, err := base64.RawURLEncoding.DecodeString(parts[1])
    if err != nil {
        log.Printf("❌ Failed to decode payload: %v", err)
        return nil, err
    }

    var claims JWTClaims
    if err := json.Unmarshal(payload, &claims); err != nil {
        log.Printf("❌ Failed to unmarshal claims: %v", err)
        return nil, err
    }

    log.Printf("✅ JWT: sub=%d, role=%s, exp=%d", claims.Sub, claims.Role, claims.Exp)

    if claims.Exp > 0 && claims.Exp < time.Now().Unix() {
        log.Printf("❌ Token expired: exp=%d, now=%d", claims.Exp, time.Now().Unix())
        return nil, fmt.Errorf("token expired")
    }

    log.Printf("✅ Token valid for user: %s (role: %s)", claims.Sub, claims.Role)
    return &claims, nil
}

// Pobierz JWT z ciasteczek
func getJWTFromCookie(r *http.Request) string {
    cookie, err := r.Cookie("token")
    if err != nil {
        log.Printf("🍪 Cookie 'token' not found: %v", err)
        cookie, err = r.Cookie("jwt")
        if err != nil {
            log.Printf("🍪 Cookie 'jwt' not found: %v", err)
            return ""
        }
    }
    log.Printf("🍪 Cookie found: token=%s... (length: %d)", cookie.Value[:min(20, len(cookie.Value))], len(cookie.Value))
    return cookie.Value
}

// Pobierz JWT z nagłówka Authorization
func getJWTFromHeader(r *http.Request) string {
    auth := r.Header.Get("Authorization")
    if strings.HasPrefix(auth, "Bearer ") {
        return strings.TrimPrefix(auth, "Bearer ")
    }
    return ""
}

// Middleware do sprawdzania autoryzacji
func authMiddleware(allowedRoles ...string) func(http.Handler) http.Handler {
    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {

            log.Printf("🔐 [Middleware] Path: %s, Roles: %v", r.URL.Path, allowedRoles)

            // Pobierz token
            token := getJWTFromCookie(r)
            if token == "" {
                token = getJWTFromHeader(r)
            }

            if token == "" {
                serveErrorPage(w, r, http.StatusForbidden, "Brak autoryzacji", "Musisz być zalogowany, aby uzyskać dostęp do tej strony.")
                return
            }

            // Zweryfikuj token
            claims, err := verifyJWT(token)
            if err != nil {
                serveErrorPage(w, r, http.StatusForbidden, "Nieprawidłowy token", "Twój token jest nieprawidłowy lub wygasł.")
                return
            }
                    log.Printf("👤 [Middleware] User: %s, Role: %s", claims.Sub, claims.Role)

            // Sprawdź rolę
            if len(allowedRoles) > 0 {
                roleOk := false
                for _, role := range allowedRoles {
                    if claims.Role == role {
                        roleOk = true
                        break
                    }
                }
                if !roleOk {
                                    log.Printf("🚫 [Middleware] Role '%s' not allowed: %v", claims.Role, allowedRoles)
                    serveErrorPage(w, r, http.StatusForbidden, "Brak uprawnień", "Nie masz wystarczających uprawnień do tej strony.")
                    return
                }
            }
            log.Printf("✅ [Middleware] Access granted for %s", r.URL.Path)
            // Przekaż dalej
            next.ServeHTTP(w, r)
        })
    }
}
// ============================================================
// 8. AUTORYZACJA – ROLE Z JWT
// ============================================================

// Sprawdza, czy użytkownik ma odpowiednią rolę (Admin, User, Legituser)
func checkUserRole(r *http.Request, allowedRoles ...string) bool {
    log.Printf("🔐 Checking user role for path: %s", r.URL.Path)

    token := getJWTFromCookie(r)
    if token == "" {
        log.Printf("❌ No token found in cookies")
        return false
    }

    claims, err := verifyJWT(token)
    if err != nil {
        log.Printf("❌ JWT verification failed: %v", err)
        return false
    }

    log.Printf("👤 User: %s, Role: %s", claims.Sub, claims.Role)
    log.Printf("📋 Allowed roles: %v", allowedRoles)

    for _, role := range allowedRoles {
        if claims.Role == role {
            log.Printf("✅ Role matched: %s", role)
            return true
        }
    }

    log.Printf("❌ Role '%s' not in allowed list: %v", claims.Role, allowedRoles)
    return false
}

// func serveErrorPage(w http.ResponseWriter, r *http.Request, statusCode int, title, message string) {
//     w.WriteHeader(statusCode)
//
//     // Jeśli to żądanie AJAX/fetch – zwróć JSON z błędem
//     if r.Header.Get("X-Requested-With") == "XMLHttpRequest" ||
//        strings.Contains(r.Header.Get("Accept"), "application/json") {
//         w.Header().Set("Content-Type", "application/json")
//         json.NewEncoder(w).Encode(map[string]interface{}{
//             "error":   true,
//             "status":  statusCode,
//             "message": message,
//         })
//         return
//     }
//
//     // W przeciwnym razie – serwuj HTML
//     errorPage := "./strony/error_page.html"
//
//     // Jeśli plik istnieje – serwuj go z przekazaniem parametrów
//     if _, err := os.Stat(errorPage); err == nil {
//         // Przekieruj z parametrami w URL
//         targetURL := "/strony/error_page.html?code=" + fmt.Sprintf("%d", statusCode) +
//                      "&title=" + url.QueryEscape(title) +
//                      "&message=" + url.QueryEscape(message)
//         http.Redirect(w, r, targetURL, http.StatusFound)
//         return
//     }
//
//     // Fallback – prosta wiadomość tekstowa
//     http.Error(w, fmt.Sprintf("%d %s: %s", statusCode, title, message), statusCode)
// }

func serveErrorPage(w http.ResponseWriter, r *http.Request, statusCode int, title, message string) {
    w.WriteHeader(statusCode)

    // Jeśli to żądanie AJAX/fetch – zwróć JSON z błędem
    if r.Header.Get("X-Requested-With") == "XMLHttpRequest" ||
       strings.Contains(r.Header.Get("Accept"), "application/json") {
        w.Header().Set("Content-Type", "application/json")
        json.NewEncoder(w).Encode(map[string]interface{}{
            "error":   true,
            "status":  statusCode,
            "message": message,
        })
        return
    }

    // Serwuj error_page.html BEZ przekierowania
    errorPage := "./strony/error_page.html"
    if _, err := os.Stat(errorPage); err == nil {
        content, err := os.ReadFile(errorPage)
        if err == nil {
            html := string(content)
            // Zastąp zmienne w HTML ({{code}}, {{title}}, {{message}})
            html = strings.ReplaceAll(html, "{{code}}", fmt.Sprintf("%d", statusCode))
            html = strings.ReplaceAll(html, "{{title}}", title)
            html = strings.ReplaceAll(html, "{{message}}", message)
            w.Header().Set("Content-Type", "text/html; charset=utf-8")
            w.Write([]byte(html))
            return
        }
    }

    // Fallback – prosta wiadomość tekstowa
    http.Error(w, fmt.Sprintf("%d %s: %s", statusCode, title, message), statusCode)
}