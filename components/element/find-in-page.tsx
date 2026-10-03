import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface FindInPageProps {
  tabId: string;
  onClose: () => void;
}

function FindInPage({ tabId, onClose }: FindInPageProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const requestId = useRef(0);
  const [query, setQuery] = useState("");
  const [result, setResult] = useState({ activeMatchOrdinal: 0, matches: 0 });

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  useEffect(() => {
    return () => {
      requestId.current += 1;
      window.electronAPI.findInPage.stop(tabId);
    };
  }, [tabId]);

  useEffect(() => {
    const currentRequest = ++requestId.current;
    if (!query) {
      window.electronAPI.findInPage.stop(tabId);
      setResult({ activeMatchOrdinal: 0, matches: 0 });
      return;
    }
    void window.electronAPI.findInPage
      .find(tabId, query, true, false)
      .then((nextResult) => {
        if (currentRequest === requestId.current) {
          setResult(nextResult ?? { activeMatchOrdinal: 0, matches: 0 });
        }
      })
      .catch(() => {
        if (currentRequest === requestId.current) {
          setResult({ activeMatchOrdinal: 0, matches: 0 });
        }
      });
  }, [query, tabId]);

  const close = () => {
    window.electronAPI.findInPage.stop(tabId);
    onClose();
  };
  const next = (forward: boolean) => {
    if (query) {
      const currentRequest = ++requestId.current;
      void window.electronAPI.findInPage
        .find(tabId, query, forward, true)
        .then((nextResult) => {
          if (currentRequest === requestId.current && nextResult)
            setResult(nextResult);
        })
        .catch(() => {
          if (currentRequest === requestId.current) {
            setResult({ activeMatchOrdinal: 0, matches: 0 });
          }
        });
    }
  };

  return (
    <div className="app-no-drag relative z-40 flex h-12 shrink-0 items-center justify-end gap-1 border-b bg-background p-1.5">
      <div className="flex h-9 w-[360px] items-center gap-1 rounded-md border bg-background px-1 shadow-sm">
        <Input
          aria-label="Find in page"
          className="h-7 flex-1 border-0 bg-transparent shadow-none focus-visible:ring-0"
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") close();
            if (event.key === "Enter") next(!event.shiftKey);
          }}
          placeholder="Find in page"
          ref={inputRef}
          value={query}
        />
        <span className="w-16 text-center text-xs text-muted-foreground">
          {result.matches
            ? `${result.activeMatchOrdinal}/${result.matches}`
            : "0/0"}
        </span>
        <Button
          aria-label="Previous match"
          disabled={!query}
          onClick={() => next(false)}
          size="icon-xs"
          variant="ghost"
        >
          <ChevronUp />
        </Button>
        <Button
          aria-label="Next match"
          disabled={!query}
          onClick={() => next(true)}
          size="icon-xs"
          variant="ghost"
        >
          <ChevronDown />
        </Button>
        <Button
          aria-label="Close find in page"
          onClick={close}
          size="icon-xs"
          variant="ghost"
        >
          <X />
        </Button>
      </div>
    </div>
  );
}

export { FindInPage };
