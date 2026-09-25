import { Column, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

// Sección 5.3 del documento de arquitectura. Se guarda separada de
// bookings (aunque hoy sea 1:1) porque representa el bloqueo horario en
// sí — es lo que se consulta para detectar solapamientos antes de
// confirmar una nueva reserva, independientemente del estado del booking.
@Entity("booking_slots")
@Index(["booking_id"])
export class BookingSlot {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "uuid" })
  booking_id: string;

  @Column({ type: "timestamptz" })
  start_time: Date;

  @Column({ type: "timestamptz" })
  end_time: Date;

  // Mientras locked_until esté en el futuro, el slot cuenta como ocupado
  // para el chequeo de solapamiento aunque el booking siga "pending"
  // (bloqueo optimista, sección 4.3 del documento).
  @Column({ type: "timestamptz" })
  locked_until: Date;
}
