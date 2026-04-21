#!/bin/bash
# =============================================================================
#  QuantumCRM — Docker Deploy Script
#  Actualiza el contenedor con los cambios de código más recientes.
#
#  Uso:
#    ./deploy.sh              → deploy inteligente (detecta si huedes deps)
#    ./deploy.sh --full       → reconstruir imagen completa (docker-compose up --build)
#    ./deploy.sh --hot        → solo copia archivos y reinicia el proceso Node (sin rebuild)
#    ./deploy.sh --status     → muestra el estado de los contenedores
#    ./deploy.sh --logs       → sigue los logs del servicio app en vivo
#    ./deploy.sh --stop       → detiene todos los contenedores
# =============================================================================

set -e  # Salir si ocurre cualquier error

# ── Colores ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# ── Configuración ─────────────────────────────────────────────────────────────
APP_SERVICE="app"                          # Nombre del servicio en docker-compose.yml
CONTAINER_WORKDIR="/usr/src/app"           # WORKDIR del Dockerfile
COMPOSE_FILE="docker-compose.yml"

# Archivos/directorios a copiar en modo --hot (sin rebuild)
# Separados por espacio, relativos al proyecto
HOT_DIRS="routes services middlewares config public"
HOT_FILES="app.js update_db.js"

# ── Helpers ───────────────────────────────────────────────────────────────────
log()    { echo -e "${CYAN}[$(date '+%H:%M:%S')]${NC} $1"; }
ok()     { echo -e "${GREEN}✔${NC}  $1"; }
warn()   { echo -e "${YELLOW}⚠${NC}  $1"; }
error()  { echo -e "${RED}✖${NC}  $1"; }
title()  { echo -e "\n${BOLD}${CYAN}══════════════════════════════════════════${NC}"; echo -e "${BOLD}  $1${NC}"; echo -e "${BOLD}${CYAN}══════════════════════════════════════════${NC}\n"; }

# ── Verificar que Docker esté corriendo ───────────────────────────────────────
check_docker() {
    if ! docker info &>/dev/null; then
        error "Docker no está corriendo. Inícialo primero."
        exit 1
    fi
}

# ── Obtener el ID del contenedor app ──────────────────────────────────────────
get_container_id() {
    docker compose ps -q "$APP_SERVICE" 2>/dev/null
}

# ── Modo: Status ──────────────────────────────────────────────────────────────
cmd_status() {
    title "Estado de los Contenedores"
    docker compose ps
    echo ""
    CONTAINER=$(get_container_id)
    if [ -n "$CONTAINER" ]; then
        echo -e "${GREEN}✔ Contenedor app corriendo:${NC} $CONTAINER"
        echo ""
        log "Uso de recursos:"
        docker stats --no-stream "$CONTAINER" 2>/dev/null || warn "No se pudo leer stats."
    else
        warn "El contenedor 'app' no está corriendo."
    fi
}

# ── Modo: Logs ────────────────────────────────────────────────────────────────
cmd_logs() {
    title "Logs en Vivo — QuantumCRM"
    log "Presiona Ctrl+C para salir"
    echo ""
    docker compose logs -f --tail=100 "$APP_SERVICE"
}

# ── Modo: Stop ────────────────────────────────────────────────────────────────
cmd_stop() {
    title "Deteniendo Contenedores"
    docker compose stop
    ok "Todos los contenedores detenidos."
}

# ── Modo: Full Rebuild ────────────────────────────────────────────────────────
cmd_full_rebuild() {
    title "Rebuild Completo — QuantumCRM"
    log "Reconstruyendo imagen Docker y reiniciando servicios..."
    echo ""

    START_TIME=$(date +%s)

    # Rebuild y restart solo del servicio app (sin tocar postgres ni redis)
    docker compose up -d --build --no-deps "$APP_SERVICE"

    END_TIME=$(date +%s)
    ELAPSED=$((END_TIME - START_TIME))

    echo ""
    ok "Rebuild completo en ${ELAPSED}s."
    log "Siguiendo logs (Ctrl+C para salir):"
    echo ""
    sleep 1
    docker compose logs -f --tail=30 "$APP_SERVICE"
}

# ── Modo: Hot Reload (sin rebuild) ────────────────────────────────────────────
cmd_hot_reload() {
    title "Hot Deploy — QuantumCRM"

    CONTAINER=$(get_container_id)
    if [ -z "$CONTAINER" ]; then
        warn "El contenedor 'app' no está corriendo. Levantando con docker compose up..."
        docker compose up -d
        sleep 2
        CONTAINER=$(get_container_id)
    fi

    if [ -z "$CONTAINER" ]; then
        error "No se pudo obtener el ID del contenedor. Intenta --full."
        exit 1
    fi

    log "Contenedor activo: ${CONTAINER:0:12}"
    echo ""

    # Copiar directorios
    for dir in $HOT_DIRS; do
        if [ -d "$dir" ]; then
            log "Copiando directorio: ${YELLOW}$dir/${NC}"
            docker cp "$dir/." "$CONTAINER:$CONTAINER_WORKDIR/$dir/"
            ok "$dir/"
        fi
    done

    # Copiar archivos sueltos
    for file in $HOT_FILES; do
        if [ -f "$file" ]; then
            log "Copiando archivo: ${YELLOW}$file${NC}"
            docker cp "$file" "$CONTAINER:$CONTAINER_WORKDIR/$file"
            ok "$file"
        fi
    done

    echo ""
    log "Reiniciando proceso Node.js dentro del contenedor..."

    # Matar y relanzar el proceso Node (usa 'node app.js' que es el CMD del Dockerfile)
    docker exec "$CONTAINER" sh -c "
        PID=\$(pgrep -f 'node app.js' | head -1)
        if [ -n \"\$PID\" ]; then
            kill \$PID
            echo 'Proceso Node (PID '\$PID') terminado.'
        else
            echo 'No se encontró proceso Node activo.'
        fi
    "

    # Reiniciar el servicio via docker compose (relanza el CMD del contenedor)
    docker compose restart "$APP_SERVICE"

    echo ""
    ok "Hot deploy completado."
    log "Siguiendo logs (Ctrl+C para salir):"
    echo ""
    sleep 1
    docker compose logs -f --tail=30 "$APP_SERVICE"
}

# ── Modo: Auto-detectar si necesita rebuild completo ─────────────────────────
cmd_auto() {
    title "QuantumCRM — Auto Deploy"

    check_docker

    # Detectar si package.json cambió desde el último commit
    NEEDS_REBUILD=false

    if git rev-parse --git-dir &>/dev/null; then
        # Revisar si package.json tiene cambios sin commitear o difiere del último commit
        if ! git diff --quiet HEAD -- package.json package-lock.json 2>/dev/null; then
            warn "Detectado cambio en package.json — se requiere rebuild completo."
            NEEDS_REBUILD=true
        elif ! git diff --quiet -- package.json package-lock.json 2>/dev/null; then
            warn "package.json modificado sin commitear — rebuild recomendado."
            NEEDS_REBUILD=true
        fi
    else
        warn "No es un repositorio Git. Usando modo hot reload por defecto."
    fi

    if [ "$NEEDS_REBUILD" = true ]; then
        echo ""
        read -p "  ¿Ejecutar rebuild completo? (s/N): " CONFIRM
        if [[ "$CONFIRM" =~ ^[sS]$ ]]; then
            cmd_full_rebuild
        else
            warn "Rebuild cancelado. Ejecutando hot deploy de todas formas..."
            cmd_hot_reload
        fi
    else
        log "Sin cambios de dependencias detectados → Hot deploy."
        echo ""
        cmd_hot_reload
    fi
}

# ── Mostrar ayuda ─────────────────────────────────────────────────────────────
cmd_help() {
    echo ""
    echo -e "${BOLD}QuantumCRM — Docker Deploy Script${NC}"
    echo ""
    echo -e "  ${CYAN}./deploy.sh${NC}           Detección automática (hot o rebuild)"
    echo -e "  ${CYAN}./deploy.sh --hot${NC}     Copia archivos y reinicia Node (rápido, sin rebuild)"
    echo -e "  ${CYAN}./deploy.sh --full${NC}    Reconstruye imagen completa (lento, necesario si cambia package.json)"
    echo -e "  ${CYAN}./deploy.sh --status${NC}  Estado y recursos de los contenedores"
    echo -e "  ${CYAN}./deploy.sh --logs${NC}    Sigue los logs del servicio app en tiempo real"
    echo -e "  ${CYAN}./deploy.sh --stop${NC}    Detiene todos los contenedores"
    echo -e "  ${CYAN}./deploy.sh --help${NC}    Muestra esta ayuda"
    echo ""
    echo -e "  ${YELLOW}Ejemplos:${NC}"
    echo -e "    ./deploy.sh              # deploy inteligente al hacer cambios de código"
    echo -e "    ./deploy.sh --full       # después de npm install o cambios en Dockerfile"
    echo -e "    ./deploy.sh --logs       # monitorear errores en producción"
    echo ""
}

# ── Entry Point ───────────────────────────────────────────────────────────────
check_docker

case "${1:-}" in
    --full)    cmd_full_rebuild ;;
    --hot)     cmd_hot_reload ;;
    --status)  cmd_status ;;
    --logs)    cmd_logs ;;
    --stop)    cmd_stop ;;
    --help|-h) cmd_help ;;
    "")        cmd_auto ;;
    *)
        error "Argumento desconocido: $1"
        cmd_help
        exit 1
        ;;
esac
