
# ETAP 1 – BUDOWANIE

FROM golang:latest AS builder

RUN apk add --no-cache git ca-certificates tzdata
WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download
RUN go mod verify

COPY . .
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -a -installsuffix cgo -o server .


# ETAP 2 – LEKKI OBRAZ WYKONAWCZY

FROM debian:trixie-slim AS runner
RUN apt-get update && apt-get install -y ca-certificates tzdata && rm -rf /var/lib/apt/lists/* \
ENV TZ=Europe/Warsaw
WORKDIR /app

COPY --from=builder /app/server .

# Tworzy puste katalogi, żeby Go nie rzuciło błędem przed podpięciem wolumenów
RUN mkdir -p /app/data /app/static /app/pages /app/logs

EXPOSE 8443
EXPOSE 8444

CMD ["./server"]