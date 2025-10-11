FROM golang:1.21-alpine AS builder

WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o knowledge-gateway ./cmd/main.go

FROM alpine:latest
RUN apk --no-cache add ca-certificates curl
WORKDIR /root/

COPY --from=builder /app/knowledge-gateway .
COPY --from=builder /app/config ./config

EXPOSE 8088
CMD ["./knowledge-gateway"]
