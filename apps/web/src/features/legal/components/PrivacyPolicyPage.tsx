import { LegalDocumentLayout } from "@/features/legal/components/LegalDocumentLayout";
import {
  APP_NAME,
  APP_PRODUCT_ALIAS,
  LEGAL_CONTACT_EMAIL,
  LEGAL_EFFECTIVE_DATE,
} from "@/lib/constants";
import Link from "next/link";

export function PrivacyPolicyPage() {
  return (
    <LegalDocumentLayout title="Privacy Policy">
      <p>
        <strong className="font-medium text-soft-stone">
          Effective date: {LEGAL_EFFECTIVE_DATE}.
        </strong>{" "}
        This Privacy Policy explains how {APP_NAME} (“{APP_PRODUCT_ALIAS}”,
        “the Service”, “we”, “us”) collects, uses, stores, and shares
        information when you use the Service. It is written for this personal
        project and is not a substitute for advice from a privacy lawyer.
      </p>

      <h2>1. Who we are</h2>
      <p>
        {APP_NAME} is a private, single-user career assistant. Contact:{" "}
        <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a>.
      </p>

      <h2>2. Information we collect</h2>
      <h2 className="!mt-4 !text-base">2.1 Account and identity</h2>
      <ul>
        <li>
          Authentication data via Clerk (for example name, email address,
          profile image, and a Clerk user id such as <code>user_…</code>).
        </li>
        <li>
          Session/cookies required for signed-in access (Clerk session
          cookies).
        </li>
      </ul>
      <h2 className="!mt-4 !text-base">2.2 Career and application content</h2>
      <ul>
        <li>
          Materials you upload: resumes, cover letters, project write-ups,
          notes, and related metadata.
        </li>
        <li>
          Job postings you paste or that the Service discovers (company, title,
          URL, raw text, source, scores, and related fields as features ship).
        </li>
        <li>
          Application drafts (resume bullets, cover letters, custom answers),
          status history, notes, and optional follow-up drafts.
        </li>
        <li>
          Email content you connect or import for classification and draft
          replies (when that module is enabled).
        </li>
        <li>
          Optional company research caches, interview-prep content, and salary
          negotiation drafts.
        </li>
      </ul>
      <h2 className="!mt-4 !text-base">2.3 Technical and runner data</h2>
      <ul>
        <li>
          Basic operational logs (for example API health checks and error
          diagnostics).
        </li>
        <li>
          If you use the local CareerOS Runner: task queue metadata (task type,
          status, payload needed to fill forms, errors). The runner stores a
          scoped access token on your machine; we store only a hash of that
          token server-side when tokens are issued.
        </li>
      </ul>
      <p>
        We do not intentionally collect government ID numbers, payment card
        data, or biometric identifiers for this product.
      </p>

      <h2>3. How we use information</h2>
      <ul>
        <li>To authenticate you and protect your account;</li>
        <li>
          To build and query your knowledge base (chunking, embeddings, RAG);
        </li>
        <li>
          To score jobs, research companies, draft application and email
          content, and track application status;
        </li>
        <li>
          To enqueue and record local runner tasks you approve (non-LinkedIn
          auto-apply only);
        </li>
        <li>To improve reliability, security, and debugging of the Service;</li>
        <li>To communicate with you about the Service if needed.</li>
      </ul>
      <p>
        We do not sell your personal information. We do not use your career
        content to train third-party foundation models beyond what is necessary
        to generate responses through the AI providers you configure (those
        providers’ own policies apply).
      </p>

      <h2>4. AI processing</h2>
      <p>
        When you use AI features, relevant text (for example job descriptions,
        retrieved knowledge chunks, prompts, and drafts) is sent to the
        configured AI provider (such as OpenRouter and/or OpenAI or Anthropic).
        Do not upload secrets you are not willing to expose to those providers.
        AI outputs can be wrong; you must review them before submitting to
        employers.
      </p>

      <h2>5. Where data is stored and who processes it</h2>
      <ul>
        <li>
          <strong>Clerk</strong> — authentication and session management.
        </li>
        <li>
          <strong>Supabase (Postgres + pgvector)</strong> — application data and
          embeddings. Access from our API uses an elevated server key; the
          browser and the local runner do not hold Supabase secrets.
        </li>
        <li>
          <strong>AI providers</strong> — inference for chat and embeddings.
        </li>
        <li>
          <strong>Your device</strong> — the CareerOS Runner and your Chrome
          session cookies for job sites remain on your machine; we do not host
          your job-board login cookies in the cloud API.
        </li>
        <li>
          <strong>Email providers</strong> (if connected later) — inbound mail
          and send flows subject to that provider’s terms.
        </li>
      </ul>
      <p>
        Data may be processed in the regions those providers operate (often
        including the United States, EU, or other regions). Exact locations
        depend on each vendor’s configuration.
      </p>

      <h2>6. Cookies and similar technologies</h2>
      <p>
        We use essential cookies/storage for authentication (Clerk) and basic
        app function. We do not currently run advertising trackers. Browser
        settings can block cookies, but signed-in features may stop working.
      </p>

      <h2>7. Retention</h2>
      <p>
        We retain your account and content for as long as you use the Service
        or until you ask us to delete them (subject to backups and legal
        holds). You may request deletion of your account data by emailing{" "}
        <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a>.
        Deletion from third-party processors may take additional time under
        their procedures.
      </p>

      <h2>8. Security</h2>
      <p>
        We use access controls appropriate to a personal project: split
        secrets by component, RLS deny-public on app tables, and scoped runner
        tokens. No method of transmission or storage is 100% secure. You are
        responsible for securing your device, Chrome profiles, and local runner
        config.
      </p>

      <h2>9. Children</h2>
      <p>
        The Service is not directed to children under 16 (or the age of digital
        consent in your jurisdiction). We do not knowingly collect their data.
      </p>

      <h2>10. Your choices</h2>
      <ul>
        <li>Update or delete uploaded materials in the product UI when available;</li>
        <li>Disconnect third-party integrations you enable;</li>
        <li>
          Request access, correction, or deletion by contacting{" "}
          <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a>;
        </li>
        <li>Stop using the Service and delete your account.</li>
      </ul>
      <p>
        If you are in the EEA/UK or similar jurisdictions, you may have
        additional rights under applicable law (access, erasure, restriction,
        portability, objection). Contact us to exercise them.
      </p>

      <h2>11. International users</h2>
      <p>
        If you access the Service from outside the country where our processors
        host data, you consent to transfer of your information to those
        locations for the purposes described here.
      </p>

      <h2>12. Changes</h2>
      <p>
        We may update this Privacy Policy as features ship (for example email
        ingest or the runner). Material changes will update the effective date.
        Continued use after changes means you accept the revised policy.
      </p>

      <h2>13. Related terms</h2>
      <p>
        Use of the Service is also governed by our{" "}
        <Link href="/terms">Terms of Use</Link>, including limits on automation,
        LinkedIn auto-submit, and human-in-the-loop sending.
      </p>
    </LegalDocumentLayout>
  );
}
