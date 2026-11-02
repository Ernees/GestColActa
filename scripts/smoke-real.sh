#!/usr/bin/env bash
# Prueba rápida contra las APIs reales (Deepgram + Claude).
# Requiere .env con DEEPGRAM_API_KEY y ANTHROPIC_API_KEY. Solo macOS (say/afconvert/open).
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PORT:-3123}"
WORK="$(mktemp -d)"
trap 'kill "${SERVER_PID:-}" 2>/dev/null || true; rm -rf "$WORK"' EXIT

VOZ_A="Eddy (Spanish (Mexico))"   # Directora
VOZ_B="Flo (Spanish (Mexico))"    # Docente
LINEAS=(
"A|Buenas tardes a todos. Damos comienzo a la reunión de convivencia de quinto grado, convocada por los conflictos ocurridos en el recreo del viernes pasado."
"B|Gracias, directora. Desde el curso venimos observando discusiones entre varios alumnos, y el viernes un compañero terminó lastimado en una pelea durante el recreo."
"A|Entiendo. Propongo que el docente realice una instancia de mediación con los alumnos involucrados antes del próximo viernes."
"B|De acuerdo, yo me encargo de la mediación antes del viernes. Además voy a registrar lo conversado en el cuaderno de seguimiento del curso."
"A|Perfecto. Por mi parte, Dirección va a comunicar a las familias lo acordado a través del cuaderno de comunicados en las próximas cuarenta y ocho horas."
"B|Muy bien. Entonces quedamos así, y retomamos el tema en la reunión de la semana próxima."
"A|Excelente. Damos por finalizada la reunión. Muchas gracias."
)

echo "→ Sintetizando audio…"
i=0
for linea in "${LINEAS[@]}"; do
  voz="$VOZ_A"; [[ "${linea%%|*}" == "B" ]] && voz="$VOZ_B"
  say -v "$voz" -o "$WORK/$i.aiff" "${linea#*|}"
  afconvert -f WAVE -d LEI16@16000 -c 1 "$WORK/$i.aiff" "$WORK/$i.wav"
  i=$((i+1))
done
python3 - "$WORK" "$i" <<'PY'
import sys, wave
d, n = sys.argv[1], int(sys.argv[2])
out = wave.open(f"{d}/reunion.wav", "wb")
for k in range(n):
    w = wave.open(f"{d}/{k}.wav", "rb")
    if k == 0:
        out.setparams(w.getparams())
    out.writeframes(w.readframes(w.getnframes()))
    out.writeframes(b"\x00\x00" * 8000)  # 0.5 s de silencio entre turnos
    w.close()
out.close()
PY
cp "$WORK/reunion.wav" ./reunion-prueba.wav

echo "→ Levantando servidor en :${PORT}…"
npm run build >/dev/null
PORT="$PORT" node dist/main >"$WORK/server.log" 2>&1 &
SERVER_PID=$!
for _ in $(seq 1 30); do curl -s "localhost:$PORT" >/dev/null 2>&1 && break; sleep 0.5; done

METADATA='{
 "institucion":{"nombre":"Highest College","subtitulo":"Nivel Primario"},
 "metadatos":{"fecha":"2026-10-28","horaInicio":"14:00","horaFin":"14:45","lugar":"la Sala de Reuniones"},
 "tipoActa":"CONVIVENCIA",
 "asistentes":[
  {"nombre":"Laura Benítez","rol":"DIRECTIVO","dni":"27.345.678"},
  {"nombre":"Carlos Domínguez","rol":"DOCENTE","dni":"31.987.654"}]
}'

echo "→ POST /actas/procesar-reunion (Deepgram + Claude)…"
HTTP=$(curl -sS -o acta-real.docx -w "%{http_code}" -X POST "localhost:$PORT/actas/procesar-reunion" \
  -F "audio=@reunion-prueba.wav;type=audio/wav" -F "metadata=$METADATA" --max-time 300)
if [[ "$HTTP" != "200" ]]; then
  echo "✗ HTTP $HTTP"; cat acta-real.docx; echo; grep -E "WARN|ERROR" "$WORK/server.log" || true; rm -f acta-real.docx; exit 1
fi

echo "→ Versión JSON (transcripción y mapeo de hablantes)…"
curl -sS -X POST "localhost:$PORT/actas/procesar-reunion?formato=json" \
  -F "audio=@reunion-prueba.wav;type=audio/wav" -F "metadata=$METADATA" --max-time 300 \
  | python3 -c 'import json,sys; d=json.load(sys.stdin); print(json.dumps({k:d[k] for k in ("mapeoHablantes","transcripcion")}, ensure_ascii=False, indent=1))'

echo "✓ acta-real.docx generado"
open acta-real.docx
