// Thin wrapper around Razorpay's Checkout.js widget. The backend does real HMAC signature
// verification (see app/services/payment_service.py::verify_payment on the backend), so this
// has to be a genuine Checkout.js flow -- there's no way to fake a valid signature client-side.

export interface RazorpayCheckoutResult {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

interface RazorpayOptions {
  key: string;
  order_id: string;
  amount: number;
  currency: string;
  name?: string;
  description?: string;
  prefill?: { name?: string; email?: string; contact?: string };
  theme?: { color?: string };
  method?: { upi?: boolean; card?: boolean; netbanking?: boolean; wallet?: boolean };
  handler: (response: RazorpayCheckoutResult) => void;
  modal?: { ondismiss?: () => void };
}

interface RazorpayInstance {
  open: () => void;
  on: (event: "payment.failed", handler: (response: { error: { description?: string } }) => void) => void;
}

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

let scriptPromise: Promise<void> | null = null;

export function loadRazorpayScript(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      scriptPromise = null;
      reject(new Error("Could not load Razorpay Checkout. Check your connection and try again."));
    };
    document.body.appendChild(script);
  });
  return scriptPromise;
}

export async function openRazorpayCheckout(options: {
  orderId: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  prefill?: { name?: string; email?: string; contact?: string };
}): Promise<RazorpayCheckoutResult> {
  const key = import.meta.env.VITE_RAZORPAY_KEY_ID as string | undefined;
  if (!key) {
    throw new Error("Payments aren't configured yet (missing VITE_RAZORPAY_KEY_ID).");
  }
  await loadRazorpayScript();

  return new Promise((resolve, reject) => {
    const rzp = new window.Razorpay!({
      key,
      order_id: options.orderId,
      amount: options.amount,
      currency: options.currency,
      name: options.name,
      description: options.description,
      prefill: options.prefill,
      theme: { color: "#7c5cff" },
      // Explicitly request UPI alongside the other methods -- some accounts/checkout builds
      // default to a narrower method set unless UPI is asked for by name. Left as Razorpay's
      // default layout (no custom config.display) so it simply omits whatever the account
      // doesn't actually support, instead of showing an empty block for it.
      method: { upi: true, card: true, netbanking: true, wallet: true },
      handler: (response) => resolve(response),
      modal: {
        ondismiss: () => reject(new Error("Payment window closed before completing.")),
      },
    });
    rzp.on("payment.failed", (response) => {
      reject(new Error(response.error?.description || "Payment failed."));
    });
    rzp.open();
  });
}
