export type RecentFile = {
  id: string;
  name: string;
  extension: string;
  label: string;
  lastOpenedAt: string;
};

export const mockRecentFiles: RecentFile[] = [
  {
    id: "1",
    name: "billing-report-march",
    extension: "pdf",
    label: "billing-report-march.pdf",
    lastOpenedAt: "2026-03-10T09:00:00Z",
  },
  {
    id: "2",
    name: "usage-export",
    extension: "csv",
    label: "usage-export.csv",
    lastOpenedAt: "2026-03-10T08:40:00Z",
  },
  {
    id: "3",
    name: "api-schema",
    extension: "json",
    label: "api-schema.json",
    lastOpenedAt: "2026-03-10T08:10:00Z",
  },
  {
    id: "4",
    name: "customer-invoice",
    extension: "docx",
    label: "customer-invoice.docx",
    lastOpenedAt: "2026-03-10T07:50:00Z",
  },
  {
    id: "5",
    name: "dashboard-wireframe",
    extension: "png",
    label: "dashboard-wireframe.png",
    lastOpenedAt: "2026-03-10T07:20:00Z",
  },
  {
    id: "6",
    name: "sprint-notes",
    extension: "txt",
    label: "sprint-notes.txt",
    lastOpenedAt: "2026-03-10T06:55:00Z",
  },
  {
    id: "7",
    name: "quota-rules",
    extension: "xlsx",
    label: "quota-rules.xlsx",
    lastOpenedAt: "2026-03-10T06:30:00Z",
  },
];