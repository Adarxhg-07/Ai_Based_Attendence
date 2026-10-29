# Deployment Plan: Zero-Budget, Always-Available Hosting

## Context
The system works locally but needs to be accessible from anywhere (advisor's PC, any browser). Constraints: zero budget, laptop can't run 24/7. The main bottleneck is the AI service needing 2-4GB RAM for TensorFlow, while most free tiers only offer 256-512MB.

## Recommendation: Oracle Cloud Always Free

**Oracle Cloud gives you a free ARM VM with 4 CPUs, 24GB RAM, 200GB disk — always on, forever free.** This is the only free option that comfortably runs the full stack on a single machine.

### Architecture

```
[Internet] --> [your-app.duckdns.org (HTTPS)]
                        |
                   [Nginx on Oracle VM]
                   /         \
    Static files (frontend)   Reverse proxy
                              /           \
                   Backend :3000      AI Service :8000
                   (Node.js+SQLite)   (FastAPI+TF+FaceNet)
```

Everything runs on one machine. Nginx serves the frontend and proxies `/api/v1/*` to the backend.

---

## Step-by-Step Implementation

### 1. Create Oracle Cloud Account
- Sign up at https://oracle.com/cloud/free (use a credit/debit card for verification — you will NOT be charged)
- Choose a less popular region if your preferred one is full (Zurich, Osaka, Sao Paulo have better availability)
- Create an **Ampere A1** VM: 4 OCPU, 24GB RAM, Ubuntu 22.04 (aarch64)
- Open ports **80** and **443** in the VCN security list
- Note down the VM's public IP address

### 2. SSH In & Install Dependencies
```bash
# Connect to VM
ssh -i <your-key.pem> ubuntu@<VM-PUBLIC-IP>

# System updates
sudo apt update && sudo apt upgrade -y
sudo apt install -y nginx certbot python3-certbot-nginx git

# Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Python 3.10+
sudo apt install -y python3 python3-pip python3-venv

# Verify
node -v    # should be 18.x
python3 --version  # should be 3.10+
nginx -v
```

### 3. Clone Repository
```bash
sudo mkdir -p /opt/attendance
sudo chown ubuntu:ubuntu /opt/attendance
git clone https://github.com/Adarxhg-07/Ai_based_Attendence.git /opt/attendance
```

### 4. Deploy Backend
```bash
cd /opt/attendance/backend
npm install
npx prisma generate
npx prisma migrate deploy
```

Create production `.env` file:
```bash
cat > /opt/attendance/backend/.env << 'EOF'
PORT=3000
NODE_ENV=production
DATABASE_URL=file:./prisma/dev.db
JWT_ACCESS_SECRET=$(openssl rand -hex 32)
JWT_REFRESH_SECRET=$(openssl rand -hex 32)
AI_SERVICE_URL=http://localhost:8000
AI_SERVICE_API_KEY=attendance-system-key
AI_SERVICE_TIMEOUT=120000
CORS_ORIGIN=https://your-app.duckdns.org
STORAGE_PATH=./storage
MAX_FILE_SIZE=10485760
ALLOWED_FILE_TYPES=image/jpeg,image/png,image/webp
RATE_LIMIT_WINDOW=900000
RATE_LIMIT_MAX=100
EOF
```

**Important:** Replace `your-app.duckdns.org` with your actual domain.

Seed the database:
```bash
npx tsx prisma/seed.ts
```

Build TypeScript:
```bash
# If there's a build script in package.json:
npm run build

# Otherwise compile directly:
npx tsc
```

Create systemd service:
```bash
sudo tee /etc/systemd/system/attendance-backend.service << 'EOF'
[Unit]
Description=Attendance System Backend
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/opt/attendance/backend
ExecStart=/usr/bin/node dist/app.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF
```

### 5. Deploy AI Service
```bash
cd /opt/attendance/ai-service
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

Create systemd service:
```bash
sudo tee /etc/systemd/system/attendance-ai.service << 'EOF'
[Unit]
Description=Attendance AI Service
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/opt/attendance/ai-service
ExecStart=/opt/attendance/ai-service/venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF
```

### 6. Transfer Data from Laptop to VM

From your laptop (Git Bash or PowerShell), copy the pre-generated data:

```bash
# Encodings (9.4MB - the face embeddings for all 112 students)
scp -i <your-key.pem> -r ai-service/encodings/ ubuntu@<VM-IP>:/opt/attendance/ai-service/

# SVM model (11MB - the trained classifier)
scp -i <your-key.pem> -r ai-service/svm_model/ ubuntu@<VM-IP>:/opt/attendance/ai-service/

# Database (500KB - all student/course/user data)
scp -i <your-key.pem> backend/prisma/dev.db ubuntu@<VM-IP>:/opt/attendance/backend/prisma/
```

**Alternative:** Copy the entire `Data received/` folder (~400MB) to the VM and re-run:
```bash
cd /opt/attendance/ai-service
source venv/bin/activate
python generate_encodings.py --force
```

### 7. Build & Serve Frontend
```bash
cd /opt/attendance/frontend
npm install
npm run build
sudo mkdir -p /var/www/attendance
sudo cp -r dist/* /var/www/attendance/
```

### 8. Configure Nginx

```bash
sudo tee /etc/nginx/sites-available/attendance << 'EOF'
server {
    listen 80;
    server_name your-app.duckdns.org;

    # Frontend - serve static React build
    root /var/www/attendance;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Backend API - reverse proxy
    location /api/v1/ {
        proxy_pass http://localhost:3000/api/v1/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;     # face recognition can be slow
        proxy_send_timeout 120s;
        client_max_body_size 50M;    # allow image uploads
    }
}
EOF

# Enable the site
sudo ln -s /etc/nginx/sites-available/attendance /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Test and reload
sudo nginx -t
sudo systemctl reload nginx
```

### 9. Free Domain + HTTPS

#### DuckDNS (free subdomain):
1. Go to https://www.duckdns.org
2. Login with your GitHub account
3. Create a subdomain (e.g., `fyp-attendance`)
4. Point it to your VM's public IP
5. Your app will be at `fyp-attendance.duckdns.org`

#### Let's Encrypt (free HTTPS):
```bash
sudo certbot --nginx -d your-app.duckdns.org
# Follow the prompts, select "redirect HTTP to HTTPS"
```

Certbot auto-renews. Verify with:
```bash
sudo certbot renew --dry-run
```

### 10. Start Everything
```bash
# Enable services to start on boot
sudo systemctl enable attendance-ai attendance-backend nginx

# Start services
sudo systemctl start attendance-ai
# Wait 60 seconds for AI models to load
sleep 60
sudo systemctl start attendance-backend

# Check status
sudo systemctl status attendance-ai attendance-backend nginx
```

### 11. Verify
```bash
# Test AI service
curl http://localhost:8000/health

# Test backend
curl http://localhost:3000/api/v1/auth/profile

# Test from browser
# Open https://your-app.duckdns.org
```

---

## Monitoring & Maintenance

### View logs:
```bash
sudo journalctl -u attendance-backend -f   # backend logs
sudo journalctl -u attendance-ai -f        # AI service logs
sudo tail -f /var/log/nginx/access.log     # web access logs
```

### Restart services:
```bash
sudo systemctl restart attendance-backend
sudo systemctl restart attendance-ai
```

### Update code:
```bash
cd /opt/attendance
git pull origin main

# Rebuild backend
cd backend && npm install && npm run build
sudo systemctl restart attendance-backend

# Rebuild frontend
cd ../frontend && npm install && npm run build
sudo cp -r dist/* /var/www/attendance/

# Restart AI if changed
cd ../ai-service
source venv/bin/activate && pip install -r requirements.txt
sudo systemctl restart attendance-ai
```

---

## System Requirements Summary

| Resource | Required | Oracle Free Tier Provides |
|----------|----------|--------------------------|
| RAM | 2-4GB (AI) + 256MB (Backend) | **24GB** |
| CPU | 2 cores minimum | **4 ARM cores** |
| Disk | ~500MB (code+data+DB) | **200GB** |
| Network | Always-on, public IP | **Yes** |
| Cost | $0 | **$0 forever** |

---

## Default Credentials
- Admin: `admin@university.edu` / `admin123`
- Teacher: `teacher@university.edu` / `teacher123`
- Tester: `tester@university.edu` / `tester123`

---

## Code Changes Required

**Zero code changes.** All configuration is already environment-driven:
- Backend reads `AI_SERVICE_URL`, `CORS_ORIGIN`, `JWT_*` from `.env`
- Frontend uses relative `/api/v1` URLs (proxied by Nginx in production)
- AI service binds to `0.0.0.0` by default

---

## Fallback: Split Architecture (If Oracle Signup Fails)

If Oracle Cloud account creation fails, split across three free platforms:

| Component | Platform | RAM | Persistent Disk | Always On |
|-----------|----------|-----|-----------------|-----------|
| Frontend | **Cloudflare Pages** | N/A (CDN) | N/A | Yes |
| Backend | **Railway.app** ($5/mo free credit) | 512MB | 8GB | Yes (within credit) |
| AI Service | **Hugging Face Spaces** (Docker) | **16GB** | Ephemeral | No (sleeps after 30min) |

### Fallback Trade-offs:
- AI service sleeps after 30min idle → 90-second cold start when waking
- Need `_redirects` file on Cloudflare to proxy API calls to Railway
- Three platforms to manage instead of one
- Railway's $5/month credit may run out under heavy use
- Encodings must be baked into Docker image (HF Spaces has ephemeral storage)

### Fallback Setup:
1. **Cloudflare Pages**: Connect GitHub repo, build command `cd frontend && npm run build`, output `frontend/dist`. Add `public/_redirects`:
   ```
   /api/v1/*  https://your-app.up.railway.app/api/v1/:splat  200
   ```

2. **Railway.app**: Connect GitHub repo, set root to `backend/`, set env vars, start command:
   ```
   npx prisma migrate deploy && node dist/app.js
   ```

3. **Hugging Face Spaces**: Create Docker Space with Dockerfile:
   ```dockerfile
   FROM python:3.10-slim
   WORKDIR /app
   COPY ai-service/requirements.txt .
   RUN pip install -r requirements.txt
   COPY ai-service/ .
   EXPOSE 8000
   CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
   ```

**Only use the fallback if Oracle Cloud signup fails.**
