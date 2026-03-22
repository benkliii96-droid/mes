# Наш приватный веб-мультитул

Приватное веб-приложение для пары с мессенджером, трансляцией экрана, общим календарём и отслеживанием менструального цикла.

## Функции

- 💬 **Мессенджер** - текстовые сообщения, фото, видео, голосовые сообщения и кружочки
- 📺 **Трансляция экрана** - P2P через WebRTC с передачей звука (Android)
- 📅 **Общий календарь** - события с напоминаниями и повторениями
- 🌸 **Менструальный цикл** - отслеживание и прогнозирование
- 🔔 **Push-уведомления** - новые сообщения и напоминания
- 🎨 **Настройки оформления** - светлая/тёмная тема, цветовые схемы
- 👁 **Статус "был(а) в сети"** - отображение последней активности

## Технологии

- **Клиент**: React + TypeScript + Vite
- **Сервер**: Node.js + Express + TypeScript
- **База данных**: PostgreSQL + Prisma
- **Real-time**: Socket.IO
- **WebRTC**: Peer-to-peer трансляция
- **Push**: Web Push API + Service Worker
- **Deployment**: Docker, Nginx

## Требования

- Node.js 18+
- PostgreSQL 14+
- Docker & Docker Compose (для деплоя)

---

## Установка и запуск (Docker)

### Быстрый старт

```bash
# Клонировать репозиторий
git clone <repo-url> my-app
cd my-app

# Запустить всё
docker-compose up --build -d

# Проверить статус
docker-compose ps
```

Приложение будет доступно:
- **Клиент**: http://localhost:5173
- **API**: http://localhost:3001

### Остановка

```bash
docker-compose down
```

---

## Установка и запуск (локально)

### Требования

- Node.js 18+
- PostgreSQL 14+

### 1. Установка зависимостей

```bash
npm install
```

### 2. Настройка базы данных

Создайте базу данных PostgreSQL:

```sql
CREATE DATABASE ourapp;
```

### 3. Настройка переменных окружения

```bash
cp server/.env.example server/.env
# Отредактируйте server/.env
```

### 4. Инициализация Prisma

```bash
cd server
npx prisma generate
npx prisma db push
```

### 5. Запуск

```bash
# Разработка (сервер + клиент)
npm run dev

# Или по отдельности:
npm run dev:server  # Сервер на http://localhost:3001
npm run dev:client  # Клиент на http://localhost:5173

# Production сборка
npm run build
npm run start
```

---

## Файлы для деплоя

### Docker файлы

```
├── docker-compose.yml      # Основной файл оркестрации
├── Dockerfile.server       # Сборка Node.js сервера
├── Dockerfile.client       # Сборка React клиента (Nginx)
└── nginx.conf              # Конфигурация Nginx
```

### Конфигурация

```
├── .env                    # Переменные окружения сервера
├── .gitignore              # Исключения для Git
├── server/.env             # Настройки БД, JWT, VAPID ключи
└── server/prisma/schema.prisma  # Схема базы данных
```

### Описание Docker файлов

#### docker-compose.yml
- `postgres` - база данных PostgreSQL
- `server` - Node.js API сервер (порт 3001)
- `client` - Nginx с React приложением (порт 5173)

#### Dockerfile.server
- Node.js 18 Alpine
- Установка зависимостей
- Генерация Prisma клиента
- Запуск через tsx

#### Dockerfile.client
- Multi-stage сборка
- Vite сборка React
- Nginx Alpine для статики

#### nginx.conf
- Проксирование /api → server:3001
- Проксирование /socket.io → server:3001
- Проксирование /uploads → server:3001
- SPA fallback на index.html

---

## Использование

### Первый запуск

1. При первом запуске автоматически создаются два пользователя:
   - "Он" (ID: 1)
   - "Она" (ID: 2)
2. Пароль по умолчанию: `ourlove`

### Вход

1. Откройте приложение в браузере
2. Выберите аккаунт (Он/Она)
3. Введите пароль
4. Нажмите "Войти"

### Мессенджер

- Отправка текстовых сообщений
- Загрузка фото/видео из галереи
- Запись голосовых сообщений (удерживайте кнопку микрофона)
- Запись кружочков (коротких видео)
- Статус прочтения (одна галочка - отправлено, две - прочитано)

### Трансляция экрана

1. Перейдите на вкладку трансляции
2. Нажмите "Начать трансляцию"
3. Выберите экран для демонстрации
4. Звук передаётся на Android-устройствах

### Календарь

- Просмотр месяца
- Создание событий (название, дата, время, повторение, напоминание)
- События могут быть однократными или ежегодными

### Менструальный цикл

1. Перейдите в календарь
2. Нажмите "Добавить день цикла"
3. Укажите дату начала месячных
4. После 2+ записей появляется прогноз

### Настройки

- **Аватар** - загрузка/удаление
- **Имя** - изменение никнейма
- **Оформление**: режим (светлый/тёмный/системный), цветовая схема
- **Уведомления** - вкл/выкл напоминаний календаря

---

## Структура проекта

```
├── .gitignore              # Исключения Git
├── README.MD               # Этот файл
├── package.json            # Корневой пакет (workspaces)
├── docker-compose.yml      # Docker оркестрация
├── Dockerfile.server       # Docker сервера
├── Dockerfile.client       # Docker клиента
├── nginx.conf              # Nginx конфиг
│
├── client/                 # React приложение
│   ├── src/
│   │   ├── components/     # Компоненты (Navigation)
│   │   ├── context/        # React Context (Auth, Theme)
│   │   ├── pages/          # Страницы (Chat, Calendar, Settings, ScreenShare, Login)
│   │   └── styles/         # CSS стили
│   ├── public/             # Статика (sw.js, favicon.svg)
│   ├── index.html
│   ├── vite.config.ts
│   └── tsconfig.json
│
└── server/                 # Node.js сервер
    ├── src/
    │   ├── middleware/     # Auth middleware
    │   ├── routes/         # API роуты
    │   │   ├── auth.ts     # /auth/*
    │   │   ├── messages.ts # /messages/*
    │   │   ├── events.ts   # /events/*
    │   │   ├── cycle.ts    # /cycle/*
    │   │   ├── user.ts     # /user/*
    │   │   ├── push.ts     # /push/*
    │   │   └── upload.ts   # /upload/*
    │   ├── services/       # Бизнес-логика
    │   │   ├── socketService.ts
    │   │   └── cronService.ts
    │   └── index.ts        # Точка входа
    ├── prisma/
    │   └── schema.prisma   # Схема БД
    ├── uploads/            # Загруженные файлы
    ├── avatars/            # Аватары пользователей
    ├── .env                # Переменные окружения
    └── tsconfig.json
```

---

## API Endpoints

| Метод | Путь | Описание |
|-------|------|----------|
| POST | `/auth/login` | Вход |
| GET | `/auth/verify` | Проверка токена |
| POST | `/auth/change-password` | Смена пароля |
| POST | `/auth/logout` | Выход |
| GET | `/messages` | История сообщений |
| POST | `/messages/read` | Отметить прочитанным |
| POST | `/upload` | Загрузка файла |
| GET | `/events` | События календаря |
| POST | `/events` | Создание события |
| PUT | `/events/:id` | Обновление события |
| DELETE | `/events/:id` | Удаление события |
| GET | `/cycle/entries` | Записи цикла |
| POST | `/cycle/entries` | Добавить запись |
| GET | `/cycle/predict` | Прогноз цикла |
| GET | `/user` | Настройки пользователя |
| PUT | `/user` | Обновить настройки |
| GET | `/user/last-seen/:id` | Статус онлайна |
| POST | `/push/subscribe` | Подписка на push |
| GET | `/push/vapid-key` | VAPID публичный ключ |

## WebSocket события

### Чат
- `send_message` → `new_message`
- `mark_read` → `message_read`

### WebRTC (трансляция)
- `join_room`
- `webrtc_offer`
- `webrtc_answer`
- `webrtc_ice_candidate`
- `stop_screen_share`

### Статус
- `user_status` - онлайн/офлайн

---

## Переменные окружения (server/.env)

```env
# База данных
DATABASE_URL="postgresql://postgres:password@localhost:5432/ourapp"

# JWT
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=7d

# Сервер
PORT=3001
CLIENT_URL=http://localhost:5173

# Пароль по умолчанию
DEFAULT_PASSWORD=ourlove

# VAPID для push-уведомлений
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:email@example.com

# STUN для WebRTC
STUN_SERVER=stun:stun.l.google.com:19302
```

---

## Лицензия

Private - только для личного использования

---

## Содержимое Docker и Nginx файлов

### docker-compose.yml

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:14
    container_name: ourapp-db
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
      POSTGRES_DB: ourapp
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  server:
    build: 
      context: .
      dockerfile: Dockerfile.server
    container_name: ourapp-server
    environment:
      DATABASE_URL: postgresql://postgres:password@postgres:5432/ourapp
      JWT_SECRET: our-private-jwt-secret-key-2024
      JWT_EXPIRES_IN: 7d
      PORT: 3001
      CLIENT_URL: http://localhost:5173
      DEFAULT_PASSWORD: ourlove
      VAPID_PUBLIC_KEY: BF_7w2RPpMuasYHjsy9D-wYzyNJe10er9bmJj8hatSATshm_OViKApx4abLXlWan79NNvabIOd2_hVIO76IrSHY
      VAPID_PRIVATE_KEY: 76BXg6TPJo4sFgb9vmL9gt4ZwD5RT2b2bN-A14t-fRU
      VAPID_SUBJECT: mailto:benkliii96@gmail.com
      STUN_SERVER: stun:stun.l.google.com:19302
    ports:
      - "3001:3001"
    depends_on:
      - postgres
    volumes:
      - ./server/uploads:/app/uploads
      - ./server/avatars:/app/avatars

  client:
    build:
      context: .
      dockerfile: Dockerfile.client
    container_name: ourapp-client
    ports:
      - "5173:80"
    depends_on:
      - server

volumes:
  postgres_data:
```

### Dockerfile.server

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY server/package*.json ./server/
COPY server/tsconfig.json ./server/
COPY server/src ./server/src/
COPY server/prisma ./server/prisma/

WORKDIR /app/server
RUN npm install
RUN npx prisma generate

EXPOSE 3001

CMD ["npx", "tsx", "src/index.ts"]
```

### Dockerfile.client

```dockerfile
FROM node:18-alpine AS builder

WORKDIR /app
COPY client/package*.json ./client/
COPY client/vite.config.ts ./client/
COPY client/tsconfig*.json ./client/
COPY client/index.html ./client/
COPY client/src ./client/src/
COPY client/public ./client/public/
RUN npm install --workspace=client
RUN npm run build --workspace=client

FROM nginx:alpine
COPY --from=builder /app/client/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### nginx.conf

```nginx
server {
    listen 80;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass http://server:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    location /uploads {
        proxy_pass http://server:3001;
    }

    location /avatars {
        proxy_pass http://server:3001;
    }

    location /socket.io {
        proxy_pass http://server:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```