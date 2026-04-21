# 📚 Manual de Usuario - QuantumCRM (Edición Conversacional y Multicanal)

Bienvenido a **QuantumCRM**. Este manual detalla cómo utilizar, administrar y orquestar tu plataforma integral basada en Node.js, diseñada para la calificación de ventas inbound y la fidelización multicanal de comercio electrónico (E-commerce).

---

## 🚀 1. Arrancando el Sistema (Inicio Rápido)

Tu CRM está completamente orquestado con una arquitectura tipo enjambre usando **Docker**. Esto significa que nunca tendrás que instalar manualmente bases de datos ni cachés en tus computadoras.

**Requisito previo:** Tener instalado `Docker Desktop` (o `docker-compose` en servidores).

### Pasos de Inicio
1. Abre tu terminal (Consola/Simbolo de Sistema).
2. Navega hacia la carpeta del proyecto:
   ```bash
   cd "C:\Users\Lenovo\Documents\CRM Whatsap Agent"
   ```
3. Ejecuta el comando de construcción y arranque:
   ```bash
   docker-compose up --build -d
   ```
4. Abre tu navegador web de preferencia e ingresa a tu nueva interfaz administrativa en:
   👉 `http://localhost:3000`

5. **¡Importante! (Muro de Seguridad)** El sistema te redirigirá a una pantalla de bloqueo. Debes usar las credenciales maestras iniciales:
   * **Usuario:** `admin`
   * **Contraseña:** `123456`
   *(Una vez admitido, el sistema guarda tu sesión cifrada en tu navegador).*

---

### 4. Diagnóstico Vivo (Nueva Consola)
Esta pestaña técnica te otorga "Rayos X" del sistema sin saber programar.
Abre esta terminal oscura para ver el pulso de tu CRM de fondo en la web:
* Muestra fallos de OpenAI (Si te quedaste sin crédito).
* Muestra ejecuciones del DRIP CRON cada que envía un recordatorio automático.
* Muestra errores de webhooks no autorizados o mal hechos.
* Usa el botón **[ ↻ Refresh ]** para arrastrar los últimos 200 disparos de código en línea del servidor.

### 5. Configuración y Llaves (El Cerebro)

Antes de que tu CRM pueda realizar embudos y mandar mensajes, debes enlazarlo con tus permisos de desarrollador.
*Gracias a tu sistema centralizado en bases de datos, no requieres modificar código.*

1. Dentro de la Interfaz Visual, haz clic en **Configuración (⚙️)**.
2. Llena las siguientes dos categorías obligatorias:

### A) Credenciales de Facebook (Meta) WhatsApp Cloud
* **WhatsApp Verify Token:** Es el código secreto que usaste para registrar este webhook dentro de developer.facebook.com (Ej. `mi_clave_secreta_123`).
* **WhatsApp Access Token:** Tu pasaporte temporal o permanente ("System User Token") de la Graph API generado para poder enviar mensajes vía WhatsApp.
* **Phone Number ID:** El ID de red de WhatsApp asignado a la línea que operará como bot.

### B) Credenciales Multicanal (SMTP)
* **Host SMTP:** El de tu proovedor de correo. (Ejemplo Google: `smtp.gmail.com`).
* **Usuario:** Tu correo electrónico ligado para envíos (ej. `ventas@miempresa.com`).
* **Contraseña SMTP (App Password):** Si usas Gmail o dominios protegidos, requieres generar una exclusiva para aplicaciones de terceros (No uses directamente la contraseña con la que abres tu correo diario si tienes Verificación de 2 Pasos).

### C) Cerebro Cognitivo (Inteligencia Artificial OpenAI)
Para que tu CRM deje de responder con "Botones" rígidos y pase a entablar una conversación brillante y natural orientada a conseguir la venta, activa la Inteligencia Artificial.
*   **OpenAI API Key**: Obtenla en `platform.openai.com`. Al pegarla aquí habilitas la maquinaria de GPT-4 para tu WhatsApp.
*   **System Prompt (Personalidad)**: Esta inmensa caja de texto le dice al Bot quién es. *Ejemplo: "Eres Alejandro, vendedor estrella de Seguros Alfa. Responde muy breve, no uses más de 3 oraciones, mantén tono amigable y tu meta es atrapar su correo electrónico"*.

> Dale clic al botón radiante **Guardar Cambios**. Aparecerá una pequeña alerta verde indicando el éxito. Los cambios surten efecto de manera inmediata.

---

## 📊 3. Entendiendo el "Dashboard"

Tu pantalla principal del menú cuenta con la telemetría fundamental.
* **Tasa de Conversión:** El porcentaje general que nos divide qué tantas personas que inician un chat en "Nuevo" realmente logran llegar a nuestro estado final llamado `CLOSED_WON`.
* **TFR Promedio (Time to First Response):** Enseña matemáticamente cuánto tarda tu empresa (o el bot) en escribirle de vuelta al cliente de forma real.
* **Gasto Estimado (Mes):** Extrae un desglose financiero en vivo tomando como base el volumen de mensajes que envió el Bot a lo largo de este mismo mes multiplicado por las tarifas Meta que tú mismo puedes configurar en la pestaña "Configuración".

---

## 💬 4. Administración del "Live Inbox" (Bandeja y Handoff)

En el Inbox verás en la parte izquierda una lista jerárquica de todas las personas que han escrito. El Bot las atiende a todas, ¿Cuándo deberías intervenir tú?

* **Handoff Manual:** Cuando veas que un usuario tiene un botón o contorno que destella en color ROJO (`HANDOFF REQUERIDO`), significa que el usuario explícitamente se quejó o dijo una palabra reservada (ej. *"Asesor, quiero a un humano"*), o bien, el bot no le entendió 2 veces seguidas a la misma pregunta.
* **Toma de Control:** Si le das clic a un usuario pausado (Rojo), verás el historial de lo que el Bot ya platicó con él. Podrás leer por qué se frustró y verás la caja temporal abajo para escribir tú mismo como humano a su número de WhatsApp. 

> *Nota:* Mientras un lead tiene el badge rojo parpadeante de "Handoff", el sistema conversacional robotizado está **Pausado** y el CRM ignorará sus mensajes autómaticos Inbound para dejarte hablar.

---

## 🕸️ 5. Motores Automáticos y Post-Venta

El sistema de Marketing no solo responde rápido, sino que va a cazar a los clientes que han comprado o preguntado.

### Lógica de Seguimiento a Leads sin comprar (24H)
Cada inicio de Hora el reloj interno del CRM revisará quién no cerró la compra pero lleva más de **24 horas callado** sin interactuar. Tras la revisión, soltará mediante la API tu plantilla de Reactivación / Disipación de dudas.

### Motor De Ecommerce Secuenciado (Drip Campaign)
Tu módulo avanzado rastreará días fijos posteriores a la realización de la orden en tu tienda virtual (Día 0, 3, 5 y 7).

Para echarlo a andar, la ingeniería de tu página web (WooCommerce / Shopify) debe hacer un envío (webhook POST) hacia esta red:
👉 `http://tu_dominio.com/api/ecommerce/order-created`
(Enviando en cuerpo JSON: `order_id`, `phone_number`, `name`, `email`)

**¿Qué gatillará esto internamente en el CRM?**
1. **Día 0 (Al Instante)**: Envía tu WhatsApp de bienvenida afectiva y empuja por SMTP un Correo corporativo formal al mail capturado.
2. **Día 3 al 4**: Buscará a las personas que pagaron hace 3 días exactos y les preguntará sobre su experiencia temprana con el producto.
3. **Día 5**: Manda el WhatsApp invitando a interactuar con los Tips de la Comunidad.
4. **Día 6-7**: Solicitará Feedback de la evaluación general del artículo.

### Módulo de "Onboarding" Externo (Registro de Usuarios)
Si tienes una página web, ERP o aplicación externa y quieres que este CRM contacte **en frío** a tus usuarios recién registrados para darles sus credenciales de acceso, debes pedirle a tu programador (o configurar en Zapier/IntegroMat/N8N) lo siguiente:

Hacer un llamado (Webhook) hacia:
👉 `POST http://tu_dominio.com/api/integrations/user-created`

**Estructurando el JSON:**
```json
{
   "name": "Juan Perez",
   "phone_number": "5215512345678",
   "email": "juan@correo.com",
   "password": "AutoPassword123"
}
```

> [!WARNING]
> ***Gestión en Meta Manager***
> Como este mensaje contacta a alguien que NO nos ha escrito en 24 horas, WhatsApp nos exige usar una **Plantilla Oficial**.
> 1. Ve a Facebook Developer y crea una plantilla llamada exactamente: `user_onboarding`.
> 2. Envíala con 3 *vars* en el cuepo: `{{1}}` (para el nombre), `{{2}}` (correo) y `{{3}}` (contraseña). 
> 
> *Notas*: No podrás editar el texto libremente de esta plantilla desde la sección interna de 'Gestión de Campañas' (solo las de embudo normal). 

---

### Mantenimiento de Copies / Plantillas
¡No necesitas abrir bases de datos ni tocar código! QuantumCRM está pensado para ser flexible y **No-Code**.

1. Clic en **Gestión Campañas (📢)** en tu menú lateral izquierdo.
2. Verás tarjetas cargadas con los textos que envía tu Bot para cada etapa del embudo o goteo (Ej. `welcome_msg`, `followup_24h`).
3. Modifica el texto en el cuadro como si fuera un block de notas (puedes agregar emojis y variables como `{{name}}`).
4. Dale clic a **"Guardar Copy"**.

¡Listo! El CRM usará el nuevo texto inmediatamente en la próxima conversación.
