import { useEffect, useState } from "react";
import { Loader2, ShieldCheck, ShieldQuestion, XCircle } from "lucide-react";
import { Modal } from "@shared/components/ui/Modal";
import { Button } from "@shared/components/ui/Button";
import { useAuth } from "@shared/hooks/useAuth";
import { useCountdown } from "@/hooks/useCountdown";
import { formatCurrency, pad2 } from "@shared/lib/utils";
import { openRazorpayCheckout } from "@/lib/razorpay";
import { ApiError } from "@shared/api/client";
import { upsertGameAccountForTournament, verifyGameAccountForTournament } from "@/api/gameAccounts";
import { registerForTournament } from "@/api/registrations";
import { createPaymentOrder, verifyPayment, type RazorpayOrder } from "@/api/payments";
import type { GameAccount, Game, Registration, Tournament } from "@shared/types";

type Step = "account" | "confirm" | "payment" | "processing" | "failure";

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
  const [newUsername, setNewUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [registration, setRegistration] = useState<Registration | null>(null);
  const [order, setOrder] = useState<RazorpayOrder | null>(null);
  const [busy, setBusy] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  // Only ever set by a successful Verify call against whatever's currently typed -- cleared
  // the instant the username changes, so a stale "Verified" badge can never linger for a
  // now-different value the user hasn't verified.
  const [verifiedAccount, setVerifiedAccount] = useState<GameAccount | null>(null);

  const reservationCountdown = useCountdown(registration?.reservationExpiresAt ?? null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setVerifyError(null);
    setRegistration(null);
    setOrder(null);
    setNewUsername("");
    setVerifiedAccount(null);

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
  }, [open, game.id, tournament.id, resumePendingPayment]);

  useEffect(() => {
    if (step === "payment" && reservationCountdown.expired && registration) {
      setError("Your slot reservation expired. Please start again.");
      setStep("failure");
    }
  }, [step, reservationCountdown.expired, registration]);

  // Saves whatever's currently typed as this tournament's game account. Shared by "Continue"
  // and "Verify", since verifying should work against whatever's currently entered without a
  // separate save step first.
  async function saveCurrentUsername(): Promise<GameAccount | null> {
    const username = newUsername.trim();
    if (!username) {
      setError("Enter your in-game name to continue.");
      return null;
    }
    // Smash Karts (and similar) have no player-facing UID -- the in-game name is the only
    // identifier there is, so it doubles as both fields.
    const account = await upsertGameAccountForTournament(tournament.id, {
      gameUid: username,
      gameUsername: username,
    });
    return account;
  }

  async function handleContinueFromAccount() {
    setBusy(true);
    setError(null);
    try {
      const account = await saveCurrentUsername();
      if (account) setStep("confirm");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not save your Game UID.");
    } finally {
      setBusy(false);
    }
  }

  async function handleVerify() {
    setVerifying(true);
    setVerifyError(null);
    try {
      const saved = await saveCurrentUsername();
      if (!saved) return;
      const verified = await verifyGameAccountForTournament(tournament.id);
      setVerifiedAccount(verified);
    } catch (e) {
      setVerifyError(e instanceof ApiError ? e.message : "Could not verify this username.");
    } finally {
      setVerifying(false);
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
      // No separate "success" confirmation screen -- close straight back to the tournament
      // page, which onSuccess() has just refreshed to show the now-unlocked Proceed button.
      onSuccess();
      onClose();
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

          <div>
            <label className="text-xs font-semibold text-gray-500">
              {game.integrationKey === "chess_com" ? "Chess.com username" : "In-game name"}
            </label>
            <input
              value={newUsername}
              onChange={(e) => {
                setNewUsername(e.target.value);
                setVerifiedAccount(null);
              }}
              placeholder={game.integrationKey === "chess_com" ? "Chess.com username" : "In-game name"}
              // Every player registering sees this field -- must never suggest a value the
              // browser remembers from a *different* account having typed into it before.
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary-400"
            />
          </div>

          {game.integrationKey === "chess_com" ? (
            <div className="rounded-xl bg-app-bg p-3">
              {verifiedAccount?.verifiedAt ? (
                <p className="flex items-center gap-1.5 text-xs font-semibold text-success-600">
                  <ShieldCheck size={14} /> Verified on Chess.com
                  {typeof verifiedAccount.providerData.title === "string"
                    ? ` — titled ${verifiedAccount.providerData.title}`
                    : ""}
                </p>
              ) : (
                <>
                  <p className="flex items-center gap-1.5 text-xs text-gray-500">
                    <ShieldQuestion size={14} /> Not verified yet — we check this username actually exists on
                    Chess.com.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    disabled={verifying || !newUsername.trim()}
                    onClick={handleVerify}
                  >
                    {verifying ? <Loader2 size={14} className="animate-spin" /> : "Verify with Chess.com"}
                  </Button>
                </>
              )}
              {verifyError ? <p className="mt-2 text-xs font-medium text-danger-600">{verifyError}</p> : null}
            </div>
          ) : null}

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
