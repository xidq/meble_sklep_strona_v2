package main

//handlers.go
import (
	"bytes"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/gorilla/websocket"
	//     "time"
)

// Globalny klient HTTP z ignorowaniem certyfikatu
var insecureHTTPClient = &http.Client{
	Transport: &http.Transport{
		TLSClientConfig: &tls.Config{
			InsecureSkipVerify: true, // Tylko dla self-signed
		},
	},
}

// Globalny dialer WebSocket z ignorowaniem certyfikatu
var insecureWSDialer = websocket.Dialer{
	TLSClientConfig: &tls.Config{
		InsecureSkipVerify: true,
	},
}

// JWTClaims zgodny z backend
type JWTClaims struct {
	Sub      int64  `json:"sub"`
	Username string `json:"username,omitempty"`
	Role     string `json:"role"`
	Exp      int64  `json:"exp"`
}

// Implementacja interfejsu jwt.Claims
func (c JWTClaims) GetExpirationTime() (*jwt.NumericDate, error) {
	return jwt.NewNumericDate(time.Unix(c.Exp, 0)), nil
}
func (c JWTClaims) GetIssuedAt() (*jwt.NumericDate, error) {
	return nil, nil
}
func (c JWTClaims) GetNotBefore() (*jwt.NumericDate, error) {
	return nil, nil
}
func (c JWTClaims) GetIssuer() (string, error) {
	return "", nil
}
func (c JWTClaims) GetSubject() (string, error) {
	return "", nil
}
func (c JWTClaims) GetAudience() (jwt.ClaimStrings, error) {
	return nil, nil
}

var config *Config

// Dozwolone rozszerzenia
//var allowedExtensions = map[string]bool{
//	".glb":  true,
//	".gltf": true,
//	".png":  true,
//	".jpg":  true,
//	".jpeg": true,
//	".webp": true,
//	".avif": true,
//	".json": true,
//	".dds":  true,
//}

type ProductCache struct {
	sync.RWMutex
	data      []byte
	timestamp time.Time
}

var productCache = &ProductCache{}

const cacheTTL = 5 * time.Minute

func putNewUserOrder(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	// Dodane r.Method i nil dla custom payloadu
	forwardToRust(w, r, r.Method, "/api/order", true, nil)
}
func getUserOwnOrders(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	// Dodane r.Method i nil dla custom payloadu
	forwardToRust(w, r, r.Method, "/usr/self/orders", true, nil)
}
func userAccountOperations(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet && r.Method != http.MethodPut && r.Method != http.MethodDelete {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	// Tutaj wywalało błąd przez próbę przesłania 5 argumentów. Teraz pasuje.[cite: 1]
	forwardToRust(w, r, r.Method, "/usr/usr", true, nil)
}
func getUserOwnData(w http.ResponseWriter, r *http.Request) {
	// sprawdza, czy metoda to GET
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// pobiera token JWT z ciasteczka
	token := getJWTFromCookie(r)
	if token == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// ogarnia żądanie do serwera Rust
	baseURL := "https://" + config.RustHost + ":" + config.RustPort + "/usr/self/data"
	req, err := http.NewRequest(http.MethodGet, baseURL, nil)
	if err != nil {
		http.Error(w, "Failed to create request", http.StatusInternalServerError)
		return
	}

	// Przekaż token w nagłówku Authorization
	req.Header.Set("Authorization", "Bearer "+token)

	// Wykonaj żądanie używając Twojego globalnego klienta (insecure)
	resp, err := insecureHTTPClient.Do(req)
	if err != nil {
		log.Printf("Error calling Rust user data: %v", err)
		http.Error(w, "Backend unavailable", http.StatusBadGateway)
		return
	}
	defer func(Body io.ReadCloser) {
		err := Body.Close()
		if err != nil {
			log.Printf("Error closing response body: %v", err)
		}
	}(resp.Body)

	// Przekaż nagłówki i status odpowiedzi z Rusta
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(resp.StatusCode)

	// Przekaż ciało odpowiedzi (dane użytkownika z Rusta)
	if _, err := io.Copy(w, resp.Body); err != nil {
		log.Printf("Error copying response body: %v", err)
		return
	}
}

//	func getProductsCachedProxyHandler(w http.ResponseWriter, r *http.Request) {
//		// Cache stosujemy głównie do zapytań GET pobierających listę/produkty
//		if r.Method == http.MethodGet {
//			productCache.RLock()
//			isFresh := time.Since(productCache.timestamp) < cacheTTL && len(productCache.data) > 0
//			if isFresh {
//				data := productCache.data
//				productCache.RUnlock()
//				w.Header().Set("Content-Type", "application/json")
//				w.Header().Set("X-Cache", "HIT")
//				w.Write(data)
//				return
//			}
//			productCache.RUnlock()
//		}
//
//		// Jeśli cache wygasł lub to metoda modyfikująca (POST/PUT/DELETE):
//		// Wykonujemy standardowe żądanie do Rusta (tak jak w Twoim getProductsProxyHandler)
//		// ... (tutaj kod strzelający do Rusta i przypisujący odpowiedź do 'respBody') ...
//
//		// Jeśli to był udany GET, zapisujemy do cache'u
//		if r.Method == http.MethodGet && resp.StatusCode == http.StatusOK {
//			productCache.Lock()
//			productCache.data = respBody
//			productCache.timestamp = time.Now()
//			productCache.Unlock()
//		}
//
//		// Jeśli to POST, PUT lub DELETE (edycja/dodanie produktu), AUTOMATYCZNIE czyścimy cache:
//		if r.Method == http.MethodPost || r.Method == http.MethodPut || r.Method == http.MethodDelete {
//			productCache.Lock()
//			productCache.data = nil
//			productCache.timestamp = time.Time{}
//			productCache.Unlock()
//		}
//	}
//
// adminUsersProxyHandler obsługuje zapytania do zarządzania użytkownikami z panelu admina
func adminUsersProxyHandler(w http.ResponseWriter, r *http.Request) {
	// r.URL.Path będzie wynosić np. "/admin/usr" lub "/admin/usr/Janusz"
	// Przekazujemy dokładnie tę samą ścieżkę do Rusta
	//baseURL := "/admin/usr"
	// requiresAuth = true, customPayload = nil
	targetPath := strings.Replace(r.URL.Path, "/api/admin", "/admin", 1)
	forwardToRust(w, r, r.Method, targetPath, true, nil)
}
func adminResponseCheckProxyHandler(w http.ResponseWriter, r *http.Request) {
	// r.URL.Path będzie wynosić np. "/admin/usr" lub "/admin/usr/Janusz"
	// Przekazujemy dokładnie tę samą ścieżkę do Rusta
	//baseURL := "/admin/usr"
	// requiresAuth = true, customPayload = nil
	targetPath := strings.TrimPrefix(r.URL.Path, "/api/admin/check_response")

	forwardToRust(w, r, r.Method, targetPath, true, nil)
}
func getProductsProxyHandler(w http.ResponseWriter, r *http.Request) {
	// 1. Sprawdzanie cache dla GET
	if r.Method == http.MethodGet {
		productCache.RLock()
		isFresh := time.Since(productCache.timestamp) < cacheTTL && len(productCache.data) > 0
		if isFresh {
			data := productCache.data
			productCache.RUnlock()
			w.Header().Set("Content-Type", "application/json")
			w.Header().Set("X-Cache", "HIT")
			if _, err := w.Write(data); err != nil {
				log.Printf("Error w.Write isFresh getting products proxy handler: %v", err)
				return
			}
			return
		}
		productCache.RUnlock()
	}

	// 2. Przygotowanie URL do Rusta
	baseURL := "https://" + config.RustHost + ":" + config.RustPort + "/api/products"

	// Dla PUT i DELETE wyciągamy ID ze ścieżki (np. /api/products/123)
	if r.Method == http.MethodPut || r.Method == http.MethodDelete {
		pathParts := strings.Split(r.URL.Path, "/")
		if len(pathParts) > 0 {
			id := pathParts[len(pathParts)-1]
			if id != "" && id != "products" && id != "api" {
				baseURL += "/" + id
			}
		}
	}

	if r.URL.RawQuery != "" {
		baseURL += "?" + r.URL.RawQuery
	}

	// 3. Przygotowanie i wysłanie żądania do backendu
	req, err := http.NewRequest(r.Method, baseURL, r.Body)
	if err != nil {
		http.Error(w, "Failed to create request", http.StatusInternalServerError)
		return
	}

	req.Header = r.Header.Clone()
	req.Header.Del("Host")

	resp, err := insecureHTTPClient.Do(req)
	if err != nil {
		log.Printf("Products proxy error: %v", err)
		http.Error(w, "Backend unavailable", http.StatusBadGateway)
		return
	}
	defer func(Body io.ReadCloser) {
		err := Body.Close()
		if err != nil {
			log.Printf("Error closing response body: %v", err)
		}
	}(resp.Body)

	// 4. Odczytanie całego body do pamięci (potrzebne, aby zapisać w cache)
	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		log.Printf("Error reading response body: %v", err)
		http.Error(w, "Error reading response", http.StatusInternalServerError)
		return
	}

	// 5. Aktualizacja Cache
	if r.Method == http.MethodGet && resp.StatusCode == http.StatusOK {
		// Pomyślny GET -> zapisujemy do cache
		productCache.Lock()
		productCache.data = respBody
		productCache.timestamp = time.Now()
		productCache.Unlock()
	} else if r.Method == http.MethodPost || r.Method == http.MethodPut || r.Method == http.MethodDelete {
		// Modyfikacja -> natychmiastowe ubicie cache
		productCache.Lock()
		productCache.data = nil
		productCache.timestamp = time.Time{}
		productCache.Unlock()
	}

	// 6. Wysłanie odpowiedzi do klienta
	for key, values := range resp.Header {
		for _, value := range values {
			w.Header().Add(key, value)
		}
	}
	w.WriteHeader(resp.StatusCode)
	//w.Write(respBody)
	if _, err := w.Write(respBody); err != nil {
		log.Printf("Error w.Write getting products proxy handler: %v", err)
		return
	}
}

//func getProductsProxyHandler(w http.ResponseWriter, r *http.Request) {
//	// buduje bazowy URL do backendu Rusta
//	baseURL := "https://" + config.RustHost + ":" + config.RustPort + "/api/products"
//
//	// Dla PUT – dodajemy ID z URL do ścieżki
//	if r.Method == http.MethodPut {
//		// Wyciągamy ID ze ścieżki: /api/products/123
//		pathParts := strings.Split(r.URL.Path, "/")
//		if len(pathParts) < 3 {
//			http.Error(w, "Missing product ID", http.StatusBadRequest)
//			return
//		}
//		id := pathParts[len(pathParts)-1]
//		if id == "" {
//			http.Error(w, "Invalid product ID", http.StatusBadRequest)
//			return
//		}
//		baseURL += "/" + id
//	}
//
//	// Dodajemy query string, jeśli istnieje
//	if r.URL.RawQuery != "" {
//		baseURL += "?" + r.URL.RawQuery
//	}
//
//	// tworzy nowe żądanie do Rusta
//	req, err := http.NewRequest(r.Method, baseURL, r.Body)
//	if err != nil {
//		http.Error(w, "Failed to create request", http.StatusInternalServerError)
//		return
//	}
//
//	// Kopiujemy wszystkie nagłówki (ważne: ciasteczka, Content-Type, autoryzacja)
//	req.Header = r.Header.Clone()
//	req.Header.Del("Host") // usuwamy, bo może być niepoprawny
//
//	// Wykonaj żądanie do Rusta
//	resp, err := insecureHTTPClient.Do(req)
//	if err != nil {
//		log.Printf("Products proxy error: %v", err)
//		http.Error(w, "Backend unavailable", http.StatusBadGateway)
//		return
//	}
//	defer resp.Body.Close()
//
//	// Kopiuj nagłówki odpowiedzi
//	for key, values := range resp.Header {
//		for _, value := range values {
//			w.Header().Add(key, value)
//		}
//	}
//
//	// Ustaw kod statusu
//	w.WriteHeader(resp.StatusCode)
//
//	// Kopiuj ciało odpowiedzi
//	if _, err := io.Copy(w, resp.Body); err != nil {
//		log.Printf("Error copying response body: %v", err)
//		return
//	}
//}

// UPLOAD FILES (Multipart) /api/produkty/{nameId}
// śle na serwer drugi pliki i dobiera
func getProductByNameIdProxyHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Wyciągamy name_id ze ścieżki (np. z "/api/products/by-name/biurko_1" dostajemy "biurko_1")
	nameID := strings.TrimPrefix(r.URL.Path, "/api/products/by-name/")
	if nameID == "" {
		http.Error(w, "Missing product name_id", http.StatusBadRequest)
		return
	}

	// buduje bezpośredni adres do Rusta na Twój endpoint obsługujący name_id
	baseURL := fmt.Sprintf("https://%s:%s/api/products/name_id/%s", config.RustHost, config.RustPort, nameID)

	// tworzy żądanie do Rusta
	req, err := http.NewRequest(r.Method, baseURL, r.Body)
	if err != nil {
		http.Error(w, "Failed to create request", http.StatusInternalServerError)
		return
	}

	// Kopiujemy nagłówki
	req.Header = r.Header.Clone()
	req.Header.Del("Host")

	// wykonuje zapytanie do Rusta
	resp, err := insecureHTTPClient.Do(req)
	if err != nil {
		log.Printf("Product by name_id proxy error: %v", err)
		http.Error(w, "Backend unavailable", http.StatusBadGateway)
		return
	}
	defer func(Body io.ReadCloser) {
		err := Body.Close()
		if err != nil {
			log.Printf("Error closing response body: %v", err)
		}
	}(resp.Body)

	// Kopiujemy nagłówki i ciało odpowiedzi do przeglądarki
	for key, values := range resp.Header {
		for _, value := range values {
			w.Header().Add(key, value)
		}
	}
	w.WriteHeader(resp.StatusCode)
	if _, err := io.Copy(w, resp.Body); err != nil {
		log.Printf("Error copying response body: %v", err)
		return
	}
}

//	func proxyProducts(w http.ResponseWriter, r *http.Request) {
//		// Zamienia np. /api/products/123 na /api/products/123 w locie[cite: 1]
//		path := strings.TrimPrefix(r.URL.Path, "/api/products")
//		forwardToRust(w, r, r.Method, "/api/products"+path, false, nil)
//	}
//
//	func uploadFilesHandler(w http.ResponseWriter, r *http.Request) {
//		if r.Method != http.MethodPost {
//			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
//			return
//		}
//
//		// Parsujemy formularz wieloczęściowy, żeby móc sprawdzić przesyłane pliki
//		if err := r.ParseMultipartForm(800 << 20); err != nil {
//			http.Error(w, "Failed to parse multipart form", http.StatusBadRequest)
//			return
//		}
//
//		if r.MultipartForm != nil && r.MultipartForm.File != nil {
//			for _, files := range r.MultipartForm.File {
//				for _, fileHeader := range files {
//					ext := strings.ToLower(filepath.Ext(fileHeader.Filename))
//					if !allowedExtensions[ext] {
//						http.Error(w, fmt.Sprintf("Niedozwolone rozszerzenie pliku: %s", ext), http.StatusBadRequest)
//						return
//					}
//				}
//			}
//		}
//
//		nameID := filepath.Base(r.URL.Path)
//		forwardToRust(w, r, r.Method, "/api/images/upload/"+nameID, true, nil)
//	}
//
//	func uploadFilesHandler(w http.ResponseWriter, r *http.Request) {
//		if r.Method != http.MethodPost {
//			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
//			return
//		}
//
//		// USUŃ CAŁY BLOK Z r.ParseMultipartForm ORAZ WERYFIKACJĄ ROZSZERZEŃ!
//		// Pozwala to zostawić r.Body nienaruszone jako aktywny strumień.
//
//		nameID := filepath.Base(r.URL.Path)
//		forwardToRust(w, r, r.Method, "/api/images/upload/"+nameID, true, nil)
//	}
func uploadFilesHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// r.URL.Path np: "/api/admin/models/biurko_1" lub "/api/admin/images/biurko_1"
	parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	if len(parts) < 3 {
		http.Error(w, "Invalid path", http.StatusBadRequest)
		return
	}

	category := parts[len(parts)-2] // "models", "images" lub "produkty"
	nameID := parts[len(parts)-1]   // name_id

	// Mapowanie dla bezpieczeństwa
	rustTargetCategory := "images"
	if category == "models" {
		rustTargetCategory = "models"
	}

	targetRustPath := fmt.Sprintf("/api/%s/upload/%s", rustTargetCategory, nameID)
	forwardToRust(w, r, r.Method, targetRustPath, true, nil)
}

// ROUTING STRON
//
//	func handlePages(w http.ResponseWriter, r *http.Request) {
//		cfg := config
//		pathq := strings.TrimSuffix(r.URL.Path, "/")
//		query := r.URL.RawQuery
//		log.Printf("handlePages: path=%s, query=%s", pathq, query)
//		// 	w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
//		// 	w.Header().Set("Pragma", "no-cache")
//		// 	w.Header().Set("Expires", "0")
//		pathh := r.URL.Path
//
//		// Jeśli to plik statyczny, dajemy agresywny cache na rok!
//		if isStaticFile(pathh) {
//			w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
//			// Usuwamy nagłówki blokujące cache, jeśli mogły być ustawione wcześniej
//			w.Header().Del("Pragma")
//			w.Header().Del("Expires")
//		} else {
//			// Dla zwykłych podstron HTML blokujemy cache, tak jak miałeś dotychczas
//			w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
//			w.Header().Set("Pragma", "no-cache")
//			w.Header().Set("Expires", "0")
//		}
//
//		path := strings.TrimSuffix(r.URL.Path, "/")
//		// 	query := r.URL.RawQuery
//		log.Printf("Request: %s (query: %s)", path, query)
//
//		// AUTORYZACJA DLA CHRONIONYCH ŚCIEŻEK
//		protectedPaths := map[string][]string{
//			"/admin":             {"Admin"},
//			"/admin/":            {"Admin"},
//			"/user_page":         {"Admin", "User", "Legituser"},
//			"/user_page/":        {"Admin", "User", "Legituser"},
//			"/email":             {"Admin", "Legituser"}, //prroblem gdzies indziej
//			"/email/":            {"Admin", "Legituser"},
//			"/dashboard":         {"Admin", "User", "Legituser"},
//			"/dashboard/":        {"Admin", "User", "Legituser"},
//			"/strony/admin":      {"Admin"},
//			"/strony/admin/":     {"Admin"},
//			"/strony/user_page":  {"Admin", "User", "Legituser"},
//			"/strony/user_page/": {"Admin", "User", "Legituser"},
//			"/strony/email":      {"Admin", "Legituser"},
//			"/strony/email/":     {"Admin", "Legituser"},
//			"/strony/dashboard":  {"Admin", "User", "Legituser"},
//			"/strony/dashboard/": {"Admin", "User", "Legituser"},
//		}
//
//		for protectedPath, allowedRoles := range protectedPaths {
//			log.Printf("protecpath: %s (allowed roles: %s)", protectedPath, allowedRoles)
//			if strings.HasPrefix(path, protectedPath) {
//				log.Printf("Path '%s' matched protected: %s", path, protectedPath)
//				if !checkUserRole(r, allowedRoles...) {
//					log.Printf("Access denied for %s", path)
//					serveErrorPage(w, r, http.StatusForbidden, "Brak uprawnień", "Nie masz wystarczających uprawnień do tej strony.")
//					return
//				}
//				log.Printf("Access granted for %s", path)
//				break
//			}
//		}
//
//		// Stare ścieżki /strony/*.html -> przekierowanie
//		if strings.HasPrefix(path, "/strony/") && strings.HasSuffix(path, ".html") {
//			log.Printf("Redirecting old path: %s", path)
//			cleanPath := strings.TrimPrefix(path, "/strony/")
//			cleanPath = strings.TrimSuffix(cleanPath, ".html")
//			newURL := "/" + cleanPath
//			if query != "" {
//				newURL += "?" + query
//			}
//			http.Redirect(w, r, newURL, http.StatusFound)
//			return
//		}
//
//		if path == "" || path == "/" {
//			http.ServeFile(w, r, filepath.Join(cfg.StaticDir, "index.html"))
//			return
//		}
//		if path == "/index.html" {
//			http.Redirect(w, r, "/", http.StatusFound)
//			return
//		}
//
//		// Jeśli .html – serwuj z głównego lub z ./strony/
//		if strings.HasSuffix(path, ".html") {
//			// sprawdza w głównym katalogu
//			filePath := filepath.Join(cfg.StaticDir, strings.TrimPrefix(path, "/"))
//			log.Printf("Checking file: %s", filePath)
//			if _, err := os.Stat(filePath); err == nil {
//				log.Printf("Serving file: %s", filePath)
//				http.ServeFile(w, r, filePath)
//				return
//			}
//			// sprawdza w ./strony/
//			filePath = filepath.Join(cfg.PagesDir, strings.TrimPrefix(path, "/"))
//			log.Printf("Checking file: %s", filePath)
//			if _, err := os.Stat(filePath); err == nil {
//				log.Printf("Serving file: %s", filePath)
//				http.ServeFile(w, r, filePath)
//				return
//			}
//			//         log.Printf("File not found: %s", filePath)
//			//         Plik .html nie istnieje -> 404
//			serveErrorPage(w, r, http.StatusNotFound, "Nie znaleziono strony", "Plik '"+path+"' nie istnieje.")
//			return
//		}
//
//		// Dynamiczne mapowanie: /produkty -> ./strony/produkty.html
//		htmlPath := filepath.Join(cfg.PagesDir, path+".html")
//		if _, err := os.Stat(htmlPath); err == nil {
//			http.ServeFile(w, r, htmlPath)
//			return
//		}
//
//		// Plik z rozszerzeniem -> 404
//		if strings.Contains(path, ".") {
//			serveErrorPage(w, r, http.StatusNotFound, "Nie znaleziono pliku", "Plik '"+path+"' nie istnieje.")
//			return
//		}
//
//		// SPA fallback
//		// 	http.ServeFile(w, r, "./index.html")
//		// Wszystko inne -> 404
//		serveErrorPage(w, r, http.StatusNotFound, "Nie znaleziono strony", "Strona '"+path+"' nie istnieje.")
//	}
var protectedPaths = map[string][]string{
	"/admin":             {"Admin"},
	"/admin/":            {"Admin"},
	"/user_page":         {"Admin", "User", "Legituser"},
	"/user_page/":        {"Admin", "User", "Legituser"},
	"/email":             {"Admin", "Legituser"}, //prroblem gdzies indziej
	"/email/":            {"Admin", "Legituser"},
	"/dashboard":         {"Admin", "User", "Legituser"},
	"/dashboard/":        {"Admin", "User", "Legituser"},
	"/strony/admin":      {"Admin"},
	"/strony/admin/":     {"Admin"},
	"/strony/user_page":  {"Admin", "User", "Legituser"},
	"/strony/user_page/": {"Admin", "User", "Legituser"},
	"/strony/email":      {"Admin", "Legituser"},
	"/strony/email/":     {"Admin", "Legituser"},
	"/strony/dashboard":  {"Admin", "User", "Legituser"},
	"/strony/dashboard/": {"Admin", "User", "Legituser"},
	// Usunięto powielone wersje z trailing slashem oraz stare "/strony/" - ogarniemy to logicznie niżej[cite: 1]
}

func handlePages(w http.ResponseWriter, r *http.Request) {
	path := strings.TrimSuffix(r.URL.Path, "/")
	if path == "" {
		path = "/index"
	} // domyślna strona

	// Nagłówki Cache'owania
	if isStaticFile(path) {
		w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
		w.Header().Del("Pragma")
		w.Header().Del("Expires")
	} else {
		w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
	}

	// Obsługa starych ścieżek
	if strings.HasPrefix(path, "/strony/") && strings.HasSuffix(path, ".html") {
		cleanPath := strings.TrimSuffix(strings.TrimPrefix(path, "/strony/"), ".html")
		http.Redirect(w, r, "/"+cleanPath, http.StatusFound)
		return
	}

	// Autoryzacja
	for prefix, allowedRoles := range protectedPaths {
		if strings.HasPrefix(path, prefix) {
			if !checkUserRole(r, allowedRoles...) {
				serveErrorPage(w, r, http.StatusForbidden, "Brak uprawnień", "Nie masz wystarczających uprawnień.")
				return
			}
			break
		}
	}

	// Szukanie pliku
	tryPaths := []string{
		filepath.Join(config.StaticDir, path),
		filepath.Join(config.PagesDir, path),
		filepath.Join(config.StaticDir, path+".html"),
		filepath.Join(config.PagesDir, path+".html"),
	}

	for _, p := range tryPaths {
		if stat, err := os.Stat(p); err == nil && !stat.IsDir() {
			http.ServeFile(w, r, p)
			return
		}
	}

	serveErrorPage(w, r, http.StatusNotFound, "Nie znaleziono", "Strona nie istnieje.")
}
func handleWebSocket(w http.ResponseWriter, r *http.Request) {
	token := getJWTFromCookie(r)
	if token == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	claims, err := verifyJWT(token)
	if err != nil {
		http.Error(w, "Invalid token", http.StatusUnauthorized)
		return
	}

	// 1. Łączenie z backendem Rust
	backendURL := "wss://" + config.RustHost + ":" + config.RustPort + "/wss"
	header := http.Header{}
	header.Set("Authorization", "Bearer "+token)

	backendConn, _, err := insecureWSDialer.Dial(backendURL, header)
	if err != nil {
		log.Printf("Cannot connect to Rust WS: %v", err)
		http.Error(w, "Backend unavailable", http.StatusBadGateway)
		return
	}
	//defer backendConn.Close()
	defer func() {
		if err := backendConn.Close(); err != nil {
			log.Printf("Error closing backend connection: %v", err)
		}
	}()
	// 2. Upgrade połączenia klienta
	clientConn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("WebSocket upgrade error: %v", err)
		return
	}
	//defer clientConn.Close()
	defer func() {
		if err := clientConn.Close(); err != nil {
			log.Printf("Error closing client connection: %v", err)
		}
	}()
	// 3. Wysłanie danych autoryzacji do Rusta
	authMsg := map[string]any{
		"sub":      claims.Sub,
		"username": claims.Username,
		"role":     claims.Role,
		"exp":      claims.Exp,
	}
	authData, _ := json.Marshal(authMsg)
	if err := backendConn.WriteMessage(websocket.TextMessage, authData); err != nil {
		log.Printf("Failed to send auth to backend: %v", err)
		return
	}

	errChan := make(chan error, 2)
	timeout := time.Duration(config.TimeoutDeadline) * time.Second
	siteTimeout := time.Duration(config.SiteDeadline) * time.Second

	// 4. Rust -> Klient
	go func() {
		for {
			if err := backendConn.SetReadDeadline(time.Now().Add(timeout)); err != nil {
				log.Printf("Failed to set read deadline: %v", err)
				return
			}
			msgType, msg, err := backendConn.ReadMessage()
			if err != nil {
				if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
					log.Printf("Backend read error: %v", err)
				}
				errChan <- err
				return
			}

			if err := clientConn.SetWriteDeadline(time.Now().Add(siteTimeout)); err != nil {
				log.Printf("Failed to set write deadline: %v", err)
				return
			}
			if err := clientConn.WriteMessage(msgType, msg); err != nil {
				errChan <- err
				return
			}
		}
	}()

	// 5. Klient -> Rust
	go func() {
		for {

			if err := clientConn.SetReadDeadline(time.Now().Add(timeout)); err != nil {
				log.Printf("Failed to set read deadline: %v", err)
				return
			}
			msgType, msg, err := clientConn.ReadMessage()
			if err != nil {
				errChan <- err
				return
			}

			// Odrzucanie wiadomości auth wysłanych bezpośrednio przez klienta
			var data map[string]any
			if json.Unmarshal(msg, &data) == nil {
				if typ, ok := data["type"].(string); ok && typ == "auth" {
					log.Println("Ignoring auth message from client")
					continue
				}
			}

			if err := backendConn.SetWriteDeadline(time.Now().Add(siteTimeout)); err != nil {
				log.Printf("Failed to set write deadline: %v", err)
				return
			}
			if err := backendConn.WriteMessage(msgType, msg); err != nil {
				errChan <- err
				return
			}
		}
	}()

	// Oczekiwanie na jakikolwiek błąd/rozłączenie z którejś ze stron
	<-errChan
}

// Pomocnicze - fixPaths
//func fixPaths(obj map[string]any, nameID, typ string) {
//
//	for key, val := range obj {
//		switch v := val.(type) {
//		case string:
//			if strings.Contains(v, "src/api/products/") {
//				// Zamiana: src/api/products/{nameId}/(images|models)/ -> /data/products/{nameId}/{typ}/
//				obj[key] = strings.Replace(v, "src/api/products/", "/data/products/", 1)
//				obj[key] = strings.Replace(obj[key].(string), "/images/", "/"+typ+"/", 1)
//				obj[key] = strings.Replace(obj[key].(string), "/models/", "/"+typ+"/", 1)
//			}
//		case map[string]any:
//			fixPaths(v, nameID, typ)
//		case []any:
//			for _, item := range v {
//				if m, ok := item.(map[string]any); ok {
//					fixPaths(m, nameID, typ)
//				}
//			}
//		}
//	}
//}

// // verifyJWT – weryfikuje podpis i czas ważności
//
//	func verifyJWT(tokenString string) (*JWTClaims, error) {
//		secret := []byte(os.Getenv("JWT_SECRET_KEY"))
//		if len(secret) == 0 {
//			log.Println("JWT_SECRET_KEY not set – using insecure mode!")
//			return verifyJWTInsecure(tokenString)
//		}
//
//		token, err := jwt.ParseWithClaims(tokenString, &JWTClaims{}, func(t *jwt.Token) (any, error) {
//			if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
//				return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
//			}
//			return secret, nil
//		})
//
//		// NAJPIERW sprawdza, czy w ogóle parser nie wypluł błędu
//		if err != nil {
//			return nil, fmt.Errorf("token validation failed: %w", err)
//		}
//
//		// Dopiero gdy err == nil, upewnij się, że token NIE JEST NILEM
//		if token == nil {
//			return nil, fmt.Errorf("token is nil")
//		}
//
//		// Bezpieczne wyciągnięcie claimsów
//		claims, ok := token.Claims.(*JWTClaims)
//		if !ok || !token.Valid {
//			return nil, fmt.Errorf("invalid token claims")
//		}
//
//		// Popraw logi na Printf zamiast Println (Println nie obsługuje formatowania %s, %v itd.)
//		log.Printf("claims verified successfully: %+v", claims)
//
//		// Dodatkowe sprawdzenie czasu
//		if claims.Exp > 0 && claims.Exp < time.Now().Unix() {
//			return nil, fmt.Errorf("token expired")
//		}
//
//		return claims, nil
//	}
//
// // Tymczasowa funkcja dla kompatybilności – usuń po ustawieniu JWT_SECRET_KEY
//
//	func verifyJWTInsecure(tokenString string) (*JWTClaims, error) {
//		parts := strings.Split(tokenString, ".")
//		if len(parts) != 3 {
//			return nil, fmt.Errorf("invalid token format")
//		}
//		payload, err := base64.RawURLEncoding.DecodeString(parts[1])
//		if err != nil {
//			return nil, err
//		}
//		var claims JWTClaims
//		if err := json.Unmarshal(payload, &claims); err != nil {
//			return nil, err
//		}
//		if claims.Exp > 0 && claims.Exp < time.Now().Unix() {
//			return nil, fmt.Errorf("token expired")
//		}
//		return &claims, nil
//	}
//

// extractAuthToken próbuje pobrać token z ciasteczka, a w ramach fallbacku z nagłówka
func extractAuthToken(r *http.Request) string {
	if cookie, err := r.Cookie("token"); err == nil {
		return cookie.Value
	}
	if cookie, err := r.Cookie("jwt"); err == nil {
		return cookie.Value
	}
	return strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ") //[cite: 1]
}

// forwardToRust automatyzuje wysyłanie żądania do backendu i przepisywanie odpowiedzi
// forwardToRust automatyzuje wysyłanie żądania do backendu, obsługując dodatkowe dane
func forwardToRust(w http.ResponseWriter, r *http.Request, method string, targetPath string, requiresAuth bool, customPayload []byte) {
	baseURL := fmt.Sprintf("https://%s:%s%s", config.RustHost, config.RustPort, targetPath)

	// Zachowaj query string jeśli istnieje[cite: 1]
	if r.URL.RawQuery != "" {
		baseURL += "?" + r.URL.RawQuery
	}

	// Obsługa oryginalnego body LUB dodatkowych danych zdefiniowanych w handlerze
	var bodyReader io.Reader
	if customPayload != nil {
		bodyReader = bytes.NewReader(customPayload)
	} else if r.Body != nil {
		bodyReader = r.Body
	}

	req, err := http.NewRequest(method, baseURL, bodyReader)
	if err != nil {
		http.Error(w, "Failed to create request", http.StatusInternalServerError)
		return
	}

	// Kopiowanie nagłówków i usuwanie Hosta[cite: 1]
	req.Header = r.Header.Clone()
	req.Header.Del("Host")

	// Jeśli wrzucamy dodatkowe dane z poziomu Go, musimy ustawić nowy Content-Length
	if customPayload != nil {
		req.Header.Set("Content-Length", fmt.Sprintf("%d", len(customPayload)))
	}

	if req.Header.Get("Content-Type") == "" {
		req.Header.Set("Content-Type", "application/json")
	}

	if requiresAuth {
		token := extractAuthToken(r)
		if token == "" {
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}
		req.Header.Set("Authorization", "Bearer "+token)
	}
	// --- TYMCZASOWY LOG DEBUGUJĄCY ---
	if strings.Contains(targetPath, "models") || strings.Contains(targetPath, "images") {
		log.Printf("[DEBUG UPLOAD] Target path: %s", targetPath)
		log.Printf("[DEBUG UPLOAD] Content-Type: %s", req.Header.Get("Content-Type"))

		// Jeśli to mały payload lub chcemy podejrzeć nagłówki HTTP żądania do Rusta
		for k, vv := range req.Header {
			for _, v := range vv {
				log.Printf("[DEBUG UPLOAD] Header -> %s: %s", k, v)
			}
		}
	}
	// ---------------------------------
	resp, err := insecureHTTPClient.Do(req)
	if err != nil {
		log.Printf("[GO PROXY ERROR] Request to %s failed: %v", baseURL, err)
		http.Error(w, "Backend unavailable", http.StatusBadGateway)
		return
	}
	defer func(Body io.ReadCloser) {
		err := Body.Close()
		if err != nil {
			log.Printf("Error closing body: %v", err)
		}
	}(resp.Body)
	//defer func() {
	//	if resp != nil && resp.Body != nil {
	//		if err := resp.Body.Close(); err != nil {
	//			log.Printf("Error closing body: %v", err)
	//		}
	//	}
	//}()

	// Kopiowanie nagłówków odpowiedzi
	for k, vv := range resp.Header {
		for _, v := range vv {
			w.Header().Add(k, v)
		}
	}

	w.WriteHeader(resp.StatusCode)
	if _, err := io.Copy(w, resp.Body); err != nil {
		log.Printf("Error copying response body: %v", err)
	}
}

// verifyJWT – weryfikuje podpis i czas ważności
func verifyJWT(tokenString string) (*JWTClaims, error) {
	// Używamy klucza zaczytanego do konfiguracji na starcie aplikacji
	secret := []byte(config.JwtSecKey)
	if len(secret) == 0 {
		return nil, fmt.Errorf("błąd serwera: JWT_SECRET_KEY nie jest skonfigurowany")
	}

	token, err := jwt.ParseWithClaims(tokenString, &JWTClaims{}, func(t *jwt.Token) (any, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("nieoczekiwana metoda szyfrowania: %v", t.Header["alg"])
		}
		return secret, nil
	})

	if err != nil {
		return nil, fmt.Errorf("weryfikacja tokenu nie powiodła się: %w", err)
	}

	if token == nil {
		return nil, fmt.Errorf("token jest pusty")
	}

	claims, ok := token.Claims.(*JWTClaims)
	if !ok || !token.Valid {
		return nil, fmt.Errorf("nieprawidłowe dane (claims) tokenu")
	}

	log.Printf("Claims zweryfikowane pomyślnie: %+v", claims)

	// Dodatkowe sprawdzenie czasu
	if claims.Exp > 0 && claims.Exp < time.Now().Unix() {
		return nil, fmt.Errorf("token wygasł")
	}

	return claims, nil
}

// pobiera JWT z ciasteczek
func getJWTFromCookie(r *http.Request) string {

	cookie, err := r.Cookie("token")
	if err != nil {
		log.Printf("Cookie 'token' not found: %v", err)
		cookie, err = r.Cookie("jwt")
		if err != nil {
			log.Printf("Cookie 'jwt' not found: %v", err)
			return ""
		}
	}
	log.Printf("Cookie found: token=%s... (length: %d)", cookie.Value[:min(20, len(cookie.Value))], len(cookie.Value))
	return cookie.Value
}

// pobiera JWT z nagłówka Authorization
//func getJWTFromHeader(r *http.Request) string {
//
//	auth := r.Header.Get("Authorization")
//	if after, ok := strings.CutPrefix(auth, "Bearer "); ok {
//		return after
//	}
//	return ""
//}

// Middleware do sprawdzania autoryzacji
func authMiddleware(allowedRoles ...string) func(http.HandlerFunc) http.HandlerFunc {
	return func(next http.HandlerFunc) http.HandlerFunc {
		return func(w http.ResponseWriter, r *http.Request) {

			log.Printf("[Middleware] Path: %s, Roles: %v", r.URL.Path, allowedRoles)

			// pobiera token
			token := extractAuthToken(r)

			if token == "" {
				LogSecurity("API_ACCESS_DENIED", map[string]any{
					"path":   r.URL.Path,
					"ip":     r.RemoteAddr,
					"reason": "no_token",
				})
				serveErrorPage(w, r, http.StatusForbidden, "Brak autoryzacji", "Musisz być zalogowany, aby uzyskać dostęp do tej strony.")
				return
			}

			// weryfikacja tokenu
			claims, err := verifyJWT(token)
			if err != nil {
				serveErrorPage(w, r, http.StatusForbidden, "Nieprawidłowy token", "Twój token jest nieprawidłowy lub wygasł.")
				return
			}
			log.Printf("[Middleware] User: %v, Role: %s", claims.Sub, claims.Role)

			// sprawdza rolę
			if len(allowedRoles) > 0 {
				roleOk := false
				for _, role := range allowedRoles {
					if claims.Role == role {
						roleOk = true
						break
					}
				}
				if !roleOk {
					LogSecurity("API_ACCESS_DENIED", map[string]any{
						"path":           r.URL.Path,
						"ip":             r.RemoteAddr,
						"user_role":      claims.Role,
						"required_roles": allowedRoles,
					})
					log.Printf("[Middleware] Role '%s' not allowed: %v", claims.Role, allowedRoles)
					serveErrorPage(w, r, http.StatusForbidden, "Brak uprawnień", "Nie masz wystarczających uprawnień do tej strony.")
					return
				}
			}
			log.Printf("[Middleware] Access granted for %s", r.URL.Path)
			next(w, r)
		}
	}
}

// AUTORYZACJA – ROLE Z JWT
// Sprawdza, czy użytkownik ma odpowiednią rolę (Admin, User, Legituser)
func checkUserRole(r *http.Request, allowedRoles ...string) bool {
	token := getJWTFromCookie(r)
	log.Printf("checkUserRole/token: %s", token)
	if token == "" {
		LogSecurity("ACCESS_DENIED", map[string]any{
			"path":           r.URL.Path,
			"ip":             r.RemoteAddr,
			"required_roles": allowedRoles,
			"reason":         "no_token",
		})
		return false
	}

	claims, err := verifyJWT(token)
	log.Printf("checkUserRole/claims: %v", claims)
	log.Printf("checkUserRole/claims_err: %s", err)

	if err != nil {
		LogSecurity("ACCESS_DENIED", map[string]any{
			"path":           r.URL.Path,
			"ip":             r.RemoteAddr,
			"required_roles": allowedRoles,
			"reason":         "invalid_token",
		})
		return false
	}

	for _, role := range allowedRoles {
		if claims.Role == role {
			return true
		}
	}

	LogSecurity("ACCESS_DENIED", map[string]any{
		"path":           r.URL.Path,
		"ip":             r.RemoteAddr,
		"required_roles": allowedRoles,
		"user_role":      claims.Role,
		"reason":         "role_mismatch",
	})
	return false
}

func serveErrorPage(w http.ResponseWriter, r *http.Request, statusCode int, title, message string) {
	cfg := config

	w.WriteHeader(statusCode)

	// Jeśli to żądanie AJAX/fetch to zwraca JSON z błędem
	if r.Header.Get("X-Requested-With") == "XMLHttpRequest" ||
		strings.Contains(r.Header.Get("Accept"), "application/json") {
		w.Header().Set("Content-Type", "application/json")

		if err := json.NewEncoder(w).Encode(map[string]any{
			"error":   true,
			"status":  statusCode,
			"message": message,
		}); err != nil {
			log.Printf("Error encoding JSON: %v", err)
			return
		}
		return
	}

	// Serwuje error_page.html BEZ przekierowania
	errorPage := filepath.Join(cfg.PagesDir, "error_page.html")
	if _, err := os.Stat(errorPage); err == nil {
		content, err := os.ReadFile(errorPage)
		if err == nil {
			html := string(content)
			html = strings.ReplaceAll(html, "{{code}}", fmt.Sprintf("%d", statusCode))
			html = strings.ReplaceAll(html, "{{title}}", title)
			html = strings.ReplaceAll(html, "{{message}}", message)
			w.Header().Set("Content-Type", "text/html; charset=utf-8")

			if _, err2 := w.Write([]byte(html)); err2 != nil {
				log.Printf("[Middleware] Error writing error page: %v", err2)
				return
			}
			return
		}
	}

	http.Error(w, fmt.Sprintf("%d %s: %s", statusCode, title, message), statusCode)
}

func isStaticFile(path string) bool {
	// Albo po rozszerzeniach plików:
	hasExtension := len(path) > 4
	if !hasExtension {
		return false
	}

	// Sprawdzamy końcówki
	suffixes := []string{".js", ".css", ".png", ".jpg", ".jpeg", ".webp", ".svg", ".ico", ".avif"}
	for _, suffix := range suffixes {
		if len(path) >= len(suffix) && path[len(path)-len(suffix):] == suffix {
			return true
		}
	}
	return false
}

func loginProxyHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Kopiujemy request, upewniając się, że czytamy go i zamykamy poprawnie
	bodyBytes, _ := io.ReadAll(r.Body)
	r.Body = io.NopCloser(bytes.NewReader(bodyBytes))

	rustURL := fmt.Sprintf("https://%s:%s/usr/login", config.RustHost, config.RustPort)
	resp, err := insecureHTTPClient.Post(rustURL, "application/json", r.Body) //[cite: 1]

	if err != nil {
		http.Error(w, "Backend error", http.StatusBadGateway)
		return
	}
	defer func(Body io.ReadCloser) {
		err := Body.Close()
		if err != nil {
			log.Printf("[Middleware] Error closing body: %v", err)
		}
	}(resp.Body)

	if resp.StatusCode != http.StatusOK {
		w.WriteHeader(resp.StatusCode)
		_, err := io.Copy(w, resp.Body)
		if err != nil {
			log.Printf("[Middleware] Error copying response body: %v", err)
			return
		}
		return
	}

	var responseData map[string]any

	if err := json.NewDecoder(resp.Body).Decode(&responseData); err != nil {
		log.Printf("Error decoding JSON: %v", err)
		return
	}

	if token, ok := responseData["token"].(string); ok {
		http.SetCookie(w, &http.Cookie{
			Name: "token", Value: token, Path: "/",
			HttpOnly: true, Secure: true, SameSite: http.SameSiteStrictMode, MaxAge: 86400,
		}) //[cite: 1]
		delete(responseData, "token")
	}

	w.Header().Set("Content-Type", "application/json")

	if err := json.NewEncoder(w).Encode(responseData); err != nil {
		return
	}
}

// ratelimit auth
type AuthLimiter struct {
	sync.Mutex
	attempts map[string][]time.Time
}

var loginLimiter = &AuthLimiter{attempts: make(map[string][]time.Time)}

// authRateLimitMiddleware pozwala na max 5 prób autoryzacji na minutę na jedno IP
func authRateLimitMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Interweniujemy tylko na ścieżkach logowania i rejestracji
		if r.URL.Path == "/api/login" || r.URL.Path == "/api/register" {
			ip := r.RemoteAddr
			if idx := strings.LastIndex(ip, ":"); idx != -1 {
				ip = ip[:idx] // czysty adres IP (bez portu)
			}

			loginLimiter.Lock()
			now := time.Now()
			// Czyścimy próby starsze niż 1 minuta
			var validAttempts []time.Time
			for _, t := range loginLimiter.attempts[ip] {
				if now.Sub(t) < time.Minute {
					validAttempts = append(validAttempts, t)
				}
			}

			if len(validAttempts) >= 5 {
				loginLimiter.Unlock()
				http.Error(w, `{"error":"Zbyt wiele prób logowania. Spróbuj ponownie za minutę."}`, http.StatusTooManyRequests)
				return
			}

			loginLimiter.attempts[ip] = append(validAttempts, now)
			loginLimiter.Unlock()
		}
		next.ServeHTTP(w, r)
	})
}

// Rejestracja - Zwykłe proxy przekazujące dane do Rusta
func registerProxyHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	bodyBytes, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "Request read error", http.StatusBadRequest)
		return
	}

	rustURL := "https://" + config.RustHost + ":" + config.RustPort + "/usr/usr"
	//     rustURL := fmt.Sprintf(config.RustHost + ":" + config.RustPort + "/usr/usr")
	//     resp, err := http.Post(rustURL, "application/json", bytes.NewBuffer(bodyBytes))
	resp, err := insecureHTTPClient.Post(rustURL, "application/json", bytes.NewBuffer(bodyBytes))
	if err != nil {
		http.Error(w, `{"error":"Błąd rejestracji na serwerze głównym"}`, http.StatusBadGateway)
		return
	}
	//defer resp.Body.Close()
	defer func() { _ = resp.Body.Close() }()

	w.WriteHeader(resp.StatusCode)
	if _, err := io.Copy(w, resp.Body); err != nil {
		log.Printf("Error copying response body: %v", err)
		return
	}
}

// Wylogowanie - Niszczymy ciasteczko z poziomu serwera
func logoutHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	http.SetCookie(w, &http.Cookie{
		Name:     "token",
		Value:    "",
		Path:     "/",
		HttpOnly: true,
		Secure:   true,
		SameSite: http.SameSiteStrictMode,
		MaxAge:   -1, // Natychmiastowe usunięcie przez przeglądarkę
	})
	LogSecurity("LOGOUT", map[string]any{
		"ip": r.RemoteAddr,
	})
	w.Header().Set("Content-Type", "application/json")

	if _, err := w.Write([]byte(`{"message":"Wylogowano pomyślnie"}`)); err != nil {
		log.Printf("Error copying response body: %v", err)
		return
	}
}

func meHandler(w http.ResponseWriter, r *http.Request) {
	token := getJWTFromCookie(r)
	if token == "" {
		http.Error(w, `{"error":"Unauthorized"}`, http.StatusUnauthorized)
		return
	}
	claims, err := verifyJWT(token)
	if err != nil {
		http.Error(w, `{"error":"Invalid token"}`, http.StatusUnauthorized)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(map[string]any{
		"username": claims.Username,
		"role":     claims.Role,
	}); err != nil {
		log.Printf("Error encoding JSON: %v", err)
		return
	}
}
