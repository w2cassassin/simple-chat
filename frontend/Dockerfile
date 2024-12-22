# Этап сборки
FROM node:20-alpine AS builder

WORKDIR /app

# Копируем файлы и устанавливаем зависимости
COPY package*.json ./
RUN npm ci

# Копируем исходный код и создаём сборку
COPY . .
ENV PUBLIC_URL=/chat
ENV REACT_APP_PUBLIC_URL=/chat
ENV PORT=3000
RUN npm run build

# Этап запуска
FROM node:20-alpine

WORKDIR /app

# Устанавливаем `serve` для раздачи статики
RUN npm install -g serve

# Копируем собранные файлы
COPY --from=builder /app/build ./build

# Открываем порт для serve
EXPOSE 8015

# Запускаем `serve`
CMD ["serve", "-s", "build", "--cors", "-l", "8015"]
