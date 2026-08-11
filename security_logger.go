package main

import (
	"log"
	"os"
	"strings"
	//     "time"
	"fmt"
)

var securityLog *log.Logger

func init() {
	// Otwórz plik z logami bezpieczeństwa
	file, err := os.OpenFile("security.log", os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		log.Printf("Cannot open security.log: %v", err)
		// Fallback – pisz do stdout
		securityLog = log.New(os.Stdout, "[SECURITY] ", log.LstdFlags)
		return
	}
	securityLog = log.New(file, "", log.LstdFlags)
}

// LogSecurity – zapisuje zdarzenie z kontekstem
func LogSecurity(event string, details map[string]any) {
	if securityLog == nil {
		return
	}
	var msg strings.Builder
	msg.WriteString(fmt.Sprintf("%s | ", event))
	for k, v := range details {
		msg.WriteString(fmt.Sprintf("%s=%v ", k, v))
	}
	securityLog.Println(msg.String())
}
