import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { DataSource } from "typeorm";
import { AppModule } from "../../src/app.module";
import { CatalogServiceClient } from "../../src/bookings/catalog-service.client";
import { UserServiceClient } from "../../src/bookings/user-service.client";
import { EventsPublisher } from "../../src/events/events.publisher";
import { createTestApp, fakeEventsPublisher, tokenFor } from "../helpers/test-app";

// Prueba de INTEGRACIÓN: HTTP -> controlador -> servicio -> PostgreSQL real.
// Se reemplazan: publicador RabbitMQ y clientes HTTP de User y Catalog (fakes).
describe("Integración: reservas y emparejamiento", () => {
  let app: INestApplication;
  const events = fakeEventsPublisher();
  const TUTOR_PROFILE = "22222222-2222-4222-8222-222222222222"; // id del perfil en Catalog
  const TUTOR_USER = "tutor-user-1";
  const hora = (h: number) => new Date(Date.now() + h * 3600_000).toISOString();

  const users = { getUser: async (id: string) => ({ id, role: id.startsWith("tutor") ? "tutor" : "student" }) };
  const catalog = {
    getTutorProfile: async () => ({ hourlyRate: 50000, user: { id: TUTOR_USER } }),
    searchTutors: async () => [
      { id: "t1", hourlyRate: 30000 },
      { id: "t2", hourlyRate: 80000 },
    ],
  };

  beforeAll(async () => {
    app = await createTestApp(
      [AppModule],
      [
        { provide: EventsPublisher, useValue: events },
        { provide: UserServiceClient, useValue: users },
        { provide: CatalogServiceClient, useValue: catalog },
      ],
    );
  });
  afterAll(async () => {
    await app.close();
  });

  it("Integración: reserva, aceptación, bloqueo de doble reserva, cancelación que libera el horario y emparejamiento", async () => {
    const http = request(app.getHttpServer());
    const estudiante = { Authorization: `Bearer ${tokenFor("student-1", "student")}` };
    const otroEstudiante = { Authorization: `Bearer ${tokenFor("student-2", "student")}` };
    const tutor = { Authorization: `Bearer ${tokenFor(TUTOR_USER, "tutor")}` };
    const tutorAjeno = { Authorization: `Bearer ${tokenFor("tutor-otro", "tutor")}` };
    const inicio = hora(48);

    // Autorización: sin token 401; un tutor no puede reservar (403)
    await http.post("/api/v1/bookings").send({ tutorId: TUTOR_PROFILE, scheduledAt: inicio }).expect(401);
    await http.post("/api/v1/bookings").set({ Authorization: `Bearer ${tokenFor(TUTOR_USER, "tutor")}` }).send({ tutorId: TUTOR_PROFILE, scheduledAt: inicio }).expect(403);
    // Validación del DTO
    await http.post("/api/v1/bookings").set(estudiante).send({ tutorId: "no-uuid", scheduledAt: inicio }).expect(400);

    // CREAR: queda pendiente, con precio congelado y evento booking.created
    const creada = await http.post("/api/v1/bookings").set(estudiante).send({ tutorId: TUTOR_PROFILE, scheduledAt: inicio, durationMinutes: 60 }).expect(201);
    expect(creada.body.status).toBe("pending");
    expect(Number(creada.body.price_snapshot)).toBe(50000);
    expect(creada.body.student_id).toBe("student-1");
    expect(events.calls.map((c: any) => c.event)).toContain("publishBookingCreated");
    const id = creada.body.id;

    // CONSULTAR
    expect((await http.get(`/api/v1/bookings/${id}`).expect(200)).body.status).toBe("pending");
    expect((await http.get("/api/v1/bookings?studentId=student-1").expect(200)).body).toHaveLength(1);

    // DOBLE RESERVA: mismo horario (y uno que se solapa a mitad) -> 409
    await http.post("/api/v1/bookings").set(otroEstudiante).send({ tutorId: TUTOR_PROFILE, scheduledAt: inicio }).expect(409);
    const solapada = new Date(new Date(inicio).getTime() + 30 * 60_000).toISOString();
    await http.post("/api/v1/bookings").set(otroEstudiante).send({ tutorId: TUTOR_PROFILE, scheduledAt: solapada }).expect(409);
    // Un horario contiguo (justo al terminar) sí es posible
    const contigua = new Date(new Date(inicio).getTime() + 60 * 60_000).toISOString();
    const siguiente = await http.post("/api/v1/bookings").set(otroEstudiante).send({ tutorId: TUTOR_PROFILE, scheduledAt: contigua }).expect(201);

    // ACEPTAR: un tutor ajeno -> 403; el dueño -> confirmed + evento
    await http.patch(`/api/v1/bookings/${id}/accept`).set(tutorAjeno).expect(403);
    const aceptada = await http.patch(`/api/v1/bookings/${id}/accept`).set(tutor).expect(200);
    expect(aceptada.body.status).toBe("confirmed");
    expect(events.calls.map((c: any) => c.event)).toContain("publishBookingConfirmed");
    await http.patch(`/api/v1/bookings/${id}/accept`).set(tutor).expect(400); // ya no está pendiente

    // CANCELAR: un estudiante no puede retirar una reserva ya confirmada; el tutor dueño sí
    await http.patch(`/api/v1/bookings/${id}/cancel`).set(estudiante).expect(400);
    const cancelada = await http.patch(`/api/v1/bookings/${id}/cancel`).set(tutor).expect(200);
    expect(cancelada.body.status).toBe("cancelled");
    expect(events.calls.map((c: any) => c.event)).toContain("publishBookingCancelled");

    // El slot quedó libre en la base de datos y el horario puede reservarse otra vez
    const db = app.get(DataSource);
    const slots = await db.query("SELECT 1 FROM booking_slots WHERE booking_id = $1", [id]);
    expect(slots).toHaveLength(0);
    await http.post("/api/v1/bookings").set(otroEstudiante).send({ tutorId: TUTOR_PROFILE, scheduledAt: inicio }).expect(201);
    expect(siguiente.body.status).toBe("pending");

    // EMPAREJAMIENTO: filtra por tarifa máxima, guarda el historial y exige rol estudiante
    await http.post("/api/v1/matching/search").set(tutor).send({}).expect(403);
    const busqueda = await http.post("/api/v1/matching/search").set(estudiante).send({ maxHourlyRate: 40000 }).expect(201);
    expect(busqueda.body.resultsCount).toBe(1);
    expect(busqueda.body.tutors[0].id).toBe("t1");
    const historial = await http.get("/api/v1/matching/history").set(estudiante).expect(200);
    expect(historial.body).toHaveLength(1);
    expect(historial.body[0].resolved_at).not.toBeNull();
  });
});
