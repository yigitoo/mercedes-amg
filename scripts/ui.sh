#!/usr/bin/env bash
# ============================================================================
#  mercedesctl ortak çıktı: renkler, başlıklar, adım/spinner, onay, komut önerisi.
#  mercedesctl bunu "source" eder; tek başına çalıştırılmaz.
#
#  Renk: AMG kimliği (siyah zemin, beyaz, tek vurgu AMG Red). Truecolor varsa gerçek tonlar,
#  yoksa 8 renk; NO_COLOR tanımlıysa ya da çıktı terminal değilse (CI, log) renksiz.
# ============================================================================

if [ -t 1 ] && [ -z "${NO_COLOR:-}" ] && [ "${TERM:-dumb}" != "dumb" ]; then
  if [ "${COLORTERM:-}" = "truecolor" ] || [ "${COLORTERM:-}" = "24bit" ]; then
    C_RED=$'\033[38;2;224;58;64m'     # AMG Red'in koyu terminalde okunan tonu (#B21E23 ailesi)
    C_WHITE=$'\033[38;2;243;243;244m'
    C_MUTED=$'\033[38;2;142;142;150m'
  else
    C_RED=$'\033[31m'; C_WHITE=$'\033[97m'; C_MUTED=$'\033[2m'
  fi
  C_BOLD=$'\033[1m'; C_0=$'\033[0m'
  UI_TTY=1
else
  C_RED=""; C_WHITE=""; C_MUTED=""; C_BOLD=""; C_0=""
  UI_TTY=0
fi

say()   { printf '%s\n' "${C_RED}▸${C_0} $*"; }
ok()    { printf '%s\n' "${C_WHITE}✓${C_0} $*"; }
warn()  { printf '%s\n' "${C_RED}!${C_0} $*"; }
info()  { printf '%s\n' "${C_MUTED}· $*${C_0}"; }
fail()  { printf '%s\n' "${C_RED}✗${C_0} $*" >&2; }
# die: bilinçli çıkış (kod 3); hata yakalayıcı bunu "beklenmeyen hata" diye tekrar yazmaz.
die()   { printf '%s\n' "${C_RED}✗ $*${C_0}" >&2; exit 3; }
title() { printf '\n%s\n' "${C_RED}${C_BOLD}////${C_0} ${C_BOLD}$*${C_0}"; }
have()  { command -v "$1" >/dev/null 2>&1; }

# Banner: logodaki beş eğik şerit + ad.
banner() {
  [ "$UI_TTY" = 1 ] || return 0
  printf '\n  %s%s/////%s%sAMG%s %sPulse%s  %s%s%s\n' "$C_RED" "$C_BOLD" "$C_0" "$C_BOLD$C_WHITE" "$C_0" "$C_WHITE" "$C_0" "$C_MUTED" "${1:-}" "$C_0"
}

_fmt_secs() { local s="$1"; if [ "$s" -ge 60 ]; then printf '%d dk %02d sn' $((s / 60)) $((s % 60)); else printf '%d sn' "$s"; fi; }

# step "<açıklama>" <komut...>
#   Komutu çalıştırır, çıktıyı $STEP_LOG'a yazar; terminalde spinner ve süre gösterir.
#   Başarısızsa logun son 40 satırını basar ve 3 döner.
STEP_LOG="${STEP_LOG:-${TMPDIR:-/tmp}/mercedesctl-step.log}"
step() {
  local msg="$1"; shift
  local start=$SECONDS rc=0
  : >"$STEP_LOG"
  if [ "$UI_TTY" = 1 ]; then
    ("$@") >>"$STEP_LOG" 2>&1 &
    local pid=$! i=0 frames='⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏'
    while kill -0 "$pid" 2>/dev/null; do
      printf '\r%s%s%s %s %s(%s)%s' "$C_RED" "${frames:i++%${#frames}:1}" "$C_0" "$msg" "$C_MUTED" "$(_fmt_secs $((SECONDS - start)))" "$C_0"
      sleep 0.1
    done
    wait "$pid" || rc=$?
    printf '\r\033[K'
  else
    ("$@") >>"$STEP_LOG" 2>&1 || rc=$?
  fi
  local took; took="$(_fmt_secs $((SECONDS - start)))"
  if [ "$rc" = 0 ]; then
    ok "$msg ${C_MUTED}($took)${C_0}"
  else
    fail "$msg ${C_MUTED}($took, çıkış $rc)${C_0}"
    printf '%s\n' "${C_MUTED}── son satırlar ($STEP_LOG) ──${C_0}" >&2
    tail -n 40 "$STEP_LOG" >&2
    return 3
  fi
}

# confirm "<soru>": evet → 0. Terminal yoksa ya da YES=1 ise sormadan evet.
confirm() {
  [ "${YES:-0}" = 1 ] && return 0
  [ -t 0 ] || { warn "onay gerekiyor ama terminal yok: YES=1 ile çalıştır"; return 1; }
  local a; printf '%s ' "${C_RED}?${C_0} $1 ${C_MUTED}[e/H]${C_0}"; read -r a
  [[ "$a" =~ ^([eE]|[eE]vet|[yY]|[yY]es)$ ]]
}

# suggest <yazılan> <aday...>: en yakın komutu yazdırır (yoksa boş).
suggest() {
  local typed="$1" best="" best_d=999 cand d; shift
  for cand in "$@"; do
    d="$(_lev "$typed" "$cand")"
    if [ "$d" -lt "$best_d" ]; then best_d="$d"; best="$cand"; fi
  done
  if [ "$best_d" -le 3 ]; then printf '%s' "$best"; fi
  return 0
}
_lev() {
  local a="$1" b="$2" i j cost la=${#1} lb=${#2} del ins sub m
  local -a prev cur
  for ((j = 0; j <= lb; j++)); do prev[j]=$j; done
  for ((i = 1; i <= la; i++)); do
    cur[0]=$i
    for ((j = 1; j <= lb; j++)); do
      [ "${a:i-1:1}" = "${b:j-1:1}" ] && cost=0 || cost=1
      del=$((prev[j] + 1)); ins=$((cur[j - 1] + 1)); sub=$((prev[j - 1] + cost))
      m=$del; [ $ins -lt $m ] && m=$ins; [ $sub -lt $m ] && m=$sub
      cur[j]=$m
    done
    prev=("${cur[@]}")
  done
  printf '%s' "${prev[lb]}"
}
