package main

import (
    "context"
    "embed"
    "encoding/json"
    "io/fs"
    "fmt"
    "html/template"
    "log"
    "net/http"
    "os"
    "strings"
    "sync"
    "time"
)

//go:embed web/templates/*.html web/static/*
var embeddedFS embed.FS

type Server struct {
    templates *template.Template
    broker    *Broker
}

type Broker struct {
    mu      sync.Mutex
    clients map[chan string]struct{}
}

func NewBroker() *Broker {
    return &Broker{clients: make(map[chan string]struct{})}
}

func (b *Broker) AddClient() chan string {
    ch := make(chan string, 8)
    b.mu.Lock()
    b.clients[ch] = struct{}{}
    b.mu.Unlock()
    return ch
}

func (b *Broker) RemoveClient(ch chan string) {
    b.mu.Lock()
    delete(b.clients, ch)
    b.mu.Unlock()
    close(ch)
}

func (b *Broker) Broadcast(msg string) {
    b.mu.Lock()
    for ch := range b.clients {
        select {
        case ch <- msg:
        default:
            // drop if slow
        }
    }
    b.mu.Unlock()
}

func main() {
    tpls := template.Must(template.New("").Funcs(template.FuncMap{
        "nl2br": func(s string) template.HTML {
            escaped := template.HTMLEscapeString(s)
            return template.HTML(strings.ReplaceAll(escaped, "\n", "<br>"))
        },
    }).ParseFS(embeddedFS, "web/templates/*.html"))

    srv := &Server{
        templates: tpls,
        broker:    NewBroker(),
    }

    mux := http.NewServeMux()

    mux.HandleFunc("/", srv.handleIndex)
    mux.HandleFunc("/chat", srv.handleChat)
    mux.HandleFunc("/monitor", srv.handleMonitor)
    mux.HandleFunc("/events", srv.handleEvents)
    mux.HandleFunc("/simulate", srv.handleSimulate)
    mux.HandleFunc("/log", srv.handleLog)

    // static assets
    fsStatic, err := fsSub("web/static")
    if err != nil {
        log.Fatalf("static fs: %v", err)
    }
    mux.Handle("/static/", http.StripPrefix("/static/", http.FileServer(fsStatic)))

    port := env("PORT", "3000")

    srv.broker.Broadcast("server: frontend starting...")

    s := &http.Server{
        Addr:              ":" + port,
        Handler:           logRequests(mux),
        ReadHeaderTimeout: 5 * time.Second,
        IdleTimeout:       60 * time.Second,
    }

    log.Printf("Web Frontend ready: http://127.0.0.1:%s", port)
    log.Printf("  • Chat:    http://127.0.0.1:%s/", port)
    log.Printf("  • Monitor: http://127.0.0.1:%s/monitor", port)
    if err := s.ListenAndServe(); err != nil && err != http.ErrServerClosed {
        log.Fatalf("server error: %v", err)
    }
}

func (s *Server) handleIndex(w http.ResponseWriter, r *http.Request) {
    if r.URL.Path != "/" {
        http.NotFound(w, r)
        return
    }
    s.render(w, r, "chat.html", map[string]any{
        "Title": "Assistant Chat",
    })
}

func (s *Server) handleMonitor(w http.ResponseWriter, r *http.Request) {
    s.render(w, r, "monitor.html", map[string]any{
        "Title": "Automation Monitor",
    })
}

func (s *Server) handleChat(w http.ResponseWriter, r *http.Request) {
    if r.Method != http.MethodPost {
        http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
        return
    }
    if err := r.ParseForm(); err != nil {
        http.Error(w, "bad form", http.StatusBadRequest)
        return
    }
    msg := strings.TrimSpace(r.Form.Get("message"))
    if msg == "" {
        w.WriteHeader(http.StatusNoContent)
        return
    }

    // Broadcast to monitor
    s.broker.Broadcast(fmt.Sprintf("chat:user: %s", msg))

    // Simple assistant echo (placeholder)
    reply := simpleReply(msg)
    s.broker.Broadcast(fmt.Sprintf("chat:assistant: %s", reply))

    // Return HTML snippet to append to conversation
    type M struct{ Role, Text string }
    var buf strings.Builder
    if err := s.templates.ExecuteTemplate(&buf, "message.html", M{Role: "user", Text: msg}); err != nil {
        http.Error(w, "tpl error", http.StatusInternalServerError)
        return
    }
    if err := s.templates.ExecuteTemplate(&buf, "message.html", M{Role: "assistant", Text: reply}); err != nil {
        http.Error(w, "tpl error", http.StatusInternalServerError)
        return
    }
    w.Header().Set("Content-Type", "text/html; charset=utf-8")
    _, _ = w.Write([]byte(buf.String()))
}

func (s *Server) handleEvents(w http.ResponseWriter, r *http.Request) {
    flusher, ok := w.(http.Flusher)
    if !ok {
        http.Error(w, "stream unsupported", http.StatusInternalServerError)
        return
    }
    w.Header().Set("Content-Type", "text/event-stream")
    w.Header().Set("Cache-Control", "no-cache")
    w.Header().Set("Connection", "keep-alive")

    ch := s.broker.AddClient()
    defer s.broker.RemoveClient(ch)

    // initial ping
    fmt.Fprintf(w, "event: ping\n")
    fmt.Fprintf(w, "data: ready\n\n")
    flusher.Flush()

    ticker := time.NewTicker(15 * time.Second)
    defer ticker.Stop()

    ctx := r.Context()
    for {
        select {
        case <-ctx.Done():
            return
        case <-ticker.C:
            fmt.Fprintf(w, "event: ping\n")
            fmt.Fprintf(w, "data: keepalive\n\n")
            flusher.Flush()
        case msg := <-ch:
            fmt.Fprintf(w, "data: %s\n\n", escapeSSE(msg))
            flusher.Flush()
        }
    }
}

func (s *Server) handleSimulate(w http.ResponseWriter, r *http.Request) {
    go func() {
        for i := 1; i <= 5; i++ {
            s.broker.Broadcast(fmt.Sprintf("automation: step %d/5 running...", i))
            time.Sleep(700 * time.Millisecond)
        }
        s.broker.Broadcast("automation: complete ✔")
    }()
    w.Header().Set("Content-Type", "application/json")
    w.Write([]byte(`{"ok":true}`))
}

func (s *Server) handleLog(w http.ResponseWriter, r *http.Request) {
    // Accept either JSON {"message":"..."} or form field message
    var body struct{ Message string `json:"message"` }
    ct := r.Header.Get("Content-Type")
    if strings.HasPrefix(ct, "application/json") {
        if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
            http.Error(w, "bad json", http.StatusBadRequest)
            return
        }
    } else {
        _ = r.ParseForm()
        body.Message = r.Form.Get("message")
    }
    msg := strings.TrimSpace(body.Message)
    if msg == "" {
        http.Error(w, "empty message", http.StatusBadRequest)
        return
    }
    s.broker.Broadcast(msg)
    w.Header().Set("Content-Type", "application/json")
    w.Write([]byte(`{"ok":true}`))
}

func (s *Server) render(w http.ResponseWriter, r *http.Request, name string, data any) {
    w.Header().Set("Content-Type", "text/html; charset=utf-8")
    if err := s.templates.ExecuteTemplate(w, name, data); err != nil {
        log.Printf("render error %s: %v", name, err)
        http.Error(w, "template error", http.StatusInternalServerError)
    }
}

func logRequests(h http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        t0 := time.Now()
        h.ServeHTTP(w, r)
        log.Printf("%s %s %s", r.Method, r.URL.Path, time.Since(t0).Truncate(time.Millisecond))
    })
}

func env(k, def string) string {
    if v := os.Getenv(k); v != "" {
        return v
    }
    return def
}

func simpleReply(q string) string {
    // Placeholder assistant logic; replace with LLM router call as needed.
    q = strings.TrimSpace(q)
    if q == "" {
        return "How can I help today?"
    }
    // Tiny canned behaviors
    lower := strings.ToLower(q)
    switch {
    case strings.Contains(lower, "hello") || strings.Contains(lower, "hi"):
        return "Hello! 👋 What would you like to do?"
    case strings.HasPrefix(lower, "open monitor"):
        return "Click the ‘Open Monitor’ button to pop out the window."
    default:
        return fmt.Sprintf("Got it — you said: %s", q)
    }
}

func escapeSSE(s string) string {
    // Basic escaping for SSE data lines
    s = strings.ReplaceAll(s, "\n", " ")
    return s
}

// fsSub returns an http.FileSystem from the embedded FS under a path.
func fsSub(path string) (http.FileSystem, error) {
    sub, err := fs.Sub(embeddedFS, path)
    if err != nil {
        return nil, err
    }
    return http.FS(sub), nil
}

// Graceful shutdown helper (unused now, kept for extension)
func shutdown(ctx context.Context, s *http.Server) {
    _ = s.Shutdown(ctx)
}
