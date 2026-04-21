# Manual de usuario — QuantumCRM

Este documento describe el uso de **QuantumCRM**: plataforma Node.js para calificación de ventas inbound, conversaciones por WhatsApp Cloud API y canales complementarios (correo, automatizaciones).

---

## 1. Arranque del sistema

El entorno está preparado para **Docker**; no es necesario instalar PostgreSQL ni Redis manualmente en equipos de desarrollo habituales.

**Requisito:** Docker Desktop (o `docker-compose` en servidor Linux).

### Pasos

1. Abra una terminal en la carpeta del proyecto (ajuste la ruta a su copia del repositorio):

   ```bash
   cd "C:\Users\Lenovo\Documents\GitHub\QuantumCRM"
   ```

2. Construya e inicie los servicios:

   ```bash
   docker-compose up --build -d
   ```

3. En el navegador, abra la aplicación:

   `http://localhost:3000`

4. **Acceso:** Si no hay sesión activa, se mostrará la pantalla **Acceso corporativo**. Credenciales iniciales por defecto (cambie en producción):

   - **Usuario:** `admin`
   - **Contraseña:** `123456`

   Tras un inicio de sesión correcto, la aplicación guarda el token en el navegador para las peticiones a la API.

5. Pulse **Entrar al área de trabajo** para acceder al panel principal.

---

## 2. Navegación del menú lateral

| Elemento del menú | Descripción breve |
|-------------------|-------------------|
| **Panel ejecutivo** | Indicadores de conversión, tiempo de primera respuesta (TFR) y coste estimado. |
| **Conversaciones** | Lista de contactos e historial; derivación a agente humano (handoff). |
| **Plantillas y embudo** | Textos por nodo del flujo (variables, por ejemplo `{{name}}`). |
| **Registro de sistema** | Eventos y diagnóstico en tiempo casi real. |
| **Configuración** | Credenciales Meta, SMTP, OpenAI y referencias de coste. |

---

## 3. Panel ejecutivo

Vista principal al entrar al área de trabajo.

- **Tasa de conversión:** porcentaje de contactos que alcanzan el estado `CLOSED_WON` respecto al embudo definido en su implementación.
- **TFR medio:** tiempo hasta la primera respuesta (Time to first response), según los datos registrados.
- **Coste estimado (periodo):** estimación en función del volumen de mensajes (entrantes, respuestas de agente, plantillas) y de las tarifas en USD configuradas en **Configuración**.

Los valores se actualizan al cargar la vista y de forma periódica mientras permanezca abierta la aplicación.

---

## 4. Centro de conversaciones

En **Conversaciones** verá a la izquierda el listado de contactos y, al seleccionar uno, el historial a la derecha.

- **Derivación pendiente:** cuando un contacto aparece con este estado (o equivalente según su regla de negocio), el flujo automatizado puede estar **pausado** a favor de un agente humano. Revise el historial y utilice el campo de mensaje saliente solo si el webhook y las credenciales de WhatsApp están activos.
- Use la búsqueda para filtrar por nombre o teléfono.
- Los mensajes sin texto plano pueden mostrarse como *Contenido no textual* (adjuntos o interactivos).

---

## 5. Plantillas y embudo

En **Plantillas y embudo** se editan los textos asociados a cada **nodo** del sistema (por ejemplo `welcome_msg`, `followup_24h`), sin modificar código ni base de datos a mano.

1. Localice la tarjeta del nodo deseado.
2. Edite el texto en el área indicada; puede usar variables como `{{name}}` donde el motor las sustituya.
3. Pulse **Guardar plantilla**. Tras un guardado correcto verá confirmación en el propio botón; en caso de error, el sistema lo indicará y podrá reintentar.

Los cambios aplican a las **siguientes** conversaciones que utilicen ese nodo.

---

## 6. Registro de sistema

La vista **Registro de sistema** muestra eventos útiles para soporte TI (integraciones, tareas programadas, errores de servicios externos como OpenAI, etc.).

- Pulse **Actualizar** para volver a cargar el listado desde el backend.
- Si no hay eventos recientes, verá un mensaje informativo en lugar de la lista.

---

## 7. Configuración empresarial

Antes de operar embudos y envíos, debe enlazar la aplicación con **Meta (WhatsApp Cloud API)** y, si aplica, con correo SMTP y OpenAI. Los valores se guardan en la tabla de configuración de la base de datos; no requiere redeploy del código para cambiar credenciales.

1. Abra **Configuración** en el menú lateral.

### 7.1 Validación de conectividad (WhatsApp Cloud API)

En la parte superior, la sección **WhatsApp Cloud API — validación de conectividad** permite comprobar el **access token** y el **phone number ID** contra la Graph API de Meta **antes** de persistirlos.

1. Complete los campos obligatorios.
2. Pulse **Verificar conexión**.
3. Si la validación es correcta, los campos inferiores del formulario se rellenarán con esos valores; **debe pulsar Guardar configuración** para almacenarlos en base de datos.

### 7.2 Credenciales WhatsApp y webhook

- **Verify token (handshake del webhook):** debe coincidir con el valor configurado en Meta al suscribir la URL de webhook de este servidor.
- **Access token:** token Bearer de Graph API (temporal de usuario o de sistema, según su política en Meta).
- **Phone number ID:** identificador del número de WhatsApp Business utilizado en las rutas de la Cloud API.

### 7.3 Correo electrónico (SMTP)

- **Host SMTP:** servidor de salida (ejemplo: `smtp.gmail.com`).
- **Usuario:** cuenta utilizada para el envío.
- **Contraseña:** en proveedores como Google suelen usarse **contraseñas de aplicación**, no la contraseña principal de la cuenta si tiene verificación en dos pasos.

### 7.4 Inteligencia artificial (OpenAI)

- **OpenAI API Key:** obtenida en [platform.openai.com](https://platform.openai.com); el uso genera coste según su contrato con OpenAI.
- **Instrucciones de sistema (rol y políticas):** definen tono, límites y objetivos del asistente.

### 7.5 Costos de conversación (referencia en USD)

Valores de referencia para el cálculo mostrado en el **Panel ejecutivo**; ajústelos según su facturación o contrato con Meta.

### Guardar

Pulse **Guardar configuración**. Si el guardado es correcto, aparecerá un mensaje de confirmación; los cambios surten efecto de inmediato para los servicios que lean la tabla de configuración.

---

## 8. Motores automáticos y postventa

### Seguimiento a leads (ventana 24 h)

El sistema puede programar acciones sobre contactos que no han interactuado en un periodo definido; la lógica concreta depende de la implementación desplegada (plantillas de reactivación, etc.).

### Secuencias e-commerce (drip)

Tras una orden, el flujo puede disparar mensajes por días (por ejemplo 0, 3, 5 y 7). Para integrar su tienda, debe configurarse un **webhook** hacia su instancia, por ejemplo:

`POST https://su_dominio.com/api/ecommerce/order-created`

Cuerpo JSON típico (ajuste a su contrato de API): `order_id`, `phone_number`, `name`, `email`.

### Onboarding externo (usuarios en frío)

Endpoint de ejemplo:

`POST https://su_dominio.com/api/integrations/user-created`

**Ejemplo de cuerpo JSON:**

```json
{
   "name": "Juan Pérez",
   "phone_number": "5215512345678",
   "email": "juan@correo.com",
   "password": "AutoPassword123"
}
```

> **Importante (Meta Business Manager):**  
> Si el contacto no ha escrito en las últimas 24 horas, WhatsApp exige el uso de una **plantilla aprobada** (por ejemplo `user_onboarding` con variables según la definición en Meta). Las plantillas aprobadas en Meta **no** se editan desde la pantalla interna de **Plantillas y embudo** del CRM; esa pantalla corresponde a los nodos de texto del embudo conversacional del producto.

---

## 9. Mantenimiento y buenas prácticas

- Revise periódicamente el **Registro de sistema** ante incidencias.
- Proteja las credenciales de **Configuración**; limite el acceso administrativo.
- En producción, sustituya las credenciales por defecto del administrador y use HTTPS en la URL pública del CRM y del webhook.

---

*Última revisión alineada con la interfaz corporativa de QuantumCRM (menú, vistas y textos de botones).*
