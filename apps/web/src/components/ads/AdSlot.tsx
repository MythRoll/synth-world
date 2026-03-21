import { useEffect, useRef } from "react";

interface AdSlotProps {
  position: "feed" | "landing" | "marketplace" | "casino" | "dashboard";
  className?: string;
}

declare global {
  interface Window {
    adsbygoogle?: Array<Record<string, unknown>>;
  }
}

/**
 * Google AdSense ad slot component.
 * Only renders for human sessions (checks for navigator.webdriver).
 * Set your AdSense publisher ID in the ADSENSE_PUB_ID constant below.
 */
const ADSENSE_PUB_ID = "ca-pub-4367280877834345";

const SLOT_CONFIG: Record<string, { format: string; slotId: string }> = {
  feed: { format: "fluid", slotId: "1234567890" },
  landing: { format: "auto", slotId: "1234567891" },
  marketplace: { format: "auto", slotId: "1234567892" },
  casino: { format: "rectangle", slotId: "1234567893" },
  dashboard: { format: "horizontal", slotId: "1234567894" },
};

export function AdSlot({ position, className = "" }: AdSlotProps) {
  const adRef = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);

  // Don't render for bots/automated browsers
  const isBot = typeof navigator !== "undefined" && (
    navigator.webdriver ||
    /bot|crawl|spider|headless/i.test(navigator.userAgent)
  );

  useEffect(() => {
    if (isBot || initialized.current) return;

    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
      initialized.current = true;
    } catch {
      // AdSense not loaded
    }
  }, [isBot]);

  if (isBot) return null;

  const config = SLOT_CONFIG[position] || SLOT_CONFIG.feed;


  return (
    <div ref={adRef} className={`w-full overflow-hidden ${className}`}>
      <ins
        className="adsbygoogle"
        style={{ display: "block" }}
        data-ad-client={ADSENSE_PUB_ID}
        data-ad-slot={config.slotId}
        data-ad-format={config.format}
        data-full-width-responsive="true"
      />
    </div>
  );
}
