#!/bin/bash
# =============================================================================
#  QuantumCRM — Docker Deploy Script
#  Actualiza el contenedor con los cambios de código más recientes.
#
#  Uso:
#    ./deploy.sh              → deploy inteligente (detecta si hay cambios en deps)
#    ./deploy.sh --pull       → git pull + redeploy automático
#    ./deploy.sh --full       → reconstruir imagen completa (docker-compose up --build)
#    ./deploy.sh --hot        → para app, copia código y stop/start del servicio (sin rebuild)
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

# ── Raíz del proyecto (el script debe poder ejecutarse desde cualquier cwd) ───
script_dir() {
    cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd
}

# ── Docker Compose (fija el compose para no depender del cwd previo) ─────────
dc() {
    docker compose -f "$COMPOSE_FILE" "$@"
}

# ── Obtener el ID del contenedor app (solo en ejecución) ─────────────────────
get_container_id() {
    dc ps -q "$APP_SERVICE" 2>/dev/null
}

# ── Modo: Status ──────────────────────────────────────────────────────────────
cmd_status() {
    title "Estado de los Contenedores"
    dc ps
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
    dc logs -f --tail=100 "$APP_SERVICE"
}

# ── Modo: Stop ────────────────────────────────────────────────────────────────
cmd_stop() {
    title "Deteniendo Contenedores"
    dc stop
    ok "Todos los contenedores detenidos."
}

# ── Modo: Full Rebuild ────────────────────────────────────────────────────────
cmd_full_rebuild() {
    title "Rebuild Completo — QuantumCRM"
    log "Reconstruyendo imagen Docker desde cero (sin caché)..."
    echo ""

    START_TIME=$(date +%s)

    # Forzar rebuild sin cache para garantizar que los archivos locales entren frescos
    dc build --no-cache "$APP_SERVICE"
    dc up -d --no-deps "$APP_SERVICE"

    END_TIME=$(date +%s)
    ELAPSED=$((END_TIME - START_TIME))

    echo ""
    ok "Rebuild completo en ${ELAPSED}s."
    log "Siguiendo logs (Ctrl+C para salir):"
    echo ""
    sleep 1
    dc logs -f --tail=30 "$APP_SERVICE"
}

# ── Modo: Hot Reload (sin rebuild) ────────────────────────────────────────────
cmd_hot_reload() {
    title "Hot Deploy — QuantumCRM"

    CONTAINER=$(get_container_id)
    if [ -z "$CONTAINER" ]; then
        warn "El contenedor 'app' no está corriendo. Levantando el stack con docker compose up..."
        dc up -d
        sleep 2
        CONTAINER=$(get_container_id)
    fi

    if [ -z "$CONTAINER" ]; then
        error "No se pudo obtener el ID del contenedor. Intenta --full."
        exit 1
    fi

    log "Contenedor activo: ${CONTAINER:0:12}"
    echo ""

    # ── PASO 1: Parar solo el servicio app (Postgres/Redis siguen arriba) ───────
    # Así no hay proceso con app.js abierto como ejecutable (evita ETXTBSY / "busy").
    log "Deteniendo servicio ${YELLOW}$APP_SERVICE${NC} para copiar archivos con seguridad..."
    dc stop "$APP_SERVICE"
    sleep 1
    # No volver a llamar get_container_id aquí: `dc ps -q` solo lista contenedores
    # en ejecución; tras `stop` devolvería vacío. El mismo ID de antes sigue válido.
    echo "  → Contenedor detenido (archivos listos para actualizar)."
    echo ""

    # ── PASO 2: Copiar directorios ───────────────────────────────────────────────
    for dir in $HOT_DIRS; do
        if [ -d "$dir" ]; then
            log "Copiando directorio: ${YELLOW}$dir/${NC}"
            docker cp "$dir/." "$CONTAINER:$CONTAINER_WORKDIR/$dir/"
            ok "$dir/"
        fi
    done

    # ── PASO 3: Copiar archivos sueltos (contenedor parado: sin mv dentro del FS) ─
    echo ""
    for file in $HOT_FILES; do
        if [ -f "$file" ]; then
            FINAL_DEST="$CONTAINER_WORKDIR/$file"
            log "Copiando archivo: ${YELLOW}$file${NC}"
            docker cp "$file" "$CONTAINER:$FINAL_DEST"
            ok "$file"
        fi
    done

    # ── PASO 4: Arrancar de nuevo (mismo contenedor, código nuevo) ───────────────
    echo ""
    log "Iniciando servicio ${YELLOW}$APP_SERVICE${NC}..."
    dc start "$APP_SERVICE"

    echo ""
    ok "Hot deploy completado."
    log "Siguiendo logs (Ctrl+C para salir):"
    echo ""
    sleep 1
    dc logs -f --tail=30 "$APP_SERVICE"
}

# ── Modo: Pull desde Git + Redeploy ──────────────────────────────────────────
cmd_pull() {
    title "Actualizar desde GitHub — QuantumCRM"

    # Verificar que sea un repositorio Git
    if ! git rev-parse --git-dir &>/dev/null; then
        error "Este directorio no es un repositorio Git."
        exit 1
    fi

    BRANCH=$(git rev-parse --abbrev-ref HEAD)
    REMOTE=$(git remote get-url origin 2>/dev/null || echo "(sin remote)")

    log "Rama activa  : ${YELLOW}${BRANCH}${NC}"
    log "Remote origin: ${YELLOW}${REMOTE}${NC}"
    echo ""

    # Fetch silencioso para obtener info antes de pull
    log "Obteniendo cambios remotos (git fetch)..."
    git fetch origin "$BRANCH" 2>&1 | sed "s/^/  /"
    echo ""

    # Mostrar commits que llegarán
    INCOMING=$(git log HEAD..origin/"$BRANCH" --oneline 2>/dev/null)
    if [ -z "$INCOMING" ]; then
        ok "Ya estás al día con ${REMOTE}. No hay commits nuevos."
        echo ""
        exit 0
    fi

    echo -e "${BOLD}  Commits nuevos que se aplicarán:${NC}"
    git log HEAD..origin/"$BRANCH" --oneline --decorate | sed "s/^/    ${CYAN}→${NC} /"
    echo ""

    # Mostrar resumen de archivos modificados
    CHANGED_FILES=$(git diff --name-status HEAD origin/"$BRANCH" 2>/dev/null)
    if [ -n "$CHANGED_FILES" ]; then
        echo -e "${BOLD}  Archivos afectados:${NC}"
        git diff --name-status HEAD origin/"$BRANCH" | awk '
            /^A/ { print "    \033[0;32m+  " $2 "\033[0m" }
            /^M/ { print "    \033[1;33m~  " $2 "\033[0m" }
            /^D/ { print "    \033[0;31m-  " $2 "\033[0m" }
        '
        echo ""
    fi

    # Detectar si package.json cambia (necesitará rebuild)
    PKG_CHANGED=false
    if git diff --name-only HEAD origin/"$BRANCH" 2>/dev/null | grep -qE 'package(-lock)?\.json'; then
        warn "package.json cambia → se requerirá rebuild completo."
        PKG_CHANGED=true
        echo ""
    fi

    # Confirmar antes de hacer pull
    read -p "  ¿Aplicar cambios con git pull? (s/N): " CONFIRM_PULL
    if [[ ! "$CONFIRM_PULL" =~ ^[sS]$ ]]; then
        warn "Pull cancelado por el usuario."
        exit 0
    fi

    echo ""
    log "Ejecutando git pull origin ${BRANCH}..."
    git pull origin "$BRANCH"
    echo ""
    ok "Código actualizado desde GitHub."
    echo ""

    # Preguntar si redeploy
    read -p "  ¿Redesplegar ahora? (s/N): " CONFIRM_DEPLOY
    if [[ ! "$CONFIRM_DEPLOY" =~ ^[sS]$ ]]; then
        warn "Redeploy omitido. Ejecuta './deploy.sh' cuando quieras aplicar los cambios."
        exit 0
    fi

    echo ""
    if [ "$PKG_CHANGED" = true ]; then
        log "Dependencias cambiaron → ejecutando rebuild completo..."
        cmd_full_rebuild
    else
        log "Sin cambios en dependencias → ejecutando hot deploy..."
        cmd_hot_reload
    fi
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
    echo -e "  ${CYAN}./deploy.sh --pull${NC}    Actualiza desde GitHub y redespliega"
    echo -e "  ${CYAN}./deploy.sh --hot${NC}     Copia código al contenedor app y stop/start (sin rebuild)"
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

cd "$(script_dir)" || {
    error "No se pudo situar en el directorio del proyecto."
    exit 1
}

case "${1:-}" in
    --pull)    cmd_pull ;;
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
