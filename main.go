package main

import (
    "context"
    "log"
    "net/http"
    "os"
    "os/signal"
    "path/filepath"
    "strings"
    "syscall"
    "time"

    "github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
    CheckOrigin: func(r *http.Request) bool { return true },
}

func main() {
    // ============================================
    // SERWER WWW – strony + WebSocket
    // ============================================
    wwwMux := http.NewServeMux()

    // --- CSS z blokadą katalogów + security + cache + gzip ---
    wwwMux.Handle("/css/", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        // Blokada wyświetlania katalogów
        path := strings.TrimPrefix(r.URL.Path, "/css/")
        if path == "" || strings.HasSuffix(path, "/") {
            serveErrorPage(w, r, http.StatusForbidden, "Dostęp zabroniony", "Nie masz uprawnień do przeglądania tego katalogu.")
            return
        }

        // Serwuj plik z bezpieczeństwem, cache i gzip
        handler := securityHeaders(cacheMiddleware(gzipMiddleware(
            http.StripPrefix("/css/", http.FileServer(http.Dir("./css"))),
        )))
        handler.ServeHTTP(w, r)
    }))

    // --- JS z blokadą katalogów + security + cache + gzip ---
    wwwMux.Handle("/js/", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        // Blokada wyświetlania katalogów
        path := strings.TrimPrefix(r.URL.Path, "/js/")
        if path == "" || strings.HasSuffix(path, "/") {
            serveErrorPage(w, r, http.StatusForbidden, "Dostęp zabroniony", "Nie masz uprawnień do przeglądania tego katalogu.")
            return
        }

        // Serwuj plik z bezpieczeństwem, cache i gzip
        handler := securityHeaders(cacheMiddleware(gzipMiddleware(
            http.StripPrefix("/js/", http.FileServer(http.Dir("./js"))),
        )))
        handler.ServeHTTP(w, r)
    }))

    // --- DATA (bez cache, blokada katalogów) ---
    wwwMux.Handle("/data/", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
        w.Header().Set("Pragma", "no-cache")
        w.Header().Set("Expires", "0")

        path := strings.TrimPrefix(r.URL.Path, "/data/")
        if path == "" || strings.HasSuffix(path, "/") {
            serveErrorPage(w, r, http.StatusForbidden, "Dostęp zabroniony", "Nie masz uprawnień do przeglądania tego katalogu.")
            return
        }

        fullPath := filepath.Join(".", "data", path)
        info, err := os.Stat(fullPath)
        if err != nil {
            serveErrorPage(w, r, http.StatusNotFound, "Nie znaleziono pliku", "Plik '"+path+"' nie istnieje.")
            return
        }
        if info.IsDir() {
            serveErrorPage(w, r, http.StatusForbidden, "Dostęp zabroniony", "Nie masz uprawnień do przeglądania tego katalogu.")
            return
        }

        http.ServeFile(w, r, fullPath)
    }))

    // --- WEBSOCKET ---
    wwwMux.HandleFunc("/ws", handleWebSocket)

    // --- HEALTH CHECK ---
    wwwMux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
        w.Header().Set("Content-Type", "application/json")
        w.WriteHeader(http.StatusOK)
        w.Write([]byte(`{"status":"ok"}`))
    })

    // --- ROUTING STRON (z autoryzacją) ---
    wwwMux.HandleFunc("/", handlePages)

    // ============================================
    // SERWER API – CORS + Rate Limit
    // ============================================
    apiMux := http.NewServeMux()

    apiMux.HandleFunc("/api/upload/product", uploadProductHandler)
    apiMux.HandleFunc("/api/produkty/", uploadFilesHandler)
    apiMux.HandleFunc("/api/upload/json/", uploadJSONHandler)

    // CORS dla API
    corsHandler := func(h http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            w.Header().Set("Access-Control-Allow-Origin", "https://localhost:8443")
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
    apiHandler := rateLimitMiddleware(corsHandler(apiMux))

    // ============================================
    // URUCHOMIENIE – z Graceful Shutdown
    // ============================================
    portWWW := os.Getenv("PORT_WWW")
    if portWWW == "" {
        portWWW = "8443"
    }
    portAPI := os.Getenv("PORT_API")
    if portAPI == "" {
        portAPI = "8444"
    }

    // --- SERWER WWW ---
    srvWWW := &http.Server{
        Addr:    ":" + portWWW,
        Handler: wwwMux,
    }

    go func() {
        log.Printf("🌐 WWW Server on https://localhost:%s", portWWW)
        if err := srvWWW.ListenAndServeTLS("server.crt", "server.key"); err != nil && err != http.ErrServerClosed {
            log.Fatal("WWW Server: ", err)
        }
    }()

    // --- SERWER API ---
    srvAPI := &http.Server{
        Addr:    ":" + portAPI,
        Handler: apiHandler,
    }

    go func() {
        log.Printf("🔌 API Server on https://localhost:%s", portAPI)
        if err := srvAPI.ListenAndServeTLS("server.crt", "server.key"); err != nil && err != http.ErrServerClosed {
            log.Fatal("API Server: ", err)
        }
    }()

    // --- GRACEFUL SHUTDOWN ---
    quit := make(chan os.Signal, 1)
    signal.Notify(quit, os.Interrupt, syscall.SIGTERM)
    <-quit
    log.Println("🛑 Shutting down servers...")

    ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
    defer cancel()

    if err := srvWWW.Shutdown(ctx); err != nil {
        log.Printf("WWW Shutdown error: %v", err)
    }
    if err := srvAPI.Shutdown(ctx); err != nil {
        log.Printf("API Shutdown error: %v", err)
    }

    log.Println("✅ Servers stopped gracefully")
}