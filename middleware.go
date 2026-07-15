package main

import (
    "net/http"
    "golang.org/x/time/rate"
    "github.com/NYTimes/gziphandler"
)

// Rate Limiter – 10 req/s, burst 20
var limiter = rate.NewLimiter(rate.Limit(10), 20)

func rateLimitMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        if !limiter.Allow() {
            http.Error(w, "Too Many Requests", http.StatusTooManyRequests)
            return
        }
        next.ServeHTTP(w, r)
    })
}

// Cache dla plików statycznych (1 rok)
func cacheMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        w.Header().Set("Cache-Control", "public, max-age=31536000")
        w.Header().Set("ETag", `"static-v1"`)
        next.ServeHTTP(w, r)
    })
}

// Security Headers
func securityHeaders(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        w.Header().Set("X-Content-Type-Options", "nosniff")
        w.Header().Set("X-Frame-Options", "DENY")
        w.Header().Set("X-XSS-Protection", "1; mode=block")
        w.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")
        w.Header().Set("Content-Security-Policy", "default-src 'self'")
        next.ServeHTTP(w, r)
    })
}

// Gzip Compression dla plików statycznych
func gzipMiddleware(next http.Handler) http.Handler {
    return gziphandler.GzipHandler(next)
}