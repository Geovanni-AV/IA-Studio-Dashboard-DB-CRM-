# Dockerfile - Fragmento de compilación Enterprise para Vite

FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci

# 🛡️ INYECCIÓN EN TIEMPO DE COMPILACIÓN (Build Args)
# Estas variables deben ser provistas por tu comando de despliegue o secret mánager
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY

# Mapeo explícito para que el proceso de Node/Vite las capture en caliente
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY

COPY . .
# El empaquetador ahora grabará a fuego los endpoints reales en el JS estático
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
