package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"stepflow/backend/internal/handlers"
	"stepflow/backend/internal/storage"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = os.Getenv("BACKEND_PORT")
		if port == "" {
			port = "8080"
		}
	}

	dbPath := os.Getenv("STEPFLOW_DB_PATH")
	store, err := storage.New(dbPath)
	if err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}
	defer store.Close()

	srv := handlers.NewServer(store)
	mux := http.NewServeMux()

	mux.HandleFunc("GET /api/workspace", srv.HandleWorkspaceGet)
	mux.HandleFunc("POST /api/workspace", srv.HandleWorkspacePost)
	mux.HandleFunc("GET /api/search", srv.HandleSearchGet)
	mux.HandleFunc("POST /api/search", srv.HandleSearchPost)
	mux.HandleFunc("POST /api/ai/generate-guide", srv.HandleGenerateGuide)
	mux.HandleFunc("GET /api/guides/{id}", srv.HandleGuideGet)
	mux.HandleFunc("GET /api/health", srv.HandleHealth)
	mux.HandleFunc("GET /health", srv.HandleHealth)

	server := &http.Server{
		Addr:         ":" + port,
		Handler:      handlers.CorsMiddleware(mux),
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)

	go func() {
		log.Printf("StepFlow Go backend listening on port %s", port)
		if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatalf("Server failed: %v", err)
		}
	}()

	<-stop
	log.Println("Shutting down StepFlow backend...")

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := server.Shutdown(ctx); err != nil {
		log.Printf("Server forced shutdown: %v", err)
	}
	log.Println("StepFlow backend stopped.")
}
