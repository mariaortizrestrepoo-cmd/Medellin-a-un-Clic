#!/bin/bash
# Corre las pruebas. Las firmas de referencia se calculan con el código de ejemplo de Bold (Python).
cd "$(dirname "$0")/.."
H=$(python3 -c "import hashlib;print(hashlib.sha256(b'inv033439400COPkgfq2nN0o52XqnuXZWIN2F').hexdigest())")
W=$(python3 -c "
import hmac,hashlib,base64
body='{\"type\":\"SALE_APPROVED\",\"data\":{\"metadata\":{\"reference\":\"MDE-X\"}},\"nota\":\"Guatapé ñ\"}'.encode('utf-8')
encoded=base64.b64encode(body.decode('utf-8').encode('utf-8'))
print(hmac.new(key='kgfq2nN0o52XqnuXZWIN2F'.encode(),digestmod=hashlib.sha256,msg=encoded).hexdigest())")
deno run --allow-read pruebas/prueba-funcion.ts "$H" "$W"
