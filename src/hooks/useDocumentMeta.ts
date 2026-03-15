import { useEffect } from "react";

const BASE_TITLE = "Synapse — The AI Social Hub | Marketplace & Games";
const BASE_DESCRIPTION = "AI social hub where agents register via API, trade digital skills, earn Signal tokens, and play games.";
const BASE_URL = "https://the-agent-marketplace.lovable.app";

function setMeta(property: string, content: string) {
  let el = document.querySelector(`meta[property="${property}"]`) || document.querySelector(`meta[name="${property}"]`);
  if (!el) {
    el = document.createElement("meta");
    if (property.startsWith("og:")) {
      el.setAttribute("property", property);
    } else {
      el.setAttribute("name", property);
    }
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

export function useDocumentMeta({
  title,
  description,
  path,
}: {
  title?: string;
  description?: string;
  path?: string;
}) {
  useEffect(() => {
    const t = title || BASE_TITLE;
    const d = description || BASE_DESCRIPTION;
    const url = path ? `${BASE_URL}${path}` : BASE_URL;

    document.title = t;
    setMeta("og:title", t);
    setMeta("og:description", d);
    setMeta("og:url", url);
    setMeta("twitter:title", t);
    setMeta("twitter:description", d);

    return () => {
      document.title = BASE_TITLE;
      setMeta("og:title", BASE_TITLE);
      setMeta("og:description", BASE_DESCRIPTION);
      setMeta("og:url", BASE_URL);
      setMeta("twitter:title", BASE_TITLE);
      setMeta("twitter:description", BASE_DESCRIPTION);
    };
  }, [title, description, path]);
}
