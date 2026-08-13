import { http } from "@/api/client";

export interface AdminPayment {
  id: string;
  userId: string;
  playerName: string;
  playerEmail: string;
  tournamentId: string;
  tournamentName: string;
  amount: number; // rupees
  currency: string;
  razorpayOrderId: string;
  razorpayPaymentId: string | null;
  status: "CREATED" | "PENDING" | "CAPTURED" | "FAILED" | "REFUNDED";
  createdAt: string;
}

interface AdminPaymentDto {
  id: string;
  user_id: string;
  player_name: string;
  player_email: string;
  tournament_id: string;
  tournament_name: string;
  amount_paise: number;
  currency: string;
  razorpay_order_id: string;
  razorpay_payment_id: string | null;
  status: AdminPayment["status"];
  created_at: string;
}

// GET /api/admin/payments
export async function listAllPayments(): Promise<AdminPayment[]> {
  const dtos = await http.get<AdminPaymentDto[]>("/api/admin/payments");
  return dtos.map((dto) => ({
    id: dto.id,
    userId: dto.user_id,
    playerName: dto.player_name,
    playerEmail: dto.player_email,
    tournamentId: dto.tournament_id,
    tournamentName: dto.tournament_name,
    amount: dto.amount_paise / 100,
    currency: dto.currency,
    razorpayOrderId: dto.razorpay_order_id,
    razorpayPaymentId: dto.razorpay_payment_id,
    status: dto.status,
    createdAt: dto.created_at,
  }));
}
