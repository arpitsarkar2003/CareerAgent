"use client";

import { Button, Card, Input, useToast } from "@/components/ui";
import {
  getSearchConfig,
  updateSearchConfig,
  type SearchConfig,
} from "@/services/search";
import { useAuth } from "@clerk/nextjs";
import { useEffect, useState, type FormEvent } from "react";

function joinList(values: string[]): string {
  return values.join(", ");
}

function splitList(raw: string): string[] {
  return raw
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Known-working public boards (slugs only, not full URLs).
 * Comma-separated = search multiple companies in one Run search.
 */
const EXAMPLE_CONFIG = {
  roleKeywords: "engineer",
  locations: "",
  experienceLevels: "",
  greenhouseBoards: "airbnb, stripe, phonepe, postman, groww, figma, cloudflare",
  leverCompanies: "leverdemo, palantir, spotify",
  ashbyBoards: "notion, openai, linear, ramp",
} as const;

type SearchConfigFormProps = {
  onSaved?: (config: SearchConfig) => void;
};

export function SearchConfigForm({ onSaved }: SearchConfigFormProps) {
  const { getToken } = useAuth();
  const { push } = useToast();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [roleKeywords, setRoleKeywords] = useState("");
  const [locations, setLocations] = useState("");
  const [experienceLevels, setExperienceLevels] = useState("");
  const [greenhouseBoards, setGreenhouseBoards] = useState("");
  const [leverCompanies, setLeverCompanies] = useState("");
  const [ashbyBoards, setAshbyBoards] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const token = await getToken();
      if (!token || cancelled) return;
      setLoading(true);
      try {
        const config = await getSearchConfig(token);
        if (cancelled) return;
        setRoleKeywords(joinList(config.role_keywords));
        setLocations(joinList(config.locations));
        setExperienceLevels(joinList(config.experience_levels));
        setGreenhouseBoards(joinList(config.greenhouse_boards));
        setLeverCompanies(joinList(config.lever_companies));
        setAshbyBoards(joinList(config.ashby_boards));
        onSaved?.(config);
      } catch (err) {
        if (!cancelled) {
          push(
            "error",
            err instanceof Error ? err.message : "Failed to load search config",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
    // Load once when auth is ready; onSaved is optional parent notify.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getToken, push]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const token = await getToken();
    if (!token) {
      push("error", "Sign in required");
      return;
    }
    setBusy(true);
    try {
      const saved = await updateSearchConfig(token, {
        role_keywords: splitList(roleKeywords),
        locations: splitList(locations),
        experience_levels: splitList(experienceLevels),
        greenhouse_boards: splitList(greenhouseBoards),
        lever_companies: splitList(leverCompanies),
        ashby_boards: splitList(ashbyBoards),
      });
      push("success", "Search settings saved");
      onSaved?.(saved);
    } catch (err) {
      push(
        "error",
        err instanceof Error ? err.message : "Failed to save settings",
      );
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <Card>
        <p className="font-sans text-sm text-soft-muted">Loading settings…</p>
      </Card>
    );
  }

  return (
    <Card>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="font-sans text-base font-semibold text-soft-stone">
              Search settings
            </h2>
            <p className="mt-1 font-sans text-sm text-soft-muted">
              Filters and board tokens used when you click Run search. Enter
              slugs only (e.g.{" "}
              <span className="font-medium text-soft-stone">airbnb</span>), not
              full URLs. Comma-separate to search multiple companies at once.
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="shrink-0 self-start"
            disabled={busy}
            onClick={() => {
              setRoleKeywords(EXAMPLE_CONFIG.roleKeywords);
              setLocations(EXAMPLE_CONFIG.locations);
              setExperienceLevels(EXAMPLE_CONFIG.experienceLevels);
              setGreenhouseBoards(EXAMPLE_CONFIG.greenhouseBoards);
              setLeverCompanies(EXAMPLE_CONFIG.leverCompanies);
              setAshbyBoards(EXAMPLE_CONFIG.ashbyBoards);
              push(
                "success",
                "Example filled — click Save settings, then Run search",
              );
            }}
          >
            Use example
          </Button>
        </div>

        <Input
          label="Role keywords"
          hint="e.g. software engineer, product manager"
          value={roleKeywords}
          onChange={(e) => setRoleKeywords(e.target.value)}
          placeholder="software engineer, fullstack"
        />
        <Input
          label="Locations"
          hint="Leave empty to match any location"
          value={locations}
          onChange={(e) => setLocations(e.target.value)}
          placeholder="Remote, San Francisco, Bangalore"
        />
        <Input
          label="Experience levels"
          hint="Optional — e.g. senior, staff, mid"
          value={experienceLevels}
          onChange={(e) => setExperienceLevels(e.target.value)}
          placeholder="senior, staff"
        />
        <Input
          label="Greenhouse boards"
          hint="Slug only — boards.greenhouse.io/{token} → enter {token}. Multiple OK."
          value={greenhouseBoards}
          onChange={(e) => setGreenhouseBoards(e.target.value)}
          placeholder="airbnb, phonepe, postman"
        />
        <Input
          label="Lever companies"
          hint="Slug only — jobs.lever.co/{slug} → enter {slug}. Multiple OK."
          value={leverCompanies}
          onChange={(e) => setLeverCompanies(e.target.value)}
          placeholder="leverdemo, spotify"
        />
        <Input
          label="Ashby boards"
          hint="Slug only — jobs.ashbyhq.com/{name} → enter {name}. Multiple OK."
          value={ashbyBoards}
          onChange={(e) => setAshbyBoards(e.target.value)}
          placeholder="notion, openai, linear"
        />

        <div className="flex justify-end">
          <Button type="submit" disabled={busy} variant="secondary">
            {busy ? "Saving…" : "Save settings"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
