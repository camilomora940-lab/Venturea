# Configurar cuentas gratuitas de Venturea

Venturea puede usar un proyecto de Supabase en el plan Free. No se debe cambiar a un plan pago ni habilitar complementos de pago. Las cuotas y condiciones pueden cambiar; en el plan gratuito los proyectos pueden pausarse por inactividad y las funciones compartidas dejan de estar disponibles si se alcanza un límite.

## 1. Crear la instancia gratuita

1. Crea una organización y un proyecto en Supabase y selecciona **Free**. No elijas Pro ni agregues complementos.
2. En **SQL Editor**, ejecuta en orden cada archivo de [`migrations/`](./migrations) (`001_init.sql`, `002_search.sql`, ...). Esto crea perfiles, preferencias, startups, actualizaciones, intereses y políticas RLS.
3. En **Project Settings → API**, copia el **Project URL** y la clave **anon/publicable**. Nunca copies una `service_role` o clave secreta en el frontend.
4. En **Authentication → URL Configuration**, agrega la URL local permitida `http://localhost:8000/**` y define `http://localhost:8000/` como Site URL.
5. Mantén activa la confirmación de correo si deseas verificar cuentas. El enlace de confirmación regresa a la URL local permitida.

## 2. Conectar Venturea

Edita [`../supabase-config.js`](../supabase-config.js) y pega los datos públicos del paso anterior:

```js
window.VENTUREA_CONFIG = {
  supabaseUrl: "https://TU-PROJECT-REF.supabase.co",
  supabaseAnonKey: "TU-CLAVE-ANON-O-PUBLICABLE"
};
```

La URL y la clave pública están diseñadas para usarse en el navegador; las políticas de seguridad de la base de datos son las que autorizan cada operación. No añadas claves secretas ni contraseñas a este archivo.

## 3. Probar localmente

Abre PowerShell en la carpeta del proyecto y ejecuta:

```powershell
python -m http.server 8000
```

Visita `http://localhost:8000`. Registra una cuenta como startup y otra como inversor para comprobar el perfil, el interés y la aceptación del match. El navegador no puede conectarse a una instancia real abriendo `index.html` con `file://`.

## Qué está conectado

- Registro con correo y contraseña, inicio y cierre de sesión.
- Perfiles de inversor y startup chilena.
- Publicación de perfiles, apertura voluntaria de rondas y actualizaciones.
- Preferencias de inversión guardadas en la base de datos.
- Interés de inversor persistido y aceptación/rechazo por la startup; solo aceptar crea el match mutuo.
- Row Level Security (RLS) limita cambios a los propietarios y a los participantes de cada interés.

Todo lo anterior está disponible a todos los usuarios sin pagos, suscripciones ni privilegios Pro. Las ubicaciones las declara cada startup; esta versión no verifica documentación legal. El feed se actualiza al navegar o recargar; la entrega instantánea y las notificaciones push no forman parte de esta primera versión.

## Costos y límites

El costo del software y de esta configuración es cero mientras la instancia y el alojamiento se mantengan en planes gratuitos y dentro de sus cuotas. Supabase Free tiene límites y puede pausar proyectos inactivos; el alojamiento público del sitio también debe ser gratuito si el objetivo es no pagar nada. No actives facturación, no cambies de plan y no aceptes complementos pagos. Revisa las condiciones actuales antes de publicar, porque los proveedores pueden modificarlas.
