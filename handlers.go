package main
//handlers.go
import (
	"encoding/json"
	"io"
	"log"
	"net/http"
	"os"
    "fmt"
	"path/filepath"
	"strings"
	"encoding/base64"
	"time"
	"bytes"
    "sync"
    "github.com/gorilla/websocket"
    "github.com/golang-jwt/jwt/v5"
    "crypto/tls"
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
var allowedExtensions = map[string]bool{
    ".glb":   true,
    ".gltf":   true,
    ".png":   true,
    ".jpg":   true,
    ".jpeg":  true,
    ".webp":  true,
    ".avif":  true,
    ".json":  true,
    ".dds":   true,
}
func putNewUserOrder(w http.ResponseWriter, r *http.Request) {
log.Printf("DEBUG: Otrzymano żądanie %s na ścieżkę %s", r.Method, r.URL.Path)
    // czy metoda to POST
    if r.Method != http.MethodPost {
        http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
        return
    }

    // pobiera token JWT (z 'bisquits' lub nagłówka)
    token := getJWTFromCookie(r)
    if token == "" {
        token = getJWTFromHeader(r)
    }

    if token == "" {
        http.Error(w, "Unauthorized", http.StatusUnauthorized)
        return
    }

    // URL do backendu
    baseURL := "https://" + config.RustHost + ":" + config.RustPort + "/api/order"

    // robi nowe żądanie HTTP typu POST, przekazując oryginalne ciało żądania (JSON)
    req, err := http.NewRequest(http.MethodPost, baseURL, r.Body)
    if err != nil {
        http.Error(w, "Failed to create request", http.StatusInternalServerError)
        return
    }

    // przekazuje token JWT na backend (odpowiednik maybe_claims w rust)
    req.Header.Set("Authorization", "Bearer "+token)

    // Przekazuje też Content-Type, żeby Rust poprawnie odczytał Json<CaloscioweZamowienie>
    contentType := r.Header.Get("Content-Type")
    if contentType != "" {
        req.Header.Set("Content-Type", contentType)
    } else {
        req.Header.Set("Content-Type", "application/json")
    }

    // wykonuje żądanie używając zdefiniowanego w Twoim pliku insecureHTTPClient
    resp, err := insecureHTTPClient.Do(req)
    if err != nil {
        log.Printf("Error calling Rust /api/order: %v", err)
        http.Error(w, "Backend unavailable", http.StatusBadGateway)
        return
    }
    defer resp.Body.Close()

    // Przepisujemy nagłówki z odpowiedzi back
    for key, values := range resp.Header {
        for _, value := range values {
            w.Header().Add(key, value)
        }
    }

    // przekazuje kod odpowiedzi z bakcend (oczekiwane StatusCode::CREATED - 201)
    w.WriteHeader(resp.StatusCode)

    // Kopiujemy ciało odpowiedzi z backend na front (zawierające np. { "payment_url": "..." })
    io.Copy(w, resp.Body)
}
func getUserOwnOrders(w http.ResponseWriter, r *http.Request) {
    // sprawdza, czy metoda to GET
    if r.Method != http.MethodGet {
        http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
        return
    }

    // pobiera token JWT (z ciasteczka lub nagłówka)
    token := getJWTFromCookie(r)
    if token == "" {
        token = getJWTFromHeader(r)
    }

    if token == "" {
        http.Error(w, "Unauthorized", http.StatusUnauthorized)
        return
    }

    // buduje URL do backendu Rusta
    baseURL := "https://" + config.RustHost + ":" + config.RustPort + "/api/user/orders"

    // tworzy żądanie do Rusta
    req, err := http.NewRequest(http.MethodGet, baseURL, nil)
    if err != nil {
        http.Error(w, "Failed to create request", http.StatusInternalServerError)
        return
    }

    // przekazuje token JWT, aby Rust mógł wyciągnąć claims.sub
    req.Header.Set("Authorization", "Bearer "+token)

    // wykonuje żądanie za pomocą insecureHTTPClient
    resp, err := insecureHTTPClient.Do(req)
    if err != nil {
        log.Printf("Error calling Rust user orders: %v", err)
        http.Error(w, "Backend unavailable", http.StatusBadGateway)
        return
    }
    defer resp.Body.Close()

    // przekazuje odpowiedź do frontendu
    w.Header().Set("Content-Type", "application/json")
    w.WriteHeader(resp.StatusCode)
    io.Copy(w, resp.Body)
}
func userAccountOperations(w http.ResponseWriter, r *http.Request) {
	// Akceptujemy tylko GET, PUT i DELETE (POST idzie przez rejestrację)
	if r.Method != http.MethodGet && r.Method != http.MethodPut && r.Method != http.MethodDelete {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// pobiera token JWT z ciasteczka lub nagłówka (tak samo jak w getUserOwnOrders)
	token := getJWTFromCookie(r)
	if token == "" {
		token = getJWTFromHeader(r)
	}

	if token == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// buduje URL bezpośrednio do spiętego endpointu na backendzie
	baseURL := "https://" + config.RustHost + ":" + config.RustPort + "/usr/usr"

	// tworzy żądanie do Rusta, zachowując oryginalną metodę (GET/PUT/DELETE) oraz ciało (dla PUT)
	req, err := http.NewRequest(r.Method, baseURL, r.Body)
	if err != nil {
		http.Error(w, "Failed to create request", http.StatusInternalServerError)
		return
	}

	// Kopiujemy nagłówki (szczególnie Content-Type przy aktualizacji danych przez PUT)
	req.Header = r.Header.Clone()
	req.Header.Del("Host")

	// wstrzykuje zweryfikowany token w nagłówek Bearer, by Rust wiedział, czyje to konto
	req.Header.Set("Authorization", "Bearer "+token)

	// wykonuje zapytanie do Rusta przez bezpiecznego klienta
	resp, err := insecureHTTPClient.Do(req)
	if err != nil {
		log.Printf("Error calling Rust user account operations (%s): %v", r.Method, err)
		http.Error(w, "Backend unavailable", http.StatusBadGateway)
		return
	}
	defer resp.Body.Close()

	// przekazuje nagłówki oraz status z Rusta bezpośrednio na frontend
	for key, values := range resp.Header {
		for _, value := range values {
			w.Header().Add(key, value)
		}
	}
	w.WriteHeader(resp.StatusCode)

	// Kopiujemy odpowiedź (np. JSON z zaktualizowanymi danymi konta)
	io.Copy(w, resp.Body)
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
    baseURL := "https://" + config.RustHost + ":" + config.RustPort + "/usr/usr"
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
    defer resp.Body.Close()

    // Przekaż nagłówki i status odpowiedzi z Rusta
    w.Header().Set("Content-Type", "application/json")
    w.WriteHeader(resp.StatusCode)

    // Przekaż ciało odpowiedzi (dane użytkownika z Rusta)
    io.Copy(w, resp.Body)
}
func getProductsProxyHandler(w http.ResponseWriter, r *http.Request) {
    // buduje bazowy URL do backendu Rusta
    baseURL := "https://" + config.RustHost + ":" + config.RustPort + "/api/products"

    // Dla PUT – dodajemy ID z URL do ścieżki
    if r.Method == http.MethodPut {
        // Wyciągamy ID ze ścieżki: /api/products/123
        pathParts := strings.Split(r.URL.Path, "/")
        if len(pathParts) < 3 {
            http.Error(w, "Missing product ID", http.StatusBadRequest)
            return
        }
        id := pathParts[len(pathParts)-1]
        if id == "" {
            http.Error(w, "Invalid product ID", http.StatusBadRequest)
            return
        }
        baseURL += "/" + id
    }

    // Dodajemy query string, jeśli istnieje
    if r.URL.RawQuery != "" {
        baseURL += "?" + r.URL.RawQuery
    }

    // tworzy nowe żądanie do Rusta
    req, err := http.NewRequest(r.Method, baseURL, r.Body)
    if err != nil {
        http.Error(w, "Failed to create request", http.StatusInternalServerError)
        return
    }

    // Kopiujemy wszystkie nagłówki (ważne: ciasteczka, Content-Type, autoryzacja)
    req.Header = r.Header.Clone()
    req.Header.Del("Host") // usuwamy, bo może być niepoprawny

    // Wykonaj żądanie do Rusta
    resp, err := insecureHTTPClient.Do(req)
    if err != nil {
        log.Printf("Products proxy error: %v", err)
        http.Error(w, "Backend unavailable", http.StatusBadGateway)
        return
    }
    defer resp.Body.Close()

    // Kopiuj nagłówki odpowiedzi
    for key, values := range resp.Header {
        for _, value := range values {
            w.Header().Add(key, value)
        }
    }

    // Ustaw kod statusu
    w.WriteHeader(resp.StatusCode)

    // Kopiuj ciało odpowiedzi
    io.Copy(w, resp.Body)
}
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
    defer resp.Body.Close()

    // Kopiujemy nagłówki i ciało odpowiedzi do przeglądarki
    for key, values := range resp.Header {
        for _, value := range values {
            w.Header().Add(key, value)
        }
    }
    w.WriteHeader(resp.StatusCode)
    io.Copy(w, resp.Body)
}

func uploadFilesHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Wyciągamy nameId ze ścieżki (np. /api/admin/produkty/komoda_1 -> komoda_1)
	pathParts := strings.Split(r.URL.Path, "/")
	if len(pathParts) < 3 {
		http.Error(w, "Missing nameId", http.StatusBadRequest)
		return
	}
	nameID := pathParts[len(pathParts)-1]
	if nameID == "" {
		http.Error(w, "Invalid nameId", http.StatusBadRequest)
		return
	}

	// buduje URL do backendu Rusta, zgodnie z trasą na backendzie
	rustURL := "https://" + config.RustHost + ":" + config.RustPort + "/api/images/upload/" + nameID

	// tworzy nowe żądanie do Rusta, przekazując nienaruszone ciało (multipart body)
	req, err := http.NewRequest(http.MethodPost, rustURL, r.Body)
	if err != nil {
		log.Printf("Błąd tworzenia żądania do Rusta: %v", err)
		http.Error(w, "Failed to create request", http.StatusInternalServerError)
		return
	}

	// Kopiujemy wszystkie nagłówki (w tym kluczowy Content-Type z odpowiednim boundary oraz Authorization)
	req.Header = r.Header.Clone()
	req.Header.Del("Host")

	// wykonuje żądanie przy użyciu Twojego bezpiecznego klienta dla self-signed certs
	resp, err := insecureHTTPClient.Do(req)
	if err != nil {
		log.Printf("Brak komunikacji z Rustem na %s: %v", rustURL, err)
		http.Error(w, "Backend unavailable", http.StatusBadGateway)
		return
	}
	defer resp.Body.Close()

	// Przepisujemy nagłówki odpowiedzi z Rusta z powrotem do przeglądarki
	for key, values := range resp.Header {
		for _, value := range values {
			w.Header().Add(key, value)
		}
	}

	// Zwraca status z Rusta (Rust zwraca 202 ACCEPTED)
	w.WriteHeader(resp.StatusCode)

	// Kopiuje odpowiedź (JSON o rozpoczęciu konwersji) do frontendu
	io.Copy(w, resp.Body)
}

// ROUTING STRON
func handlePages(w http.ResponseWriter, r *http.Request) {
    cfg := config
        pathq := strings.TrimSuffix(r.URL.Path, "/")
        query := r.URL.RawQuery
        log.Printf("handlePages: path=%s, query=%s", pathq, query)
// 	w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
// 	w.Header().Set("Pragma", "no-cache")
// 	w.Header().Set("Expires", "0")
    pathh := r.URL.Path

    // Jeśli to plik statyczny, dajemy agresywny cache na rok!
    if isStaticFile(pathh) {
        w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
        // Usuwamy nagłówki blokujące cache, jeśli mogły być ustawione wcześniej
        w.Header().Del("Pragma")
        w.Header().Del("Expires")
    } else {
        // Dla zwykłych podstron HTML blokujemy cache, tak jak miałeś dotychczas
        w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
        w.Header().Set("Pragma", "no-cache")
        w.Header().Set("Expires", "0")
    }

	path := strings.TrimSuffix(r.URL.Path, "/")
// 	query := r.URL.RawQuery
	log.Printf("Request: %s (query: %s)", path, query)

    // AUTORYZACJA DLA CHRONIONYCH ŚCIEŻEK
    protectedPaths := map[string][]string{
        "/admin":      {"Admin"},
        "/admin/":     {"Admin"},
        "/user_page":  {"Admin", "User", "Legituser"},
        "/user_page/": {"Admin", "User", "Legituser"},
        "/email":      {"Admin", "Legituser"}, //prroblem gdzies indziej
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
    }

    for protectedPath, allowedRoles := range protectedPaths {
    log.Printf("protecpath: %s (allowed roles: %s)", protectedPath, allowedRoles)
        if strings.HasPrefix(path, protectedPath) {
            log.Printf("Path '%s' matched protected: %s", path, protectedPath)
            if !checkUserRole(r, allowedRoles...) {
                log.Printf("Access denied for %s", path)
                serveErrorPage(w, r, http.StatusForbidden, "Brak uprawnień", "Nie masz wystarczających uprawnień do tej strony.")
                return
            }
            log.Printf("Access granted for %s", path)
            break
        }
    }


	// Stare ścieżki /strony/*.html -> przekierowanie
	if strings.HasPrefix(path, "/strony/") && strings.HasSuffix(path, ".html") {
    log.Printf("Redirecting old path: %s", path)
        cleanPath := strings.TrimPrefix(path, "/strony/")
		cleanPath = strings.TrimSuffix(cleanPath, ".html")
		newURL := "/" + cleanPath
		if query != "" {
			newURL += "?" + query
		}
		http.Redirect(w, r, newURL, http.StatusFound)
		return
	}

	if path == "" || path == "/" {
		http.ServeFile(w, r, filepath.Join(cfg.StaticDir, "index.html"))
		return
	}
	if path == "/index.html" {
		http.Redirect(w, r, "/", http.StatusFound)
		return
	}

	// Jeśli .html – serwuj z głównego lub z ./strony/
	if strings.HasSuffix(path, ".html") {
		// sprawdza w głównym katalogu
		filePath := filepath.Join(cfg.StaticDir, strings.TrimPrefix(path, "/"))
		    log.Printf("Checking file: %s", filePath)
		if _, err := os.Stat(filePath); err == nil {
		        log.Printf("Serving file: %s", filePath)
			http.ServeFile(w, r, filePath)
			return
		}
		// sprawdza w ./strony/
		filePath = filepath.Join(cfg.PagesDir, strings.TrimPrefix(path, "/"))
		    log.Printf("Checking file: %s", filePath)
		if _, err := os.Stat(filePath); err == nil {
		        log.Printf("Serving file: %s", filePath)
			http.ServeFile(w, r, filePath)
			return
		}
//         log.Printf("File not found: %s", filePath)
//         Plik .html nie istnieje -> 404
        serveErrorPage(w, r, http.StatusNotFound, "Nie znaleziono strony", "Plik '" + path + "' nie istnieje.")
        return
	}

	// Dynamiczne mapowanie: /produkty -> ./strony/produkty.html
	htmlPath := filepath.Join(cfg.PagesDir, path+".html")
	if _, err := os.Stat(htmlPath); err == nil {
		http.ServeFile(w, r, htmlPath)
		return
	}

    // Plik z rozszerzeniem -> 404
    if strings.Contains(path, ".") {
        serveErrorPage(w, r, http.StatusNotFound, "Nie znaleziono pliku", "Plik '" + path + "' nie istnieje.")
        return
    }

	// SPA fallback
    // 	http.ServeFile(w, r, "./index.html")
    // Wszystko inne -> 404
    serveErrorPage(w, r, http.StatusNotFound, "Nie znaleziono strony", "Strona '" + path + "' nie istnieje.")
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

    backendURL := "wss://" + config.RustHost + ":" + config.RustPort + "/wss"
    header := http.Header{}
    header.Set("Authorization", "Bearer "+token)
    backendConn, _, err := insecureWSDialer.Dial(backendURL, header)
    if err != nil {
        log.Printf("Cannot connect to Rust WS: %v", err)
        http.Error(w, "Backend unavailable", http.StatusBadGateway)
        return
    }
    defer backendConn.Close()

    clientConn, err := upgrader.Upgrade(w, r, nil)
    if err != nil {
        log.Printf("WebSocket upgrade error: %v", err)
        return
    }
    defer clientConn.Close()

    clientConn.SetReadDeadline(time.Now().Add(time.Duration(config.TimeoutDeadline) * time.Second))
    clientConn.SetWriteDeadline(time.Now().Add(time.Duration(config.TimeoutDeadline) * time.Second))
    backendConn.SetReadDeadline(time.Now().Add(time.Duration(config.TimeoutDeadline) * time.Second))
    backendConn.SetWriteDeadline(time.Now().Add(time.Duration(config.TimeoutDeadline) * time.Second))

    // WYŚLIJ DO RUSTA POPRAWNĄ WIADOMOŚĆ AUTH
    authMsg := map[string]interface{}{
//         "type":     "auth",
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

    go func() {
        defer clientConn.Close()
        defer backendConn.Close()
        for {
            backendConn.SetReadDeadline(time.Now().Add(time.Duration(config.TimeoutDeadline) * time.Second))
            msgType, msg, err := backendConn.ReadMessage()
            if err != nil {
                if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
                    log.Printf("Backend read error: %v", err)
                }
                errChan <- err
                return
            }
            clientConn.SetWriteDeadline(time.Now().Add(time.Duration(config.SiteDeadline) * time.Second))
            if err := clientConn.WriteMessage(msgType, msg); err != nil {
                errChan <- err
                return
            }
        }
    }()

    go func() {
        defer clientConn.Close()
        defer backendConn.Close()
        for {
            clientConn.SetReadDeadline(time.Now().Add(time.Duration(config.TimeoutDeadline) * time.Second))
            msgType, msg, err := clientConn.ReadMessage()
            if err != nil {
                errChan <- err
                return
            }
            // POMIŃ WIADOMOŚCI AUTH OD KLIENTA
            var data map[string]interface{}
            if json.Unmarshal(msg, &data) == nil {
                if typ, ok := data["type"].(string); ok && typ == "auth" {
                    log.Println("Ignoring auth message from client")
                    continue
                }
            }
            backendConn.SetWriteDeadline(time.Now().Add(time.Duration(config.SiteDeadline) * time.Second))
            if err := backendConn.WriteMessage(msgType, msg); err != nil {
                errChan <- err
                return
            }
        }
    }()

    <-errChan
}

// Pomocnicze - fixPaths
func fixPaths(obj map[string]interface{}, nameID, typ string) {

	for key, val := range obj {
		switch v := val.(type) {
		case string:
			if strings.Contains(v, "src/api/products/") {
				// Zamiana: src/api/products/{nameId}/(images|models)/ -> ../data/products/{nameId}/{typ}/
				obj[key] = strings.Replace(v, "src/api/products/", "../data/products/", 1)
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

// verifyJWT – weryfikuje podpis i czas ważności
func verifyJWT(tokenString string) (*JWTClaims, error) {
    secret := []byte(os.Getenv("JWT_SECRET_KEY"))
    if len(secret) == 0 {
        log.Println("JWT_SECRET_KEY not set – using insecure mode!")
        return verifyJWTInsecure(tokenString)
    }

    token, err := jwt.ParseWithClaims(tokenString, &JWTClaims{}, func(t *jwt.Token) (interface{}, error) {
        if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
            return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
        }
        return secret, nil
    })

    // NAJPIERW sprawdza, czy w ogóle parser nie wypluł błędu
    if err != nil {
        return nil, fmt.Errorf("token validation failed: %w", err)
    }

    // Dopiero gdy err == nil, upewnij się, że token NIE JEST NILEM
    if token == nil {
        return nil, fmt.Errorf("token is nil")
    }

    // Bezpieczne wyciągnięcie claimsów
    claims, ok := token.Claims.(*JWTClaims)
    if !ok || !token.Valid {
        return nil, fmt.Errorf("invalid token claims")
    }

    // Popraw logi na Printf zamiast Println (Println nie obsługuje formatowania %s, %v itd.)
    log.Printf("claims verified successfully: %+v", claims)

    // Dodatkowe sprawdzenie czasu
    if claims.Exp > 0 && claims.Exp < time.Now().Unix() {
        return nil, fmt.Errorf("token expired")
    }

    return claims, nil
}

// Tymczasowa funkcja dla kompatybilności – usuń po ustawieniu JWT_SECRET_KEY
func verifyJWTInsecure(tokenString string) (*JWTClaims, error) {
    parts := strings.Split(tokenString, ".")
    if len(parts) != 3 {
        return nil, fmt.Errorf("invalid token format")
    }
    payload, err := base64.RawURLEncoding.DecodeString(parts[1])
    if err != nil {
        return nil, err
    }
    var claims JWTClaims
    if err := json.Unmarshal(payload, &claims); err != nil {
        return nil, err
    }
    if claims.Exp > 0 && claims.Exp < time.Now().Unix() {
        return nil, fmt.Errorf("token expired")
    }
    return &claims, nil
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

            log.Printf("[Middleware] Path: %s, Roles: %v", r.URL.Path, allowedRoles)

            // pobiera token
            token := getJWTFromCookie(r)
            if token == "" {
                token = getJWTFromHeader(r)
            }

            if token == "" {
                LogSecurity("API_ACCESS_DENIED", map[string]interface{}{
                    "path": r.URL.Path,
                    "ip":   r.RemoteAddr,
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
                    log.Printf("[Middleware] User: %s, Role: %s", claims.Sub, claims.Role)

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
                    LogSecurity("API_ACCESS_DENIED", map[string]interface{}{
                        "path":        r.URL.Path,
                        "ip":          r.RemoteAddr,
                        "user_role":   claims.Role,
                        "required_roles": allowedRoles,
                    })
                    log.Printf("[Middleware] Role '%s' not allowed: %v", claims.Role, allowedRoles)
                    serveErrorPage(w, r, http.StatusForbidden, "Brak uprawnień", "Nie masz wystarczających uprawnień do tej strony.")
                    return
                }
            }
            log.Printf("[Middleware] Access granted for %s", r.URL.Path)
            next.ServeHTTP(w, r)
        })
    }
}

// AUTORYZACJA – ROLE Z JWT
// Sprawdza, czy użytkownik ma odpowiednią rolę (Admin, User, Legituser)
func checkUserRole(r *http.Request, allowedRoles ...string) bool {
    token := getJWTFromCookie(r)
    log.Printf("checkUserRole/token: %s", token)
    if token == "" {
        LogSecurity("ACCESS_DENIED", map[string]interface{}{
            "path":           r.URL.Path,
            "ip":             r.RemoteAddr,
            "required_roles": allowedRoles,
            "reason":         "no_token",
        })
        return false
    }

    claims, err := verifyJWT(token)
    log.Printf("checkUserRole/claims: %s", claims)
    log.Printf("checkUserRole/claims_err: %s", err)

    if err != nil {
        LogSecurity("ACCESS_DENIED", map[string]interface{}{
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

    LogSecurity("ACCESS_DENIED", map[string]interface{}{
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
        json.NewEncoder(w).Encode(map[string]interface{}{
            "error":   true,
            "status":  statusCode,
            "message": message,
        })
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
            w.Write([]byte(html))
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

//     config := LoadConfig()
//     b_port := config.PortAPI
//     b_addr := config.RustHost

    if r.Method != http.MethodPost {
        http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
        return
    }

    // ODczytaj body (musisz go zapamiętać, bo później wysyłasz)
    bodyBytes, err := io.ReadAll(r.Body)
    if err != nil {
        http.Error(w, "Cannot read body", http.StatusBadRequest)
        return
    }

    // Wyciągnij username do logowania
    var loginData map[string]interface{}
    json.Unmarshal(bodyBytes, &loginData)
    username, _ := loginData["username"].(string)
    ip := r.RemoteAddr

    // LOG: Próba logowania
    LogSecurity("LOGIN_ATTEMPT", map[string]interface{}{
        "username": username,
        "ip":       ip,
    })

    // Przywróć body dla dalszego przetwarzania
    r.Body = io.NopCloser(bytes.NewReader(bodyBytes))

    // ... wysyłka do Rusta (użyj insecureHTTPClient)
    rustURL := "https://" + config.RustHost + ":" + config.RustPort + "/usr/login"
    resp, err := insecureHTTPClient.Post(rustURL, "application/json", r.Body)
    // ...

    // LOG: Sukces lub porażka
    if resp.StatusCode != http.StatusOK {
        LogSecurity("LOGIN_FAILED", map[string]interface{}{
            "username": username,
            "ip":       ip,
            "status":   resp.StatusCode,
        })
    } else {
        LogSecurity("LOGIN_SUCCESS", map[string]interface{}{
            "username": username,
            "ip":       ip,
        })
    }

//     rustURL := "https://" + config.RustHost + ":" + config.RustPort + "/usr/login"
//     resp, err := http.Post(rustURL, "application/json", r.Body)
//     resp, err := insecureHTTPClient.Post(rustURL, "application/json", r.Body)
    if err != nil {
        log.Printf("Błąd połączenia z Rustem: %v", err)
        http.Error(w, "Backend error", http.StatusBadGateway)
        return
    }
    defer resp.Body.Close()

    // Jeśli Rust odrzucił logowanie (np. złe hasło), przekazuje błąd
    if resp.StatusCode != http.StatusOK {
        w.WriteHeader(resp.StatusCode)
        io.Copy(w, resp.Body)
        return
    }

    // Parsujemy odpowiedź z Rusta, żeby wyciągnąć token
    var responseData map[string]interface{}
    if err := json.NewDecoder(resp.Body).Decode(&responseData); err != nil {
        http.Error(w, "Invalid response from backend", http.StatusInternalServerError)
        return
    }

    // Ustawiamy BEZPIECZNE ciasteczko z tokenem (flaga HttpOnly = true)
    if token, ok := responseData["token"].(string); ok {
        http.SetCookie(w, &http.Cookie{
            Name:     "token",
            Value:    token,
            Path:     "/",
            HttpOnly: true,  // <--- KLUCZ DO BEZPIECZEŃSTWA
            Secure:   true,  // Wymaga HTTPS
            SameSite: http.SameSiteStrictMode,
            MaxAge:   86400,
        })
        // Usuwamy token z danych wysyłanych do JS - nie jest mu do niczego potrzebny
        delete(responseData, "token")
    }

    // Zwracamy resztę danych (role, username) do JS
    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(responseData)
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
    defer resp.Body.Close()

    w.WriteHeader(resp.StatusCode)
    io.Copy(w, resp.Body)
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
    LogSecurity("LOGOUT", map[string]interface{}{
        "ip": r.RemoteAddr,
    })
    w.Header().Set("Content-Type", "application/json")
    w.Write([]byte(`{"message":"Wylogowano pomyślnie"}`))
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
    json.NewEncoder(w).Encode(map[string]interface{}{
        "username": claims.Username,
        "role":     claims.Role,
    })
}