package main

import (
	"log"
	//     "log"
	"os"
	"strconv"
	"strings"

	"github.com/joho/godotenv"
)

type Config struct {
	// Serwer
	AdresWWW string
	PortWWW  string
	PortAPI  string

	JwtSecKey string

	// Rust
	RustHost string
	RustPort string
	RustURL  string

	// Ścieżki
	DataDir   string
	StaticDir string
	PagesDir  string

	// Bezpieczeństwo
	Environment           string
	BlockDirectoryListing bool
	TimeoutDeadline       int
	SiteDeadline          int

	// SSL
	CertFile string
	KeyFile  string

	// Rate Limit
	RateLimitRequests int
	RateLimitBurst    int

	// Logowanie
	LogLevel string
	LogFile  string
}

// LoadConfig wczytuje konfigurację z .env i zmiennych środowiskowych
func LoadConfig() *Config {
	if err := godotenv.Load(); err != nil {
		log.Println("Brak pliku .env – używam zmiennych środowiskowych")
	}
	cfg := &Config{
		AdresWWW:              getEnv("ADRES_WWW", ":"),
		TimeoutDeadline:       getEnvInt("TIMEOUT_DEADLINE", 60),
		SiteDeadline:          getEnvInt("SITE_DEADLINE", 5),
		JwtSecKey:             getEnv("JWT_SECRET_KEY", ""),
		PortWWW:               getEnv("PORT_WWW", "8443"),
		PortAPI:               getEnv("PORT_API", "8444"),
		RustHost:              getEnv("RUST_HOST", "127.0.0.1"),
		RustPort:              getEnv("RUST_PORT", "8080"),
		DataDir:               getEnv("DATA_DIR", "./data"),
		StaticDir:             getEnv("STATIC_DIR", "./"),
		PagesDir:              getEnv("PAGES_DIR", "./strony"),
		Environment:           getEnv("ENVIRONMENT", "development"),
		BlockDirectoryListing: getEnvBool("BLOCK_DIRECTORY_LISTING", true),
		CertFile:              getEnv("CERT_FILE", "./server.crt"),
		KeyFile:               getEnv("KEY_FILE", "./server.key"),
		RateLimitRequests:     getEnvInt("RATE_LIMIT_REQUESTS", 10),
		RateLimitBurst:        getEnvInt("RATE_LIMIT_BURST", 20),
		LogLevel:              getEnv("LOG_LEVEL", "info"),
		LogFile:               getEnv("LOG_FILE", "./server.log"),
	}

	cfg.RustURL = strings.TrimSuffix(cfg.RustHost, "/") + ":" + cfg.RustPort

	//     log.Printf("Konfiguracja wczytana: ENVIRONMENT=%s", cfg.Environment)
	return cfg
}

// getEnv pobiera zmienną środowiskową lub zwraca domyślną wartość
func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

// getEnvBool pobiera zmienną środowiskową jako bool lub zwraca domyślną wartość
func getEnvBool(key string, defaultValue bool) bool {
	if value := os.Getenv(key); value != "" {
		return strings.ToLower(value) == "true" || value == "1"
	}
	return defaultValue
}

// getEnvInt pobiera zmienną środowiskową jako int lub zwraca domyślną wartość
func getEnvInt(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		if i, err := strconv.Atoi(value); err == nil {
			return i
		}
	}
	return defaultValue
}
