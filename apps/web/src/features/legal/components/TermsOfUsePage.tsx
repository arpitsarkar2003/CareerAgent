import { LegalDocumentLayout } from "@/features/legal/components/LegalDocumentLayout";
import {
  APP_NAME,
  APP_PRODUCT_ALIAS,
  LEGAL_CONTACT_EMAIL,
  LEGAL_EFFECTIVE_DATE,
} from "@/lib/constants";
import Link from "next/link";

export function TermsOfUsePage() {
  return (
    <LegalDocumentLayout title="Terms of Use">
      <p>
        <strong className="font-medium text-soft-stone">
          Effective date: {LEGAL_EFFECTIVE_DATE}.
        </strong>{" "}
        These Terms of Use (“Terms”) govern your access to and use of {APP_NAME}{" "}
        (also referred to as “{APP_PRODUCT_ALIAS}”, “the Service”, “we”, “us”).
        The Service is a personal, single-user career and job-application
        assistant operated for private use.
      </p>
      <p>
        By creating an account or using the Service, you agree to these Terms.
        If you do not agree, do not use the Service. This document is a project
        policy draft, not legal advice from a licensed attorney.
      </p>

      <h2>1. Who this is for</h2>
      <p>
        The Service is designed as a <strong>single-user personal tool</strong>.
        It is not offered as a multi-tenant SaaS product and is not intended for
        use by the general public as a commercial service unless you later
        publish different terms.
      </p>

      <h2>2. What the Service does</h2>
      <p>Depending on features you enable over time, the Service may:</p>
      <ul>
        <li>
          Store a private knowledge base of your resume, cover letters, project
          notes, and related career materials (chunked and embedded for search);
        </li>
        <li>
          Help discover, score, and track job postings against your profile;
        </li>
        <li>
          Research companies and draft tailored application materials and
          answers using AI, grounded in your knowledge base;
        </li>
        <li>
          Draft recruiter email replies, follow-ups, interview prep, and salary
          negotiation messages for your review;
        </li>
        <li>
          Optionally queue approved non-LinkedIn applications for submission via
          a <strong>local CareerOS Runner</strong> on your own machine (browser
          automation attached to your Chrome session), only after an explicit
          action by you.
        </li>
      </ul>

      <h2>3. Human control and hard limits</h2>
      <p>You agree that the following design limits apply:</p>
      <ul>
        <li>
          <strong>No unattended scheduling.</strong> Search and apply runs are
          started by an explicit click in the dashboard—not by cron or a
          silent cloud worker.
        </li>
        <li>
          <strong>LinkedIn is never auto-submitted</strong>, regardless of any
          auto-apply preference. LinkedIn results may be searched and scored but
          stay on a manual-review path.
        </li>
        <li>
          <strong>No cloud browser automation.</strong> Form filling and
          submission via Playwright run only through the local runner on your
          device, not inside the cloud API.
        </li>
        <li>
          <strong>No autonomous email sending.</strong> Replies and follow-ups
          are drafted for your review; you send (or approve send) manually.
        </li>
      </ul>

      <h2>4. Your responsibilities</h2>
      <ul>
        <li>
          You are solely responsible for content you upload (resume, letters,
          notes) and for materials you submit to employers.
        </li>
        <li>
          You must review all AI-generated drafts before use. Outputs may be
          inaccurate, incomplete, or unsuitable.
        </li>
        <li>
          You are responsible for complying with third-party terms of service
          (job boards, LinkedIn, Greenhouse, Lever, Ashby, email providers,
          etc.), including limits on automation, scraping, and account use.
        </li>
        <li>
          Using browser automation or automated access against a site may
          violate that site’s terms and can risk account suspension or ban. You
          accept that risk.
        </li>
        <li>
          You must keep account credentials, runner tokens, and API secrets
          secure and not share them.
        </li>
      </ul>

      <h2>5. Accounts and authentication</h2>
      <p>
        Sign-in is provided via Clerk (for example Google or email-based
        methods you configure). You must keep your login secure. We may
        suspend access if we reasonably believe the account is compromised or
        misused.
      </p>

      <h2>6. Third-party services</h2>
      <p>
        The Service relies on processors such as Clerk (authentication),
        Supabase (database / vector storage), AI providers (e.g. OpenRouter,
        OpenAI, Anthropic), and optionally email or market-data sources. Their
        terms and privacy policies also apply to data they process. We do not
        control those services.
      </p>

      <h2>7. Intellectual property and your data</h2>
      <ul>
        <li>
          You retain ownership of content you upload and drafts you export.
        </li>
        <li>
          You grant us a limited license to process that content solely to
          operate the Service for you (storage, embedding, retrieval, drafting,
          tracking).
        </li>
        <li>
          The Service’s software, branding, and documentation remain with their
          respective owners.
        </li>
      </ul>

      <h2>8. No professional advice</h2>
      <p>
        The Service does not provide legal, immigration, tax, financial, or
        career advice. Drafts and scores are assistive tools only. Hiring and
        negotiation outcomes are outside our control.
      </p>

      <h2>9. Disclaimers</h2>
      <p>
        THE SERVICE IS PROVIDED “AS IS” AND “AS AVAILABLE” WITHOUT WARRANTIES OF
        ANY KIND, EXPRESS OR IMPLIED, INCLUDING MERCHANTABILITY, FITNESS FOR A
        PARTICULAR PURPOSE, AND NON-INFRINGEMENT. We do not warrant uninterrupted
        or error-free operation, or that AI output will be accurate or that job
        applications will succeed.
      </p>

      <h2>10. Limitation of liability</h2>
      <p>
        To the fullest extent permitted by law, we are not liable for indirect,
        incidental, special, consequential, or punitive damages, or for lost
        opportunities, lost offers, account bans, or data loss arising from use
        of the Service, automation, or third-party platforms—even if advised of
        the possibility. Our aggregate liability for claims relating to the
        Service will not exceed the greater of (a) amounts you paid us for the
        Service in the prior 12 months (if any) or (b) USD 50.
      </p>

      <h2>11. Indemnity</h2>
      <p>
        You agree to defend and hold us harmless from claims arising out of your
        use of the Service, your application materials, your violation of these
        Terms, or your violation of third-party terms (including job-board and
        LinkedIn rules).
      </p>

      <h2>12. Changes</h2>
      <p>
        We may update these Terms as the product evolves (for example when new
        agents ship). Continued use after an update constitutes acceptance of
        the revised Terms. The effective date above will be updated when we
        publish material changes.
      </p>

      <h2>13. Contact</h2>
      <p>
        Questions about these Terms:{" "}
        <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a>.
        See also our{" "}
        <Link href="/privacy">Privacy Policy</Link>.
      </p>
    </LegalDocumentLayout>
  );
}
