import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, ShieldCheck, XCircle } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/hooks/useAuth";
import { useCountdown } from "@/hooks/useCountdown";
import { formatCurrency, pad2 } from "@/lib/utils";
import { openRazorpayCheckout } from "@/lib/razorpay";
import { ApiError } from "@/api/client";
import { getMyGameAccounts, upsertGameAccountForTournament } from "@/api/gameAccounts";
import { registerForTournament } from "@/api/registrations";
import { createPaymentOrder, verifyPayment, type RazorpayOrder } from "@/api/payments";
import type { Game, GameAccount, Registration, Tournament } from "@/types";

type Step = "account" | "confirm" | "payment" | "processing" | "success" | "failure";

interface RegistrationFlowProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  tournament: Tournament;
  game: Game;
  // True when the caller already has a RESERVED (unpaid) registration -- skips straight to
  // payment instead of registering again (which the backend would reject as a duplicate).
  resumePendingPayment?: boolean;
}

export function RegistrationFlow({
  open,
  onClose,
  onSuccess,
  tournament,
  game,
  resumePendingPayment,
}: RegistrationFlowProps) {
  const { user } = useAuth();
  const [step, setStep] = useState<Step>("account");
  const [accounts, setAccounts] = useState<GameAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [newUsername, setNewUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [registration, setRegistration] = useState<Registration | null>(null);
  const [order, setOrder] = useState<RazorpayOrder | null>(null);
  const [busy, setBusy] = useState(false);

  const reservationCountdown = useCountdown(registration?.reservationExpiresAt ?? null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setRegistration(null);
    setOrder(null);
    setNewUsername("");

    if (resumePendingPayment) {
      setStep("payment");
      setBusy(true);
      createPaymentOrder(tournament.id)
        .then(setOrder)
        .catch((e) => setError(e instanceof ApiError ? e.message : "Could not resume payment."))
        .finally(() => setBusy(false));
      return;
    }

    setStep("account");
    getMyGameAccounts()
      .then((all) => {
        const forGame = all.filter((a) => a.gameId === game.id);
        setAccounts(forGame);
        setSelectedAccountId(forGame[0]?.id ?? null);
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : "Could not load your game accounts."));
  }, [open, game.id, tournament.id, resumePendingPayment]);

  useEffect(() => {
    if (step === "payment" && reservationCountdown.expired && registration) {
      setError("Your slot reservation expired. Please start again.");
      setStep("failure");
    }
  }, [step, reservationCountdown.expired, registration]);

  async function handleContinueFromAccount() {
    setBusy(true);
    setError(null);
    try {
      const username = newUsername.trim();
      let gameUid: string;
      let gameUsername: string;
      if (username) {
        // Smash Karts (and similar) have no player-facing UID -- the in-game name is the
        // only identifier there is, so it doubles as both fields.
        gameUid = username;
        gameUsername = username;
      } else {
        const selected = accounts.find((a) => a.id === selectedAccountId);
        if (!selected) {
          setError("Enter your in-game name to continue.");
          setBusy(false);
          return;
        }
        gameUid = selected.gameUid;
        gameUsername = selected.gameUsername;
      }
      const account = await upsertGameAccountForTournament(tournament.id, { gameUid, gameUsername });
      setAccounts((prev) => {
        const withoutOld = prev.filter((a) => a.id !== account.id);
        return [...withoutOld, account];
      });
      setSelectedAccountId(account.id);
      setStep("confirm");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not save your Game UID.");
    } finally {
      setBusy(false);
    }
  }

  async function handleRegisterAndCreateOrder() {
    setBusy(true);
    setError(null);
    try {
      const reg = await registerForTournament(tournament.id);
      setRegistration(reg);
      const newOrder = await createPaymentOrder(tournament.id);
      setOrder(newOrder);
      setStep("payment");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not complete registration.");
    } finally {
      setBusy(false);
    }
  }

  async function handlePay() {
    if (!order) return;
    setError(null);
    setBusy(true);

    let checkoutResult;
    try {
      checkoutResult = await openRazorpayCheckout({
        orderId: order.orderId,
        amount: order.amount,
        currency: order.currency,
        name: "ArenaroadX",
        description: tournament.name,
        prefill: { name: user?.name, email: user?.email, contact: user?.phone },
      });
    } catch (e) {
      setBusy(false);
      setError(e instanceof Error ? e.message : "Payment was not completed.");
      return;
    }

    setStep("processing");
    try {
      await verifyPayment({
        razorpayOrderId: checkoutResult.razorpay_order_id,
        razorpayPaymentId: checkoutResult.razorpay_payment_id,
        razorpaySignature: checkoutResult.razorpay_signature,
      });
      setStep("success");
      // Refresh the parent page's data as soon as the payment is actually confirmed, not only
      // when the user clicks "Done" -- if they close the modal (or navigate away) during the
      // brief verification window, that click never happens and the page is left showing
      // stale "Complete Payment" state even though the payment succeeded on the backend.
      onSuccess();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "We couldn't verify your payment.");
      setStep("failure");
    } finally {
      setBusy(false);
    }
  }

  // Payment verification is already in flight against the backend by this point -- closing
  // the modal here wouldn't cancel it, only hide the result, so the close affordances are
  // disabled until it settles into "success" or "failure".
  const closable = step !== "processing";

  return (
    <Modal
      open={open}
      onClose={closable ? onClose : () => {}}
      title={`Register — ${tournament.name}`}
      widthClassName="max-w-lg"
    >
      {step === "account" ? (
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            Enter the in-game name you'll use for {game.name} — match results are matched by this
            name, so double-check it before continuing.
          </p>

          {accounts.length > 0 ? (
            <div className="space-y-2">
              {accounts.map((a) => (
                <label
                  key={a.id}
                  className="flex cursor-pointer items-center gap-3 rounded-xl border border-gray-200 p-3 has-[:checked]:border-primary-400 has-[:checked]:bg-primary-50/60"
                >
                  <input
                    type="radio"
                    name="account"
                    checked={selectedAccountId === a.id}
                    onChange={() => setSelectedAccountId(a.id)}
                    className="accent-[#7c5cff]"
                  />
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{a.gameUsername}</p>
                  </div>
                  {a.verifiedAt ? (
                    <ShieldCheck size={16} className="ml-auto text-success-500" />
                  ) : null}
                </label>
              ))}
            </div>
          ) : (
            <p className="rounded-xl bg-warning-50 px-3 py-2.5 text-xs text-warning-600">
              You don't have a saved {game.name} account yet. Add one below to continue.
            </p>
          )}

          <div className="rounded-xl border border-dashed border-gray-200 p-3">
            <p className="text-xs font-semibold text-gray-500">Or use a different in-game name</p>
            <input
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              placeholder="In-game name"
              className="mt-2 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary-400"
            />
          </div>

          {error ? <p className="text-xs font-medium text-danger-600">{error}</p> : null}

          <Button className="w-full" disabled={busy} onClick={handleContinueFromAccount}>
            {busy ? <Loader2 size={16} className="animate-spin" /> : "Continue"}
          </Button>
        </div>
      ) : null}

      {step === "confirm" ? (
        <div className="space-y-4">
          <div className="rounded-xl bg-app-bg p-4 text-sm">
            <div className="flex justify-between py-1">
              <span className="text-gray-500">Tournament</span>
              <span className="font-semibold text-gray-800">{tournament.name}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-gray-500">Entry fee</span>
              <span className="font-semibold text-gray-800">{formatCurrency(tournament.fee)}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-gray-500">Slots left</span>
              <span className="font-semibold text-gray-800">
                {tournament.maxPlayers - tournament.registeredPlayers}
              </span>
            </div>
          </div>
          <p className="text-xs text-gray-400">
            We'll temporarily reserve your slot while you complete payment. Unpaid reservations
            are released automatically if payment isn't completed in time.
          </p>
          {error ? <p className="text-xs font-medium text-danger-600">{error}</p> : null}
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setStep("account")}>
              Back
            </Button>
            <Button className="flex-1" onClick={handleRegisterAndCreateOrder} disabled={busy}>
              {busy ? <Loader2 size={16} className="animate-spin" /> : "Reserve & Continue"}
            </Button>
          </div>
        </div>
      ) : null}

      {step === "payment" ? (
        <div className="space-y-4">
          {order ? (
            <>
              <div className="rounded-xl border border-gray-100 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Razorpay Checkout
                </p>
                <p className="mt-2 text-2xl font-extrabold text-gray-900">
                  {formatCurrency(order.amount / 100)}
                </p>
                <p className="mt-1 text-xs text-gray-400">Order: {order.orderId}</p>
              </div>

              {registration?.reservationExpiresAt && !reservationCountdown.expired ? (
                <p className="text-center text-xs text-gray-400">
                  Slot reserved for {pad2(reservationCountdown.minutes)}:
                  {pad2(reservationCountdown.seconds)}
                </p>
              ) : null}

              {error ? <p className="text-xs font-medium text-danger-600">{error}</p> : null}

              <Button className="w-full" onClick={handlePay} disabled={busy}>
                {busy ? <Loader2 size={16} className="animate-spin" /> : "Pay with Razorpay"}
              </Button>
              <button
                onClick={onClose}
                className="w-full py-1 text-center text-xs text-gray-400 hover:text-gray-600"
              >
                Close — your reserved slot expires automatically if unpaid
              </button>
            </>
          ) : (
            <div className="flex flex-col items-center gap-3 py-10">
              <Loader2 size={24} className="animate-spin text-primary-500" />
              <p className="text-sm text-gray-500">Setting up your payment…</p>
              {error ? <p className="text-xs font-medium text-danger-600">{error}</p> : null}
            </div>
          )}
        </div>
      ) : null}

      {step === "processing" ? (
        <div className="flex flex-col items-center gap-3 py-10">
          <Loader2 size={28} className="animate-spin text-primary-500" />
          <p className="text-sm text-gray-500">Verifying payment with the server…</p>
        </div>
      ) : null}

      {step === "success" ? (
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <CheckCircle2 size={40} className="text-success-500" />
          <p className="text-lg font-bold text-gray-900">Registration confirmed!</p>
          <p className="text-sm text-gray-500">
            You're locked in for {tournament.name}. Room details will appear here before the match.
          </p>
          <Button
            className="mt-2 w-full"
            onClick={() => {
              onSuccess();
              onClose();
            }}
          >
            Done
          </Button>
        </div>
      ) : null}

      {step === "failure" ? (
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <XCircle size={40} className="text-danger-500" />
          <p className="text-lg font-bold text-gray-900">Payment failed</p>
          <p className="text-sm text-gray-500">{error ?? "Something went wrong with your payment."}</p>
          <div className="mt-2 flex w-full gap-2">
            <Button variant="outline" className="flex-1" onClick={onClose}>
              Close
            </Button>
            <Button
              className="flex-1"
              onClick={() => {
                setError(null);
                setStep(order ? "payment" : "account");
              }}
            >
              Try Again
            </Button>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
