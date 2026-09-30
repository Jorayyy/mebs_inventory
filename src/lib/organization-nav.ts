/**
 * Sub-sections of the Organization setup area. Kept as data (not inside the
 * client component) so tests can assert the routes stay stable.
 */
export type OrgSection = {
  label: string;
  href: string;
};

export const ORG_SECTIONS: OrgSection[] = [
  { label: "Overview", href: "/settings/organization" },
  { label: "Company", href: "/settings/organization/company" },
  { label: "Sites", href: "/settings/organization/sites" },
  { label: "Locations", href: "/settings/organization/locations" },
  { label: "Departments", href: "/settings/organization/departments" },
  { label: "Catalogue", href: "/settings/organization/catalog" },
];

export const ORG_SECTION_HREFS: string[] = ORG_SECTIONS.map((section) => section.href);
