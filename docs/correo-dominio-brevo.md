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

Los correos **sí se entregan**, pero Gmail y Outlook los mandan a la carpeta de
no deseados. Faltan dos registros DNS que el Paso 1 no incluía.

### 5.1 SPF (falta — es la causa principal)

Hoy el dominio **no tiene SPF**. El único TXT en la raíz es el `brevo-code`.
Sin SPF, Outlook/Hotmail marca casi siempre como no deseado, y Gmail baja la
reputación aunque el DKIM esté bien.

En Vercel → Domains → `vidadecolorespodologia.cl` → **Add Record**:

| Tipo | Name | Value |
|------|------|-------|
| TXT | *(dejar VACÍO)* | `v=spf1 include:spf.brevo.com mx ~all` |

> El TXT del `brevo-code` **no se toca**: un dominio puede tener varios TXT en la
> raíz, pero **solo uno** puede empezar con `v=spf1`. Si hubiera dos SPF, falla.

### 5.2 MX (falta — el dominio no puede recibir correo)

El dominio no tiene ningún registro MX, así que `contacto@vidadecolorespodologia.cl`
no existe como buzón: si un paciente responde el correo, rebota. Los filtros de
spam también penalizan que un dominio remitente no pueda recibir respuestas.

Opción sin costo: crear un **reenvío** con ImprovMX (u otro servicio de forwarding)
para que todo lo que llegue a `contacto@vidadecolorespodologia.cl` se reenvíe al
Gmail de la clínica, y agregar en Vercel los MX que indique el servicio.

Mientras tanto, el código ya envía la cabecera **Reply-To** apuntando al correo de
la clínica (⚙️ Configuración → Datos del negocio), así las respuestas llegan igual.

### 5.3 Lo que ya está bien (verificado)

| Registro | Estado |
|----------|--------|
| DKIM `brevo1._domainkey` / `brevo2._domainkey` | ✅ |
| DMARC `_dmarc` (`p=none`) | ✅ |
| `brevo-code` en la raíz | ✅ |
| CNAME de marca `mail`, `img.mail`, `r.mail` | ✅ |

### 5.4 Mejoras aplicadas en el código

- Cada correo se envía con **versión en texto plano** además del HTML
  (los mensajes solo-HTML suman puntos de spam).
- Se agrega **Reply-To** con el correo real de la clínica.
- Se quitaron los **emojis del inicio del asunto** (`✅`, `📅`), que es donde más
  pesan para los filtros. Dentro del cuerpo se mantienen.

### 5.5 Cuando ya lleguen bien

Subir el DMARC de `p=none` a `p=quarantine` refuerza la reputación del dominio.
Hacerlo **solo después** de confirmar por una o dos semanas que todo entra a la
bandeja principal.
