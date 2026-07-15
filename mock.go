package main

import (
    "net/http"
    "net/http/httptest"
)

// MockServer tworzy testowy serwer
func MockServer(handler http.Handler) *httptest.Server {
    return httptest.NewServer(handler)
}

// MockClient tworzy testowy klient HTTP
func MockClient() *http.Client {
    return &http.Client{}
}