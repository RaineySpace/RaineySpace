import type { Metadata } from "next";
import BackButton from "@/app/components/BackButton";
import EntityList from "@/app/components/EntityList";
import { emptyCollectionMessage, entityTitle } from "@/lib/entity-rendering.ts";
import JsonLd from "@/app/components/JsonLd";
import { getContacts } from "@/lib/contacts";
import { collectionJsonLd, pageMetadata, pages } from "@/lib/seo";

export const metadata: Metadata = pageMetadata(pages.contacts);

export default async function ContactsPage() {
  const contacts = await getContacts();

  return (
    <div>
      <JsonLd data={collectionJsonLd(pages.contacts, contacts.map((contact) => ({
        url: contact.url, name: entityTitle(contact), description: contact.description,
      })))} />
      <header className="mb-3">
        <div className="flex items-center gap-2">
          <BackButton iconOnly />
          <h1 className="page-title">联系我</h1>
        </div>
        <p className="page-description">
          在互联网的这些地方和我建立联系，很期待认识你。
        </p>
      </header>
      <EntityList items={contacts} headingLevel="h2" emptyLabel={emptyCollectionMessage.contact} />
    </div>
  );
}
