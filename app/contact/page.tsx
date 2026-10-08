import type { Metadata } from "next";
import EntityList from "@/app/components/EntityList";
import { emptyCollectionMessage } from "@/lib/entity-rendering.ts";
import JsonLd from "@/app/components/JsonLd";
import { getContacts } from "@/lib/contacts";
import { entityCollectionJsonLd, pageMetadata, pages } from "@/lib/seo";

export const metadata: Metadata = pageMetadata(pages.contacts);

export default async function ContactsPage() {
  const contacts = await getContacts();

  return (
    <div>
      <JsonLd data={entityCollectionJsonLd(pages.contacts, contacts)} />
      <header className="mb-3">
        <h1 className="page-title">联系我</h1>
        <p className="page-description">
          在互联网的这些地方和我建立联系，很期待认识你。
        </p>
      </header>
      <EntityList items={contacts} headingLevel="h2" emptyLabel={emptyCollectionMessage.contact} />
    </div>
  );
}
