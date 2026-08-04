package main

import (
	"context"
	"crypto/tls"
	"log"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"syscall"
	"time"

	"github.com/gorilla/websocket"
	"golang.org/x/time/rate"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		origin := r.Header.Get("Origin")
		allowedOrigin := "https://" + config.AdresWWW + ":" + config.PortWWW
		return origin == allowedOrigin
	},
}

func main() {
	config = LoadConfig()
	limiter = rate.NewLimiter(rate.Limit(config.RateLimitRequests), config.RateLimitBurst)
	if os.Getenv("JWT_SECRET_KEY") == "" {
		log.Fatal("JWT_SECRET_KEY must be set in .env – required for JWT verification")
	}
	wwwMux := http.NewServeMux()

	apiProxy := httputil.NewSingleHostReverseProxy(&url.URL{
		Scheme: "https",
		Host:   config.AdresWWW + ":" + config.PortAPI,
	})
	apiProxy.Transport = &http.Transport{
		TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
	}

	// WSZYSTKIE ŻĄDANIA /api/* SĄ PRZEKIEROWYWANE NA 8444
	wwwMux.Handle("/api/", apiProxy)

	wwwMux.HandleFunc("/robots.txt", func(w http.ResponseWriter, r *http.Request) {
		http.ServeFile(w, r, filepath.Join(config.StaticDir, "robots.txt"))
	})
	wwwMux.HandleFunc("/license.txt", func(w http.ResponseWriter, r *http.Request) {
		http.ServeFile(w, r, filepath.Join(config.StaticDir, "license.txt"))
	})
	wwwMux.Handle("/css/", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Blokada wyświetlania katalogów
		path := strings.TrimPrefix(r.URL.Path, "/css/")
		if path == "" || strings.HasSuffix(path, "/") {
			serveErrorPage(w, r, http.StatusForbidden, "Access denied", "Nie masz uprawnień do przeglądania tego katalogu.")
			return
		}
		// Serwuje plik z bezpieczeństwem, cache i gzip
		handler := securityHeaders(cacheMiddleware(gzipMiddleware(
			http.StripPrefix("/css/", http.FileServer(http.Dir(filepath.Join(config.StaticDir, "css")))),
		)))
		handler.ServeHTTP(w, r)
	}))
	wwwMux.Handle("/js/", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := strings.TrimPrefix(r.URL.Path, "/js/")
		if path == "" || strings.HasSuffix(path, "/") {
			serveErrorPage(w, r, http.StatusForbidden, "Access denied", "Nie masz uprawnień do przeglądania tego katalogu.")
			return
		}
		handler := securityHeaders(cacheMiddleware(gzipMiddleware(
			http.StripPrefix("/js/", http.FileServer(http.Dir(filepath.Join(config.StaticDir, "js")))),
		)))
		handler.ServeHTTP(w, r)
	}))

	wwwMux.Handle("/data/", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := strings.TrimPrefix(r.URL.Path, "/data/")

		if path == "" || strings.HasSuffix(path, "/") {
			serveErrorPage(w, r, http.StatusForbidden, "Access denied", "Nie masz uprawnień do przeglądania tego katalogu.")
			return
		}

		// ZABEZPIECZENIE PRZED PATH TRAVERSAL
		fullPath := filepath.Join(config.DataDir, path)
		cleanPath := filepath.Clean(fullPath)

		// check czy ścieżka znajduje się wewnątrz DataDir
		dataDirClean := filepath.Clean(config.DataDir)
		if !strings.HasPrefix(cleanPath, dataDirClean+string(os.PathSeparator)) && cleanPath != dataDirClean {
			serveErrorPage(w, r, http.StatusForbidden, "Access denied", "Nieprawidłowa ścieżka.")
			return
		}
		info, err := os.Stat(fullPath)
		if err != nil {
			serveErrorPage(w, r, http.StatusNotFound, "Nie znaleziono pliku", "Plik '"+path+"' nie istnieje.")
			return
		}
		if info.IsDir() {
			serveErrorPage(w, r, http.StatusForbidden, "Dostęp zabroniony", "Nie masz uprawnień do przeglądania tego katalogu.")
			return
		}

		// Cache-Control na podstawie typu pliku
		ext := strings.ToLower(filepath.Ext(path))
		switch ext {
		// Zdjęcia i grafiki dostają długi cache (rok)
		case ".avif", ".webp", ".jpg", ".jpeg", ".png", ".gif", ".svg", ".ico":
			w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
			// nagłówki usuwane |no-cache| w razie jak jakiś middleware by się zapomniał i dodał
			w.Header().Del("Pragma")
			w.Header().Del("Expires")

		// Wszystko inne (np. pliki konfiguracyjne, JSON-y, dane tekstowe) ma zablokowany cache
		default:
			w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
			w.Header().Set("Pragma", "no-cache")
			w.Header().Set("Expires", "0")
		}

		// "Bezpieczne" serwowanie pliku
		http.ServeFile(w, r, fullPath)
	}))

	// WEBSOCKET
	wwwMux.HandleFunc("/ws", handleWebSocket)

	// HEALTH CHECK
	wwwMux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)

		if _, err := w.Write([]byte(`{"status":"ok"}`)); err != nil {
			return
		}
	})

	// ROUTING STRON (z autoryzacją)
	wwwMux.HandleFunc("/", handlePages)

	// SERWER API – CORS + Rate Limit
	apiMux := http.NewServeMux()

	// Endpointy dla Panelu Admina (Frontend -> Go proxy do Rusta)
	apiMux.HandleFunc("/api/admin/images/", authMiddleware("Admin")(uploadFilesHandler))
	apiMux.HandleFunc("/api/admin/models/", authMiddleware("Admin")(uploadFilesHandler))
	// Zapewne masz coś w tym stylu (mux, chi, lub standardowy http.ServeMux):
	apiMux.HandleFunc("/api/products", getProductsProxyHandler)  // <-- Dla POST/GET
	apiMux.HandleFunc("/api/products/", getProductsProxyHandler) // <-- Dla PUT/DELETE z ID
	apiMux.HandleFunc("/api/model_ops", authMiddleware("Admin")(getModelsRefreshHandler))
	apiMux.HandleFunc("/api/model_ops/", authMiddleware("Admin")(getModelsRefreshHandler))
	apiMux.HandleFunc("/api/model_ops/refresh", authMiddleware("Admin")(getModelsRefreshHandler))
	// Endpointy zwrotne, międzyserwerowe
	apiMux.HandleFunc("/api/sync/all/", authMiddleware("Admin")(syncAllDataHandler))
	apiMux.HandleFunc("/api/produkty/", rustFilesUploadHandler)
	apiMux.HandleFunc("/api/upload/json/", rustJsonUploadHandler)
	apiMux.HandleFunc("/api/products/by-name/", getProductByNameIdProxyHandler)
	// Endpoint bazowy do pobierania listy i tworzenia użytkownika (POST / GET)
	apiMux.HandleFunc("/api/admin/usr", authMiddleware("Admin")(adminUsersProxyHandler))
	apiMux.HandleFunc("/api/admin/orders", authMiddleware("Admin")(adminUsersProxyHandler))

	// Endpoint z parametrem do pobierania pojedynczego i edycji (GET / PUT / DELETE)
	apiMux.HandleFunc("/api/admin/usr/", authMiddleware("Admin")(adminUsersProxyHandler))
	apiMux.HandleFunc("/api/admin/orders/", authMiddleware("Admin")(adminUsersProxyHandler))
	apiMux.HandleFunc("/api/admin/check_response/", authMiddleware("Admin")(adminResponseCheckProxyHandler))

	apiMux.HandleFunc("/api/login", loginProxyHandler)
	apiMux.HandleFunc("/api/usr/self/data", authMiddleware("Admin", "User", "Legituser")(getUserOwnData))
	apiMux.HandleFunc("/api/usr/account", authMiddleware("Admin", "User", "Legituser")(userAccountOperations))
	apiMux.HandleFunc("/api/usr/account/", authMiddleware("Admin", "User", "Legituser")(userAccountOperations))
	apiMux.HandleFunc("/api/usr/self/orders", authMiddleware("Admin", "User", "Legituser")(getUserOwnOrders))
	apiMux.HandleFunc("/api/usr/actions/order", putNewUserOrder)
	apiMux.HandleFunc("/api/getproducts", getProductsProxyHandler)
	apiMux.HandleFunc("/api/getproducts/", getProductsProxyHandler)
	apiMux.HandleFunc("/api/register", registerProxyHandler)
	apiMux.HandleFunc("/api/logout", logoutHandler)
	apiMux.HandleFunc("/api/me", authMiddleware("Admin", "User", "Legituser")(meHandler))

	// CORS dla API
	corsHandler := func(h http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Access-Control-Allow-Origin", "https://"+config.AdresWWW+":"+config.PortWWW)
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
			w.Header().Set("Access-Control-Allow-Credentials", "true")

			if r.Method == "OPTIONS" {
				w.WriteHeader(http.StatusOK)
				return
			}
			h.ServeHTTP(w, r)
		})
	}

	// API z CORS + Rate Limit
	//apiHandler := rateLimitMiddleware(corsHandler(apiMux))
	apiHandler := rateLimitMiddleware(authRateLimitMiddleware(corsHandler(apiMux)))

	portWWW := config.PortWWW
	portAPI := config.PortAPI
	adresWWW := config.AdresWWW
	//     adresAPI := config.RustHost

	// SERWER WWW
	srvWWW := &http.Server{
		//         Addr:    ":" + portWWW,
		Addr:    adresWWW + ":" + portWWW,
		Handler: wwwMux,
	}

	go func() {
		log.Printf("🌐 WWW Server on https://%s:%s", adresWWW, portWWW)
		if err := srvWWW.ListenAndServeTLS(config.CertFile, config.KeyFile); err != nil && err != http.ErrServerClosed {
			log.Fatal("WWW Server: ", err)
		}
	}()

	// SERWER API
	srvAPI := &http.Server{
		Addr:    adresWWW + ":" + portAPI,
		Handler: apiHandler,
	}

	go func() {
		log.Printf("🔌 API Server on https://%s:%s", adresWWW, portAPI)
		if err := srvAPI.ListenAndServeTLS(config.CertFile, config.KeyFile); err != nil && err != http.ErrServerClosed {
			log.Fatal("API Server: ", err)
		}
	}()

	// GRACEFUL SHUTDOWN
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, os.Interrupt, syscall.SIGTERM)
	<-quit
	log.Println("Shutting down servers...")

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := srvWWW.Shutdown(ctx); err != nil {
		log.Printf("WWW Shutdown error: %v", err)
	}
	if err := srvAPI.Shutdown(ctx); err != nil {
		log.Printf("API Shutdown error: %v", err)
	}

	log.Println("Servers stopped gracefully, YO! ;)")
}
