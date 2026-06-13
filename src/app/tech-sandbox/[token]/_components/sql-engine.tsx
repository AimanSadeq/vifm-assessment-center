"use client";
// SQL engine (e.g. FP&A 3.1). Shows the prompt + read-only schema preview and
// collects the candidate's query into { query }. Execution + hash-match happen
// server-side on submit (read-only sandboxed runner).
import { useState } from "react";

export interface SqlEngineProps {
  config: {
    dialect?: string;
    schema_sql?: string;
    prompt_en?: string;
    prompt_ar?: string;
  };
  locale: "en" | "ar";
  initialWork?: { query?: string };
  onChange: (work: { query: string }) => void;
}

export function SqlEngine({ config, locale, initialWork, onChange }: SqlEngineProps) {
  const [query, setQuery] = useState(initialWork?.query ?? "");
  const ar = locale === "ar";

  function update(v: string) {
    setQuery(v);
    onChange({ query: v });
  }

  return (
    <div className="space-y-3" dir={ar ? "rtl" : "ltr"}>
      {(config.prompt_en || config.prompt_ar) && (
        <p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
          {ar ? config.prompt_ar ?? config.prompt_en : config.prompt_en}
        </p>
      )}
      {config.schema_sql && (
        <div>
          <div className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Schema ({config.dialect ?? "postgres"})
          </div>
          <pre className="overflow-x-auto rounded-md bg-[#0b1220] p-3 text-xs text-slate-200" dir="ltr">
            {config.schema_sql}
          </pre>
        </div>
      )}
      <div>
        <div className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Your query
        </div>
        <textarea
          value={query}
          onChange={(e) => update(e.target.value)}
          spellCheck={false}
          rows={8}
          dir="ltr"
          placeholder="SELECT ..."
          className="w-full rounded-md border border-border bg-[#0b1220] p-3 font-mono text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#5391D5]"
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Single read-only SELECT/WITH statement. It runs against a throwaway copy of the schema.
        </p>
      </div>
    </div>
  );
}
