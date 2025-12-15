# 🚀 Script de Inicio Rápido - MercadoPago

# Este script te ayuda a iniciar el proyecto con la nueva integración de MercadoPago

Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "🎴 ECOS DEL ORÁCULO - MERCADOPAGO" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

# Verificar que existe el archivo .env
$envPath = ".\Ecos-backend\.env"
if (!(Test-Path $envPath)) {
    Write-Host "⚠️  No se encontró el archivo .env" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Creando archivo .env desde .env.example..." -ForegroundColor Yellow
    
    if (Test-Path ".\Ecos-backend\.env.example") {
        Copy-Item ".\Ecos-backend\.env.example" $envPath
        Write-Host "✅ Archivo .env creado" -ForegroundColor Green
        Write-Host ""
        Write-Host "⚠️  IMPORTANTE: Edita el archivo .env y configura:" -ForegroundColor Yellow
        Write-Host "   - MERCADOPAGO_ACCESS_TOKEN (ya está configurado para pruebas)" -ForegroundColor Yellow
        Write-Host "   - BACKEND_URL (por defecto: http://localhost:3010)" -ForegroundColor Yellow
        Write-Host "   - FRONTEND_URL (por defecto: http://localhost:4200)" -ForegroundColor Yellow
        Write-Host ""
    } else {
        Write-Host "❌ No se encontró .env.example" -ForegroundColor Red
        Write-Host ""
        Write-Host "Crea manualmente el archivo .env con:" -ForegroundColor Yellow
        Write-Host "MERCADOPAGO_ACCESS_TOKEN=APP_USR-1393476095754998-121110-c9d79692a3bda835c7146d5aa20294a8-2240000410" -ForegroundColor White
        Write-Host "BACKEND_URL=http://localhost:3010" -ForegroundColor White
        Write-Host "FRONTEND_URL=http://localhost:4200" -ForegroundColor White
        Write-Host "PORT=3010" -ForegroundColor White
        Write-Host ""
        Read-Host "Presiona Enter después de crear el archivo .env"
    }
}

Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "📦 PASO 1: Instalar Dependencias" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

$installDeps = Read-Host "¿Instalar dependencias del backend? (s/n)"
if ($installDeps -eq "s") {
    Write-Host "📥 Instalando dependencias del backend..." -ForegroundColor Yellow
    Set-Location ".\Ecos-backend"
    npm install
    Set-Location ".."
    Write-Host "✅ Dependencias instaladas" -ForegroundColor Green
    Write-Host ""
}

Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "🔨 PASO 2: Compilar TypeScript" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "El compilador TypeScript ya está corriendo en otra terminal" -ForegroundColor Green
Write-Host "Si no está corriendo, abre otra terminal y ejecuta:" -ForegroundColor Yellow
Write-Host "   cd Ecos-backend" -ForegroundColor White
Write-Host "   npm run typescript" -ForegroundColor White
Write-Host ""

Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "🚀 PASO 3: Iniciar Servidores" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Abre 2 terminales separadas:" -ForegroundColor Yellow
Write-Host ""
Write-Host "Terminal 1 - Backend:" -ForegroundColor Cyan
Write-Host "   cd Ecos-backend" -ForegroundColor White
Write-Host "   npm run dev" -ForegroundColor White
Write-Host ""
Write-Host "Terminal 2 - Frontend:" -ForegroundColor Cyan
Write-Host "   cd Ecos-oraculo" -ForegroundColor White
Write-Host "   ng serve" -ForegroundColor White
Write-Host ""

Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "🧪 PASO 4: Probar la Integración" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "1. Abre el navegador en: http://localhost:4200" -ForegroundColor White
Write-Host "2. Navega a la sección de tarot" -ForegroundColor White
Write-Host "3. Selecciona cartas" -ForegroundColor White
Write-Host "4. Haz clic en 'Realizar Pago'" -ForegroundColor White
Write-Host "5. Serás redirigido a MercadoPago (Sandbox)" -ForegroundColor White
Write-Host ""

Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "💳 Tarjetas de Prueba" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Visa Aprobada:" -ForegroundColor Green
Write-Host "   Número: 4013 5406 8274 6260" -ForegroundColor White
Write-Host "   CVV: 123" -ForegroundColor White
Write-Host "   Fecha: Cualquier fecha futura" -ForegroundColor White
Write-Host ""
Write-Host "Mastercard Aprobada:" -ForegroundColor Green
Write-Host "   Número: 5031 7557 3453 0604" -ForegroundColor White
Write-Host "   CVV: 123" -ForegroundColor White
Write-Host "   Fecha: Cualquier fecha futura" -ForegroundColor White
Write-Host ""
Write-Host "Tarjeta Rechazada (para probar errores):" -ForegroundColor Red
Write-Host "   Número: 4013 5406 8274 6269" -ForegroundColor White
Write-Host ""

Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "📚 Documentación" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Lee la documentación completa en:" -ForegroundColor Yellow
Write-Host "   MERCADOPAGO_INTEGRATION.md" -ForegroundColor White
Write-Host ""

Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "🎉 ¡Todo Listo!" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "La integración de MercadoPago está configurada." -ForegroundColor Green
Write-Host ""
Write-Host "Recuerda:" -ForegroundColor Yellow
Write-Host "✅ Estás usando el modo SANDBOX (pruebas)" -ForegroundColor Yellow
Write-Host "✅ No se realizarán cobros reales" -ForegroundColor Yellow
Write-Host "✅ Para producción, actualiza MERCADOPAGO_ACCESS_TOKEN" -ForegroundColor Yellow
Write-Host ""

Read-Host "Presiona Enter para salir"
