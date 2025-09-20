# Development SSL Certificates
This directory contains self-signed SSL certificates for development use.
## Files
- `certificate.crt` - Self-signed SSL certificate

- `private.key` - Private key for the certificate

- `cert.conf` - Certificate configuration used during generation

- `https-dev-server.js` - Development HTTPS proxy server
## Usage
### Option 1: Run HTTPS development server

```bash

npm run dev:https

```
This starts an HTTPS proxy server on port 9443 that forwards requests to your main application on port 9999.
### Option 2: Configure main server for HTTPS

Set environment variables:

```bash

HTTPS_ENABLED=true

SSL_CERT_PATH=/Users/christianmerrill/Desktop/universal-ai-tools/ssl/certificate.crt

SSL_KEY_PATH=/Users/christianmerrill/Desktop/universal-ai-tools/ssl/private.key

```
## Browser Warnings
Since these are self-signed certificates, browsers will show security warnings. This is expected and safe for development.
To bypass warnings:

1. Click "Advanced" or "Show details"

2. Click "Proceed to localhost (unsafe)" or similar
## Certificate Details
- **Subject:** CN=localhost, O=Universal AI Tools, L=Local, ST=Development, C=US

- **Valid for:** 365 days from generation

- **Domains:** localhost, 127.0.0.1, 0.0.0.0, *.localhost

- **Key size:** 2048 bits RSA
## Regeneration
To regenerate certificates (if expired or corrupted):

```bash

npm run ssl:setup

```
## Security Note
**Do not use these certificates in production!** They are for development only.
