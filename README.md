# booking-service

Reservas de tutorías (solicitar, aceptar, cancelar, completar) y matching.

Parte de **EduConecta** (plataforma de tutorías, arquitectura de microservicios). Stack: NestJS · TypeORM · PostgreSQL · RabbitMQ.

## Requisitos
- Node.js 20+
- PostgreSQL 14+ (local o Neon)
- RabbitMQ (CloudAMQP o local)

## Puesta en marcha
```bash
cd booking-service
cp .env.example .env   # completar valores
npm install
npm run start:dev      # desarrollo
npm run build && npm start   # producción
```
El servicio escucha en `PORT` (por defecto 5435). Salud: `GET /health` y `GET /ready`; métricas: `GET /metrics`.

## Variables de entorno
Ver `.env.example`. Todos los servicios que validan JWT deben usar el **mismo** `JWT_SECRET` (y el gateway también).

## Endpoints
| Método | Ruta |
|---|---|
| POST | `/api/v1/bookings` |
| GET | `/api/v1/bookings` |
| GET | `/api/v1/bookings/:id` |
| PATCH | `/api/v1/bookings/:id/accept` |
| PATCH | `/api/v1/bookings/:id/cancel` |
| POST | `/api/v1/matching/search` |
| GET | `/api/v1/matching/history` |

## Mensajería (RabbitMQ)
- Colas: `booking_analytics_queue`, `booking_events_queue`, `feedback_events_queue`, `payment_events_queue`, `session_events_queue`
- Consume: `session.completed`
- Publica: `booking.cancelled`, `booking.completed`, `booking.confirmed`, `booking.created`


## Pruebas
```bash
npm run test:unit
npm run test:integration   # requiere PostgreSQL (TEST_DB_PASSWORD)
```
CI/CD: GitHub Actions (`.github/workflows/ci.yml` y `deploy.yml`, despliegue a Render por Deploy Hook).
