import { useEffect } from "react";

/**
 * Names the tab after the page. Moved out of the exhibition page when Phase 6
 * gave the site more pages than one; restores the previous title on unmount so
 * the front page falls back to index.html's own bilingual title.
 */
export function useDocumentTitle(title: string | null, site: string) {
  useEffect(() => {
    if (!title) return;
    const previous = document.title;
    document.title = `${title} · ${site}`;
    return () => {
      document.title = previous;
    };
  }, [title, site]);
}
