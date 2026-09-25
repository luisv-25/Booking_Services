import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

// Sección 5.3 del documento de arquitectura: deja registro de cada
// búsqueda de emparejamiento (POST /matching/search), con los filtros
// usados y cuándo se resolvió, para poder auditar/analizar después qué
// está buscando la gente (insumo típico para Analytics Service).
@Entity("matching_requests")
export class MatchingRequest {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  // Referencia lógica a user_db.users.id (sección 5.10, sin FK física).
  @Index()
  @Column()
  student_id: string;

  @Column({ type: "jsonb" })
  filters_json: Record<string, unknown>;

  @Column({ type: "timestamptz", nullable: true })
  resolved_at: Date | null;

  @CreateDateColumn()
  created_at: Date;
}
