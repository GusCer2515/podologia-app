# Correo con dominio propio (Brevo + Vercel DNS)

## Por qué se hace esto

Gmail estaba **bloqueando** (`deferred`) los correos con este error:

> `421-4.7.28 Gmail has detected an unusual rate of mail originating from your SPF
> domain [11684706.brevosend.com]. Mail sent from your domain has been temporarily rate limited.`

**Causa:** los correos decían venir de `podologiavidadecolores@gmail.com` pero salían
del servidor compartido de Brevo (`brevosend.com`). Esa falta de coincidencia entre el
remitente y quien firma el correo hace que Gmail lo trate como sospechoso y lo limite.

**Solución:** autenticar el dominio propio `vidadecolorespodologia.cl` en Brevo. Así los
correos se firman con DKIM del dominio real, SPF y DMARC quedan alineados, y Gmail confía.

---

## Paso 1 — Agregar los 7 registros DNS en Vercel

El DNS del dominio lo maneja **Vercel** (nameservers `ns1/ns2.vercel-dns.com`).

**Dónde:** vercel.com → equipo **Guztavo_Team** → menú **Domains** (nivel equipo, no el del
proyecto) → click en `vidadecolorespodologia.cl` → sección **DNS Records** → **Add Record**.

> ⚠️ **Usa el botón "Copiar" de Brevo para cada valor.** Los valores de abajo son de
> referencia; el `brevo-code` es único y solo se puede copiar del panel.

| # | Tipo | Name (en Vercel) | Value |
|---|------|------------------|-------|
| 1 | CNAME | `mail` | `mail-vidadecolorespodologia-cl.brand.brevosend.com` |
| 2 | TXT | *(dejar VACÍO)* | `brevo-code:ea6eb76c9d6848db2bbebb9a854...` ← **copiar de Brevo** |
| 3 | CNAME | `brevo1._domainkey` | `b1.vidadecolorespodologia-cl.dkim.brevo.com` |
| 4 | CNAME | `brevo2._domainkey` | `b2.vidadecolorespodologia-cl.dkim.brevo.com` |
| 5 | TXT | `_dmarc` | `v=DMARC1; p=none; rua=mailto:rua@dmarc.brevo.com` |
| 6 | CNAME | `img.mail` | `mail-vidadecolorespodologia-cl.img.brand.brevosend.com` |
| 7 | CNAME | `r.mail` | `mail-vidadecolorespodologia-cl.r.brand.brevosend.com` |

### Reglas importantes en Vercel

- **Registro #2 (el `@`):** Vercel NO acepta `@`. Deja el campo **Name completamente vacío**
  (vacío = raíz del dominio).
- **En los demás:** escribe solo la parte corta (`mail`, `_dmarc`, `brevo1._domainkey`...),
  **sin** agregar `.vidadecolorespodologia.cl` al final — Vercel lo completa solo.
- **NO borres** los registros existentes (el `A` de la raíz y el `CNAME` de `www`): esos
  mantienen el sitio funcionando.
- Los registros 3, 4 y 5 (DKIM + DMARC) son los que **arreglan el bloqueo de Gmail**.
  Los 1, 6 y 7 son para que los links de los correos usen tu marca.

---

## Paso 2 — Verificar en Brevo

1. Vuelve a la pantalla de registros en Brevo
2. Click en **"Verificar registros"** (espera 5–15 min si aún no los detecta; el DNS tarda)
3. Cuando estén en verde → click en **"Autenticar dominio"**

---

## Paso 3 — Cambiar el remitente

1. **En Brevo:** Settings → Remitentes → **Agregar un remitente**
   - Nombre: `Vida de Colores`
   - Email: `contacto@vidadecolorespodologia.cl`
   - (Con el dominio autenticado NO pide verificación por correo)

2. **En Vercel:** proyecto `podologia-app-us75` → Settings → **Environment Variables**
   - Edita `BREVO_FROM_EMAIL` → `contacto@vidadecolorespodologia.cl`
   - Guarda → **Deployments → ⋯ → Redeploy**

3. **En el panel admin:** ⚙️ Configuración → Datos del negocio
   - "Correo para avisos de reserva": el correo donde Jahel quiere recibir los avisos

---

## Paso 4 — Probar

Agenda una hora de prueba desde el sitio y revisa que lleguen los 2 correos
(confirmación al paciente + aviso a la clínica), ya **sin caer en spam**.

Para revisar el estado real de entrega (`delivered` / `deferred` / `blocked`):
Brevo → **Statistics** → **Email** → o la pestaña de registros/logs transaccionales.

---

## Paso 5 — Los correos llegan a spam / no deseado

Los correos **sí se entregan** (Brevo los marca `delivered`), pero Gmail y Outlook
los mandaban a la carpeta de no deseados. Se corrigió en dos tandas.

### 5.1 Primera tanda — 2026-08-13 (DNS)

Al dominio le faltaban dos registros que el asistente de Brevo no incluye:

| Tipo | Name | Value | Para qué |
|------|------|-------|----------|
| TXT | *(vacío)* | `v=spf1 include:spf.brevo.com include:spf.improvmx.com mx ~all` | SPF |
| MX | *(vacío)* | `mx1.improvmx.com` (10) y `mx2.improvmx.com` (20) | recibir respuestas |

> Solo puede haber **un** TXT que empiece con `v=spf1`. El de Brevo y el de ImprovMX
> van fusionados en el mismo registro (por eso los dos `include:`).

El buzón lo resuelve **ImprovMX** (gratis) con un catch-all
`*@vidadecolorespodologia.cl` → Gmail de la clínica.

### 5.2 Segunda tanda — 2026-08-18 (el Reply-To era el problema)

Con el DNS ya correcto los correos seguían cayendo en no deseados. El diagnóstico
real se sacó enviando un correo idéntico al de producción a mail-tester.com:

**Puntaje: 5.6/10** — a un pelo del umbral de spam. Lo que restaba:

| Regla de SpamAssassin | Puntos | Qué es |
|---|---|---|
| `FREEMAIL_FORGED_REPLYTO` | **2.5** | Reply-To en `@gmail.com` con el From en el dominio propio |
| `HTML_IMAGE_ONLY_24` | 1.3 | poco texto en relación al HTML + el píxel de seguimiento de Brevo |
| imágenes sin `alt` | 0.5 | el píxel de apertura que agrega Brevo |
| `HEADER_FROM_DIFFERENT_DOMAINS` | 0.25 | el sobre sale de Brevo, el From es del dominio |

La regla cara la introdujo, sin querer, el arreglo anterior: un **Reply-To hacia una
casilla `@gmail.com` cuando el remitente es un dominio propio es el patrón clásico de
suplantación**, y pesa 2.5 puntos. Ya no hace falta ese Reply-To, porque desde que
existen los MX el dominio recibe correo: contestar al remitente llega igual.

**Se quitó el Reply-To de los dos correos** (`lib/email.ts`) → **8.1/10** medido.

Autenticación, ya verificada en el informe: SPF `pass`, DKIM `pass` firmado por
`d=vidadecolorespodologia.cl`, DMARC `pass`, IP no está en ninguna lista negra.

### 5.3 Lo que queda (y no vale la pena forzar)

- **Píxel de seguimiento de Brevo** (1.3 + 0.5 pts): Brevo **no permite** desactivar
  el seguimiento de aperturas en correos transaccionales, ni por API ni por cuenta.
  Se puede compensar escribiendo más texto en el cuerpo del correo.
- **`HEADER_FROM_DIFFERENT_DOMAINS`** (0.25): requiere un return-path propio, que es
  de plan pago en Brevo. Es un cuarto de punto: no se toca.

### 5.4 Reputación: no enviar a correos falsos

El panel guarda `rut@sincorreo.local` cuando el paciente no da correo. Enviar a esa
dirección generaba rebotes (`Unable to find MX of domain sincorreo.local`) y los
rebotes bajan la reputación del remitente. `emailValido()` ahora la descarta.

### 5.5 Cómo volver a diagnosticar esto

1. Ir a mail-tester.com y copiar la dirección `test-xxxx@srv1.mail-tester.com`
2. Enviar ahí un correo igual al de producción (misma API, mismo remitente, misma plantilla)
3. Abrir `https://www.mail-tester.com/test-xxxx` y leer el desglose

Para ver el estado de entrega real: Brevo → Statistics → Email, o la API
`GET /v3/smtp/statistics/events?days=15`.

### 5.6 Cuando lleven un tiempo llegando bien

Subir el DMARC de `p=none` a `p=quarantine` refuerza la reputación del dominio.
Hacerlo **solo después** de confirmar por una o dos semanas que todo entra a la
bandeja principal.
