import { http } from "@/api/client";
import { mapPayment, type PaymentDto } from "@/lib/mappers";
import type { Payment } from "@/types";

export interface RazorpayOrder {
  paymentId: string;
  orderId: string;
  amount: number; // paise
  currency: string;
}

// POST /api/payments/create-order
export async function createPaymentOrder(tournamentId: string): Promise<RazorpayOrder> {
  const dto = await http.post<{ payment_id: string; order_id: string; amount: number; currency: string }>(
    "/api/payments/create-order",
    { tournament_id: tournamentId },
  );
  return { paymentId: dto.payment_id, orderId: dto.order_id, amount: dto.amount, currency: dto.currency };
}

// POST /api/payments/verify -- real Razorpay HMAC signature verification server-side.
// Called from the Razorpay Checkout.js `handler` callback (see lib/razorpay.ts).
export async function verifyPayment(input: {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}): Promise<Payment> {
  const dto = await http.post<PaymentDto>("/api/payments/verify", {
    razorpay_order_id: input.razorpayOrderId,
    razorpay_payment_id: input.razorpayPaymentId,
    razorpay_signature: input.razorpaySignature,
  });
  return mapPayment(dto);
}

// GET /api/payments
export async function getMyPayments(): Promise<Payment[]> {
  const dtos = await http.get<PaymentDto[]>("/api/payments");
  return dtos.map(mapPayment);
}
