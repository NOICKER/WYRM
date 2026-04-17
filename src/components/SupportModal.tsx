import React, { useState } from "react";

import { isSupporter, tryRedeemCode } from "../ui/supporterModel.ts";

interface SupportModalProps {
  onClose: () => void;
}

export function SupportModal({ onClose }: SupportModalProps): React.JSX.Element {
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const alreadySupporter = isSupporter();

  const handleRedeem = () => {
    const ok = tryRedeemCode(code);
    setStatus(ok ? "success" : "error");
  };

  return (
    <div className="support-modal-backdrop" onClick={onClose}>
      <div className="support-modal" onClick={(event) => event.stopPropagation()}>
        <button className="support-modal__close" onClick={onClose} aria-label="Close">
          ✕
        </button>

        <h2 className="support-modal__title">Support WYRM</h2>
        <p className="support-modal__body">
          WYRM is free to play, made by one person. If you enjoy it, a small contribution keeps the
          serpents alive.
        </p>

        <div className="support-modal__qr">
          <img src="/support-qr.png" alt="Payment QR code" width={180} height={180} />
        </div>

        <p className="support-modal__small">
          After paying, message the creator for your supporter code. Enter it below to unlock your{" "}
          <strong>Gold Trail</strong> and <strong>✦ Founder badge</strong>.
        </p>

        {alreadySupporter ? (
          <p className="support-modal__redeemed">✦ You are already a Founder. Thank you.</p>
        ) : (
          <div className="support-modal__redeem">
            <input
              type="text"
              placeholder="Enter supporter code"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              className="support-modal__input"
            />
            <button
              className="button button--forest"
              onClick={handleRedeem}
              disabled={!code.trim()}
            >
              Unlock
            </button>
            {status === "success" ? (
              <p className="support-modal__ok">✦ Unlocked! Close this panel to refresh your badge.</p>
            ) : null}
            {status === "error" ? (
              <p className="support-modal__err">Code not recognised. Check the spelling.</p>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
