import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

export enum BookingStatus {
  PENDING = "pending",
  CONFIRMED = "confirmed",
  CANCELLED = "cancelled",
  COMPLETED = "completed",
}

@Entity("bookings")
@Check(`"status" IN ('pending','confirmed','cancelled','completed')`)
export class Booking {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  // Referencias LÓGICAS a user_db.users.id — sin FK física entre bases
  // distintas, igual que en el resto de servicios (sección 5.10 del doc).
  @Index()
  @Column()
  student_id: string;

  @Index()
  @Column()
  tutor_id: string;

  @Column({ nullable: true })
  subject_id: string;

  @Column({ type: "enum", enum: BookingStatus, default: BookingStatus.PENDING })
  status: BookingStatus;

  @Column({ type: "timestamptz" })
  scheduled_at: Date;

  // Snapshot desnormalizado de la tarifa vigente al momento de reservar,
  // para no depender de un JOIN remoto contra catalog_db (sección 5.3/5.10).
  @Column({ type: "numeric", precision: 10, scale: 2, default: 0 })
  price_snapshot: number;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
