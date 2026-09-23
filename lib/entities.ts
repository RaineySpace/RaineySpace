/** Canonical registry and rendering contract shared by projects, friends, and contacts. */
export type EntityKind = "project" | "friend" | "contact";
export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export interface EntityExtensions {
  [key: string]: JsonValue | undefined;
}

// Each kind can add typed, optional fields here without changing the shared renderer.
export interface ProjectExtensions {
  [key: string]: JsonValue | undefined;
}
export interface FriendExtensions {
  [key: string]: JsonValue | undefined;
}

export interface ContactExtensions {
  [key: string]: JsonValue | undefined;
}

export interface EntityExtensionsByKind {
  contact: ContactExtensions;
  project: ProjectExtensions;
  friend: FriendExtensions;
}

/** Source JSON: the object key supplies id; the registry file supplies kind. */
export interface EntityDefinition<Extensions extends EntityExtensions = EntityExtensions> {
  name: string;
  title?: string;
  url: string;
  description?: string;
  icon?: string;
  date: string;
  extensions?: Extensions;
}

/** Normalized data. All loaders return this shape without renaming fields. */
export interface Entity<Kind extends EntityKind = EntityKind> {
  id: string;
  kind: Kind;
  name: string;
  title?: string;
  url: string;
  description?: string;
  icon?: string;
  date: Date | null;
  dateText: string;
  extensions: EntityExtensionsByKind[Kind];
}

export interface EntityRenderOptions {
  variant?: "inline" | "card";
  appearance?: "text" | "chip" | "icon";
  /** Only affects inline entities; cards keep their fixed dimensions. */
  size?: "sm" | "md" | "lg";
  showIcon?: boolean;
  hoverCard?: boolean;
  popoverShowIcon?: boolean;
  placement?: "auto" | "top";
  headingLevel?: "h2" | "h3";
  newTab?: boolean;
}
