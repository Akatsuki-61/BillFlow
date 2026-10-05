"use client";
import Link from "next/link";
import { PageHeader } from "@/components/ui/Workspace";
import { useData } from "@/lib/data/DataProvider";

const project = "https://github.com/Akatsuki-61/BillFlow";
export default function SupportPage() {
  const { isElectron, error } = useData();
  return <div className="workspace-page motion-page">
    <PageHeader title="Support" description="Find workspace controls and report a problem." />
    {error && <p role="alert" className="ui-card p-4 text-content-red-700">{error}</p>}
    <section className="ui-card p-6 space-y-4">
      <h2 className="text-lg font-semibold">Workspace help</h2>
      <div className="flex flex-wrap gap-4">
        <Link href="/settings">Business and payment details</Link>
        <Link href="/settings?tab=data">Backup and restore</Link>
        <Link href="/settings?tab=appearance">Appearance</Link>
        <Link href="/tasks">Task board</Link>
      </div>
      <details><summary>Where is my business data stored?</summary><p className="mt-3 text-content-neutral-600">{isElectron ? "The desktop app saves business records locally. Find the database location and backup controls in Settings." : "Open the desktop app to save workflow records. Browser preview does not verify desktop persistence."}</p></details>
      <details><summary>How do I choose the invoice PDF folder?</summary><p className="mt-3 text-content-neutral-600">Open Settings → Invoices, choose a folder, then save changes. Downloads is the default.</p></details>
      <details><summary>What does task working time measure?</summary><p className="mt-3 text-content-neutral-600">Task details separate total elapsed time from recorded In progress time. Waiting in To do or Review does not count as active time.</p></details>
    </section>
    <section className="ui-card p-6 mt-6 space-y-4">
      <h2 className="text-lg font-semibold">Project resources and feedback</h2>
      <p className="text-content-neutral-600">Use the project repository for existing setup instructions and issue tracking.</p>
      <div className="flex gap-4">
        <a className="ui-button ui-button--secondary" href={`${project}#readme`} target="_blank" rel="noreferrer">Project guide</a>
        <a className="ui-button ui-button--primary" href={`${project}/issues`} target="_blank" rel="noreferrer">Feedback and issues</a>
      </div>
    </section>
  </div>;
}
