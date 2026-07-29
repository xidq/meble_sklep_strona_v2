# Go Frontend Server for E-Commerce Platform

This repository contains the Go-based frontend server that acts as a reverse proxy and middleware layer for an e-commerce platform. It serves the static web interface, handles WebSocket connections, manages authentication, and proxies API requests to a Rust backend service.

## Overview

The server is built with Go and serves as the entry point for all client traffic. It provides:

- Static file serving with caching optimizations
- Authentication and authorization middleware
- API proxying to a Rust backend
- WebSocket connection management
- File upload handling for product images and 3D models
- Rate limiting and security headers
- Product data caching

## Architecture

```
Client Browser
      │
      ▼
┌─────────────────────────────────────────┐
│         Go Frontend Server              │
│  (Port WWW: 443, API: 8444)            │
│                                         │
│  ┌────────────┐   ┌──────────────────┐  │
│  │ Static     │   │   API Proxy     │  │
│  │ Files      │   │   to Rust       │  │
│  └────────────┘   └──────────────────┘  │
│  ┌────────────┐   ┌──────────────────┐  │
│  │ WebSocket  │   │  Upload         │  │
│  │ Handler    │   │  Handler        │  │
│  └────────────┘   └──────────────────┘  │
└─────────────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────────────┐
│         Rust Backend                    │
│  (Port: 8444)                          │
│                                         │
│  - Product Management                   │
│  - Order Processing                     │
│  - User Management                      │
│  - Authentication                       │
└─────────────────────────────────────────┘
```

## Key Features

### Authentication & Authorization

- JWT-based authentication with cookies
- Role-based access control (Admin, User, Legituser)
- Login rate limiting (5 attempts per IP per minute)
- Secure session management

### Product Management

- CRUD operations via API proxy
- Product listing with caching (5 minutes TTL)
- Product retrieval by name_id
- Automatic cache invalidation on modifications

### File Upload

- Multipart form uploads for product images and 3D models
- Automatic directory structure creation
- File type validation
- Support for .glb, .gltf, .dds, .png, .jpg, .jpeg, .webp, .avif

### WebSocket Support

- Bidirectional communication with Rust backend
- Authentication forwarding
- Message proxying between client and backend

### 3D Product Configurator

- Babylon.js-based 3D viewer
- Real-time material customization (wood, metal, glass)
- Dynamic price calculation
- Configuration export to shopping cart

### Administrative Dashboard

- User management with CRUD operations
- Order management with filtering and sorting
- Product management
- File upload interface for images and models
- API endpoint tester

### Shopping Cart

- Local storage-based cart
- Product configuration persistence
- Cart summary with pricing
- Checkout flow with order submission

### Security Features

- TLS/HTTPS with configurable certificates
- Content Security Policy headers
- XSS protection headers
- Rate limiting on all endpoints
- Path traversal protection for static files
- Security event logging

## Project Structure

```
.
├── main.go                 # Server entry point, routing configuration
├── handlers.go             # HTTP handlers, proxy logic, authentication
├── middleware.go           # Rate limiting, caching, security headers, compression
├── storage.go              # File upload handling, JSON processing, router.json management
├── security_logger.go      # Security event logging
├── config.go               # Configuration loading from .env
└── static/                 # Static assets directory
    ├── css/                # Stylesheets
    ├── js/                 # Client-side JavaScript
    │   ├── auth_ui.js      # Authentication UI components
    │   ├── websoc.js       # WebSocket client
    │   ├── lang.js         # Internationalization
    │   ├── admin_panel*.js # Admin dashboard modules
    │   ├── configurator.js # 3D product configurator
    │   ├── finalizacja.js  # Checkout logic
    │   └── user_page.js    # User profile management
    ├── pages/              # HTML templates
    └── data/               # Product data and router.json
```

## Setup

### Prerequisites

- Go 1.21 or higher
- TLS certificates (or self-signed for development)
- Rust backend service running

### Environment Variables

Create a `.env` file with the following configuration:

```
JWT_SECRET_KEY=your_jwt_secret_key
RUST_HOST=127.0.0.1
RUST_PORT=8444
ADRES_WWW=127.0.0.1
PORT_WWW=443
PORT_API=8444
STATIC_DIR=./static
PAGES_DIR=./pages
DATA_DIR=./data
CERT_FILE=./certs/cert.pem
KEY_FILE=./certs/key.pem
TIMEOUT_DEADLINE=10
SITE_DEADLINE=10
```

### Running

```
go run .
```

The server will start two HTTPS servers:
- WWW: Main application server (port 8443 by default)
- API: API server (port 8444 by default)

## API Endpoints

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/login | User login |
| POST | /api/register | User registration |
| POST | /api/logout | User logout |
| GET | /api/me | Get current user info |

### User Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/usr/self/data | Get own user data |
| GET/PUT/DELETE | /api/usr/account | Manage user account |
| GET | /api/usr/self/orders | Get own orders |
| POST | /api/usr/actions/order | Create new order |

### Admin

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST/PUT/DELETE | /api/admin/usr | User management |
| GET/PUT | /api/admin/orders | Order management |
| POST | /api/admin/images/{name_id} | Upload product images |
| POST | /api/admin/models/{name_id} | Upload 3D models |

### Products

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST/PUT/DELETE | /api/products | Product management |
| GET | /api/products/by-name/{name_id} | Get product by name_id |
| GET | /api/getproducts | Get product list (cached) |

### Uploads

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/produkty/{name_id} | File upload for products |
| POST | /api/upload/json/{type}/{name_id} | JSON configuration upload |

## Dependencies

- github.com/golang-jwt/jwt/v5 - JWT authentication
- github.com/gorilla/websocket - WebSocket support
- golang.org/x/time/rate - Rate limiting
- github.com/NYTimes/gziphandler - Gzip compression

## License

This project is proprietary software. All rights reserved.
